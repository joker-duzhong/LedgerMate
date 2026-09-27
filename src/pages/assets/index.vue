<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import H5ChatEntry from '@/components/H5ChatEntry.vue'
import MonthPicker from '@/components/MonthPicker.vue'
import { useMonthAnalysis } from '@/composables/useMonthAnalysis'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { formatMoney } from '@/utils/format'
import { goChat, syncNativeTab } from '@/utils/navigation'
import { ensureLogin } from '@/utils/authNavigation'
import { byCreatedDescending } from '@/utils/ledger'
import { analysisDate, paymentFlows, recordSummary } from '@/utils/statistics'

const { month, snapshot, loading, errorMessage, isGuest, load, dispose } = useMonthAnalysis()
const { navigationStyle } = useNavigationLayout()
const selectedPayment = ref('')
const flows = computed(() => paymentFlows(snapshot.value?.records || [], snapshot.value?.payments || []))
const totals = computed(() => recordSummary(snapshot.value?.records || []))
const selectedFlow = computed(() => flows.value.find((item) => item.id === selectedPayment.value))
const names = computed(() => new Map(snapshot.value?.categories.map((item) => [item.id, item.name]) || []))
const records = computed(() => (snapshot.value?.records || []).filter((record) => (record.payment_method_id || 'unspecified') === selectedPayment.value).slice().sort(byCreatedDescending))
const money = (value: number) => isGuest.value ? '—' : formatMoney(value)
const openRecord = (id: string) => { if (ensureLogin()) uni.navigateTo({ url: `/pages/record-detail/index?id=${encodeURIComponent(id)}` }) }
const addRecord = goChat
watch(month, () => { selectedPayment.value = '' })
onShow(() => { syncNativeTab(1); void load() })
onPullDownRefresh(() => { void load(true) })
onUnload(dispose)
</script>

