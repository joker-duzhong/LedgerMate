<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import { useLedgerSettings } from '@/composables/useLedgerSettings'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { goHome } from '@/utils/navigation'
import { ensureLogin } from '@/utils/authNavigation'

const { navigationStyle } = useNavigationLayout()
const {
  paymentMethods, section, activeType, name, loading, loaded, saving, expanded,
  loadError, formError, visibleCategories, categoryCount, paymentCount,
  load, selectSection, selectType, toggleForm, add,
} = useLedgerSettings()
const canGoBack = ref(false)
const sectionName = computed(() => section.value === 'categories' ? '分类' : '支付方式')
const back = () => { if (!saving.value) uni.navigateBack({ fail: goHome }) }
const save = async () => {
  if (await add()) uni.showToast({ title: '已添加', icon: 'success' })
}

onLoad((query) => {
  canGoBack.value = getCurrentPages().length > 1
  if (query?.section === 'payments' || query?.tab === 'payment') section.value = 'payments'
  if (query?.type === 'income' || query?.record_type === 'income') activeType.value = 'income'
  if (query?.add === '1') expanded.value = true
})
onShow(() => { if (ensureLogin()) void load() })
</script>

<template>
  <view class="settings-page" :style="navigationStyle">
    <view class="settings-header">
    <view class="settings-head capsule-safe">
      <button class="icon-button settings-back" :disabled="saving" aria-label="返回上一页" @tap="back"><AppIcon name="chevron-left" :size="34" color="#292A25" /></button>
      <text class="page-title">记账设置</text>
    </view>
    <text class="page-subtitle settings-subtitle">分类与支付方式，由你整理</text>
    </view>

    <view class="settings-body">
      <view class="account-counts card">
        <view><text class="count-number">{{ loaded ? categoryCount : '—' }}</text><text class="count-label">可用分类</text></view>
        <view class="count-divider" />
        <view><text class="count-number">{{ loaded ? paymentCount : '—' }}</text><text class="count-label">支付方式</text></view>
      </view>

    <view class="settings-switch segmented">
      <button :class="{ active: section === 'categories' }" :disabled="saving" @tap="selectSection('categories')">收支分类</button>
      <button :class="{ active: section === 'payments' }" :disabled="saving" @tap="selectSection('payments')">支付方式</button>
    </view>

    <view v-if="loading" class="card state-card settings-state"><AppIcon name="refresh" :size="42" /><text class="state-title">正在整理你的设置</text><text class="state-copy">很快就好，请稍候。</text></view>
    <view v-else-if="loadError" class="card state-card settings-state"><AppIcon name="ledger" :size="44" /><text class="state-title">暂时没能加载设置</text><text class="state-copy">{{ loadError }}</text><button class="ghost-button retry-button" @tap="load">重新加载</button></view>
    <template v-else>
      <view v-if="section === 'categories'" class="category-toolbar">
        <view class="type-switch"><button :class="{ active: activeType === 'expense' }" :disabled="saving" @tap="selectType('expense')">支出</button><button :class="{ active: activeType === 'income' }" :disabled="saving" @tap="selectType('income')">收入</button></view>
        <text>{{ visibleCategories.length }} 个分类</text>
      </view>

      <view v-if="section === 'categories' && visibleCategories.length" class="card preference-list">
        <view v-for="category in visibleCategories" :key="category.id" class="preference-row" :class="{ inactive: !category.is_enabled }">
          <view class="preference-icon" :class="activeType"><CategoryIcon :category="category" :size="34" color="#292A25" /></view>
          <text class="preference-name">{{ category.name }}</text><text class="preference-tag">{{ !category.is_enabled ? '已停用' : category.is_system ? '预设' : '自定义' }}</text>
        </view>
      </view>
      <view v-else-if="section === 'payments' && paymentMethods.length" class="card preference-list payment-list">
        <view v-for="method in paymentMethods" :key="method.id" class="preference-row" :class="{ inactive: !method.is_enabled }">
          <view class="preference-icon"><AppIcon name="wallet" :size="34" color="#292A25" /></view><text class="preference-name">{{ method.name }}</text><text class="preference-tag" :class="{ default: method.is_default && method.is_enabled }">{{ !method.is_enabled ? '已停用' : method.is_default ? '默认' : '' }}</text>
        </view>
      </view>
      <view v-else class="card state-card settings-state"><AppIcon :name="section === 'categories' ? 'ledger' : 'wallet'" :size="44" /><text class="state-title">还没有{{ sectionName }}</text><text class="state-copy">添加一个常用{{ sectionName }}，下次记账更顺手。</text></view>

      <view class="add-preference" :class="{ expanded }">
        <button class="add-toggle" :disabled="saving" @tap="toggleForm"><AppIcon :name="expanded ? 'close' : 'plus'" :size="30" color="#292A25" /><text>{{ expanded ? '收起新增' : `添加${sectionName}` }}</text></button>
        <view v-if="expanded" class="add-form">
          <text class="input-label">{{ section === 'categories' ? `${activeType === 'expense' ? '支出' : '收入'}分类名称` : '支付方式名称' }}</text>
          <input v-model="name" class="name-input" :disabled="saving" :aria-label="`${sectionName}名称`" maxlength="30" :placeholder="section === 'categories' ? '例如：咖啡、养宠、旅行' : '例如：微信支付、银行卡'" placeholder-class="settings-placeholder" confirm-type="done" @confirm="save" />
          <text v-if="formError" class="inline-error">{{ formError }}</text>
          <view class="add-form-footer"><text>最多 30 个字</text><button class="primary-button add-submit" :disabled="saving" :loading="saving" @tap="save">{{ saving ? '添加中' : '确认添加' }}</button></view>
        </view>
      </view>
      <button v-if="canGoBack" class="return-editor ghost-button" :disabled="saving" @tap="back"><AppIcon name="chevron-left" :size="28" color="#292A25" /><text>完成，返回上一页</text></button>
    </template>

    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';

