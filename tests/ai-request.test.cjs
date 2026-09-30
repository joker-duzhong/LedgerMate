const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness, flush } = require('./helpers.cjs')

const PENDING_KEY = 'ledger_mate_pending_ai:test-user'
const session = (id = 'session-1') => ({ id, title: '日常记账', created_at: '2026-09-26T08:00:00+08:00', updated_at: '2026-09-26T09:00:00+08:00' })
const response = (sessionId, content, clientId, status = 'queued') => ({
  status, client_message_id: clientId, session: session(sessionId), error_message: status === 'failed' ? '处理失败，请重试' : null,
  user_message: { id: `user-${clientId}`, role: 'user', content, payload: { client_message_id: clientId }, records: [], created_at: '2026-09-26T09:00:00+08:00' },
  assistant_message: status === 'completed' ? {
    id: `assistant-${clientId}`, role: 'assistant', content: '已经记下。', payload: { client_message_id: clientId, status: 'ready', questions: [] },
    records: [{ id: `record-${clientId}`, record_type: 'expense', amount_cent: 2800, category_id: 'food', occurred_date: '2026-09-26', source: 'ai', created_at: '2026-09-26T09:00:01+08:00' }],
    created_at: '2026-09-26T09:00:01+08:00',
  } : null,
})
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

function createClock() {
  let now = 0
  let sequence = 0
  const timers = new Map()
  return {
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, due: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
    delays: () => [...timers.values()].map(timer => timer.due - now).sort((a, b) => a - b),
    async advance(milliseconds) {
      const target = now + milliseconds
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.due <= target).sort((a, b) => a[1].due - b[1].due)[0]
        if (!next) break
        now = next[1].due
        timers.delete(next[0])
        next[1].callback()
        await flush()
      }
      now = target
      await flush()
    },
  }
}

function setup(t, overrides = {}, options = {}) {
  const clock = createClock()
  const server = new Map((options.server || []).map(item => [item.session.id + ':' + item.client_message_id, item]))
  const calls = { discoveries: 0, queries: [], sent: [], created: 0 }
  let h
  const api = {
    listAiSessions: async () => [session()],
    listAiMessages: async (id) => overrides.listAiMessages ? overrides.listAiMessages(id) : [...server.values()].filter(item => item.session.id === id).flatMap(item => [item.user_message, ...(item.assistant_message ? [item.assistant_message] : [])]),
    listCategories: async () => [{ id: 'food', name: '餐饮', record_type: 'expense', is_enabled: true, is_system: true }],
    createAiSession: async () => { calls.created++; return overrides.createAiSession ? overrides.createAiSession() : session('created-session') },
    sendAiMessage: async (id, content, clientId) => {
      calls.sent.push({ id, content, clientId })
      if (overrides.sendAiMessage) return overrides.sendAiMessage(id, content, clientId)
      const accepted = response(id, content, clientId)
      server.set(id + ':' + clientId, accepted)
      return accepted
    },
    listPendingAiRequests: async () => {
      calls.discoveries++
      return overrides.listPendingAiRequests ? overrides.listPendingAiRequests() : [...server.values()].filter(item => ['queued', 'processing'].includes(item.status))
    },
    getAiRequest: async (id, clientId) => {
      calls.queries.push({ id, clientId })
      if (overrides.getAiRequest) return overrides.getAiRequest(id, clientId)
      const item = server.get(id + ':' + clientId)
      if (!item) throw new (h.load('src/utils/request.ts').ApiError)(404, '尚未接收')
      return item
    },
    ...(overrides.listAiSessions ? { listAiSessions: overrides.listAiSessions } : {}),
  }
  h = createHarness({
    storage: options.storage,
    globals: { Error, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout },
    mocks: { '@/api/ledger': api },
  })
  h.auth.saveSession(authenticated())
  const store = h.load('src/stores/aiRequest.ts').useAiRequestStore()
  const navigation = h.load('src/utils/navigation.ts')
  const chats = []
  const createChat = () => { const chat = h.load('src/composables/useAiChat.ts').useAiChat(); chats.push(chat); return chat }
  const close = () => { chats.forEach(chat => chat.dispose()); store.setForeground(false); store.$dispose() }
  t.after(close)
  const setStatus = (clientId, status, sessionId = 'session-1', content = '午餐 28') => {
    const item = response(sessionId, content, clientId, status)
    server.set(sessionId + ':' + clientId, item)
    return item
  }
  return { ...h, store, clock, calls, server, navigation, createChat, close, setStatus }
}

