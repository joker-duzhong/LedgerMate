<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onBackPress, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import CalendarSheet from '@/components/CalendarSheet.vue'
import { useRecordEditor } from '@/composables/useRecordEditor'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { applyAmountKey } from '@/utils/keypad'
import { goHome } from '@/utils/navigation'
import { ensureLogin } from '@/utils/authNavigation'

const editor = useRecordEditor()
const { navigationStyle } = useNavigationLayout()
const {
  draft, paymentOptions, selectedPaymentIndex, filteredCategories, loading, saving,
  busy, fieldsLocked, errorMessage, loadError, pendingCreate, dirty, isEditing, completed,
  load, selectCategory,
} = editor
const calendarOpen = ref(false)
const budgetExcluded = ref(false)
const typeTabs = [
  { key: 'expense', label: '支出' },
  { key: 'income', label: '收入' },
  { key: 'transfer', label: '转账' },
  { key: 'loan', label: '借款' },
  { key: 'ai', label: 'AI记' },
] as const
const keypad = ['1', '2', '3', 'backspace', '4', '5', '6', '+', '7', '8', '9', '-', 'again', '0', '.', 'done'] as const
const formattedDate = computed(() => draft.occurredDate.replace(/-/g, '.'))
const paymentLabel = computed(() => paymentOptions.value[selectedPaymentIndex.value]?.name || '无账户')
let allowLeaving = false
let confirming = false
let refreshOnReturn = false
let continueAfterRetry = false

const leave = () => {
  allowLeaving = true
  // #ifdef MP-WEIXIN
  if (typeof uni.disableAlertBeforeUnload === 'function') uni.disableAlertBeforeUnload({})
  // #endif
  uni.navigateBack({ delta: 1, fail: goHome })
}

const back = () => {
  if (calendarOpen.value) { calendarOpen.value = false; return }
  if (busy.value || confirming) return
  if (!dirty.value) { leave(); return }
  confirming = true
  uni.showModal({
    title: pendingCreate.value ? '这笔账尚未确认' : '放弃这次修改？',
    content: pendingCreate.value ? '保存结果暂未确认，建议留在当前页面重试。现在离开，之后请先在账单中核对，避免重复记录。' : '填写的内容还没有保存，离开后将不会保留。',
    confirmText: '离开', cancelText: '继续记账', confirmColor: '#5B4A16',
    success: ({ confirm }) => { if (confirm) leave() },
    complete: () => { confirming = false },
  })
}

const changePayment = (event: { detail: { value: number | string } }) => {
  if (!fieldsLocked.value) draft.paymentMethodId = paymentOptions.value[Number(event.detail.value)]?.id || ''
}
const changeDate = (value: string) => { if (!fieldsLocked.value) draft.occurredDate = value }
const selectTypeTab = (key: typeof typeTabs[number]['key']) => {
  if (fieldsLocked.value) return
  if (key === 'expense' || key === 'income') editor.changeType(key)
  else uni.showToast({ title: '该类型暂未开放', icon: 'none' })
}
const appendAmount = (key: string) => {
  if (fieldsLocked.value) return
  if (key === '+' || key === '-') { editor.changeType(key === '+' ? 'income' : 'expense'); return }
  draft.amount = applyAmountKey(draft.amount, key)
}
const onKeypad = (key: typeof keypad[number]) => {
  if (key === 'again') { void save(true); return }
  if (key === 'done') { void save(false); return }
  appendAmount(key)
}
const manageCategories = () => {
  if (fieldsLocked.value) return
  refreshOnReturn = true
  uni.navigateTo({ url: `/pages/category-settings/index?section=categories&type=${draft.recordType}${filteredCategories.value.length ? '' : '&add=1'}` })
}
const save = async (continueAdding = false) => {
  if (pendingCreate.value) continueAdding = continueAfterRetry
  else continueAfterRetry = continueAdding
  if (!await editor.save(continueAdding)) {
    if (errorMessage.value) uni.showToast({ title: errorMessage.value, icon: 'none' })
    return
  }
  uni.showToast({ title: isEditing.value ? '修改已保存' : '已记好这一笔', icon: 'success' })
  if (continueAdding && !isEditing.value) {
    uni.pageScrollTo({ scrollTop: 0, duration: 200 })
  } else leave()
}
// #ifdef MP-WEIXIN
watch(dirty, (value) => {
  if (value && typeof uni.enableAlertBeforeUnload === 'function') uni.enableAlertBeforeUnload({ message: '这笔账还没有保存，确定离开吗？' })
  else if (typeof uni.disableAlertBeforeUnload === 'function') uni.disableAlertBeforeUnload({})
})
// #endif
onLoad((query) => { if (ensureLogin()) void load(typeof query?.id === 'string' ? query.id : '') })
onShow(() => {
  if (!ensureLogin()) return
  if (refreshOnReturn) { refreshOnReturn = false; void editor.refreshOptions() }
})
onBackPress(() => {
  if (calendarOpen.value) { calendarOpen.value = false; return true }
  if (allowLeaving) return false
  if (dirty.value || busy.value) { back(); return true }
  return false
})
onUnload(() => { editor.dispose() })
</script>

