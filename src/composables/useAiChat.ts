import { computed, ref } from 'vue'
import { listAiSessions, createAiSession, listAiMessages, sendAiMessage, deleteRecord, listCategories } from '@/api/ledger'
import type { AiChatResponse, AiMessage, AiSession, Category, RecordItem } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/utils/request'
import { ledgerRevision, markLedgerChanged } from '@/utils/navigation'

interface PendingMessage { id: string; content: string; sessionId: string | null }

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const normalizeSession = (value: unknown): AiSession => {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id || typeof value.title !== 'string' || typeof value.created_at !== 'string') throw new Error('对话列表格式异常，请重新加载')
  return value as unknown as AiSession
}
const normalizeMessage = (value: unknown): AiMessage => {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id || !['user', 'assistant'].includes(String(value.role)) || typeof value.content !== 'string' || typeof value.created_at !== 'string') throw new Error('对话消息格式异常，请重新加载')
  const records = value.records == null ? [] : value.records
  if (!Array.isArray(records) || records.some((item) => !isObject(item) || typeof item.id !== 'string' || !item.id || !['income', 'expense'].includes(String(item.record_type)) || !Number.isSafeInteger(item.amount_cent) || Number(item.amount_cent) <= 0 || typeof item.category_id !== 'string')) throw new Error('对话中的账单格式异常，请重新加载')
  return { ...value, records: records as RecordItem[] } as AiMessage
}
const normalizeMessages = (value: unknown): AiMessage[] => {
  if (!Array.isArray(value)) throw new Error('对话消息列表格式异常，请重新加载')
  return value.map(normalizeMessage)
}
const normalizeResponse = (value: unknown, expectedSession: string): AiChatResponse => {
  if (!isObject(value)) throw new Error('回复格式异常，请重试确认这条消息')
  const session = normalizeSession(value.session)
  const userMessage = normalizeMessage(value.user_message)
  const assistantMessage = normalizeMessage(value.assistant_message)
  if (session.id !== expectedSession || userMessage.role !== 'user' || assistantMessage.role !== 'assistant') throw new Error('回复与当前对话不一致，请重试确认这条消息')
  return { session, user_message: userMessage, assistant_message: assistantMessage }
}

