<script setup lang="ts">
import { computed } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { useRecordDetail } from '@/composables/useRecordDetail'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { formatMoney } from '@/utils/format'
import { goHome } from '@/utils/navigation'
import { ensureLogin } from '@/utils/authNavigation'

const detail = useRecordDetail()
const { navigationStyle } = useNavigationLayout()
const { record, loading, deleting, deleted, errorMessage, loadError, category, categoryName, paymentName, sourceName, load } = detail
const dateLabel = computed(() => record.value?.occurred_date?.replace(/-/g, '.') || '日期未提供')
let confirming = false
let refreshOnReturn = false
const back = () => { if (!deleting.value) uni.navigateBack({ delta: 1, fail: goHome }) }
const edit = () => {
  if (!record.value || deleting.value || deleted.value) return
  refreshOnReturn = true
  uni.navigateTo({ url: `/pages/record-editor/index?id=${encodeURIComponent(record.value.id)}` })
}
const remove = () => {
  if (deleting.value || confirming) return
  confirming = true
  uni.showModal({
    title: '删除这笔账单？', content: '删除后无法恢复，确认不再保留这笔记录吗？',
    confirmText: '删除', cancelText: '保留', confirmColor: '#B94738',
    success: async ({ confirm }) => {
      if (!confirm || !await detail.remove()) return
      uni.showToast({ title: '账单已删除', icon: 'success' })
      back()
    },
    complete: () => { confirming = false },
  })
}
onLoad((query) => { if (ensureLogin()) void load(typeof query?.id === 'string' ? query.id : '') })
onShow(() => { if (ensureLogin() && refreshOnReturn) { refreshOnReturn = false; void load() } })
onUnload(detail.dispose)
</script>

<template>
  <view class="page-shell detail-page" :style="navigationStyle">
    <view class="detail-header capsule-safe"><button class="icon-button detail-back" :disabled="deleting" aria-label="返回" @tap="back"><AppIcon name="chevron-left" color="#292A25" :size="42" /></button><text class="detail-title">账单详情</text></view>
    <view v-if="loading" class="card state-card"><AppIcon name="ledger" :size="64" color="#292A25" /><text class="state-title">正在打开这笔账单</text><text class="state-copy">稍等一下，马上就好</text></view>
    <view v-else-if="loadError" class="card state-card"><AppIcon name="refresh" :size="64" color="#292A25" /><text class="state-title">暂时无法查看</text><text class="state-copy">{{ loadError }}</text><button class="ghost-button" @tap="load()">重新加载</button></view>
    <template v-else-if="record">
      <view class="detail-card">
        <view class="receipt-top"><view class="detail-category-icon"><CategoryIcon :category="category" :name="categoryName" :size="56" color="#292A25" /></view><text class="detail-category-name">{{ categoryName }}</text><text class="record-kind">{{ record.record_type === 'income' ? '收入' : '支出' }}</text><text class="detail-amount money" :class="record.record_type">{{ record.record_type === 'income' ? '+' : '−' }}{{ formatMoney(record.amount_cent) }}</text></view>
        <view class="receipt-divider"><view class="receipt-notch left" /><view class="receipt-notch right" /></view>
        <view class="receipt-fields">
          <view class="detail-field"><text class="detail-label">备注</text><text class="detail-value note-value" :class="{ muted: !record.note }">{{ record.note || '还没有备注' }}</text></view>
          <view class="detail-field"><text class="detail-label">支付方式</text><text class="detail-value">{{ paymentName }}</text></view>
          <view class="detail-field"><text class="detail-label">记账日期</text><text class="detail-value">{{ dateLabel }}</text></view>
          <view class="detail-field"><text class="detail-label">记账方式</text><text class="detail-value">{{ sourceName }}</text></view>
        </view>
        <view class="receipt-footer"><AppIcon name="check" :size="25" color="#75756B" /><text>生活的这一笔，已经记好了</text></view>
      </view>
      <view v-if="errorMessage" class="form-error detail-error" role="alert">{{ errorMessage }}</view>
      <view class="detail-actions"><button class="delete-action" :disabled="deleting || deleted" :loading="deleting" @tap="remove"><AppIcon v-if="!deleting" name="trash" :size="34" color="#B94738" />删除</button><button class="primary-button edit-action" :disabled="deleting || deleted" @tap="edit"><AppIcon name="edit" :size="32" color="#292A25" />编辑账单</button></view>
    </template>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.detail-page { padding-bottom: calc(180rpx + env(safe-area-inset-bottom)); }
.detail-header { display: flex; align-items: center; gap: 20rpx; margin-bottom: 38rpx; }
.detail-back { width: 70rpx; height: 70rpx; }
.detail-title { color: $ink; font-size: 34rpx; font-weight: 600; }
.detail-card { overflow: hidden; border: 1rpx solid $line; border-radius: 34rpx; background: $paper; }
.receipt-top { display: flex; align-items: center; flex-direction: column; padding: 52rpx 32rpx 44rpx; }
.detail-category-icon { display: flex; align-items: center; justify-content: center; width: 104rpx; height: 104rpx; margin-bottom: 20rpx; border-radius: 34rpx; background: $brand; }
.detail-category-name { color: $ink; font-size: 34rpx; font-weight: 600; }
.record-kind { margin-top: 18rpx; color: $muted; font-size: 23rpx; }
.detail-amount { max-width: 100%; margin-top: 12rpx; color: $expense; font-size: 67rpx; font-weight: 650; line-height: 1.3; overflow-wrap: anywhere; }
.detail-amount.income { color: $income; }
.receipt-divider { position: relative; margin: 0 26rpx; border-top: 2rpx dashed $line; }
.receipt-notch { position: absolute; top: -15rpx; width: 30rpx; height: 30rpx; border: 1rpx solid $line; border-radius: 50%; background: $canvas; }
.receipt-notch.left { left: -42rpx; }.receipt-notch.right { right: -42rpx; }
.receipt-fields { display: flex; flex-direction: column; gap: 32rpx; padding: 40rpx 38rpx; }
.detail-field { display: flex; align-items: flex-start; justify-content: space-between; gap: 30rpx; font-size: 27rpx; line-height: 1.6; }
.detail-label { flex-shrink: 0; color: $muted; }
.detail-value { min-width: 0; color: $ink; text-align: right; overflow-wrap: anywhere; }
.note-value { white-space: pre-wrap; }.detail-value.muted { color: $muted; }
.receipt-footer { display: flex; align-items: center; justify-content: center; gap: 10rpx; padding: 26rpx 18rpx; border-top: 1rpx solid #F0EFE8; color: $muted; font-size: 22rpx; }
.detail-error { margin-top: 26rpx; }
.detail-actions { position: fixed; right: 0; bottom: 0; left: 0; display: flex; gap: 20rpx; max-width: 960rpx; margin: 0 auto; padding: 24rpx 36rpx calc(24rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid $line; background: $canvas; }
.delete-action { display: flex; align-items: center; justify-content: center; gap: 10rpx; flex: 0 0 184rpx; min-height: 96rpx; margin: 0; padding: 0 20rpx; border: 1rpx solid $line; border-radius: 24rpx; background: $paper; color: $danger; font-size: 28rpx; line-height: 1.4; }
.edit-action { flex: 1; color: $ink; }
button::after { border: 0; }
</style>
