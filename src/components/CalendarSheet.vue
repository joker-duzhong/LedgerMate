<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { calendarDate, calendarDays, calendarMonth, calendarYearPage, MAX_CALENDAR_YEAR, MIN_CALENDAR_YEAR, moveCalendarMonth, parseCalendarDate, todayDate } from '@/utils/calendar'
import { setTabBarHidden, TAB_PATHS } from '@/utils/navigation'

const props = withDefaults(defineProps<{ show: boolean; modelValue: string; mode?: 'date' | 'month' }>(), { mode: 'date' })
const emit = defineEmits<{ 'update:show': [show: boolean]; 'update:modelValue': [value: string]; confirm: [value: string] }>()
const selected = ref(todayDate())
const today = ref(todayDate())
const year = ref(new Date().getFullYear())
const month = ref(new Date().getMonth() + 1)
const yearPage = ref(calendarYearPage(year.value))
const panel = ref<'days' | 'months' | 'years'>('days')
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const months = Array.from({ length: 12 }, (_, index) => index + 1)
const years = computed(() => Array.from({ length: 12 }, (_, index) => yearPage.value + index).filter((item) => item <= MAX_CALENDAR_YEAR))
const days = computed(() => calendarDays(year.value, month.value))
const selectedMonth = computed(() => selected.value.slice(0, 7))
const browsingMonth = computed(() => calendarDate(year.value, month.value, 1).slice(0, 7))
const previousDisabled = computed(() => panel.value === 'years' ? yearPage.value <= MIN_CALENDAR_YEAR : panel.value === 'months' ? year.value <= MIN_CALENDAR_YEAR : browsingMonth.value <= '1900-01')
const nextDisabled = computed(() => panel.value === 'years' ? yearPage.value + 12 > MAX_CALENDAR_YEAR : panel.value === 'months' ? year.value >= MAX_CALENDAR_YEAR : browsingMonth.value >= '9998-12')
let tabBarHidden = false
const currentRoute = () => getCurrentPages()[getCurrentPages().length - 1]?.route || ''

const restoreTabBar = () => {
  if (!tabBarHidden) return
  tabBarHidden = false
  setTabBarHidden(false)
}
const close = () => { emit('update:show', false) }
const reset = () => {
  today.value = todayDate()
  const initialDate = parseCalendarDate(props.modelValue)
  const initial = initialDate || calendarMonth(props.modelValue) || parseCalendarDate(today.value)!
  year.value = initial.year
  month.value = initial.month
  selected.value = calendarDate(initial.year, initial.month, initialDate?.day || 1)
  yearPage.value = calendarYearPage(initial.year)
  panel.value = props.mode === 'month' ? 'months' : 'days'
}
const move = (offset: number) => {
  if (offset < 0 && previousDisabled.value || offset > 0 && nextDisabled.value) return
  if (panel.value === 'years') yearPage.value += offset * 12
  else if (panel.value === 'months') year.value += offset
  else {
    const next = moveCalendarMonth(year.value, month.value, offset)
    year.value = next.year
    month.value = next.month
  }
}
const showYears = () => { yearPage.value = calendarYearPage(year.value); panel.value = panel.value === 'years' ? (props.mode === 'month' ? 'months' : 'days') : 'years' }
const showMonths = () => { panel.value = panel.value === 'months' && props.mode === 'date' ? 'days' : 'months' }
const chooseYear = (value: number) => { year.value = value; panel.value = 'months' }
const chooseMonth = (value: number) => {
  month.value = value
  if (props.mode === 'month') selected.value = calendarDate(year.value, value, 1)
  else panel.value = 'days'
}
const chooseDay = (value: string) => {
  const parsed = parseCalendarDate(value)
  if (!parsed) return
  selected.value = value
  year.value = parsed.year
  month.value = parsed.month
}
const chooseToday = () => {
  chooseDay(today.value)
  yearPage.value = calendarYearPage(year.value)
  panel.value = props.mode === 'month' ? 'months' : 'days'
}
const confirm = () => {
  const value = props.mode === 'month' ? selectedMonth.value : selected.value
  emit('update:modelValue', value)
  emit('confirm', value)
  close()
}

watch(() => props.show, (show) => {
  if (show) {
    reset()
    uni.hideKeyboard()
    const route = currentRoute()
    if (route !== 'pages/ai-chat/index' && TAB_PATHS.some((path) => path === '/' + route)) {
      setTabBarHidden(true)
      tabBarHidden = true
    }
  } else restoreTabBar()
}, { immediate: true })
onUnmounted(restoreTabBar)
</script>

