<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import CalendarSheet from '@/components/CalendarSheet.vue'
import { calendarDate, calendarMonth, moveCalendarMonth } from '@/utils/calendar'

const props = defineProps<{ modelValue: string; beforeChange?: () => boolean }>()
const emit = defineEmits<{ 'update:modelValue': [month: string] }>()
const show = ref(false)
const title = computed(() => {
  const value = calendarMonth(props.modelValue)
  return value ? `${value.year}年${value.month}月` : '选择月份'
})
const canChange = () => props.beforeChange?.() !== false
const open = () => { if (canChange()) show.value = true }
const change = (value: string) => { if (canChange()) emit('update:modelValue', value) }
const move = (offset: number) => {
  if (!canChange()) return
  const value = calendarMonth(props.modelValue)
  if (!value) return
  const next = moveCalendarMonth(value.year, value.month, offset)
  emit('update:modelValue', calendarDate(next.year, next.month, 1).slice(0, 7))
}
</script>

<template>
  <view class="month-picker">
    <button class="icon-button month-arrow" aria-label="上个月" :disabled="modelValue <= '1900-01'" @tap="move(-1)"><AppIcon name="chevron-left" color="#292A25" :size="30" /></button>
    <button class="month-control month-label" aria-label="选择月份" @tap="open"><text>{{ title }}</text></button>
    <button class="icon-button month-arrow" aria-label="下个月" :disabled="modelValue >= '9998-12'" @tap="move(1)"><AppIcon name="chevron-right" color="#292A25" :size="30" /></button>
    <CalendarSheet v-model:show="show" :model-value="modelValue" mode="month" @confirm="change" />
  </view>
</template>

<style scoped lang="scss">
@import '@/styles/theme.scss';
.month-picker { display: inline-flex; align-items: center; gap: 8rpx; }
.month-picker .month-arrow { width: 56rpx; height: 56rpx; border-radius: 18rpx; background: $brand; }
.month-control { min-width: 196rpx; }
.month-label { display: flex; align-items: center; justify-content: center; gap: 12rpx; min-height: 80rpx; margin: 0; padding: 0 12rpx; background: transparent; color: $ink; font-size: 28rpx; font-weight: 600; }
button::after { border: 0; }
</style>
