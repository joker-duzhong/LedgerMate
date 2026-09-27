import type { RecordPayload, RecordType } from '@/types/api'
import { parseCalendarDate } from '@/utils/calendar'

export interface RecordDraft {
  recordType: RecordType
  amount: string
  categoryId: string
  paymentMethodId: string
  note: string
  occurredDate: string
}

export const parseRecordAmount = (input: string): number | null => {
  if (!/^\d+(\.\d{1,2})?$/.test(input)) return null
  const [integer, decimal = ''] = input.split('.')
  const cents = Number(`${integer}${decimal.padEnd(2, '0')}`)
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000 ? cents : null
}

export const localRecordFields = (date: string) => {
  if (!parseCalendarDate(date)) throw new Error('这笔账的日期无效，请稍后重试')
  return { occurredDate: date }
}

export const draftToPayload = (draft: RecordDraft): RecordPayload => {
  const amountCent = parseRecordAmount(draft.amount)
  if (amountCent === null) throw new Error('金额需大于 0 且不超过 100 万元，最多保留两位小数')
  if (!draft.categoryId) throw new Error('请选择分类；暂无分类时，可先前往管理页添加')
  if (!parseCalendarDate(draft.occurredDate)) throw new Error('请选择有效日期')
  return {
    record_type: draft.recordType,
    amount_cent: amountCent,
    category_id: draft.categoryId,
    occurred_date: draft.occurredDate,
    note: draft.note.trim(),
    ...(draft.paymentMethodId ? { payment_method_id: draft.paymentMethodId } : {}),
  }
}

export const draftFingerprint = (draft: RecordDraft) => JSON.stringify(draft)
