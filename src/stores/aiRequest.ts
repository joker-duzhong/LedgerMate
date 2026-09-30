import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { createAiSession, getAiRequest, listPendingAiRequests, sendAiMessage } from '@/api/ledger'
import type { AiMessage, AiRequestResponse, AiRequestStatus, AiSession } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import { isObject, normalizeAiRequest, normalizeSession } from '@/utils/aiChat'
import { ApiError } from '@/utils/request'
import { markLedgerChanged } from '@/utils/navigation'

interface PendingMessage { id: string; content: string; sessionId: string | null; status: AiRequestStatus | 'unconfirmed' }

// 属于应用而非页面：卸载聊天页不会结束提交或结果查询。
export const useAiRequestStore = defineStore('aiRequest', () => {
  const auth = useAuthStore()
  const pending = ref<PendingMessage | null>(null)
  const lastResponse = ref<AiRequestResponse | null>(null)
  const errorMessage = ref('')
  const submitting = ref(false)
  const foreground = ref(false)
  const processing = computed(() => pending.value?.status === 'queued' || pending.value?.status === 'processing')
  const tracked = new Map<string, { sessionId: string; id: string }>()
  const completed = new Set<string>()
  let restoredVersion = -1
  let timer: ReturnType<typeof setTimeout> | undefined
  let checking: Promise<void> | null = null
  let generation = 0
  let failures = 0
  let notFound = false
  let needsDiscovery = false
  const key = (sessionId: string, id: string) => sessionId + ':' + id
  const storageKey = () => 'ledger_mate_pending_ai:' + (auth.user?.id || '')
  const identity = () => {
    const version = auth.sessionVersion
    const userId = auth.user?.id
    return () => auth.isLoggedIn && auth.sessionVersion === version && auth.user?.id === userId
  }
  const stopTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined }
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
    if (!auth.isLoggedIn || restoredVersion === auth.sessionVersion) return
    generation += 1
    stopTimer()
    checking = null
    tracked.clear()
    completed.clear()
    pending.value = null
    lastResponse.value = null
    submitting.value = false
    errorMessage.value = ''
    failures = 0
    notFound = false
    needsDiscovery = false
    restoredVersion = auth.sessionVersion
    try {
      const value: unknown = uni.getStorageSync(storageKey())
      if (isObject(value) && typeof value.id === 'string' && value.id && value.id.length <= 100 && typeof value.content === 'string' && value.content.length <= 2000 && (value.sessionId === null || typeof value.sessionId === 'string')) {
        const status = ['queued', 'processing', 'failed'].includes(String(value.status)) ? value.status as PendingMessage['status'] : 'unconfirmed'
        pending.value = { id: value.id, content: value.content, sessionId: value.sessionId, status }
      }
    } catch { errorMessage.value = '无法恢复待确认消息，请先核对账单记录' }
  }
  const matchesPending = (response: AiRequestResponse) => pending.value?.sessionId === response.session.id && pending.value.id === response.client_message_id
  const accept = (response: AiRequestResponse) => {
    const requestKey = key(response.session.id, response.client_message_id)
    if (completed.has(requestKey)) return
    if (matchesPending(response) && pending.value?.content !== response.user_message.content) throw new Error('回复与发送内容不一致，请重新查询')
    if (response.status === 'queued' || response.status === 'processing') {
      tracked.set(requestKey, { sessionId: response.session.id, id: response.client_message_id })
      if (!pending.value) pending.value = { id: response.client_message_id, sessionId: response.session.id, content: response.user_message.content, status: response.status }
    } else tracked.delete(requestKey)
    if (response.status === 'completed') {
      completed.add(requestKey)
      if (response.assistant_message?.records.length) markLedgerChanged()
    }
    if (matchesPending(response)) {
      if (response.status === 'completed') pending.value = null
      else pending.value = { ...pending.value!, status: response.status }
      errorMessage.value = response.status === 'failed' ? response.error_message || '这条消息处理失败，可以重试' : ''
      notFound = false
      remember()
    }
    lastResponse.value = response
  }
  const schedule = () => {
    stopTimer()
    if (!foreground.value || !auth.isLoggedIn || submitting.value) return
    if (!needsDiscovery && !tracked.size && (!pending.value?.sessionId || pending.value.status === 'failed' || notFound)) return
    timer = setTimeout(() => { timer = undefined; void refresh() }, Math.min(30000, 2000 * 2 ** failures))
  }
  const refresh = (discover = false): Promise<void> => {
    restore()
    if (discover) needsDiscovery = true
    if (!auth.isLoggedIn || submitting.value) return Promise.resolve()
    if (checking) return checking
    const current = identity()
    const version = generation
    const active = () => current() && version === generation
    const task = (async () => {
      try {
        let queryError: unknown
        if (needsDiscovery) {
          try {
            const raw = await listPendingAiRequests()
            if (!active()) return
            if (!Array.isArray(raw)) throw new Error('待处理消息格式异常，请重试')
            for (const item of raw) accept(normalizeAiRequest(item))
            needsDiscovery = false
          } catch (error) { queryError = error }
        }
        if (!active()) return
        const requests = new Map(tracked)
        if (pending.value?.sessionId) requests.set(key(pending.value.sessionId, pending.value.id), { sessionId: pending.value.sessionId, id: pending.value.id })
        for (const request of requests.values()) {
          try {
            const raw = await getAiRequest(request.sessionId, request.id)
            if (!active()) return
            accept(normalizeAiRequest(raw, request.sessionId, request.id))
          } catch (error) {
            if (!active()) return
            if (error instanceof ApiError && error.statusCode === 404) {
              tracked.delete(key(request.sessionId, request.id))
              if (pending.value?.id === request.id && pending.value.sessionId === request.sessionId) {
                notFound = true
                pending.value = { ...pending.value, status: 'unconfirmed' }
                remember()
              }
            } else queryError = error
          }
        }
        if (queryError) throw queryError
        failures = 0
      } catch (error) {
        if (active()) {
          failures = Math.min(failures + 1, 4)
          errorMessage.value = (error instanceof Error ? error.message : '暂时无法查询结果') + '。稍后会自动查询，也可手动刷新。'
        }
      }
    })().finally(() => {
      if (checking === task) checking = null
      if (active()) schedule()
    })
    checking = task
    return task
  }
  const begin = (content: string, sessionId: string | null) => {
    restore()
    if (!auth.isLoggedIn || pending.value || submitting.value) return false
    pending.value = { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), content, sessionId, status: 'unconfirmed' }
    notFound = false
    errorMessage.value = ''
    if (!remember()) { pending.value = null; return false }
    return true
  }
  const submit = async (): Promise<'invalid' | void> => {
    restore()
    if (!auth.isLoggedIn || submitting.value || !pending.value) return
    const current = identity()
    const version = generation
    const requestId = pending.value.id
    if (checking) {
      await checking
      if (!current() || version !== generation || submitting.value || pending.value?.id !== requestId) return
    }
    if (processing.value) { await refresh(); return }
    const active = () => current() && version === generation && pending.value?.id === requestId
    submitting.value = true
    stopTimer()
    errorMessage.value = ''
    try {
      if (!pending.value.sessionId) {
        const session = normalizeSession(await createAiSession())
        if (!active()) return
        pending.value = { ...pending.value!, sessionId: session.id }
      }
      if (!remember()) return
      const request = { ...pending.value! }
      const raw = await sendAiMessage(request.sessionId!, request.content, request.id)
      if (!active()) return
      accept(normalizeAiRequest(raw, request.sessionId!, request.id))
    } catch (error) {
      if (!active()) return
      const detail = error instanceof Error ? error.message : '消息暂未完成'
      if (error instanceof ApiError && [400, 422].includes(error.statusCode)) {
        pending.value = null
        remember()
        errorMessage.value = detail
        return 'invalid'
      }
      errorMessage.value = detail + '。请重试这条消息，系统会核对同一次请求。'
    } finally {
      if (current() && version === generation) { submitting.value = false; schedule() }
    }
  }
  const reconcile = (session: AiSession, messages: AiMessage[]) => {
    if (!pending.value || pending.value.sessionId !== session.id) return
    const user = messages.find(item => item.role === 'user' && item.payload?.client_message_id === pending.value?.id)
    const assistant = messages.find(item => item.role === 'assistant' && item.payload?.client_message_id === pending.value?.id)
    if (user && assistant) accept({ status: 'completed', client_message_id: pending.value.id, session, user_message: user, assistant_message: assistant, error_message: null })
  }
  const editFailed = (): string | null => {
    if (submitting.value || pending.value?.status !== 'failed') return null
    const content = pending.value.content
    pending.value = null
    errorMessage.value = ''
    remember()
    return content
  }
  const setForeground = (visible: boolean) => {
    foreground.value = visible
    stopTimer()
    if (visible) { markLedgerChanged(); void refresh(true) }
  }
  watch(() => auth.sessionVersion, () => {
    generation += 1
    stopTimer()
    checking = null
    restoredVersion = -1
    pending.value = null
    lastResponse.value = null
    submitting.value = false
    tracked.clear()
    completed.clear()
    errorMessage.value = ''
    needsDiscovery = false
    // saveSession 在版本更新后才填入用户和凭据。
    void Promise.resolve().then(() => { if (auth.isLoggedIn) { restore(); if (foreground.value) void refresh(true) } })
  }, { flush: 'sync' })
  return { pending, lastResponse, errorMessage, submitting, processing, foreground, restore, begin, submit, refresh, reconcile, editFailed, setForeground }
})