export const useAiChat = () => {
  const auth = useAuthStore()
  const sessions = ref<AiSession[]>([])
  const sessionId = ref<string | null>(null)
  const messages = ref<AiMessage[]>([])
  const categories = ref<Category[]>([])
  const input = ref('')
  const loading = ref(false)
  const loaded = ref(false)
  const sending = ref(false)
  const deletingId = ref('')
  const errorMessage = ref('')
  const pending = ref<PendingMessage | null>(null)
  const canRetryPending = computed(() => loaded.value && Boolean(pending.value) && !sending.value && !loading.value)
  const storageKey = () => 'ledger_mate_pending_ai:' + (auth.user?.id || '')
  const names = computed(() => new Map(categories.value.map(item => [item.id, item.name])))
  const categoryById = computed(() => new Map(categories.value.map(item => [item.id, item])))
  const optimisticMessage = computed<AiMessage | null>(() => {
    if (!pending.value || messages.value.some(item => item.role === 'user' && item.payload?.client_message_id === pending.value?.id)) return null
    return { id: 'pending-' + pending.value.id, role: 'user', content: pending.value.content, records: [], created_at: '' }
  })
  const visibleMessages = computed(() => optimisticMessage.value ? [...messages.value, optimisticMessage.value] : messages.value)
  let operation = 0
  let disposed = false
  let lastRevision = -1

  const remember = () => {
    try {
      if (pending.value) uni.setStorageSync(storageKey(), { ...pending.value })
      else uni.removeStorageSync(storageKey())
      return true
    } catch {
      errorMessage.value = '无法保存待发送记录，请检查设备存储空间后重试'
      return false
    }
  }
  const restore = () => {
    try {
      const value = uni.getStorageSync(storageKey()) as PendingMessage | undefined
      if (value && typeof value.id === 'string' && value.id.length <= 100 && typeof value.content === 'string' && value.content.length <= 2000 && (value.sessionId === null || typeof value.sessionId === 'string')) pending.value = value
    } catch { errorMessage.value = '无法恢复待确认消息，请先核对账单记录' }
  }

  const initialize = async (force = false) => {
    if (disposed || sending.value || loading.value) return
    if (loaded.value && !force && lastRevision === ledgerRevision()) return
    const version = ++operation
    const requestedRevision = ledgerRevision()
    loading.value = true
    errorMessage.value = ''
    try {
      if (!loaded.value) restore()
      const [sessionList, categoryList] = await Promise.all([listAiSessions(), listCategories()])
      if (disposed || version !== operation) return
      if (!Array.isArray(sessionList) || !Array.isArray(categoryList)) throw new Error('对话信息格式异常，请重新加载')
      sessions.value = sessionList.map(normalizeSession)
      if (categoryList.some((item) => !item || typeof item.id !== 'string' || typeof item.name !== 'string')) throw new Error('分类信息格式异常，请重新加载')
      categories.value = categoryList
      if (!loaded.value) sessionId.value = pending.value ? pending.value.sessionId : sessionList[0]?.id || null
      const history = sessionId.value ? normalizeMessages(await listAiMessages(sessionId.value)) : []
      if (disposed || version !== operation) return
      messages.value = history
      loaded.value = true
      lastRevision = requestedRevision
    } catch (error) {
      if (!disposed && version === operation) errorMessage.value = error instanceof Error ? error.message : '对话暂时无法加载，请重试'
    } finally { if (!disposed && version === operation) loading.value = false }
  }

  const selectSession = async (id: string | null) => {
    if (sending.value || pending.value || loading.value) return
    const previous = sessionId.value
    const version = ++operation
    loading.value = true
    errorMessage.value = ''
    try {
      const history = id ? normalizeMessages(await listAiMessages(id)) : []
      if (disposed || version !== operation) return
      sessionId.value = id
      messages.value = history
      input.value = ''
    } catch (error) {
      if (!disposed && version === operation) { sessionId.value = previous; errorMessage.value = error instanceof Error ? error.message : '无法切换对话' }
    } finally { if (!disposed && version === operation) loading.value = false }
  }

  const send = async () => {
    if (disposed || sending.value || loading.value || !loaded.value) return
    const authVersion = auth.sessionVersion
    const userId = auth.user?.id
    const sameIdentity = () => auth.sessionVersion === authVersion && auth.user?.id === userId
    if (!pending.value) {
      const content = input.value.trim()
      if (!content) return
      if (content.length > 2000) { errorMessage.value = '一次最多发送 2000 个字'; return }
      pending.value = { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), content, sessionId: sessionId.value }
      if (!remember()) { pending.value = null; return }
      input.value = ''
    }
    sending.value = true
    errorMessage.value = ''
    try {
      if (!pending.value.sessionId) {
        const session = normalizeSession(await createAiSession())
        if (disposed || !sameIdentity()) return
        sessionId.value = session.id
        messages.value = []
        pending.value.sessionId = session.id
        sessions.value.unshift(session)
      }
      if (!remember()) return
      const request = { ...pending.value }
      const rawResponse = await sendAiMessage(request.sessionId!, request.content, request.id)
      if (!sameIdentity()) return
      const response = normalizeResponse(rawResponse, request.sessionId!)
      if (response.assistant_message.records.length) markLedgerChanged()
      if (disposed) return
      const replacementIds = new Set([response.user_message.id, response.assistant_message.id])
      messages.value = [...messages.value.filter(item => !replacementIds.has(item.id)), response.user_message, response.assistant_message].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      const index = sessions.value.findIndex(item => item.id === response.session.id)
      if (index >= 0) sessions.value[index] = response.session
      else sessions.value.unshift(response.session)
      pending.value = null
      remember()
      lastRevision = ledgerRevision()
    } catch (error) {
      if (disposed || !sameIdentity()) return
      if (error instanceof ApiError && [400, 422].includes(error.statusCode)) {
        input.value = pending.value?.content || ''
        pending.value = null
        remember()
      }
      const detail = error instanceof Error ? error.message : '消息暂未完成'
      errorMessage.value = pending.value ? detail + '。请重试这条消息，系统会核对同一次请求。' : detail
    } finally { if (!disposed) sending.value = false }
  }

  const removeRecord = async (id: string) => {
    if (deletingId.value || sending.value) return false
    const authVersion = auth.sessionVersion
    const userId = auth.user?.id
    deletingId.value = id
    try {
      await deleteRecord(id)
      if (auth.sessionVersion !== authVersion || auth.user?.id !== userId) return false
      markLedgerChanged()
      if (disposed) return false
      messages.value = messages.value.map(item => ({ ...item, records: item.records.filter(record => record.id !== id) }))
      lastRevision = ledgerRevision()
      return true
    } catch (error) {
      if (!disposed) errorMessage.value = error instanceof Error ? error.message : '删除失败，请重试'
      return false
    } finally { if (!disposed) deletingId.value = '' }
  }
  const dispose = () => { disposed = true; operation += 1 }
  return { sessions, sessionId, messages, visibleMessages, names, categoryById, input, loading, loaded, sending, deletingId, errorMessage, pending, canRetryPending, initialize, selectSession, send, removeRecord, dispose }
}