<template>
  <view class="page-shell editor" :style="navigationStyle">
    <view class="editor-top capsule-safe">
      <button class="close-button" :disabled="busy" aria-label="返回账单" @tap="back"><AppIcon name="close" :size="48" color="#292A25" /></button>
      <view class="type-tabs" role="tablist" aria-label="记账类型">
        <button v-for="tab in typeTabs" :key="tab.key" class="type-tab" :class="{ active: tab.key === draft.recordType, disabled: !['expense', 'income'].includes(tab.key) }" role="tab" :aria-selected="tab.key === draft.recordType" @tap="selectTypeTab(tab.key)">{{ tab.label }}</button>
      </view>
    </view>

    <view v-if="loading" class="card state-card"><AppIcon name="ledger" :size="64" /><text class="state-title">正在打开账本</text><text class="state-copy">马上就好</text></view>
    <view v-else-if="loadError" class="card state-card"><AppIcon name="refresh" :size="64" /><text class="state-title">暂时没有准备好</text><text class="state-copy">{{ loadError }}</text><button class="ghost-button" @tap="load()">重新加载</button></view>

    <template v-else>
      <view class="editor-content">
        <view class="category-grid" role="list" aria-label="选择分类">
          <button v-for="category in filteredCategories" :key="category.id" class="category-option" :class="{ selected: draft.categoryId === category.id }" :disabled="fieldsLocked" :aria-label="`${category.name}${draft.categoryId === category.id ? '，已选中' : ''}`" @tap="selectCategory(category.id)">
            <view class="category-icon"><CategoryIcon :category="category" :size="58" color="color" /></view>
            <text>{{ category.name }}</text>
          </button>
        </view>
        <view v-if="!filteredCategories.length" class="category-empty"><text>还没有{{ draft.recordType === 'expense' ? '支出' : '收入' }}分类</text><button class="ghost-button" @tap="manageCategories">添加第一个分类</button></view>
        <button class="manage-categories" :disabled="fieldsLocked" @tap="manageCategories">管理分类 <AppIcon name="chevron-right" :size="25" color="#75756B" /></button>
      </view>

      <view class="editor-dock">
        <view class="quick-options">
          <button class="quick-option active"><AppIcon name="ledger" :size="32" color="#292A25" /><text>我的账本</text></button>
          <picker class="quick-picker" :range="paymentOptions" range-key="name" :value="selectedPaymentIndex" :disabled="fieldsLocked || !paymentOptions.length" @change="changePayment"><view class="quick-option"><AppIcon name="wallet" :size="32" color="#292A25" /><text>{{ paymentLabel }}</text><AppIcon name="chevron-down" :size="22" color="#75756B" /></view></picker>
          <button class="quick-option" :class="{ active: budgetExcluded }" :disabled="fieldsLocked" @tap="budgetExcluded = !budgetExcluded"><text class="budget-dot">○</text><text>{{ budgetExcluded ? '不计入预算' : '计入预算' }}</text></button>
        </view>

        <view class="amount-card">
          <view class="amount-row">
            <text class="currency">¥</text>
            <input v-model="draft.amount" readonly type="digit" placeholder="0" placeholder-class="amount-placeholder" :disabled="fieldsLocked" :focus="false" :maxlength="10" :adjust-position="false" aria-label="金额，使用下方数字键盘输入" />
            <button class="amount-clear" :disabled="fieldsLocked || !draft.amount" aria-label="清除金额" @tap="draft.amount = ''">×</button>
          </view>
          <view class="entry-row">
            <button class="date-chip" :disabled="fieldsLocked" aria-label="选择记账日期" @tap="calendarOpen = true"><AppIcon name="calendar" :size="31" color="#292A25" /><text>{{ formattedDate.replace(/\./g, '/') }}</text></button>
            <input v-model="draft.note" :disabled="fieldsLocked" maxlength="200" placeholder="写点备注" :cursor-spacing="40" aria-label="备注" />
          </view>
        </view>

        <view v-if="errorMessage" class="form-error editor-error" role="alert">{{ errorMessage }}</view>
        <view v-if="pendingCreate && !saving" class="retry-hint">填写内容已保留，重试会确认同一笔记录。</view>

        <view class="keypad" aria-label="金额键盘">
          <button v-for="key in keypad" :key="key" class="key-cell" :class="{ accent: key === 'done', action: ['backspace', '+', '-', 'again'].includes(key) }" :disabled="busy || completed || (fieldsLocked && key !== 'done')" @tap="onKeypad(key)">
            <AppIcon v-if="key === 'backspace'" name="backspace" :size="42" color="#292A25" />
            <text v-else-if="key === 'again'">再记</text>
            <text v-else-if="key === 'done'">{{ saving ? '保存中' : pendingCreate ? '重试' : '完成' }}</text>
            <text v-else>{{ key }}</text>
          </button>
        </view>
      </view>
    </template>
    <CalendarSheet v-model:show="calendarOpen" :model-value="draft.occurredDate" @confirm="changeDate" />
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.editor { min-height: 100vh; padding-bottom: calc(860rpx + env(safe-area-inset-bottom)); background: #FBF9F0; }
.editor-top { position: relative; z-index: 1; display: flex; align-items: center; gap: 18rpx; margin-bottom: 20rpx; }
.close-button { display: flex; align-items: center; justify-content: center; flex: 0 0 72rpx; width: 72rpx; height: 72rpx; margin: 0; padding: 0; border: 2rpx solid $ink; border-radius: 50%; background: transparent; }
.type-tabs { display: flex; align-items: center; justify-content: space-between; flex: 1; gap: 4rpx; min-width: 0; }
.type-tab { position: relative; flex: 1; margin: 0; padding: 0 4rpx; border: 0; border-radius: 24rpx; background: transparent; color: $muted; font-size: 28rpx; line-height: 76rpx; white-space: nowrap; }
.type-tab.active { color: $ink; font-weight: 700; }
.type-tab.active::after { position: absolute; right: 25%; bottom: 3rpx; left: 25%; height: 7rpx; border-radius: 8rpx; background: #FF991F; content: ''; }
.type-tab.disabled { color: #A8A69D; }
.editor-content { padding-top: 14rpx; }
.category-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 32rpx 6rpx; padding: 4rpx 0 20rpx; }
.category-option { display: flex; align-items: center; flex-direction: column; gap: 12rpx; width: 100%; margin: 0; padding: 0; background: transparent; color: $ink; font-size: 24rpx; line-height: 1.35; }
.category-option > text { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.category-icon { display: flex; align-items: center; justify-content: center; width: 116rpx; height: 116rpx; border: 2rpx solid transparent; border-radius: 50%; background: #FFFFFF; box-shadow: 0 3rpx 10rpx rgba(62, 49, 24, .04); }
.category-option.selected .category-icon { border-color: #FFD33D; background: #FFF1AE; box-shadow: 0 0 0 5rpx rgba(255, 218, 74, .25); }
.category-option.selected { font-weight: 600; }
.category-empty { display: flex; align-items: center; flex-direction: column; gap: 18rpx; padding: 36rpx 28rpx; color: $muted; font-size: 24rpx; }
.category-empty button { margin: 0; }
.manage-categories { display: flex; align-items: center; justify-content: center; gap: 4rpx; width: 100%; margin: 8rpx 0 0; padding: 16rpx; background: transparent; color: $muted; font-size: 23rpx; line-height: 1.4; }
.editor-dock { position: fixed; z-index: 12; right: 0; bottom: 0; left: 0; width: 100%; max-width: 960rpx; max-height: 76vh; box-sizing: border-box; margin: 0 auto; padding: 18rpx 26rpx calc(20rpx + env(safe-area-inset-bottom)); overflow-y: auto; border-top: 2rpx solid #D9BB57; border-radius: 34rpx 34rpx 0 0; background: #FFF0AE; box-shadow: 0 -10rpx 36rpx rgba(90, 73, 22, .08); }
.quick-options { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.quick-option { display: flex; align-items: center; justify-content: center; flex: 1; gap: 6rpx; min-width: 0; margin: 0; padding: 11rpx 14rpx; overflow: hidden; border: 2rpx solid #D8B94E; border-radius: 40rpx; background: #FFFDF6; color: $ink; font-size: 22rpx; line-height: 1.35; white-space: nowrap; }
.quick-option text { overflow: hidden; text-overflow: ellipsis; }
.quick-option.active { background: #FFF8D6; }
.quick-picker { display: block; flex: 1; min-width: 0; }
.quick-picker .quick-option { width: 100%; box-sizing: border-box; }
.budget-dot { color: #F56E43; font-size: 30rpx; line-height: 1; }
.amount-card { padding: 22rpx 26rpx 14rpx; border: 2rpx solid #D8B94E; border-radius: 28rpx; background: #FFFFFF; }
.amount-row { display: flex; align-items: center; min-height: 104rpx; border-bottom: 2rpx solid #E3E0D6; }
.currency { margin-right: 12rpx; color: $income; font-size: 58rpx; font-weight: 600; line-height: 1; }
.amount-row input { flex: 1; min-width: 0; height: 94rpx; color: $income; font-size: 68rpx; font-weight: 600; font-variant-numeric: tabular-nums; }
.amount-placeholder { color: $income; opacity: .65; }
.amount-clear { display: flex; align-items: center; justify-content: center; width: 52rpx; height: 52rpx; margin: 0; padding: 0; border-radius: 50%; background: #D9D9D9; color: #FFFFFF; font-size: 38rpx; line-height: 1; }
.entry-row { display: flex; align-items: center; gap: 16rpx; min-height: 76rpx; }
.date-chip { display: flex; align-items: center; gap: 8rpx; flex-shrink: 0; margin: 0; padding: 10rpx 18rpx; border-radius: 34rpx; background: #F7F7F4; color: $ink; font-size: 24rpx; line-height: 1.4; }
.entry-row > input { flex: 1; min-width: 0; font-size: 25rpx; }
.editor-error { margin: 12rpx 0; }
.retry-hint { margin: 10rpx 0; color: $muted; font-size: 22rpx; line-height: 1.5; }
.keypad { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12rpx; margin-top: 16rpx; }
.key-cell { display: flex; align-items: center; justify-content: center; min-height: 94rpx; margin: 0; padding: 0; border: 2rpx solid #D8B94E; border-radius: 24rpx; background: #FFFFFF; color: $ink; font-size: 40rpx; font-weight: 500; line-height: 1; }
.key-cell.action { font-size: 30rpx; }
.key-cell.accent { border-color: #25B94A; background: #24C543; color: #FFFFFF; font-size: 34rpx; font-weight: 700; }
.key-cell:active { background: #FFF7D7; }
.key-cell.accent:active { background: #20AE3D; }
.state-card { margin-top: 30rpx; padding: 60rpx 28rpx; text-align: center; }
.state-title { display: block; margin: 24rpx 0 12rpx; color: $ink; font-size: 30rpx; font-weight: 600; }
.state-copy { display: block; color: $muted; font-size: 26rpx; line-height: 1.7; }
.state-card .ghost-button { margin: 28rpx auto 0; max-width: 340rpx; }
button::after { border: 0; }
button[disabled] { opacity: .6; }
</style>
