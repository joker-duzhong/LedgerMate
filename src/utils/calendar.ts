export const MIN_CALENDAR_YEAR = 1900
export const MAX_CALENDAR_YEAR = 9998

const pad = (value: number) => String(value).padStart(2, '0')
export const calendarDate = (year: number, month: number, day: number) => `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
export const todayDate = (now = new Date()) => calendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate()

export const parseCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (year < MIN_CALENDAR_YEAR || year > MAX_CALENDAR_YEAR || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

export const calendarMonth = (value: string) => {
  const parsed = parseCalendarDate(`${value}-01`)
  return parsed ? { year: parsed.year, month: parsed.month } : null
}

export interface CalendarDay { date: string; day: number; currentMonth: boolean; disabled: boolean }

export const calendarDays = (year: number, month: number): CalendarDay[] => {
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index - offset + 1))
    const actualYear = date.getUTCFullYear()
    return {
      date: calendarDate(actualYear, date.getUTCMonth() + 1, date.getUTCDate()),
      day: date.getUTCDate(),
      currentMonth: actualYear === year && date.getUTCMonth() + 1 === month,
      disabled: actualYear < MIN_CALENDAR_YEAR || actualYear > MAX_CALENDAR_YEAR,
    }
  })
}

export const moveCalendarMonth = (year: number, month: number, offset: number) => {
  const index = Math.min((MAX_CALENDAR_YEAR + 1) * 12 - 1, Math.max(MIN_CALENDAR_YEAR * 12, year * 12 + month - 1 + offset))
  return { year: Math.floor(index / 12), month: index % 12 + 1 }
}

export const calendarYearPage = (year: number) => MIN_CALENDAR_YEAR + Math.floor((year - MIN_CALENDAR_YEAR) / 12) * 12
