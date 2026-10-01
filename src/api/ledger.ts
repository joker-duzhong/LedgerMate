import { request } from '@/utils/request'
import type { AiRequestResponse, AiMessage, AiSession, Category, ExportResult, ImportPreview, ImportResult, PaymentMethod, RecordItem, RecordPage, RecordPayload, RecordType, Statistics } from '@/types/api'
import { normalizeCategories } from '@/utils/categories'

export const listCategories = async () => normalizeCategories(await request<unknown>({ url: '/ledger-mate/categories', method: 'GET' }))
export const createCategory = (data: Pick<Category, 'name' | 'record_type'> & { icon?: string }) => request<Category>({ url: '/ledger-mate/categories', method: 'POST', data })
export const listPaymentMethods = () => request<PaymentMethod[]>({ url: '/ledger-mate/payment-methods', method: 'GET' })
export const createPaymentMethod = (data: Pick<PaymentMethod, 'name' | 'is_default'>) => request<PaymentMethod>({ url: '/ledger-mate/payment-methods', method: 'POST', data })
export const listRecords = (params: { page: number; page_size: number; record_type?: RecordType; start_date?: string; end_date?: string; keyword?: string; category_id?: string }) => request<RecordPage>({ url: '/ledger-mate/records', method: 'GET', data: params })
export const getRecord = (recordId: string) => request<RecordItem>({ url: `/ledger-mate/records/${recordId}`, method: 'GET' })
export const createRecord = (data: RecordPayload) => request<RecordItem>({ url: '/ledger-mate/records', method: 'POST', data })
export const updateRecord = (recordId: string, data: Partial<RecordPayload>) => request<RecordItem>({ url: `/ledger-mate/records/${recordId}`, method: 'PUT', data })
export const deleteRecord = (recordId: string) => request<void>({ url: `/ledger-mate/records/${recordId}`, method: 'DELETE' })
export const previewImport = (data: { file_name: string; content: string }) => request<ImportPreview>({ url: '/ledger-mate/import/preview', method: 'POST', data })
export const confirmImport = (batchId: string, data: { skip_duplicates: boolean }) => request<ImportResult>({ url: `/ledger-mate/import/${encodeURIComponent(batchId)}/confirm`, method: 'POST', data })
export const exportRecords = (params: { format: 'csv' | 'json'; start_date?: string; end_date?: string; record_type?: RecordType }) => request<ExportResult>({ url: '/ledger-mate/export', method: 'GET', data: params })
export const getStatistics = (startDate: string, endDate: string) => request<Statistics>({ url: '/ledger-mate/statistics', method: 'GET', data: { start_date: startDate, end_date: endDate } })
export const listAiSessions = () => request<AiSession[]>({ url: '/ledger-mate/ai/sessions', method: 'GET' })
export const createAiSession = () => request<AiSession>({ url: '/ledger-mate/ai/sessions', method: 'POST', data: {} })
export const listAiMessages = (sessionId: string) => request<AiMessage[]>({ url: `/ledger-mate/ai/sessions/${encodeURIComponent(sessionId)}/messages`, method: 'GET', data: { limit: 100 } })
export const sendAiMessage = (sessionId: string, content: string, clientMessageId: string) => request<AiRequestResponse>({ url: `/ledger-mate/ai/sessions/${encodeURIComponent(sessionId)}/requests`, method: 'POST', timeout: 15000, data: { content, client_message_id: clientMessageId } })
export const getAiRequest = (sessionId: string, clientMessageId: string) => request<AiRequestResponse>({ url: `/ledger-mate/ai/sessions/${encodeURIComponent(sessionId)}/requests/${encodeURIComponent(clientMessageId)}`, method: 'GET', timeout: 15000 })
export const listPendingAiRequests = () => request<AiRequestResponse[]>({ url: '/ledger-mate/ai/requests/pending', method: 'GET', timeout: 15000 })
