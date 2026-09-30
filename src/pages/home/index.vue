<script setup lang="ts">
import { computed, ref } from 'vue'
import { onHide, onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import H5ChatEntry from '@/components/H5ChatEntry.vue'
import MonthPicker from '@/components/MonthPicker.vue'
import CalendarSheet from '@/components/CalendarSheet.vue'
import { useHomeLedger } from '@/composables/useHomeLedger'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { formatMoney } from '@/utils/format'
import { currentMonth, dayTitle, weekday } from '@/utils/ledger'
import { goChat, syncNativeTab } from '@/utils/navigation'
import { ensureLogin } from '@/utils/authNavigation'

const { month, selectedDate, type, keyword, loading, loaded, loadedMonth, errorMessage, loadedCount, totalCount, monthRecords, visibleRecords, groups, totals, categoryNames, categoryById, isGuest, load, resume, pause, dispose } = useHomeLedger()
const { navigationStyle } = useNavigationLayout()
const searchOpen = ref(false)
const calendarOpen = ref(false)
const filtered = computed(() => type.value !== 'all' || Boolean(keyword.value.trim()) || Boolean(selectedDate.value))
const hasCurrentData = computed(() => loaded.value && loadedMonth.value === month.value)
const monthPeriod = computed(() => {
  const [year, index] = month.value.split('-').map(Number)
  return index + '月01日—' + index + '月' + new Date(year, index, 0).getDate() + '日'
})
const money = (value: number) => hasCurrentData.value ? formatMoney(value) : '—'
const openRecord = (id: string) => { if (ensureLogin()) uni.navigateTo({ url: '/pages/record-detail/index?id=' + encodeURIComponent(id) }) }
const resetFilter = () => { if (!ensureLogin()) return; type.value = 'all'; keyword.value = ''; selectedDate.value = '' }
const selectDate = (value: string) => { if (!ensureLogin()) return; month.value = value.slice(0, 7); selectedDate.value = value }
const manage = (section: string) => { if (ensureLogin()) uni.navigateTo({ url: '/pages/category-settings/index?section=' + section }) }
const openStats = () => { if (ensureLogin()) uni.switchTab({ url: '/pages/statistics/index' }) }
const bookMenu = () => { if (ensureLogin()) uni.showActionSheet({ itemList: ['我的账本 · 当前账本', '账本设置'], success: ({ tapIndex }) => { if (tapIndex === 1) uni.switchTab({ url: '/pages/manage/index' }) } }) }
onShow(() => { syncNativeTab(0); void resume() })
onHide(pause)
onPullDownRefresh(() => load(true))
onUnload(dispose)
</script>

<template>
  <view class="page-shell home-page" :style="navigationStyle">
    <view class="sunshine" />
    <view class="home-top capsule-safe">
      <button class="book-pill" @tap="bookMenu">我的账本<AppIcon name="chevron-down" :size="22" color="#292A25" /></button>
    </view>
    <view class="toolbar">
      <MonthPicker v-model="month" :before-change="ensureLogin" />
      <view class="toolbar-actions">
        <button class="tool-button" aria-label="按日期查看" @tap="ensureLogin() && (calendarOpen = true)"><AppIcon name="calendar" :size="38" color="#5B4A16" /></button>
        <button class="tool-button" aria-label="搜索账单" @tap="ensureLogin() && (searchOpen = !searchOpen)"><AppIcon name="search" :size="36" color="#5B4A16" /></button>
      </view>
    </view>

    <view class="overview card">
      <view class="period-strip"><text>{{ monthPeriod }}</text><button v-if="month !== currentMonth()" @tap="ensureLogin() && (month = currentMonth())">回到本月</button><text v-else>{{ isGuest ? '登录后查看收支' : '收支一目了然' }}</text></view>
      <view class="overview-main">
        <view class="expense-overview"><text class="expense-label">支出</text><text class="hero-amount money">{{ money(totals.expense) }}</text></view>
        <button class="assistant-entry" @tap="goChat"><text>说一说，快速记一笔吧～</text><image src="/static/assistant-duck.png" mode="aspectFill" /></button>
        <view class="minor-totals"><view><text>收入</text><text class="minor-value money">{{ money(totals.income) }}</text></view><view><text>结余</text><text class="minor-value money">{{ money(totals.balance) }}</text></view></view>
      </view>
      <!-- <button class="chat-invitation" @tap="goChat"><text>说一句话，把账记好</text><AppIcon name="chevron-right" :size="28" color="#292A25" /></button> -->
      <view class="quick-actions">
        <button @tap="goChat"><image src="/static/assistant-duck.png" /><text>快速记账</text></button>
        <button @tap="openStats"><AppIcon name="chart" :size="44" /><text>收支统计</text></button>
        <button @tap="manage('payments')"><AppIcon name="wallet" :size="44" /><text>支付方式</text></button>
        <button @tap="manage('categories')"><AppIcon name="ledger" :size="44" /><text>分类管理</text></button>
      </view>
    </view>

    <view class="filter-bar">
      <view class="filters"><button :class="{ active: type === 'all' }" @tap="ensureLogin() && (type = 'all')">全部</button><button :class="{ active: type === 'expense' }" @tap="ensureLogin() && (type = 'expense')">支出</button><button :class="{ active: type === 'income' }" @tap="ensureLogin() && (type = 'income')">收入</button></view>
      <text v-if="hasCurrentData">{{ visibleRecords.length }} 笔</text>
    </view>
    <view v-if="searchOpen && !isGuest" class="search-field"><AppIcon name="search" :size="32" /><input v-model="keyword" placeholder="搜索分类、备注、金额" maxlength="80" confirm-type="search" /><button v-if="keyword" class="icon-button" @tap="ensureLogin() && (keyword = '')"><AppIcon name="close" :size="26" /></button></view>
    <button v-if="selectedDate" class="date-filter" @tap="ensureLogin() && (selectedDate = '')">{{ selectedDate }} · 查看整月<AppIcon name="close" :size="24" /></button>
    <view v-if="loading" class="load-line">{{ hasCurrentData ? '正在更新账单…' : totalCount ? '正在整理 ' + loadedCount + ' / ' + totalCount + ' 笔记录' : '正在打开你的账本…' }}</view>
    <view v-if="errorMessage" class="form-error"><text>{{ errorMessage }}</text><button @tap="ensureLogin() && load(true)">重试</button></view>
    <view v-if="!loading && !errorMessage && !visibleRecords.length" class="card state-card"><image class="empty-duck" src="/static/assistant-duck.png" /><text class="state-title">{{ isGuest ? '登录后查看你的账单' : filtered ? '这里还没有匹配的账单' : '从第一笔小日常开始' }}</text><text class="state-copy">{{ isGuest ? '先看看记账、收支统计和分类管理，登录后开始记录。' : filtered ? '试试其他日期或关键词。' : '说说「午饭35元」，帮你整理这一笔。' }}</text><button class="primary-button" @tap="filtered ? resetFilter() : goChat()">{{ isGuest ? '登录并开始记账' : filtered ? '清除筛选' : '快速记一笔' }}</button></view>
    <view v-if="hasCurrentData && visibleRecords.length" class="records-card card">
      <view v-for="group in groups" :key="group.records[0]?.id" class="day-group">
        <view class="day-heading"><view><text>{{ dayTitle(group.date) }}</text><text class="weekday">{{ weekday(group.date) }}</text></view><view class="day-totals"><text class="income-total">收 {{ formatMoney(group.income) }}</text><text>支 {{ formatMoney(group.expense) }}</text></view></view>
        <button v-for="record in group.records" :key="record.id" class="record-row" @tap="openRecord(record.id)">
          <view class="category-icon"><CategoryIcon :category="categoryById.get(record.category_id)" :name="categoryNames.get(record.category_id) || ''" :size="46" /></view>
          <view class="record-info"><text class="category-name">{{ categoryNames.get(record.category_id) || '未命名分类' }}</text><text v-if="record.note" class="record-note">{{ record.note }}</text></view>
          <text class="record-amount money" :class="{ income: record.record_type === 'income' }">{{ record.record_type === 'expense' ? '−' : '+' }}{{ (record.amount_cent / 100).toFixed(2) }}</text>
        </button>
      </view>
    </view>
    <text v-if="hasCurrentData && monthRecords.length" class="list-end">按创建顺序排列 · 一笔一记，生活有迹</text>
    <CalendarSheet v-model:show="calendarOpen" :model-value="selectedDate || month + '-01'" mode="date" @confirm="selectDate" />
    <H5ChatEntry />
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.home-page { position: relative; padding: var(--app-status-bar-height, 44px) 30rpx 0; @include tab-page-bottom; }
.sunshine { position: absolute; z-index: 0; top: 0; left: 0; right: 0; height: 400rpx; border-radius: 0 0 48rpx 48rpx; background: #FFE477; pointer-events: none; }
.home-top, .toolbar, .overview, .filter-bar, .search-field, .date-filter, .load-line, .records-card, .list-end, .form-error, .state-card { position: relative; }
.home-top { display: flex; align-items: center; margin-bottom: 8rpx; }
.book-pill { display: flex; align-items: center; gap: 10rpx; margin: 0; padding: 0 24rpx; min-height: 62rpx; background: #FFF0A8; border: 2rpx solid #DCC577; border-radius: 40rpx; font-size: 27rpx; line-height: 62rpx; color: $ink; }
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 14rpx; margin: 0 0 22rpx; }
.toolbar-actions { display: flex; gap: 14rpx; }
.tool-button { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; margin: 0; padding: 0; border-radius: 50%; border: 2rpx solid #DCC577; background: #FFF0A8; }
.overview { overflow: hidden; }
.period-strip { display: flex; justify-content: space-between; align-items: center; gap: 12rpx; min-height: 64rpx; padding: 12rpx 28rpx; background: #FFF3BC; color: #797251; font-size: 22rpx; }
.period-strip button { padding: 0; margin: 0; background: transparent; font-size: 22rpx; line-height: 1.5; color: $brand-dark; }
.overview-main { position: relative; padding: 28rpx 30rpx 30rpx; }
.expense-overview { padding-right: 155rpx; }
.expense-label { color: $expense; font-size: 28rpx; }
.hero-amount { display: block; margin: 10rpx 0 28rpx; font-size: 56rpx; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.assistant-entry { position: absolute; top: 16rpx; right: 22rpx; display: flex; flex-direction: column; align-items: center; gap: 8rpx; width: 208rpx; margin: 0; padding: 0; background: transparent; line-height: 1.4; }
.assistant-entry text { font-size: 21rpx; padding: 8rpx 14rpx; border-radius: 16rpx; background: #FFE477; color: $brand-dark; }
.assistant-entry image { width: 128rpx; height: 128rpx; border: 4rpx solid #FFE477; border-radius: 50%; }
.minor-totals { display: flex; gap: 48rpx; }
.minor-totals > view { min-width: 0; max-width: 50%; }
.minor-totals text { display: block; color: $muted; font-size: 26rpx; }
.minor-totals .minor-value { margin-top: 8rpx; color: $ink; font-size: 32rpx; overflow-wrap: anywhere; }
.chat-invitation { display: flex; align-items: center; justify-content: center; gap: 14rpx; padding: 22rpx 0; margin: 0 30rpx; background: transparent; border-top: 1rpx dashed #D9D6CB; border-radius: 0; font-size: 27rpx; line-height: 1.5; color: $ink; }
.quick-actions { display: flex; margin: 0 20rpx 20rpx; padding: 14rpx 0; background: #FFF6D5; border-radius: 28rpx; }
.quick-actions button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10rpx; margin: 0; padding: 6rpx 0; background: transparent; font-size: 21rpx; line-height: 1.5; color: $ink; }
.quick-actions image { width: 44rpx; height: 44rpx; border-radius: 50%; }
.filter-bar { display: flex; align-items: center; justify-content: space-between; margin: 30rpx 0 18rpx; color: $muted; font-size: 23rpx; }
.filters { display: flex; gap: 8rpx; }
.filters button { margin: 0; padding: 0 22rpx; min-height: 66rpx; border-radius: 36rpx; line-height: 66rpx; font-size: 25rpx; color: $muted; background: transparent; }
.filters button.active { background: $brand; color: $ink; }
.search-field { display: flex; align-items: center; gap: 14rpx; min-height: 86rpx; margin-bottom: 20rpx; padding: 0 24rpx; border-radius: 24rpx; background: #FFF; border: 1rpx solid $line; }
.search-field input { flex: 1; min-width: 0; font-size: 27rpx; }.search-field .icon-button { width: 48rpx; }
.date-filter { display: flex; align-items: center; gap: 12rpx; margin: 0 0 20rpx; padding: 10rpx 20rpx; width: fit-content; border-radius: 30rpx; background: $brand-soft; color: $ink; font-size: 23rpx; }
.load-line { padding: 12rpx; color: $muted; font-size: 24rpx; text-align: center; }
.form-error button { margin: 8rpx 0 0; padding: 0; background: transparent; color: $danger; text-decoration: underline; font-size: 26rpx; }
.records-card { padding: 0 30rpx 18rpx; box-shadow: none; }
.day-heading { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10rpx; padding: 26rpx 0 20rpx; border-bottom: 1rpx solid #E4E3DA; font-size: 26rpx; }
.weekday { margin-left: 12rpx; }.day-totals { display: flex; gap: 18rpx; color: $muted; font-size: 23rpx; }.income-total { color: $income; }
.record-row { display: flex; align-items: center; gap: 20rpx; min-height: 122rpx; width: 100%; margin: 0; padding: 20rpx 0; background: transparent; text-align: left; line-height: 1.5; }
.category-icon { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 80rpx; height: 80rpx; border-radius: 50%; background: #F5F4F0; }
.record-info { flex: 1; min-width: 0; }.category-name { display: block; color: $ink; font-size: 29rpx; }.record-note { display: block; font-size: 25rpx; color: $muted; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.record-amount { flex-shrink: 0; max-width: 45%; color: $ink; font-size: 30rpx; overflow-wrap: anywhere; }.record-amount.income { color: $income; }
.empty-duck { width: 120rpx; height: 120rpx; border-radius: 50%; }.list-end { display: block; margin-top: 26rpx; font-size: 22rpx; color: $muted; text-align: center; }
</style>