test('foreground polling displays an accepted result within two seconds without another send', async (t) => {
  const h = setup(t)
  h.store.setForeground(true)
  await flush()
  const chat = h.createChat()
  await chat.initialize()
  chat.input.value = '午餐 28'
  await chat.send()
  assert.equal(chat.processing.value, true)
  assert.equal(chat.messages.value.length, 1)
  const id = h.store.pending.id
  const previousRevision = h.navigation.ledgerRevision()
  const previousQueries = h.calls.queries.length
  h.setStatus(id, 'completed')
  await h.clock.advance(1999)
  assert.equal(h.calls.queries.length, previousQueries)
  assert.equal(chat.messages.value.length, 1)
  await h.clock.advance(1)
  assert.equal(chat.messages.value.length, 2)
  assert.equal(chat.messages.value[1].records[0].id, 'record-' + id)
  assert.equal(chat.pending.value, null)
  assert.equal(chat.processing.value, false)
  assert.equal(h.calls.sent.length, 1)
  assert.equal(h.navigation.ledgerRevision(), previousRevision + 1)
  assert.equal(h.storage.has(PENDING_KEY), false)
  assert.deepEqual(h.clock.delays(), [])
})

test('disposing the chat page leaves the application polling and ledger update alive', async (t) => {
  const h = setup(t)
  h.store.setForeground(true)
  await flush()
  const chat = h.createChat()
  await chat.initialize()
  chat.input.value = '午餐 28'
  await chat.send()
  const id = h.store.pending.id
  const previousRevision = h.navigation.ledgerRevision()
  chat.dispose()
  h.setStatus(id, 'completed')
  await h.clock.advance(2000)
  assert.equal(h.store.pending, null)
  assert.equal(h.store.lastResponse.status, 'completed')
  assert.equal(h.navigation.ledgerRevision(), previousRevision + 1)
  assert.equal(chat.messages.value.length, 1)
  const reopened = h.createChat()
  await reopened.initialize()
  assert.equal(reopened.messages.value.length, 2)
  assert.equal(h.calls.sent.length, 1)
})

test('app hide stops scheduled queries and app show immediately retrieves the completed result', async (t) => {
  const h = setup(t)
  h.store.setForeground(true)
  await flush()
  h.store.begin('午餐 28', 'session-1')
  await h.store.submit()
  const id = h.store.pending.id
  h.store.setForeground(false)
  h.setStatus(id, 'completed')
  const queryCount = h.calls.queries.length
  await h.clock.advance(60000)
  assert.equal(h.calls.queries.length, queryCount)
  assert.deepEqual(h.clock.delays(), [])
  h.store.setForeground(true)
  await flush()
  assert.equal(h.calls.queries.length, queryCount + 1)
  assert.equal(h.store.lastResponse.status, 'completed')
  assert.equal(h.store.pending, null)
  assert.equal(h.calls.sent.length, 1)
})

test('a fresh application restores an accepted request by GET without resubmitting', async (t) => {
  const previous = setup(t)
  previous.store.begin('午餐 28', 'session-1')
  await previous.store.submit()
  const saved = JSON.parse(JSON.stringify(previous.storage.get(PENDING_KEY)))
  assert.equal(saved.status, 'queued')
  previous.close()
  const completed = response('session-1', '午餐 28', saved.id, 'completed')
  const h = setup(t, {}, { storage: { [PENDING_KEY]: saved }, server: [completed] })
  h.store.setForeground(true)
  await flush()
  assert.equal(h.calls.sent.length, 0)
  assert.equal(h.calls.created, 0)
  assert.deepEqual(h.calls.queries, [{ id: 'session-1', clientId: saved.id }])
  assert.equal(h.store.lastResponse.assistant_message.records[0].id, 'record-' + saved.id)
  assert.equal(h.store.pending, null)
  assert.equal(h.storage.has(PENDING_KEY), false)
})