<template>
  <view class="assets-page" :style="navigationStyle">
    <view class="assets-header"><view class="capsule-safe"><text class="page-name">资产</text></view><view class="month-toolbar"><MonthPicker v-model="month" :before-change="ensureLogin" /></view><text class="header-copy">按支付方式，看看钱的来去</text></view>
    <view class="assets-body">
      <view v-if="loading && !snapshot" class="asset-card state-card"><AppIcon name="wallet" :size="60" /><text class="state-title">正在整理账户收支</text><text class="state-copy">读取所选月份的账单</text></view>
      <view v-if="errorMessage" class="notice" role="alert"><text>{{ errorMessage }}</text><text v-if="snapshot">下方保留 {{ snapshot.month }} 上次成功加载的数据。</text><button @tap="ensureLogin() && load(true)">重新加载</button></view>
      <view v-else-if="loading && snapshot" class="notice"><text>正在更新 {{ month }}，下方暂为 {{ snapshot.month }} 的数据。</text></view>
      <template v-if="snapshot">
        <view class="asset-card flow-summary">
          <view class="summary-top"><text>当月净流入</text><text class="snapshot-month">{{ snapshot.month }}</text></view>
          <text class="net-total" :class="{ negative: totals.balance < 0 }">{{ money(totals.balance) }}</text>
          <view class="flow-totals"><view><text>总收入</text><text class="money-number">{{ money(totals.income) }}</text></view><view><text>总支出</text><text class="money-number">{{ money(totals.expense) }}</text></view></view>
          <view class="balance-note"><AppIcon name="shield" :size="28" color="#75756B" /><text>根据已记录账单统计，净流入不等于账户余额。</text></view>
        </view>

        <view class="section-heading"><text>支付方式收支</text><text v-if="!isGuest">{{ flows.length }} 项 · {{ snapshot.records.length }} 笔</text></view>
        <view v-if="!flows.length" class="asset-card state-card"><AppIcon name="wallet" :size="54" /><text class="state-title">{{ isGuest ? '登录后查看资金流向' : '这个月还没有收支' }}</text><text class="state-copy">记账时选择支付方式，就能在这里查看资金流向。</text><button class="primary-button" @tap="addRecord">{{ isGuest ? '登录并开始记账' : '记一笔' }}</button></view>
        <button v-for="flow in flows" :key="flow.id" class="asset-card payment-card" :class="{ selected: selectedPayment === flow.id }" @tap="ensureLogin() && (selectedPayment = selectedPayment === flow.id ? '' : flow.id)">
          <view class="payment-heading"><view class="payment-icon"><AppIcon name="wallet" :size="38" color="#292A25" /></view><view class="payment-title"><text>{{ flow.name }}</text><text class="payment-count">{{ flow.count }} 笔账单</text></view><AppIcon :name="selectedPayment === flow.id ? 'chevron-down' : 'chevron-right'" :size="26" color="#75756B" /></view>
          <view class="payment-grid"><view><text>收入</text><text>{{ money(flow.income) }}</text></view><view><text>支出</text><text>{{ money(flow.expense) }}</text></view><view><text>净流入</text><text :class="{ negative: flow.balance < 0 }">{{ money(flow.balance) }}</text></view></view>
        </button>

        <view v-if="selectedFlow" class="asset-card payment-details"><view class="details-heading"><text>{{ selectedFlow.name }}的明细</text><button aria-label="收起明细" @tap="ensureLogin() && (selectedPayment = '')"><AppIcon name="close" :size="26" color="#75756B" /></button></view><button v-for="record in records" :key="record.id" class="payment-record" @tap="openRecord(record.id)"><view><text>{{ names.get(record.category_id) || '未命名分类' }}</text><text class="record-note">{{ analysisDate(record) }}{{ record.note ? ' · ' + record.note : '' }}</text></view><text class="record-amount">{{ record.record_type === 'income' ? '+' : '−' }}{{ formatMoney(record.amount_cent) }}</text></button></view>
        <text class="assets-footer">仅汇总所选月份的记录，不包含期初余额。</text>
      </template>
    </view>
    <H5ChatEntry />
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.assets-page { min-height: 100vh; background: $canvas; @include tab-page-bottom; }
.assets-header { background: $brand; padding: var(--app-status-bar-height, 44px) 32rpx 56rpx; }
.page-name { display: block; color: $ink; font-size: 38rpx; font-weight: 650; }
.month-toolbar { margin-top: 10rpx; }
.header-copy { display: block; color: $brand-dark; font-size: 24rpx; margin-top: 8rpx; }
.assets-body { position: relative; max-width: 960rpx; margin: -26rpx auto 0; padding: 0 26rpx; }
.asset-card { display: block; width: 100%; padding: 28rpx; margin: 0 0 24rpx; border: 1rpx solid $line; border-radius: 28rpx; background: $paper; box-shadow: 0 6rpx 0 rgba(191,166,89,.16); }
.summary-top { display: flex; align-items: center; justify-content: space-between; color: $ink; font-size: 28rpx; font-weight: 600; }
.snapshot-month { color: $muted; font-size: 23rpx; font-weight: 400; }
.net-total { display: block; margin: 22rpx 0 30rpx; color: $income; font-size: 58rpx; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.negative { color: $danger !important; }
.flow-totals { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 22rpx; padding-bottom: 28rpx; }
.flow-totals text { display: block; color: $muted; font-size: 23rpx; }
.flow-totals .money-number { margin-top: 8rpx; color: $ink; font-size: 30rpx; font-weight: 600; overflow-wrap: anywhere; }
.balance-note { display: flex; gap: 12rpx; align-items: flex-start; padding-top: 22rpx; border-top: 1rpx dashed $line; color: $muted; font-size: 23rpx; line-height: 1.6; }
.balance-note text { flex: 1; }
.section-heading { display: flex; align-items: baseline; justify-content: space-between; margin: 38rpx 2rpx 20rpx; color: $ink; font-size: 30rpx; font-weight: 600; }
.section-heading text:last-child { color: $muted; font-size: 22rpx; font-weight: 400; }
.payment-card { line-height: 1.5; text-align: left; }
.payment-card.selected { border-color: #BC9F31; }
.payment-heading { display: flex; align-items: center; gap: 18rpx; }
.payment-icon { display: flex; align-items: center; justify-content: center; width: 70rpx; height: 70rpx; border-radius: 22rpx; background: $brand-soft; }
.payment-title { flex: 1; min-width: 0; font-size: 28rpx; color: $ink; }
.payment-title text { display: block; }
.payment-count { margin-top: 5rpx; color: $muted; font-size: 21rpx; }
.payment-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14rpx; margin-top: 26rpx; padding-top: 22rpx; border-top: 1rpx solid #F0ECDF; }
.payment-grid text { display: block; color: $muted; font-size: 22rpx; }
.payment-grid text:last-child { margin-top: 8rpx; color: $income; font-size: 26rpx; font-weight: 600; overflow-wrap: anywhere; }
.details-heading { display: flex; align-items: center; justify-content: space-between; font-size: 27rpx; font-weight: 600; }
.details-heading button { display: flex; align-items: center; justify-content: center; width: 70rpx; height: 70rpx; margin: 0; padding: 0; background: transparent; }
.payment-record { display: flex; align-items: center; gap: 16rpx; width: 100%; margin: 0; padding: 24rpx 0; border-radius: 0; background: transparent; text-align: left; line-height: 1.5; }
.payment-record + .payment-record { border-top: 1rpx solid #F0ECDF; }
.payment-record > view { flex: 1; min-width: 0; }
.payment-record text { display: block; font-size: 25rpx; }
.payment-record .record-note { margin-top: 6rpx; color: $muted; font-size: 21rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.record-amount { color: $income; font-weight: 600; }
.assets-footer { display: block; margin: 32rpx 0; color: $muted; text-align: center; font-size: 22rpx; }
.notice { margin-bottom: 24rpx; padding: 22rpx; border-radius: 18rpx; background: #FFF2C6; color: $brand-dark; font-size: 24rpx; }
.notice text { display: block; }
.notice button { padding: 10rpx 0 0; margin: 0; background: transparent; color: $brand-dark; text-align: left; font-size: 24rpx; }
</style>
