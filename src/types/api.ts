export type RecordType = 'expense' | 'income'

export interface ApiEnvelope<T> { code: number; message: string; data: T }
export interface Token { access_token: string; refresh_token: string; token_type: string }
export interface AuthUser {
  id: string
  phone?: string | null
  needs_phone_binding: boolean
  nickname?: string | null
  avatar?: { url: string } | null
}
export interface AuthenticatedIdentity extends Token {
  status: 'AUTHENTICATED'
  app_scope: string
  user: AuthUser
}
export interface PendingIdentity {
  status: 'PHONE_REQUIRED'
  login_ticket: string
  expires_at: string
}
export type IdentityResponse = AuthenticatedIdentity | PendingIdentity
export interface CompleteSmsIdentityRequest {
  login_ticket: string
  phone: string
  code: string
  accepted_terms: true
}
export interface Category {
  id: string
  record_type: RecordType
  name: string
  /** 后台上传的 CDN URL 或静态资源路径；旧接口也可能只返回图标名称。 */
  icon?: string | null
  sort_order?: number
  is_enabled: boolean
  is_system: boolean
}
export interface PaymentMethod { id: string; name: string; is_default?: boolean; is_enabled: boolean }
export interface RecordItem { id: string; record_type: RecordType; amount_cent: number; category_id: string; payment_method_id?: string | null; occurred_date: string; occurred_at?: string; note?: string | null; source: string; created_at: string }
export interface RecordPayload { record_type: RecordType; amount_cent: number; category_id: string; occurred_date: string; note?: string; payment_method_id?: string | null; idempotency_key?: string }
export interface RecordPage { items: RecordItem[]; total: number; page: number; page_size: number }
export interface ImportPreviewRow {
  row_number: number
  record_type?: RecordType
  amount_cent?: number
  occurred_date?: string
  category_name?: string
  category_id?: string
  payment_method_name?: string
  payment_method_id?: string | null
  note?: string | null
  errors: string[]
  warnings?: string[]
  duplicate?: boolean
}
export interface ImportPreview { batch_id: string; file_name: string; total: number; valid_count: number; error_count: number; duplicate_count: number; rows: ImportPreviewRow[] }
export interface ImportResult { batch_id: string; imported_count: number; skipped_count: number; error_count: number; duplicate_count: number }
export interface ExportResult { file_name: string; content: string; mime_type: string; record_count: number }
export interface Statistics { start_at: string; end_at: string; start_date?: string; end_date?: string; income_cent: number; expense_cent: number; balance_cent: number; record_count?: number; income_count?: number; expense_count?: number; category_incomes?: Array<{ category_id?: string; name?: string; amount_cent?: number; count?: number }>; category_expenses: Array<{ category_id?: string; name?: string; amount_cent?: number; count?: number; [key: string]: unknown }>; daily: Array<{ date?: string; amount_cent?: number; income_cent?: number; expense_cent?: number; balance_cent?: number; count?: number; [key: string]: unknown }> }

export interface AiSession { id: string; title: string; created_at: string; updated_at: string }
export interface AiMessage { id: string; role: 'user' | 'assistant'; content: string; payload?: { client_message_id?: string; status?: 'ready' | 'needs_clarification'; questions?: string[]; [key: string]: unknown } | null; records: RecordItem[]; created_at: string }
export interface AiChatResponse { session: AiSession; user_message: AiMessage; assistant_message: AiMessage }
export type AiRequestStatus = 'queued' | 'processing' | 'completed' | 'failed'
export interface AiRequestResponse {
  status: AiRequestStatus
  client_message_id: string
  session: AiSession
  user_message: AiMessage
  assistant_message: AiMessage | null
  error_message: string | null
}