test('a lost send response is recovered through its original request ID without a second POST', async (t) => {
  let h
  h = setup(t, { sendAiMessage: async (id, content, clientId) => {
    h.setStatus(clientId, 'completed', id, content)
    throw new Error('网络响应丢失')
  } })
  h.store.setForeground(true)
  await flush()
  h.store.begin('午餐 28', 'session-1')
  await h.store.submit()
  const originalId = h.store.pending.id
  assert.equal(h.store.pending.status, 'unconfirmed')
  await h.clock.advance(2000)
  assert.equal(h.calls.sent.length, 1)
  assert.deepEqual(h.calls.queries, [{ id: 'session-1', clientId: originalId }])
  assert.equal(h.store.pending, null)
  assert.equal(h.store.lastResponse.status, 'completed')
})

test('failed processing stops automatic polling and explicit retries retain the same request ID', async (t) => {
  let attempts = 0
  const h = setup(t, { sendAiMessage: async (id, content, clientId) => response(id, content, clientId, ++attempts === 1 ? 'failed' : 'completed') })
  h.store.setForeground(true)
  await flush()
  h.store.begin('午餐 28', 'session-1')
  await h.store.submit()
  assert.equal(h.store.pending.status, 'failed')
  assert.equal(h.store.processing, false)
  assert.match(h.store.errorMessage, /失败/)
  assert.deepEqual(h.clock.delays(), [])
  await h.clock.advance(60000)
  assert.equal(h.calls.sent.length, 1)
  assert.equal(h.calls.queries.length, 0)
  await h.store.submit()
  assert.deepEqual(h.calls.sent[1], h.calls.sent[0])
  assert.equal(h.store.pending, null)
  assert.equal(h.store.lastResponse.status, 'completed')
})

test('switching accounts discards a late query response and preserves each users recovery cache', async (t) => {
  const oldQuery = deferred()
  const h = setup(t, { getAiRequest: () => oldQuery.promise })
  h.store.begin('午餐 28', 'session-1')
  await h.store.submit()
  const oldId = h.store.pending.id
  const checking = h.store.refresh()
  h.auth.saveSession(authenticated({ user: { id: 'another-user', phone: '13900000000', needs_phone_binding: false } }))
  await flush()
  assert.equal(h.store.pending, null)
  assert.equal(h.store.lastResponse, null)
  h.store.begin('晚餐 28', 'another-session')
  const newId = h.store.pending.id
  oldQuery.resolve(response('session-1', '午餐 28', oldId, 'completed'))
  await checking
  assert.equal(h.store.pending.id, newId)
  assert.equal(h.store.pending.content, '晚餐 28')
  assert.equal(h.store.lastResponse, null)
  assert.equal(h.storage.get(PENDING_KEY).id, oldId)
  assert.equal(h.storage.get('ledger_mate_pending_ai:another-user').id, newId)
  assert.equal(h.navigation.ledgerRevision(), 0)
})

test('switching accounts during a send ignores its late acceptance and cannot clear the new pending request', async (t) => {
  const oldSend = deferred()
  const h = setup(t, { sendAiMessage: () => oldSend.promise })
  h.store.begin('午餐 28', 'session-1')
  const oldId = h.store.pending.id
  const submitting = h.store.submit()
  h.auth.saveSession(authenticated({ user: { id: 'another-user', phone: '13900000000', needs_phone_binding: false } }))
  await flush()
  h.store.begin('晚餐 28', 'another-session')
  const newId = h.store.pending.id
  oldSend.resolve(response('session-1', '午餐 28', oldId, 'completed'))
  await submitting
  assert.equal(h.store.pending.id, newId)
  assert.equal(h.store.lastResponse, null)
  assert.equal(h.navigation.ledgerRevision(), 0)
})

test('startup discovers server pending requests even when local recovery storage is empty', async (t) => {
  const h = setup(t, {}, { server: [response('session-1', '午餐 28', 'server-task', 'processing')] })
  h.store.setForeground(true)
  await flush()
  assert.equal(h.store.pending.id, 'server-task')
  assert.equal(h.store.pending.status, 'processing')
  assert.equal(h.storage.get(PENDING_KEY).id, 'server-task')
  h.setStatus('server-task', 'completed')
  await h.clock.advance(2000)
  assert.equal(h.store.pending, null)
  assert.equal(h.store.lastResponse.status, 'completed')
  assert.equal(h.calls.sent.length, 0)
})