<template>
  <view v-if="show" class="calendar-overlay">
    <view class="calendar-backdrop" @tap="close" @touchmove.stop.prevent />
    <view class="calendar-sheet" role="dialog" aria-modal="true" :aria-label="mode === 'month' ? '选择月份' : '选择日期'" @tap.stop>
      <view class="sheet-handle" />
      <view class="sheet-heading"><text>{{ mode === 'month' ? '选择月份' : '选择日期' }}</text><button class="calendar-close" aria-label="关闭日历" @tap="close"><AppIcon name="close" color="#75756B" :size="36" /></button></view>
      <view class="calendar-header">
        <button class="calendar-arrow" :disabled="previousDisabled" :aria-label="panel === 'days' ? '上个月' : '上一组年份'" @tap="move(-1)"><AppIcon name="chevron-left" color="#292A25" :size="34" /></button>
        <view class="calendar-title"><button :class="{ chosen: panel === 'years' }" @tap="showYears">{{ panel === 'years' ? yearPage + '–' + Math.min(yearPage + 11, MAX_CALENDAR_YEAR) : year + '年' }}<AppIcon name="chevron-down" color="#292A25" :size="22" /></button><button v-if="panel !== 'years'" :class="{ chosen: panel === 'months' }" @tap="showMonths">{{ month }}月<AppIcon name="chevron-down" color="#292A25" :size="22" /></button></view>
        <button class="calendar-arrow" :disabled="nextDisabled" :aria-label="panel === 'days' ? '下个月' : '下一组年份'" @tap="move(1)"><AppIcon name="chevron-right" color="#292A25" :size="34" /></button>
      </view>
      <view v-if="panel === 'days'" class="calendar-body">
        <view class="calendar-week"><text v-for="day in weekdays" :key="day">{{ day }}</text></view>
        <view class="calendar-grid"><button v-for="day in days" :key="day.date" class="calendar-day" :class="{ adjacent: !day.currentMonth, selected: selected === day.date, today: today === day.date }" :disabled="day.disabled" :aria-label="day.date + (today === day.date ? '，今天' : '')" :aria-pressed="selected === day.date" @tap="chooseDay(day.date)"><text>{{ day.day }}</text><text v-if="day.date === today" class="today-label">今</text></button></view>
      </view>
      <view v-else-if="panel === 'months'" class="choice-grid"><button v-for="value in months" :key="value" class="choice-button" :class="{ selected: selectedMonth === calendarDate(year, value, 1).slice(0, 7) }" @tap="chooseMonth(value)">{{ value }}月</button></view>
      <view v-else class="choice-grid"><button v-for="value in years" :key="value" class="choice-button" :class="{ selected: year === value }" @tap="chooseYear(value)">{{ value }}年</button></view>
      <view class="calendar-footer"><button class="calendar-today" @tap="chooseToday">{{ mode === 'month' ? '本月' : '今天' }}</button><button class="calendar-confirm" @tap="confirm">确定</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.calendar-overlay { position: fixed; z-index: 1000; inset: 0; }
.calendar-backdrop { position: absolute; inset: 0; background: rgba(24, 25, 21, .38); }
.calendar-sheet { position: absolute; right: 0; bottom: 0; left: 0; max-width: 960rpx; max-height: 94vh; overflow-y: auto; margin: 0 auto; padding: 18rpx 32rpx calc(28rpx + env(safe-area-inset-bottom)); border-radius: 44rpx 44rpx 0 0; background: $paper; box-sizing: border-box; }
.sheet-handle { width: 64rpx; height: 8rpx; margin: 0 auto 22rpx; border-radius: 8rpx; background: #DEDED7; }
.sheet-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18rpx; font-size: 30rpx; font-weight: 600; color: $ink; }
.calendar-close { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; margin: 0; padding: 0; background: transparent; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; margin-bottom: 24rpx; }
.calendar-arrow { display: flex; align-items: center; justify-content: center; flex: 0 0 64rpx; height: 64rpx; margin: 0; padding: 0; border-radius: 20rpx; background: $brand; }
.calendar-arrow[disabled] { opacity: .3; }
.calendar-title { display: flex; align-items: center; justify-content: center; gap: 10rpx; }
.calendar-title button { display: flex; align-items: center; justify-content: center; gap: 10rpx; min-height: 66rpx; margin: 0; padding: 0 12rpx; border-radius: 14rpx; background: transparent; color: $ink; font-size: 31rpx; font-weight: 600; }
// .calendar-title .chosen { background: $brand-soft; }
.calendar-week, .calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10rpx 8rpx; }
.calendar-week { margin-bottom: 14rpx; color: $muted; font-size: 25rpx; text-align: center; }
.calendar-week text { padding: 10rpx 0; }
.calendar-day { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 78rpx; min-width: 0; margin: 0; padding: 0 0 6rpx; border: 2rpx solid transparent; border-radius: 20rpx; background: transparent; color: $ink; font-size: 29rpx; line-height: 1.2; }
.calendar-day.adjacent { color: #B8B9AE; }
.calendar-day.today { border-color: $brand; }
.calendar-day.selected { border-color: $brand; background: $brand; color: $ink; font-weight: 700; }
.today-label { position: absolute; right: 0; bottom: 4rpx; left: 0; color: $muted; font-size: 16rpx; text-align: center; }
.choice-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18rpx; min-height: 440rpx; padding: 12rpx 0; }
.choice-button { display: flex; align-items: center; justify-content: center; min-height: 82rpx; width: 100%; margin: 0; padding: 0; border-radius: 20rpx; background: transparent; color: $ink; font-size: 28rpx; }
.choice-button.selected { background: $brand; font-weight: 700; }
.calendar-footer { display: flex; gap: 18rpx; margin-top: 30rpx; padding-top: 22rpx; border-top: 1rpx solid #EEEDE6; }
.calendar-today { flex: 0 0 132rpx; margin: 0; padding: 0; border: 1rpx solid $line; border-radius: 24rpx; background: $paper; color: $ink; font-size: 28rpx; line-height: 90rpx; }
.calendar-confirm { display: flex; align-items: center; justify-content: center; flex: 1; gap: 16rpx; margin: 0; padding: 0 20rpx; border-radius: 24rpx; background: $brand; color: $ink; font-size: 30rpx; font-weight: 600; line-height: 90rpx; }
.calendar-confirm text { font-size: 23rpx; font-weight: 400; }
button::after { border: none; }
</style>
