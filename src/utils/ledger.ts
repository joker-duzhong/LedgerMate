import type { Category, RecordItem, RecordPage, RecordType } from '@/types/api'

const pad = (value: number) => String(value).padStart(2, '0')
export const localDateKey = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
export const currentMonth = () => localDateKey(new Date()).slice(0, 7)
export const recordDate = (record: Pick<RecordItem, 'occurred_date' | 'occurred_at'>) => record.occurred_date || (record.occurred_at ? localDateKey(record.occurred_at) : '')
export const byCreatedDescending = (a: RecordItem, b: RecordItem) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || b.id.localeCompare(a.id)
const monthParts = (month: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('月份格式无效')
  const [year, index] = month.split('-').map(Number)
  if (year < 1900 || year > 9998) throw new Error('月份超出可用范围')
  return [year, index - 1] as const
}
export const monthRange = (month: string) => {
  const [year, index] = monthParts(month)
  return [new Date(year, index, 1).toISOString(), new Date(year, index + 1, 1).toISOString()] as const
}
export const monthTitle = (month: string) => {
  const [year, index] = monthParts(month)
  return `${year}年${index + 1}月`
}
export const shiftMonth = (month: string, offset: number) => {
  const [year, index] = monthParts(month)
  return localDateKey(new Date(year, index + offset, 1)).slice(0, 7)
}

export interface DayGroup { date: string; records: RecordItem[]; income: number; expense: number }
export const recordTotals = (records: RecordItem[]) => records.reduce((total, record) => {
  total[record.record_type] += record.amount_cent
  total.balance = total.income - total.expense
  return total
}, { income: 0, expense: 0, balance: 0 })

export const filterRecords = (records: RecordItem[], categories: Category[], options: { month: string; type: RecordType | 'all'; keyword: string }) => {
  const names = new Map(categories.map((item) => [item.id, item.name]))
  const keyword = options.keyword.trim().toLocaleLowerCase()
  return records.filter((record) => {
    if (recordDate(record).slice(0, 7) !== options.month) return false
    if (options.type !== 'all' && record.record_type !== options.type) return false
    return !keyword || `${names.get(record.category_id) || ''} ${record.note || ''} ${(record.amount_cent / 100).toFixed(2)}`.toLocaleLowerCase().includes(keyword)
  }).sort(byCreatedDescending)
}

export const groupRecordsByDay = (records: RecordItem[]): DayGroup[] => {
  const groups: DayGroup[] = []
  for (const record of [...records].sort(byCreatedDescending)) {
    const date = recordDate(record)
    if (!date) continue
    let group = groups[groups.length - 1]
    if (!group || group.date !== date) {
      group = { date, records: [], income: 0, expense: 0 }
      groups.push(group)
    }
    group.records.push(record)
    group[record.record_type] += record.amount_cent
  }
  return groups
}

export const dayTitle = (date: string, now = new Date()) => {
  if (date === localDateKey(now)) return '今天'
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (date === localDateKey(yesterday)) return '昨天'
  const parsed = new Date(`${date}T12:00:00`)
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日`
}
export const weekday = (date: string) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${date}T12:00:00`).getDay()]
// 按接口筛选后的范围完整加载，避免首批分页冒充整月。
export const collectRecords = async (
  loadPage: (params: { page: number; page_size: number }) => Promise<RecordPage>,
  progress: (loaded: number, total: number) => void = () => {},
  isCurrent: () => boolean = () => true,
): Promise<RecordItem[] | null> => {
  const records = new Map<string, RecordItem>()
  let page = 1
  let expectedTotal: number | undefined
  while (isCurrent()) {
    const result = await loadPage({ page, page_size: 50 })
    if (!isCurrent()) return null
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(result.total) || result.total < 0) throw new Error('账单数据格式异常，请重新加载')
    if (expectedTotal !== undefined && result.total !== expectedTotal) throw new Error('账单刚刚有更新，请刷新后查看完整记录')
    expectedTotal = result.total
    const before = records.size
    for (const record of result.items) records.set(record.id, record)
    if (records.size - before !== result.items.length) throw new Error('账单列表未加载完整，请刷新重试')
    progress(records.size, result.total)
    if (records.size >= result.total) return [...records.values()]
    if (records.size === before) throw new Error('账单列表未加载完整，请刷新重试')
    page += 1
  }
  return null
}
