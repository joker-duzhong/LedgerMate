import type { Category, PaymentMethod, RecordItem, RecordType, Statistics } from '@/types/api'

export interface ExpenseShare {
  key: string
  name: string
  amount: number
  percentage: number
}

export interface DailyAmount {
  date: string
  day: number
  income: number | null
  expense: number | null
}

const validAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

export const expenseShares = (rows: Statistics['category_expenses'], categories: Category[], totalExpense: number): ExpenseShare[] => {
  const total = validAmount(totalExpense) ? totalExpense : 0
  return rows.flatMap((row, index) => {
    if (!validAmount(row.amount_cent) || row.amount_cent === 0) return []
    return [{
      key: row.category_id || `${row.name || 'category'}-${index}`,
      name: row.name || categories.find((category) => category.id === row.category_id)?.name || '未命名分类',
      amount: row.amount_cent,
      percentage: total > 0 ? row.amount_cent / total * 100 : 0,
    }]
  }).sort((first, second) => second.amount - first.amount)
}

export const dailyAmounts = (rows: Statistics['daily'], month: string): DailyAmount[] => {
  const days = new Map<string, DailyAmount>()
  for (const row of rows) {
    if (typeof row.date !== 'string') continue
    const date = row.date.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 7) !== month) continue
    const [year, monthNumber, day] = date.split('-').map(Number)
    const parsed = new Date(year, monthNumber - 1, day)
    if (parsed.getFullYear() !== year || parsed.getMonth() !== monthNumber - 1 || parsed.getDate() !== day) continue
    const income = validAmount(row.income_cent) ? row.income_cent : null
    const expense = validAmount(row.expense_cent) ? row.expense_cent : null
    // amount_cent does not identify a direction; only explicit income/expense fields can be charted.
    if (income === null && expense === null) continue
    const existing = days.get(date)
    days.set(date, {
      date,
      day,
      income: income === null ? existing?.income ?? null : (existing?.income ?? 0) + income,
      expense: expense === null ? existing?.expense ?? null : (existing?.expense ?? 0) + expense,
    })
  }
  return [...days.values()].sort((first, second) => first.date.localeCompare(second.date))
}

export const CHART_COLORS = ['#FFDA4A', '#70C8A1', '#79A8DF', '#F39C7C', '#A99ADB', '#B5BE72', '#6CC5CE', '#D4A873']

export const monthDates = (month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('月份格式无效')
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(year, monthNumber, 1)
  return { start_date: `${month}-01`, end_date: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01` }
}

export const averageDayCount = (month: string, now = new Date()) => {
  monthDates(month)
  const [year, monthNumber] = month.split('-').map(Number)
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (month > current) return 0
  return month === current ? now.getDate() : new Date(year, monthNumber, 0).getDate()
}

export const dailyAverage = (amount: number, days: number) => {
  if (days <= 0 || !Number.isFinite(amount)) return 0
  const rounded = Math.round(Math.abs(amount) / days)
  return rounded === 0 ? 0 : Math.sign(amount) * rounded
}

export const analysisDate = (record: RecordItem) => {
  const dateOnly = (record as RecordItem & { occurred_date?: string }).occurred_date
  if (dateOnly) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return ''
    const [year, month, day] = dateOnly.split('-').map(Number)
    const parsed = new Date(year, month - 1, day)
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day ? dateOnly : ''
  }
  const timestamp = record.occurred_at
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const monthRecords = (records: RecordItem[], month: string) => {
  const range = monthDates(month)
  return records.filter((record) => {
    const date = analysisDate(record)
    return date >= range.start_date && date < range.end_date && validAmount(record.amount_cent)
  })
}

export const recordSummary = (records: RecordItem[]) => records.reduce((sum, record) => {
  if (validAmount(record.amount_cent)) {
    if (record.record_type === 'income') sum.income += record.amount_cent
    if (record.record_type === 'expense') sum.expense += record.amount_cent
  }
  sum.balance = sum.income - sum.expense
  return sum
}, { income: 0, expense: 0, balance: 0 })

export const recordTrend = (records: RecordItem[], month: string) => {
  const [year, monthNumber] = month.split('-').map(Number)
  const rows = Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, index) => ({
    date: `${month}-${String(index + 1).padStart(2, '0')}`, label: `${index + 1}`, income: 0, expense: 0, balance: 0,
  }))
  for (const record of monthRecords(records, month)) {
    const row = rows[Number(analysisDate(record).slice(8, 10)) - 1]
    if (!row || (record.record_type !== 'income' && record.record_type !== 'expense')) continue
    row[record.record_type] += record.amount_cent
    row.balance = row.income - row.expense
  }
  return rows
}

export const categoryRanking = (records: RecordItem[], categories: Category[], type: RecordType) => {
  const groups = new Map<string, { key: string; name: string; amount: number; count: number }>()
  for (const record of records) {
    if (record.record_type !== type || !validAmount(record.amount_cent)) continue
    const key = record.category_id || 'uncategorized'
    const row = groups.get(key) || { key, name: categories.find((item) => item.id === key)?.name || '未命名分类', amount: 0, count: 0 }
    row.amount += record.amount_cent
    row.count += 1
    groups.set(key, row)
  }
  const total = [...groups.values()].reduce((sum, row) => sum + row.amount, 0)
  return [...groups.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)).map((row, index) => ({ ...row, percentage: total ? row.amount / total * 100 : 0, color: CHART_COLORS[index % CHART_COLORS.length] }))
}

export const detailRanking = (records: RecordItem[], type: RecordType) => records
  .filter((record) => record.record_type === type && validAmount(record.amount_cent))
  .slice().sort((a, b) => b.amount_cent - a.amount_cent || analysisDate(b).localeCompare(analysisDate(a)) || a.id.localeCompare(b.id))

export const paymentFlows = (records: RecordItem[], methods: PaymentMethod[]) => {
  const groups = new Map<string, { id: string; name: string; income: number; expense: number; balance: number; count: number }>()
  for (const record of records) {
    if (!validAmount(record.amount_cent) || (record.record_type !== 'income' && record.record_type !== 'expense')) continue
    const id = record.payment_method_id || 'unspecified'
    const row = groups.get(id) || { id, name: methods.find((item) => item.id === id)?.name || (id === 'unspecified' ? '未指定支付方式' : '原支付方式'), income: 0, expense: 0, balance: 0, count: 0 }
    row[record.record_type] += record.amount_cent
    row.balance = row.income - row.expense
    row.count += 1
    groups.set(id, row)
  }
  return [...groups.values()].sort((a, b) => (b.income + b.expense) - (a.income + a.expense) || a.name.localeCompare(b.name))
}