test('failed startup discovery retries automatically without local pending storage', async (t) => {
  let discoveries = 0
  const pending = response('session-1', '午餐 28', 'server-task', 'processing')
  const h = setup(t, { listPendingAiRequests: async () => {
    if (++discoveries === 1) throw new Error('发现请求超时')
    return [pending]
  } }, { server: [pending] })
  h.store.setForeground(true)
  await flush()
  assert.equal(h.store.pending, null)
  assert.deepEqual(h.clock.delays(), [4000])
  await h.clock.advance(4000)
  assert.equal(discoveries, 2)
  assert.equal(h.store.pending.id, 'server-task')
  h.setStatus('server-task', 'completed')
  await h.clock.advance(2000)
  assert.equal(h.store.pending, null)
  assert.equal(h.store.lastResponse.status, 'completed')
  assert.equal(h.calls.sent.length, 0)
})

test('query failures back off with a thirty second cap and never run concurrent checks', async (t) => {
  const first = deferred()
  let attempts = 0
  let h
  h = setup(t, { getAiRequest: async (id, clientId) => {
    attempts++
    if (attempts === 1) return first.promise
    if (attempts <= 6) throw new Error('查询超时')
    return response(id, '午餐 28', clientId, 'completed')
  } })
  h.store.setForeground(true)
  await flush()
  h.store.begin('午餐 28', 'session-1')
  await h.store.submit()
  await h.clock.advance(2000)
  const manual = h.store.refresh()
  const duplicate = h.store.refresh(true)
  await h.clock.advance(60000)
  assert.equal(attempts, 1)
  first.reject(new Error('查询超时'))
  await Promise.all([manual, duplicate])
  assert.deepEqual(h.clock.delays(), [4000])
  assert.match(h.store.errorMessage, /自动查询/)
  for (const delay of [4000, 8000, 16000, 30000, 30000, 30000]) {
    assert.deepEqual(h.clock.delays(), [delay])
    await h.clock.advance(delay - 1)
    const before = attempts
    await h.clock.advance(1)
    assert.equal(attempts, before + 1)
  }
  assert.equal(h.store.lastResponse.status, 'completed')
  assert.equal(h.store.pending, null)
  assert.equal(h.calls.sent.length, 1)
  assert.deepEqual(h.clock.delays(), [])
})

test('disposing the page while a new session is being created still submits the original message', async (t) => {
  const creating = deferred()
  const h = setup(t, { listAiSessions: async () => [], createAiSession: () => creating.promise })
  h.store.setForeground(true)
  await flush()
  const chat = h.createChat()
  await chat.initialize()
  chat.input.value = '午餐 28'
  const sending = chat.send()
  const originalId = h.store.pending.id
  assert.equal(h.calls.created, 1)
  assert.equal(h.calls.sent.length, 0)
  chat.dispose()
  creating.resolve(session('created-session'))
  await sending
  assert.deepEqual(h.calls.sent, [{ id: 'created-session', content: '午餐 28', clientId: originalId }])
  assert.equal(h.store.pending.status, 'queued')
  assert.equal(h.storage.get(PENDING_KEY).sessionId, 'created-session')
  h.setStatus(originalId, 'completed', 'created-session')
  await h.clock.advance(2000)
  assert.equal(h.store.pending, null)
  assert.equal(h.store.lastResponse.status, 'completed')
})

test('reopening chat while submission is in flight initializes the page once acceptance arrives', async (t) => {
  const accepted = deferred()
  const h = setup(t, { sendAiMessage: () => accepted.promise })
  h.store.setForeground(true)
  await flush()
  const chat = h.createChat()
  await chat.initialize()
  chat.input.value = '午餐 28'
  const sending = chat.send()
  const id = h.store.pending.id
  chat.dispose()
  const reopened = h.createChat()
  await reopened.initialize()
  assert.equal(reopened.loaded.value, false)
  accepted.resolve(h.setStatus(id, 'queued'))
  await sending
  await flush()
  assert.equal(reopened.loaded.value, true)
  assert.equal(reopened.sessionId.value, 'session-1')
  assert.equal(reopened.messages.value.length, 1)
  h.setStatus(id, 'completed')
  await h.clock.advance(2000)
  assert.equal(reopened.messages.value[1].records[0].id, 'record-' + id)
  assert.equal(h.calls.sent.length, 1)
})

