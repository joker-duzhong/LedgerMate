<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onHide, onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import H5ChatEntry from '@/components/H5ChatEntry.vue'
import LedgerChart from '@/components/LedgerChart.vue'
import MonthPicker from '@/components/MonthPicker.vue'
import { useMonthAnalysis } from '@/composables/useMonthAnalysis'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { formatMoney } from '@/utils/format'
import { syncNativeTab } from '@/utils/navigation'
import { ensureLogin, openLogin } from '@/utils/authNavigation'
import { analysisDate, averageDayCount, categoryRanking, dailyAverage, detailRanking, recordSummary, recordTrend } from '@/utils/statistics'
import type { RecordType } from '@/types/api'

const { month, snapshot, loading, errorMessage, stale, isGuest, load, resume, pause, dispose } = useMonthAnalysis(true)
const { navigationStyle } = useNavigationLayout()
const trendType = ref<'expense' | 'income' | 'balance'>('expense')
const chartKind = ref<'bar' | 'line'>('bar')
const categoryType = ref<RecordType>('expense')
const showAllDetails = ref(false)
const selectedDay = ref(0)
const summary = computed(() => {
  const data = snapshot.value?.statistics
  return data ? { income: data.income_cent, expense: data.expense_cent, balance: data.balance_cent } : recordSummary(snapshot.value?.records || [])
})
const analysisMonth = computed(() => snapshot.value?.month || month.value)
const days = computed(() => averageDayCount(analysisMonth.value))
const overview = computed(() => [
  { label: '收入', amount: summary.value.income }, { label: '支出', amount: summary.value.expense }, { label: '结余', amount: summary.value.balance },
  { label: '日均收入', amount: dailyAverage(summary.value.income, days.value) }, { label: '日均支出', amount: dailyAverage(summary.value.expense, days.value) }, { label: '日均结余', amount: dailyAverage(summary.value.balance, days.value) },
])
const trend = computed(() => recordTrend(snapshot.value?.records || [], analysisMonth.value))
const selectedTrend = computed(() => trend.value[selectedDay.value] || trend.value[0])
const trendValues = computed(() => trend.value.map((row) => row[trendType.value]))
const rank = computed(() => categoryRanking(snapshot.value?.records || [], snapshot.value?.categories || [], categoryType.value))
const rankTotal = computed(() => rank.value.reduce((sum, row) => sum + row.amount, 0))
const details = computed(() => detailRanking(snapshot.value?.records || [], categoryType.value))
const visibleDetails = computed(() => showAllDetails.value ? details.value : details.value.slice(0, 3))
const names = computed(() => new Map(snapshot.value?.categories.map((category) => [category.id, category.name]) || []))
const categoryFor = (id: string) => snapshot.value?.categories.find((category) => category.id === id) || null
const typeTitle = computed(() => categoryType.value === 'expense' ? '支出' : '收入')
const selectedTitle = computed(() => ({ expense: '支出', income: '收入', balance: '结余' })[trendType.value])
const share = (percentage: number) => percentage > 0 && percentage < .1 ? '<0.1%' : `${percentage.toFixed(1)}%`
const money = (value: number) => isGuest.value ? '—' : formatMoney(value)
const openRecord = (id: string) => { if (ensureLogin()) uni.navigateTo({ url: `/pages/record-detail/index?id=${encodeURIComponent(id)}` }) }
watch([month, categoryType], () => { showAllDetails.value = false; selectedDay.value = 0 })
onShow(() => { syncNativeTab(2); void resume() })
onHide(pause)
onPullDownRefresh(() => { void load(true) })
onUnload(dispose)
</script>

