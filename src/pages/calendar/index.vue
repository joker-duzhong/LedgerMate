<script setup lang="ts">
import { computed, watch } from 'vue'
import { onLoad, onPullDownRefresh, onShow, onUnload } from '@dcloudio/uni-app'
import AppIcon from '@/components/AppIcon.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'
import MonthPicker from '@/components/MonthPicker.vue'
import { useHomeLedger } from '@/composables/useHomeLedger'
import { useNavigationLayout } from '@/composables/useNavigationLayout'
import { calendarDate, calendarMonth, moveCalendarMonth, parseCalendarDate, todayDate } from '@/utils/calendar'
import { dailyCalendarCells, type DailyCalendarCell } from '@/utils/dailyCalendar'
import { formatMoney } from '@/utils/format'
import { goHome, setTabBarHidden } from '@/utils/navigation'
import { dayTitle, weekday } from '@/utils/ledger'
import { ensureLogin } from '@/utils/authNavigation'

const { month, selectedDate, loading, loaded, loadedMonth, errorMessage, monthRecords, groups, totals, categoryNames, categoryById, resume, load, pause, dispose } = useHomeLedger()
const { navigationStyle } = useNavigationLayout()
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const currentDate = todayDate()
const monthParts = computed(() => calendarMonth(month.value) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
const cells = computed(() => dailyCalendarCells(monthParts.value.year, monthParts.value.month, monthRecords.value))
const selectedDay = computed(() => selectedDate.value || `${month.value}-01`)
const selectedGroup = computed(() => groups.value.find((group) => group.date === selectedDay.value))
const selectedRecords = computed(() => selectedGroup.value?.records || [])
const selectedIncome = computed(() => selectedGroup.value?.income || 0)
const selectedExpense = computed(() => selectedGroup.value?.expense || 0)
const monthReady = computed(() => loaded.value && loadedMonth.value === month.value)
const amountLabel = (cell: DailyCalendarCell) => {
  const balance = cell.balance
  if (!balance && cell.income && cell.expense) return '收支'
  if (!balance) return ''
  const value = formatMoney(Math.abs(balance)).slice(1)
  return (balance > 0 ? '+' : '−') + value
}
const tone = (cell: DailyCalendarCell) => {
  const amount = Math.abs(cell.balance) || cell.expense || cell.income
  if (!amount) return ''
  if (amount >= 200000) return 'tone-4'
  if (amount >= 100000) return 'tone-3'
  if (amount >= 50000) return 'tone-2'
  return 'tone-1'
}
const chooseDay = (date: string) => {
  if (!ensureLogin()) return
  const parsed = parseCalendarDate(date)
  if (!parsed) return
  month.value = date.slice(0, 7)
  selectedDate.value = date
}
const moveMonth = (offset: number) => {
  if (!ensureLogin()) return
  const next = moveCalendarMonth(monthParts.value.year, monthParts.value.month, offset)
  month.value = calendarDate(next.year, next.month, 1).slice(0, 7)
  selectedDate.value = `${month.value}-01`
}
const goToday = () => {
  if (!ensureLogin()) return
  month.value = currentDate.slice(0, 7)
  selectedDate.value = currentDate
}
const openRecord = (id: string) => { if (ensureLogin()) uni.navigateTo({ url: `/pages/record-detail/index?id=${encodeURIComponent(id)}` }) }
const addRecord = () => { if (ensureLogin()) uni.navigateTo({ url: `/pages/record-editor/index?date=${encodeURIComponent(selectedDay.value)}` }) }
const bookMenu = () => { if (ensureLogin()) uni.showActionSheet({ itemList: ['我的账本 · 当前账本', '账本设置'], success: ({ tapIndex }) => { if (tapIndex === 1) uni.switchTab({ url: '/pages/manage/index' }) } }) }
const back = () => { setTabBarHidden(false); uni.navigateBack({ delta: 1, fail: goHome }) }

onLoad((query) => {
  if (!ensureLogin()) return
  if (typeof query?.month === 'string') {
    try {
      const decoded = decodeURIComponent(query.month)
      if (/^\d{4}-\d{2}$/.test(decoded) && calendarMonth(decoded)) month.value = decoded
    } catch { /* malformed navigation input falls back to the current month */ }
  }
  if (typeof query?.date === 'string' && parseCalendarDate(query.date)) selectedDate.value = query.date
  if (!selectedDate.value || !selectedDate.value.startsWith(month.value)) selectedDate.value = month.value === currentDate.slice(0, 7) ? currentDate : `${month.value}-01`
})
watch(month, (value) => { if (!selectedDate.value.startsWith(value)) selectedDate.value = `${value}-01` })
onShow(() => { setTabBarHidden(true); if (ensureLogin()) void resume() })
onPullDownRefresh(() => { if (ensureLogin()) void load(true) })
onUnload(() => { setTabBarHidden(false); pause(); dispose() })
</script>

<template>
  <view class="page-shell calendar-page" :style="navigationStyle">
    <view class="calendar-hero">
      <view class="calendar-head capsule-safe">
        <button class="icon-button calendar-back" aria-label="返回首页" @tap="back"><AppIcon name="chevron-left" :size="42" color="#292A25" /></button>
        <text class="calendar-title">日历视图</text>
        <button class="book-pill" @tap="bookMenu">我的账本<AppIcon name="chevron-down" :size="22" color="#292A25" /></button>
      </view>
      <view class="calendar-toolbar">
        <view class="month-nav"><button class="month-arrow" aria-label="上个月" @tap="moveMonth(-1)"><AppIcon name="chevron-left" :size="30" color="#292A25" /></button><MonthPicker v-model="month" :before-change="ensureLogin" /><button class="month-arrow" aria-label="下个月" @tap="moveMonth(1)"><AppIcon name="chevron-right" :size="30" color="#292A25" /></button></view>
        <button class="today-button" @tap="goToday">回今天</button>
      </view>
    </view>

    <view class="month-summary card"><text>{{ month }}-01 — {{ month }}-{{ new Date(monthParts.year, monthParts.month, 0).getDate() }}</text><AppIcon name="chart" :size="30" color="#5B4A16" /><view class="summary-grid"><view><text>月收入</text><strong class="income">{{ monthReady ? formatMoney(totals.income) : '—' }}</strong></view><view><text>月支出</text><strong class="expense">{{ monthReady ? formatMoney(totals.expense) : '—' }}</strong></view><view><text>月结余</text><strong :class="totals.balance >= 0 ? 'income' : 'expense'">{{ monthReady ? formatMoney(totals.balance) : '—' }}</strong></view></view></view>

    <view class="calendar-card card">
      <view class="weekday-row"><text v-for="day in weekdays" :key="day">周{{ day }}</text></view>
      <view class="calendar-grid">
        <button v-for="cell in cells" :key="cell.date" class="calendar-cell" :class="[{ adjacent: !cell.currentMonth, selected: selectedDay === cell.date, 'income-cell': cell.balance > 0, 'expense-cell': cell.balance < 0 }, tone(cell)]" :disabled="cell.disabled" @tap="chooseDay(cell.date)">
          <text class="cell-day">{{ cell.day }}</text><text v-if="amountLabel(cell)" class="cell-amount">{{ amountLabel(cell) }}</text>
        </button>
      </view>
    </view>

    <view class="day-card card">
      <view class="day-heading"><view><text class="day-date">{{ dayTitle(selectedDay) }}</text><text class="day-weekday">{{ weekday(selectedDay) }}</text></view><view class="day-totals"><text class="income">收 {{ formatMoney(selectedIncome) }}</text><text class="expense">支 {{ formatMoney(selectedExpense) }}</text></view></view>
      <view v-if="loading && !monthReady" class="day-state"><AppIcon name="refresh" :size="42" /><text>正在整理这一天的账单</text></view>
      <view v-else-if="errorMessage" class="day-state error"><text>{{ errorMessage }}</text><button @tap="load(true)">重试</button></view>
      <view v-else-if="!selectedRecords.length" class="day-state"><AppIcon name="ledger" :size="42" /><text>这一天还没有账单</text><button class="ghost-button" @tap="addRecord">记一笔</button></view>
      <template v-else><button v-for="record in selectedRecords" :key="record.id" class="record-row" @tap="openRecord(record.id)"><view class="category-icon"><CategoryIcon :category="categoryById.get(record.category_id)" :name="categoryNames.get(record.category_id) || ''" :size="48" /></view><view class="record-info"><text class="category-name">{{ categoryNames.get(record.category_id) || '未命名分类' }}</text><text v-if="record.note" class="record-note">{{ record.note }}</text></view><text class="record-amount money" :class="{ income: record.record_type === 'income', expense: record.record_type === 'expense' }">{{ record.record_type === 'income' ? '+' : '−' }}{{ formatMoney(record.amount_cent) }}</text></button></template>
      <button v-if="selectedRecords.length" class="add-record" aria-label="新增账单" @tap="addRecord"><AppIcon name="plus" :size="46" color="#292A25" /></button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.calendar-page { padding: 0 28rpx calc(80rpx + env(safe-area-inset-bottom)); background: $canvas; }
.calendar-hero { margin: 0 -28rpx; padding: var(--app-status-bar-height, 44px) 28rpx 30rpx; background: #FFE477; border-radius: 0 0 38rpx 38rpx; }
.calendar-head { display: flex; align-items: center; gap: 16rpx; min-height: var(--app-nav-bar-height, 44px); padding-right: 0; }
.calendar-back { width: 68rpx; height: 68rpx; }.calendar-title { flex: 1; color: $ink; font-size: 38rpx; font-weight: 600; }.book-pill { display: flex; align-items: center; gap: 8rpx; min-height: 62rpx; margin: 0; padding: 0 20rpx; border: 2rpx solid #DCC577; border-radius: 34rpx; background: #FFF0A8; color: $ink; font-size: 24rpx; line-height: 62rpx; }
.calendar-toolbar { display: flex; align-items: center; justify-content: space-between; margin-top: 22rpx; }.month-nav { display: flex; align-items: center; gap: 4rpx; }.month-arrow { display: flex; align-items: center; justify-content: center; width: 58rpx; height: 58rpx; margin: 0; padding: 0; border-radius: 50%; background: $brand; }.month-nav :deep(.month-picker) { gap: 0; }.month-nav :deep(.month-picker .month-arrow) { display: none; }.month-nav :deep(.month-label) { min-width: 226rpx; min-height: 62rpx; font-size: 31rpx; }.today-button { min-height: 62rpx; margin: 0; padding: 0 26rpx; border: 2rpx solid #DCC577; border-radius: 34rpx; background: #FFF0A8; color: $brand-dark; font-size: 25rpx; line-height: 62rpx; }
.month-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 10rpx; margin-top: 26rpx; padding: 22rpx 26rpx 24rpx; color: #797251; font-size: 25rpx; }.summary-grid { display: flex; width: 100%; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx dashed #E2D6B3; }.summary-grid > view { flex: 1; padding: 0 14rpx; border-right: 1rpx dashed #E2D6B3; }.summary-grid > view:last-child { border-right: 0; }.summary-grid text, .summary-grid strong { display: block; }.summary-grid text { color: $muted; font-size: 22rpx; }.summary-grid strong { margin-top: 7rpx; font-size: 27rpx; font-weight: 500; }
.income { color: $income; }.expense { color: $danger; }
.calendar-card { margin-top: 20rpx; padding: 22rpx 14rpx 24rpx; }.weekday-row, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8rpx; }.weekday-row { margin-bottom: 10rpx; color: $muted; font-size: 22rpx; text-align: center; }.weekday-row text { padding: 8rpx 0; }.calendar-cell { display: flex; align-items: center; flex-direction: column; justify-content: center; min-width: 0; height: 102rpx; margin: 0; padding: 7rpx 2rpx 5rpx; border: 2rpx solid transparent; border-radius: 19rpx; background: #F7F6F2; color: $ink; line-height: 1.15; }.calendar-cell.adjacent { background: #FAFAF7; color: #C4C5BF; }.calendar-cell.selected { border-color: #B69F4A; box-shadow: 0 2rpx 0 #B69F4A; background: $brand; color: $ink; }.calendar-cell.income-cell { background: #D8F3E0; }.calendar-cell.expense-cell { background: #FDE4DC; }.calendar-cell.selected.income-cell { background: #BDE9CC; }.calendar-cell.selected.expense-cell { background: #FFC5B7; }.calendar-cell.tone-2 { filter: saturate(1.12); }.calendar-cell.tone-3, .calendar-cell.tone-4 { filter: saturate(1.28) brightness(.98); }.cell-day { font-size: 28rpx; font-weight: 600; }.cell-amount { max-width: 100%; margin-top: 8rpx; overflow: hidden; font-size: 17rpx; text-overflow: ellipsis; white-space: nowrap; }.calendar-cell[disabled] { opacity: .65; }
.day-card { position: relative; margin-top: 22rpx; padding: 0 26rpx 28rpx; }.day-heading { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; min-height: 100rpx; border-bottom: 1rpx solid #E9E5D9; }.day-date { color: $ink; font-size: 29rpx; }.day-weekday { margin-left: 12rpx; color: $muted; font-size: 24rpx; }.day-totals { display: flex; gap: 16rpx; font-size: 22rpx; }.day-state { display: flex; align-items: center; flex-direction: column; gap: 14rpx; padding: 44rpx 0 22rpx; color: $muted; font-size: 24rpx; text-align: center; }.day-state button { min-height: 68rpx; margin-top: 6rpx; padding: 0 26rpx; line-height: 68rpx; font-size: 24rpx; }.day-state.error { color: $danger; }.day-state.error button { padding: 0; background: transparent; text-decoration: underline; color: $danger; }.record-row { display: flex; align-items: center; gap: 18rpx; width: 100%; min-height: 116rpx; margin: 0; padding: 18rpx 0; background: transparent; text-align: left; }.category-icon { display: flex; align-items: center; justify-content: center; flex: 0 0 76rpx; width: 76rpx; height: 76rpx; border-radius: 50%; background: #F5F4F0; }.record-info { flex: 1; min-width: 0; }.category-name, .record-note { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.category-name { color: $ink; font-size: 28rpx; }.record-note { margin-top: 5rpx; color: $muted; font-size: 23rpx; }.record-amount { flex-shrink: 0; max-width: 42%; overflow-wrap: anywhere; font-size: 28rpx; }.add-record { position: absolute; right: 28rpx; bottom: -52rpx; display: flex; align-items: center; justify-content: center; width: 104rpx; height: 104rpx; margin: 0; padding: 0; border: 2rpx solid #E2C83E; border-radius: 50%; background: $brand; box-shadow: 0 5rpx 0 #D5BA36; }
button::after { border: none; }
</style>
