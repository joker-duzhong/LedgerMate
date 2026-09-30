import type { AiMessage, AiRequestResponse, AiSession, RecordItem } from '@/types/api'

export const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
export const normalizeSession = (value: unknown): AiSession => {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id || typeof value.title !== 'string' || typeof value.created_at !== 'string') throw new Error('对话列表格式异常，请重新加载')
  return value as unknown as AiSession
}
export const normalizeMessage = (value: unknown): AiMessage => {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id || !['user', 'assistant'].includes(String(value.role)) || typeof value.content !== 'string' || typeof value.created_at !== 'string') throw new Error('对话消息格式异常，请重新加载')
  const records = value.records == null ? [] : value.records
  if (!Array.isArray(records) || records.some((item) => !isObject(item) || typeof item.id !== 'string' || !item.id || !['income', 'expense'].includes(String(item.record_type)) || !Number.isSafeInteger(item.amount_cent) || Number(item.amount_cent) <= 0 || typeof item.category_id !== 'string')) throw new Error('对话中的账单格式异常，请重新加载')
  return { ...value, records: records as RecordItem[] } as AiMessage
}
export const normalizeMessages = (value: unknown): AiMessage[] => {
  if (!Array.isArray(value)) throw new Error('对话消息列表格式异常，请重新加载')
  return value.map(normalizeMessage)
}
export const normalizeAiRequest = (value: unknown, sessionId?: string, clientId?: string): AiRequestResponse => {
  if (!isObject(value) || !['queued', 'processing', 'completed', 'failed'].includes(String(value.status)) || typeof value.client_message_id !== 'string' || !value.client_message_id) throw new Error('消息处理状态格式异常，请重新查询')
  const session = normalizeSession(value.session)
  const user = normalizeMessage(value.user_message)
  const assistant = value.assistant_message == null ? null : normalizeMessage(value.assistant_message)
  if ((sessionId && session.id !== sessionId) || (clientId && value.client_message_id !== clientId) || user.role !== 'user' || user.payload?.client_message_id !== value.client_message_id || (assistant && (assistant.role !== 'assistant' || assistant.payload?.client_message_id !== value.client_message_id)) || (value.status === 'completed' && !assistant) || (value.status !== 'completed' && assistant)) throw new Error('回复与当前消息不一致，请重新查询')
  if (value.error_message != null && typeof value.error_message !== 'string') throw new Error('消息处理状态格式异常，请重新查询')
  return { status: value.status as AiRequestResponse['status'], client_message_id: value.client_message_id, session, user_message: user, assistant_message: assistant, error_message: value.error_message as string | null ?? null }
}