<template>
  <view class="analysis-page" :style="navigationStyle">
    <view class="yellow-header"><view class="capsule-safe"><text class="analysis-title">收支统计</text></view><view class="month-toolbar"><MonthPicker v-model="month" :before-change="ensureLogin" /></view><text class="header-note">每一笔记录，都有迹可循</text></view>
    <view class="analysis-body">
      <view v-if="loading && !snapshot" class="analysis-card state-card"><AppIcon name="chart" :size="56" /><text class="state-title">正在整理收支</text><text class="state-copy">正在读取所选月份的完整记录</text></view>
      <view v-if="errorMessage" class="refresh-notice" role="alert"><text>{{ errorMessage }}</text><text v-if="snapshot">下方保留 {{ snapshot.month }} 上次成功加载的数据。</text><button @tap="ensureLogin() && load(true)">重新加载</button></view>
      <view v-else-if="loading && snapshot" class="refresh-notice"><text>正在更新 {{ month }}，下方暂为 {{ snapshot.month }} 的数据。</text></view>
      <template v-if="snapshot">
        <view class="analysis-card overview-card">
          <view class="card-heading"><text>收支总览</text><text class="subtle">{{ isGuest ? '登录后查看收支' : analysisMonth + ' · ' + snapshot.records.length + ' 笔' }}</text></view>
          <view class="overview-grid"><view v-for="(item, index) in overview" :key="item.label" class="overview-item" :class="{ secondary: index > 2 }"><text class="metric-label">{{ item.label }}</text><text class="metric-number" :class="{ negative: item.amount < 0 }">{{ money(item.amount) }}</text></view></view>
          <text class="average-note">{{ isGuest ? '记录收入与支出，了解每月收支变化' : '日均按' + days + '个自然日计算' + (analysisMonth === month ? '' : '，显示上次成功月份') }}</text>
        </view>

        <view class="analysis-card trend-card">
          <view class="card-heading"><text>每日趋势</text><view class="view-switch"><button :class="{ active: chartKind === 'bar' }" @tap="ensureLogin() && (chartKind = 'bar')">柱状</button><button :class="{ active: chartKind === 'line' }" @tap="ensureLogin() && (chartKind = 'line')">折线</button></view></view>
          <view class="pill-tabs"><button :class="{ active: trendType === 'expense' }" @tap="ensureLogin() && (trendType = 'expense')">支出</button><button :class="{ active: trendType === 'income' }" @tap="ensureLogin() && (trendType = 'income')">收入</button><button :class="{ active: trendType === 'balance' }" @tap="ensureLogin() && (trendType = 'balance')">结余</button></view>
          <view class="trend-current"><text>{{ isGuest ? '登录后查看每日趋势' : selectedTrend?.date + ' ' + selectedTitle }}</text><text>{{ money(selectedTrend?.[trendType] || 0) }}</text></view>
          <button v-if="isGuest" class="empty-section guest-trend" @tap="openLogin"><AppIcon name="chart" :size="48" /><text>登录后查看每日收支趋势</text></button>
          <template v-else>
            <LedgerChart :kind="chartKind" :values="trendValues" :labels="trend.map(day => day.label)" :colors="['#27AE60']" :height="340" @select="ensureLogin() && (selectedDay = $event)" />
            <scroll-view scroll-x class="date-options" :show-scrollbar="false"><view class="date-options-inner"><button v-for="(day, index) in trend" :key="day.date" :class="{ active: selectedDay === index }" :aria-label="`${day.date}${selectedTitle}${formatMoney(day[trendType])}`" @tap="ensureLogin() && (selectedDay = index)">{{ day.label }}日</button></view></scroll-view>
          </template>
        </view>

        <view class="analysis-card category-card">
          <view class="card-heading"><text>分类排行</text><view class="view-switch"><button :class="{ active: categoryType === 'expense' }" @tap="ensureLogin() && (categoryType = 'expense')">支出</button><button :class="{ active: categoryType === 'income' }" @tap="ensureLogin() && (categoryType = 'income')">收入</button></view></view>
          <view v-if="rank.length" class="ring-wrap"><LedgerChart kind="ring" :values="rank.map(row => row.amount)" :colors="rank.map(row => row.color)" :labels="rank.map(row => row.name)" :height="330" /><view class="ring-center"><text>总{{ typeTitle }}</text><text class="ring-total">{{ formatMoney(rankTotal) }}</text></view></view>
          <view v-for="(item, index) in rank" :key="item.key" class="rank-row"><text class="rank-index">{{ index + 1 }}</text><view class="category-icon" :style="{ backgroundColor: item.color + '40' }"><CategoryIcon :category="categoryFor(item.key)" :name="item.name" :size="34" color="#292A25" /></view><view class="rank-copy"><view class="rank-top"><text>{{ item.name }}<text class="count">{{ item.count }} 笔</text></text><text>{{ formatMoney(item.amount) }}</text></view><view class="share-row"><view class="share-track"><view :style="{ width: item.percentage + '%', backgroundColor: item.color }" /></view><text>{{ share(item.percentage) }}</text></view></view></view>
          <view v-if="!rank.length" class="empty-section"><AppIcon name="chart" :size="48" /><text>{{ isGuest ? '登录后查看分类排行' : '这个月还没有' + typeTitle + '记录' }}</text></view>
        </view>

        <view class="analysis-card details-card">
          <view class="card-heading"><text>{{ typeTitle }}明细排行</text><text class="subtle">按金额从高到低</text></view>
          <button v-for="(record, index) in visibleDetails" :key="record.id" class="detail-row" @tap="openRecord(record.id)"><text class="detail-medal" :class="{ top: index < 3 }">{{ index + 1 }}</text><view class="detail-copy"><text>{{ names.get(record.category_id) || '未命名分类' }}</text><text class="detail-date">{{ analysisDate(record) }}{{ record.note ? ' · ' + record.note : '' }}</text></view><text class="detail-amount">{{ formatMoney(record.amount_cent) }}</text><AppIcon name="chevron-right" :size="22" color="#75756B" /></button>
          <text v-if="!details.length" class="empty-detail">{{ isGuest ? '登录后查看收支明细排行' : '暂无' + typeTitle + '明细' }}</text>
          <button v-if="details.length > 3" class="more-button" @tap="ensureLogin() && (showAllDetails = !showAllDetails)">{{ showAllDetails ? '收起明细' : `查看更多（共 ${details.length} 笔）` }}<AppIcon :name="showAllDetails ? 'chevron-left' : 'chevron-down'" :size="24" color="#75756B" /></button>
        </view>
        <text class="page-end">{{ stale ? '数据未更新，请重试后查看最新结果' : '认真记录，慢慢看清生活' }}</text>
      </template>
    </view>
    <H5ChatEntry />
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.analysis-page { min-height: 100vh; background: $canvas; @include tab-page-bottom; }
.yellow-header { background: $brand; padding: var(--app-status-bar-height, 44px) 32rpx 56rpx; }
.analysis-title { display: block; color: $ink; font-size: 38rpx; font-weight: 650; }
.month-toolbar { margin-top: 10rpx; }
.header-note { display: block; color: $brand-dark; font-size: 24rpx; margin-top: 8rpx; }
.analysis-body { max-width: 960rpx; margin: -26rpx auto 0; padding: 0 26rpx; position: relative; }
.analysis-card { margin-bottom: 24rpx; padding: 28rpx; border: 1rpx solid $line; border-radius: 28rpx; background: $paper; box-shadow: 0 6rpx 0 rgba(191,166,89,.16); }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; font-size: 29rpx; font-weight: 650; }
.subtle { color: $muted; font-size: 21rpx; font-weight: 400; }
.overview-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); margin-top: 20rpx; }
.overview-item { padding: 20rpx 8rpx; text-align: center; min-width: 0; }
.overview-item.secondary { border-top: 1rpx dashed #E6E0C9; }
.metric-label { display: block; margin-bottom: 10rpx; color: $muted; font-size: 23rpx; }
.metric-number { display: block; color: $income; font-size: 27rpx; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.metric-number.negative { color: $danger; }
.average-note { display: block; text-align: center; color: $muted; font-size: 20rpx; margin-top: 8rpx; }
.view-switch { display: flex; background: #F5F2E8; border-radius: 14rpx; padding: 4rpx; }
.view-switch button { margin: 0; padding: 0 20rpx; min-height: 62rpx; line-height: 62rpx; border-radius: 12rpx; color: $muted; background: transparent; font-size: 23rpx; }
.view-switch button.active { color: $ink; background: $brand; font-weight: 600; }
.pill-tabs { display: flex; gap: 20rpx; margin: 24rpx 0; }
.pill-tabs button { min-width: 104rpx; min-height: 64rpx; margin: 0; padding: 0 24rpx; line-height: 64rpx; border-radius: 32rpx; background: #F6F4EB; color: $muted; font-size: 24rpx; }
.pill-tabs button.active { color: $brand-dark; background: $brand-soft; font-weight: 600; }
.trend-current { display: flex; justify-content: space-between; gap: 20rpx; color: $muted; font-size: 23rpx; margin-bottom: 12rpx; }
.trend-current text:last-child { color: $ink; font-weight: 600; }
.date-options { margin-top: 10rpx; white-space: nowrap; }
.date-options-inner { display: inline-flex; gap: 8rpx; }
.date-options button { flex-shrink: 0; min-width: 76rpx; margin: 0; padding: 0 12rpx; line-height: 64rpx; background: transparent; color: $muted; font-size: 22rpx; border-radius: 14rpx; }
.date-options button.active { background: $brand-soft; color: $brand-dark; }
.ring-wrap { position: relative; width: 380rpx; max-width: 100%; margin: 10rpx auto; }
.ring-center { position: absolute; left: 18%; top: 38%; width: 64%; text-align: center; color: $muted; font-size: 22rpx; pointer-events: none; }
.ring-center text { display: block; }
.ring-total { margin-top: 6rpx; color: $ink; font-size: 28rpx; font-weight: 600; overflow-wrap: anywhere; }
.rank-row { display: flex; align-items: center; gap: 14rpx; padding: 22rpx 0; }
.rank-row + .rank-row { border-top: 1rpx solid #F0ECDF; }
.rank-index { width: 25rpx; flex-shrink: 0; color: $muted; font-size: 23rpx; }
.category-icon { display: flex; align-items: center; justify-content: center; width: 60rpx; height: 60rpx; border-radius: 18rpx; flex-shrink: 0; }
.rank-copy { flex: 1; min-width: 0; }
.rank-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12rpx; font-size: 25rpx; }
.count { margin-left: 10rpx; font-size: 21rpx; color: $muted; }
.share-row { display: flex; align-items: center; gap: 14rpx; margin-top: 12rpx; color: $muted; font-size: 21rpx; }
.share-track { flex: 1; height: 8rpx; background: #F4F1E6; border-radius: 6rpx; overflow: hidden; }
.share-track view { height: 100%; border-radius: inherit; }
.share-row > text { width: 78rpx; text-align: right; }
.detail-row { display: flex; align-items: center; gap: 14rpx; width: 100%; margin: 0; padding: 24rpx 0; background: transparent; text-align: left; line-height: 1.5; border-radius: 0; }
.detail-row + .detail-row { border-top: 1rpx solid #F0ECDF; }
.detail-medal { width: 40rpx; height: 40rpx; line-height: 40rpx; text-align: center; border-radius: 50%; color: $muted; font-size: 23rpx; flex-shrink: 0; }
.detail-medal.top { background: $brand-soft; color: $brand-dark; font-weight: 600; }
.detail-copy { flex: 1; min-width: 0; font-size: 25rpx; }
.detail-copy text { display: block; }
.detail-date { margin-top: 5rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: $muted; font-size: 20rpx; }
.detail-amount { color: $income; font-size: 25rpx; font-weight: 600; }
.more-button { display: flex; align-items: center; justify-content: center; gap: 10rpx; width: 100%; margin: 0; padding: 14rpx; background: transparent; color: $muted; font-size: 24rpx; }
.empty-section { display: flex; align-items: center; flex-direction: column; gap: 22rpx; padding: 52rpx 0; color: $muted; font-size: 25rpx; }
.guest-trend { width: 100%; margin: 0; background: transparent; line-height: 1.5; }
.empty-detail { display: block; padding: 30rpx 0; text-align: center; color: $muted; font-size: 24rpx; }
.refresh-notice { margin-bottom: 24rpx; padding: 22rpx; border-radius: 18rpx; background: #FFF2C6; color: $brand-dark; font-size: 24rpx; }
.refresh-notice text { display: block; }
.refresh-notice button { padding: 10rpx 0 0; margin: 0; color: $brand-dark; background: transparent; text-align: left; font-size: 24rpx; }
.page-end { display: block; margin-top: 32rpx; text-align: center; color: $muted; font-size: 22rpx; }
</style>