test('editing a failed message releases the failed request and sends corrected content with a new ID', async (t) => {
  let attempts = 0
  const h = setup(t, { sendAiMessage: async (id, content, clientId) => response(id, content, clientId, ++attempts === 1 ? 'failed' : 'queued') })
  const chat = h.createChat()
  await chat.initialize()
  chat.input.value = '午餐 28'
  await chat.send()
  const oldId = h.store.pending.id
  assert.equal(h.store.pending.status, 'failed')
  chat.editFailedMessage()
  assert.equal(h.store.pending, null)
  assert.equal(chat.input.value, '午餐 28')
  assert.equal(h.storage.has(PENDING_KEY), false)
  chat.input.value = '午餐 35'
  await chat.send()
  assert.equal(h.calls.sent.length, 2)
  assert.equal(h.calls.sent[1].content, '午餐 35')
  assert.notEqual(h.calls.sent[1].clientId, oldId)
  assert.equal(h.store.pending.status, 'queued')
})

test('editing cannot discard an unconfirmed, queued or processing request', async (t) => {
  const h = setup(t)
  h.store.begin('午餐 28', 'session-1')
  const id = h.store.pending.id
  assert.equal(h.store.editFailed(), null)
  assert.equal(h.store.pending.id, id)
  assert.equal(h.store.pending.status, 'unconfirmed')
  await h.store.submit()
  assert.equal(h.store.editFailed(), null)
  assert.equal(h.store.pending.id, id)
  assert.equal(h.store.pending.status, 'queued')
  h.setStatus(id, 'processing')
  await h.store.refresh()
  assert.equal(h.store.editFailed(), null)
  assert.equal(h.store.pending.id, id)
  assert.equal(h.store.pending.status, 'processing')
  assert.equal(h.storage.get(PENDING_KEY).id, id)
})

test('multiple discovered completions update the ledger once per request despite repeated responses', async (t) => {
  const first = response('session-1', '午餐 28', 'request-1', 'completed')
  const second = response('session-2', '午餐 28', 'request-2', 'completed')
  const firstPending = response('session-1', '午餐 28', 'request-1')
  const secondPending = response('session-2', '午餐 28', 'request-2')
  const h = setup(t, { listPendingAiRequests: async () => [firstPending, secondPending, firstPending, secondPending] }, { server: [first, second] })
  await h.store.refresh(true)
  assert.equal(h.navigation.ledgerRevision(), 2)
  assert.equal(h.store.lastResponse.client_message_id, 'request-2')
  await h.store.refresh(true)
  await h.store.refresh(true)
  assert.equal(h.navigation.ledgerRevision(), 2)
  assert.equal(h.calls.sent.length, 0)
  assert.equal(h.calls.queries.length, 2)
})

test('one failing request does not prevent another request from displaying its completed result', async (t) => {
  const first = response('session-1', 'lunch', 'request-1')
  const second = response('session-2', 'dinner', 'request-2')
  const h = setup(t, {
    listPendingAiRequests: async () => [first, second],
    getAiRequest: async (id, clientId) => {
      if (clientId === 'request-1') throw new Error('temporarily unavailable')
      return response(id, 'dinner', clientId, 'completed')
    },
  })
  await h.store.refresh(true)
  assert.equal(h.store.lastResponse.client_message_id, 'request-2')
  assert.equal(h.store.lastResponse.status, 'completed')
  assert.equal(h.navigation.ledgerRevision(), 1)
  assert.equal(h.store.pending.id, 'request-1')
})

test('stale history cannot erase current-session completion when another session completes afterwards', async (t) => {
  const delayedHistory = deferred()
  let historyCalls = 0
  const first = response('session-1', 'lunch', 'request-1')
  const second = response('session-2', 'dinner', 'request-2')
  const h = setup(t, { listAiMessages: async () => ++historyCalls === 1 ? [first.user_message] : delayedHistory.promise }, { server: [first, second] })
  h.store.setForeground(true)
  await flush()
  const chat = h.createChat()
  await chat.initialize()
  const loading = chat.initialize(true)
  await flush()
  h.setStatus('request-1', 'completed', 'session-1', 'lunch')
  h.setStatus('request-2', 'completed', 'session-2', 'dinner')
  await h.clock.advance(2000)
  assert.equal(h.store.lastResponse.session.id, 'session-2')
  assert.equal(chat.messages.value[1].records[0].id, 'record-request-1')
  delayedHistory.resolve([first.user_message])
  await loading
  assert.equal(chat.messages.value.length, 2)
  assert.equal(chat.messages.value[1].records[0].id, 'record-request-1')
  assert.equal(chat.messages.value.some(message => message.id.includes('request-2')), false)
})
