import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { listAiSessions, listAiMessages, deleteRecord, listCategories } from '@/api/ledger'
import type { AiRequestResponse, AiMessage, AiSession, Category } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import { useAiRequestStore } from '@/stores/aiRequest'
import { normalizeSession, normalizeMessages } from '@/utils/aiChat'
import { ledgerRevision, markLedgerChanged } from '@/utils/navigation'

export const useAiChat = () => {
  const auth = useAuthStore()
  const requests = useAiRequestStore()
  const { pending, submitting: sending, processing, lastResponse, errorMessage: requestError } = storeToRefs(requests)
  const sessions = ref<AiSession[]>([])
  const sessionId = ref<string | null>(null)
  const messages = ref<AiMessage[]>([])
  const categories = ref<Category[]>([])
  const input = ref('')
  const loading = ref(false)
  const loaded = ref(false)
  const deletingId = ref('')
  const pageError = ref('')
  const errorMessage = computed(() => pageError.value || requestError.value)
  const canRetryPending = computed(() => loaded.value && Boolean(pending.value) && !processing.value && !sending.value && !loading.value)
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
  let sendingRequestId = ''
  let responseSequence = 0
  const receivedResponses = new Map<string, { response: AiRequestResponse; sequence: number }>()

  const applyResponse = (response: AiRequestResponse) => {
    if (disposed || (sessionId.value !== response.session.id && response.client_message_id !== sendingRequestId)) return
    sessionId.value = response.session.id
    const incoming = [response.user_message, ...(response.assistant_message ? [response.assistant_message] : [])]
    const replacementIds = new Set(incoming.map(item => item.id))
    messages.value = [...messages.value.filter(item => !replacementIds.has(item.id)), ...incoming].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    const index = sessions.value.findIndex(item => item.id === response.session.id)
    if (index >= 0) sessions.value[index] = response.session
    else sessions.value.unshift(response.session)
  }
  const stopResponseWatch = watch(lastResponse, (response) => {
    if (!response) return
    receivedResponses.set(response.session.id + ':' + response.client_message_id, { response, sequence: ++responseSequence })
    applyResponse(response)
  }, { flush: 'sync' })
  const mergeResponsesSince = (sequence: number) => {
    for (const received of receivedResponses.values()) {
      if (received.sequence > sequence) applyResponse(received.response)
    }
    receivedResponses.clear()
  }
  const stopIdentityWatch = watch(() => auth.sessionVersion, () => {
    operation += 1
    sessions.value = []
    sessionId.value = null
    messages.value = []
    categories.value = []
    input.value = ''
    loaded.value = false
    loading.value = false
    pageError.value = ''
    lastRevision = -1
    sendingRequestId = ''
    receivedResponses.clear()
  }, { flush: 'sync' })

  const initialize = async (force = false) => {
    if (disposed || sending.value || loading.value) return
    if (loaded.value && !force && lastRevision === ledgerRevision()) return
    const version = ++operation
    let requestedRevision = ledgerRevision()
    const authVersion = auth.sessionVersion
    loading.value = true
    pageError.value = ''
    try {
      requests.restore()
      const resumeSession = pending.value ? pending.value.sessionId : undefined
      if (!loaded.value || force || pending.value) await requests.refresh(!loaded.value || force)
      if (disposed || version !== operation || authVersion !== auth.sessionVersion) return
      requestedRevision = ledgerRevision()
      const [sessionList, categoryList] = await Promise.all([listAiSessions(), listCategories()])
      if (disposed || version !== operation) return
      if (!Array.isArray(sessionList) || !Array.isArray(categoryList)) throw new Error('对话信息格式异常，请重新加载')
      sessions.value = sessionList.map(normalizeSession)
      if (categoryList.some((item) => !item || typeof item.id !== 'string' || typeof item.name !== 'string')) throw new Error('分类信息格式异常，请重新加载')
      categories.value = categoryList
      if (!loaded.value) sessionId.value = resumeSession !== undefined ? resumeSession : pending.value?.sessionId || sessionList[0]?.id || null
      const sequenceBeforeHistory = responseSequence
      const history = sessionId.value ? normalizeMessages(await listAiMessages(sessionId.value)) : []
      if (disposed || version !== operation) return
      messages.value = history
      const session = sessions.value.find(item => item.id === sessionId.value)
      if (session) requests.reconcile(session, history)
      mergeResponsesSince(sequenceBeforeHistory)
      loaded.value = true
      lastRevision = requestedRevision
    } catch (error) {
      if (!disposed && version === operation) pageError.value = error instanceof Error ? error.message : '对话暂时无法加载，请重试'
    } finally { if (!disposed && version === operation) loading.value = false }
  }

  const selectSession = async (id: string | null) => {
    if (sending.value || pending.value || loading.value) return
    const previous = sessionId.value
    const version = ++operation
    loading.value = true
    pageError.value = ''
    try {
      const sequenceBeforeHistory = responseSequence
      const history = id ? normalizeMessages(await listAiMessages(id)) : []
      if (disposed || version !== operation) return
      sessionId.value = id
      messages.value = history
      mergeResponsesSince(sequenceBeforeHistory)
      input.value = ''
    } catch (error) {
      if (!disposed && version === operation) { sessionId.value = previous; pageError.value = error instanceof Error ? error.message : '无法切换对话' }
    } finally { if (!disposed && version === operation) loading.value = false }
  }

  const stopSendingWatch = watch(sending, (value) => {
    if (!value && !loaded.value && !disposed) void initialize(true)
  })

  const send = async () => {
    if (disposed || sending.value || loading.value || !loaded.value) return
    pageError.value = ''
    const content = pending.value?.content || input.value.trim()
    if (!pending.value) {
      if (!content) return
      if (content.length > 2000) { pageError.value = '一次最多发送 2000 个字'; return }
      if (!requests.begin(content, sessionId.value)) return
      input.value = ''
    }
    const authVersion = auth.sessionVersion
    sendingRequestId = pending.value?.id || ''
    const result = await requests.submit()
    if (disposed || authVersion !== auth.sessionVersion) return
    sendingRequestId = ''
    if (result === 'invalid') input.value = content
    if (pending.value?.sessionId) sessionId.value = pending.value.sessionId
    lastRevision = ledgerRevision()
  }
  const refreshResult = async () => {
    await requests.refresh(true)
    if (!disposed) await initialize(true)
  }
  const editFailedMessage = () => {
    const content = requests.editFailed()
    if (content !== null) { input.value = content; pageError.value = '' }
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
      if (!disposed) pageError.value = error instanceof Error ? error.message : '删除失败，请重试'
      return false
    } finally { if (!disposed) deletingId.value = '' }
  }
  const dispose = () => { disposed = true; operation += 1; stopResponseWatch(); stopIdentityWatch(); stopSendingWatch() }
  return { sessions, sessionId, messages, visibleMessages, names, categoryById, input, loading, loaded, sending, processing, deletingId, errorMessage, pending, canRetryPending, initialize, selectSession, send, refreshResult, editFailedMessage, removeRecord, dispose }
}