.settings-page { min-height: 100vh; background: $canvas; padding-bottom: calc(40rpx + env(safe-area-inset-bottom)); }
.settings-header { padding: var(--app-status-bar-height, 44px) 24rpx 50rpx; background: #FFE477; }
.settings-body { position: relative; max-width: 960rpx; margin: -24rpx auto 0; padding: 0 28rpx; }
.settings-head { display: flex; align-items: center; gap: 14rpx; }
.settings-back { flex: 0 0 auto; }
.settings-subtitle { margin: 8rpx 0 0 102rpx; }
.account-counts { display: flex; align-items: center; justify-content: space-around; gap: 20rpx; margin: 0 0 32rpx; padding: 28rpx 22rpx; }
.account-counts > view:not(.count-divider) { display: flex; align-items: baseline; gap: 12rpx; }
.count-number { color: $brand-dark; font-size: 34rpx; font-weight: 600; font-variant-numeric: tabular-nums; }
.count-label { color: $muted; font-size: 23rpx; }
.count-divider { width: 1rpx; height: 36rpx; background: $line; }
.section-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 16rpx; margin: 42rpx 0 22rpx; color: $ink; font-size: 29rpx; font-weight: 600; }
.section-caption { color: $muted; font-size: 20rpx; font-weight: 400; }
.settings-switch { display: grid; grid-template-columns: 1fr 1fr; padding: 7rpx; border-radius: 24rpx; background: #F0EDDF; }
.settings-switch button { min-height: 72rpx; margin: 0; padding: 0 12rpx; border-radius: 13rpx; background: transparent; color: $muted; font-size: 26rpx; line-height: 72rpx; }
.settings-switch button.active { background: #FFE477; color: $ink; font-weight: 600; }
.category-toolbar { display: flex; align-items: center; justify-content: space-between; margin: 24rpx 0 16rpx; }
.category-toolbar > text { color: $muted; font-size: 22rpx; }
.type-switch { display: flex; gap: 10rpx; }
.type-switch button { min-width: 100rpx; margin: 0; padding: 0 22rpx; border-radius: 28rpx; background: transparent; color: $muted; font-size: 25rpx; line-height: 80rpx; }
.type-switch button.active { background: $brand-soft; color: $ink; font-weight: 600; }
.preference-list { overflow: hidden; }
.payment-list { margin-top: 24rpx; }
.preference-row { display: flex; align-items: center; gap: 18rpx; min-height: 102rpx; padding: 0 24rpx; }
.preference-row + .preference-row { border-top: 1rpx solid $line; }
.preference-row.inactive { opacity: .6; }
.preference-icon { display: flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 58rpx; height: 58rpx; border-radius: 18rpx; background: $brand-soft; }
.preference-icon.income { background: #E8F4DB; }
.preference-name { flex: 1; min-width: 0; padding: 20rpx 0; color: $ink; font-size: 27rpx; overflow-wrap: anywhere; }
.preference-tag { flex: 0 0 auto; color: $muted; font-size: 21rpx; }
.preference-tag.default { color: $ink; }
.settings-state { display: flex; flex-direction: column; align-items: center; margin-top: 24rpx; padding: 38rpx 24rpx; }
.settings-state .state-title { margin-top: 20rpx; }
.retry-button { width: 220rpx; min-height: 72rpx; margin: 24rpx 0 0; font-size: 25rpx; }
.add-preference { margin-top: 22rpx; border: 1rpx dashed $line; border-radius: 24rpx; background: $paper; }
.add-preference.expanded { border-style: solid; background: $paper; }
.add-toggle { display: flex; align-items: center; justify-content: center; gap: 10rpx; width: 100%; min-height: 92rpx; margin: 0; padding: 16rpx; background: transparent; color: $ink; font-size: 26rpx; line-height: 1.5; }
.add-form { padding: 0 24rpx 24rpx; }
.input-label { display: block; margin: 10rpx 0 14rpx; color: $ink; font-size: 24rpx; }
.name-input { height: 82rpx; padding: 0 20rpx; border: 1rpx solid $line; border-radius: 14rpx; background: $canvas; color: $ink; font-size: 26rpx; }
.settings-placeholder { color: $muted; font-size: 25rpx; }
.inline-error { display: block; margin-top: 12rpx; color: $danger; font-size: 23rpx; line-height: 1.5; }
.add-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 20rpx; }
.add-form-footer > text { color: $muted; font-size: 21rpx; }
.add-submit { min-height: 72rpx; margin: 0; padding: 0 26rpx; font-size: 25rpx; line-height: 72rpx; }
.return-editor { gap: 8rpx; margin-top: 20rpx; font-size: 25rpx; }
.service-list { overflow: hidden; }
.service-row { display: flex; align-items: center; gap: 18rpx; min-height: 104rpx; margin: 0; padding: 0 24rpx; border-radius: 0; background: transparent; line-height: 1.5; text-align: left; }
.service-row + .service-row { border-top: 1rpx solid $line; }
.service-name { flex: 1; color: $ink; font-size: 26rpx; }
.soon-label { flex: 0 0 auto; color: $muted; font-size: 21rpx; }
.logout-button { display: flex; align-items: center; justify-content: center; gap: 12rpx; min-height: 94rpx; margin: 24rpx 0 0; background: transparent; color: $muted; font-size: 25rpx; }
.settings-signoff { display: block; margin: 4rpx 0 12rpx; color: $muted; font-size: 21rpx; text-align: center; letter-spacing: 2rpx; }
</style>
