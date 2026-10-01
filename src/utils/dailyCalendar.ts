import type { RecordItem } from '@/types/api'
import { calendarDays, type CalendarDay } from '@/utils/calendar'
import { recordDate } from '@/utils/ledger'

export interface DailyCalendarCell extends CalendarDay {
  income: number
  expense: number
  balance: number
}

export const dailyCalendarCells = (year: number, month: number, records: RecordItem[]): DailyCalendarCell[] => {
  const totals = new Map<string, { income: number; expense: number }>()
  records.forEach((record) => {
    const date = recordDate(record)
    if (!date) return
    const current = totals.get(date) || { income: 0, expense: 0 }
    if (record.record_type === 'income') current.income += record.amount_cent
    else current.expense += record.amount_cent
    totals.set(date, current)
  })
  return calendarDays(year, month).map((day) => {
    const current = totals.get(day.date) || { income: 0, expense: 0 }
    return { ...day, ...current, balance: current.income - current.expense }
  })
}
