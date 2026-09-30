const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness, flush } = require('./helpers.cjs')

const PENDING_KEY = 'ledger_mate_pending_ai:test-user'
const session = (id = 'latest-session') => ({ id, title: '日常记账', created_at: '2026-09-26T08:00:00+08:00', updated_at: '2026-09-26T09:00:00+08:00' })
const record = (id = 'record-1', amount = 2800) => ({ id, record_type: 'expense', amount_cent: amount, category_id: 'food', occurred_date: '2026-09-26', note: '午餐', source: 'ai', created_at: '2026-09-26T09:00:00+08:00' })
const response = (sessionId, content, clientId, records = [record()], time = '09:00') => ({
  status: 'completed', client_message_id: clientId, error_message: null,
  session: session(sessionId),
  user_message: { id: `user-${clientId}`, role: 'user', content, payload: { client_message_id: clientId }, records: [], created_at: `2026-09-26T${time}:00+08:00` },
  assistant_message: { id: `assistant-${clientId}`, role: 'assistant', content: records.length ? '已经记下。' : '这笔金额是多少？', payload: { status: records.length ? 'ready' : 'needs_clarification', client_message_id: clientId, questions: records.length ? [] : ['这笔金额是多少？'] }, records, created_at: `2026-09-26T${time}:01+08:00` },
})

function setup(overrides = {}, options = {}) {
  let h
  const requests = { sessions: 0, histories: [], created: 0, sent: [], deleted: [], categories: 0 }
  const api = {
    listAiSessions: async () => { requests.sessions += 1; return [session()] },
    listCategories: async () => { requests.categories += 1; return [{ id: 'food', name: '餐饮', record_type: 'expense', is_enabled: true, is_system: true }] },
    listAiMessages: async (id) => { requests.histories.push(id); return [] },
    createAiSession: async () => { requests.created += 1; return session('created-session') },
    sendAiMessage: async (id, content, clientId) => { requests.sent.push({ id, content, clientId }); return response(id, content, clientId) },
    listPendingAiRequests: async () => [],
    getAiRequest: async () => { throw new (h.load('src/utils/request.ts').ApiError)(404, 'not received') },
    deleteRecord: async (id) => { requests.deleted.push(id) },
    ...overrides,
  }
  h = createHarness({ ...options, globals: { Error, ...options.globals }, mocks: { '@/api/ledger': api, ...options.mocks } })
  h.auth.saveSession(authenticated())
  const chat = h.load('src/composables/useAiChat.ts').useAiChat()
  const revision = h.load('src/utils/navigation.ts')
  const { ApiError } = h.load('src/utils/request.ts')
  return { ...h, chat, requests, revision, ApiError }
}

test('initializes the latest session, chronological history and real category names', async () => {
  const previous = response('latest-session', '午餐 28', 'old')
  const h = setup({
    listAiSessions: async () => [session(), session('older-session')],
    listAiMessages: async (id) => { assert.equal(id, 'latest-session'); return [previous.user_message, previous.assistant_message] },
  })
  await h.chat.initialize()
  assert.equal(h.chat.loaded.value, true)
  assert.equal(h.chat.sessionId.value, 'latest-session')
  assert.equal(h.chat.messages.value[0].role, 'user')
  assert.equal(h.chat.messages.value[1].records[0].amount_cent, 2800)
  assert.equal(h.chat.names.value.get('food'), '餐饮')
  assert.equal(h.chat.errorMessage.value, '')
})

test('first send creates one session then automatically sends and signals a ledger change', async () => {
  const h = setup({ listAiSessions: async () => [] })
  await h.chat.initialize()
  h.chat.input.value = '  午餐 28 元  '
  await h.chat.send()
  assert.equal(h.requests.created, 1)
  assert.equal(h.requests.sent.length, 1)
  assert.equal(h.requests.sent[0].id, 'created-session')
  assert.equal(h.requests.sent[0].content, '午餐 28 元')
  assert.ok(h.requests.sent[0].clientId.length > 0 && h.requests.sent[0].clientId.length <= 100)
  assert.equal(h.chat.pending.value, null)
  assert.equal(h.storage.has(PENDING_KEY), false)
  assert.equal(h.chat.messages.value.length, 2)
  assert.equal(h.revision.ledgerRevision(), 1)
})

test('uncertain request retries the same stable id, content and session without another session', async () => {
  const attempts = []
  const h = setup({
    listAiSessions: async () => [],
    sendAiMessage: async (id, content, clientId) => {
      attempts.push({ id, content, clientId })
      if (attempts.length === 1) throw new Error('网络超时')
      return response(id, content, clientId)
    },
  })
  await h.chat.initialize()
  h.chat.input.value = '午餐 28'
  await h.chat.send()
  assert.equal(h.chat.sending.value, false)
  assert.equal(h.chat.visibleMessages.value.length, 1)
  assert.match(h.chat.errorMessage.value, /同一次请求/)
  const stored = h.storage.get(PENDING_KEY)
  assert.equal(stored.sessionId, 'created-session')
  assert.equal(stored.id, attempts[0].clientId)
  h.chat.input.value = '此时输入的新内容不可替换待重试内容'
  await h.chat.send()
  assert.deepEqual(attempts[1], attempts[0])
  assert.equal(h.requests.created, 1)
  assert.equal(h.chat.visibleMessages.value.length, 2)
  assert.equal(h.chat.pending.value, null)
})

test('concurrent send clicks show one optimistic message and submit only once', async () => {
  let finish
  let calls = 0
  const h = setup({ sendAiMessage: (id, content, clientId) => {
    calls += 1
    return new Promise(resolve => { finish = () => resolve(response(id, content, clientId)) })
  } })
  await h.chat.initialize()
  h.chat.input.value = '午餐 28'
  const sending = h.chat.send()
  await flush()
  assert.equal(h.chat.sending.value, true)
  assert.equal(h.chat.visibleMessages.value.length, 1)
  await h.chat.send()
  assert.equal(calls, 1)
  assert.equal(h.chat.visibleMessages.value.length, 1)
  finish()
  await sending
  assert.equal(h.chat.visibleMessages.value.length, 2)
  assert.equal(h.chat.sending.value, false)
})

test('clarification response keeps real questions without changing ledger revision', async () => {
  const h = setup({ sendAiMessage: async (id, content, clientId) => response(id, content, clientId, []) })
  await h.chat.initialize()
  h.chat.input.value = '吃了午饭'
  await h.chat.send()
  assert.equal(h.chat.messages.value[1].payload.status, 'needs_clarification')
  assert.equal(h.chat.messages.value[1].records.length, 0)
  assert.equal(h.revision.ledgerRevision(), 0)
  assert.equal(h.chat.pending.value, null)
})

test('completed history clears the pending request in its original session without reposting', async () => {
  const pending = { id: 'saved-request', content: '午餐 28', sessionId: 'older-session' }
  const old = response('older-session', pending.content, pending.id)
  const histories = []
  const h = setup({
    listAiSessions: async () => [session(), session('older-session')],
    listAiMessages: async (id) => { histories.push(id); return [old.user_message, old.assistant_message] },
  }, { storage: { [PENDING_KEY]: pending } })
  await h.chat.initialize()
  assert.equal(h.chat.sessionId.value, 'older-session')
  assert.equal(h.chat.pending.value, null)
  assert.equal(h.storage.has(PENDING_KEY), false)
  assert.equal(h.chat.visibleMessages.value.length, 2)
  await h.chat.selectSession('latest-session')
  assert.equal(h.chat.sessionId.value, 'latest-session')
  assert.equal(histories.length, 2)
  assert.equal(h.requests.sent.length, 0)
  assert.equal(h.chat.visibleMessages.value.length, 2)
  assert.equal(h.chat.pending.value, null)
})

test('recovering an already saved old request preserves the chronology of newer messages', async () => {
  const pending = { id: 'old-request', content: '午餐 28', sessionId: 'latest-session' }
  const old = response('latest-session', pending.content, pending.id, [record()], '09:00')
  const newer = response('latest-session', '晚餐 36', 'newer-request', [record('record-2', 3600)], '18:00')
  const h = setup({
    listAiMessages: async () => [old.user_message, old.assistant_message, newer.user_message, newer.assistant_message],
    sendAiMessage: async () => old,
  }, { storage: { [PENDING_KEY]: pending } })
  await h.chat.initialize()
  await h.chat.send()
  assert.equal(h.chat.messages.value.map(message => message.id).join(','), [old.user_message.id, old.assistant_message.id, newer.user_message.id, newer.assistant_message.id].join(','))
})

test('pending requests prevent switching and creating a new conversation', async () => {
  const h = setup({ sendAiMessage: async () => { throw new Error('网络超时') } })
  await h.chat.initialize()
  h.chat.input.value = '午餐 28'
  await h.chat.send()
  const historyCount = h.requests.histories.length
  await h.chat.selectSession(null)
  await h.chat.selectSession('other-session')
  assert.equal(h.chat.sessionId.value, 'latest-session')
  assert.equal(h.requests.histories.length, historyCount)
  assert.equal(h.requests.created, 0)
})

test('definitive HTTP 400 and 422 restore input and release the pending lock', async () => {
  for (const status of [400, 422]) {
    let failure
    const h = setup({ sendAiMessage: async () => { throw failure } })
    failure = new h.ApiError(status, '消息格式有误')
    await h.chat.initialize()
    h.chat.input.value = '午餐 28'
    await h.chat.send()
    assert.equal(h.chat.input.value, '午餐 28')
    assert.equal(h.chat.pending.value, null)
    assert.equal(h.chat.sending.value, false)
    assert.equal(h.storage.has(PENDING_KEY), false)
    await h.chat.selectSession(null)
    assert.equal(h.chat.sessionId.value, null)
  }
})

test('successful delete removes a record from all cards and notifies other pages', async () => {
  const first = response('latest-session', '午餐', 'first', [record(), record('keep-record', 500)])
  const second = response('latest-session', '午餐查询', 'second', [record()])
  const h = setup({ listAiMessages: async () => [first.assistant_message, second.assistant_message] })
  await h.chat.initialize()
  assert.equal(await h.chat.removeRecord('record-1'), true)
  assert.equal(h.requests.deleted.join(','), 'record-1')
  assert.equal(h.chat.messages.value[0].records.length, 1)
  assert.equal(h.chat.messages.value[0].records[0].id, 'keep-record')
  assert.equal(h.chat.messages.value[1].records.length, 0)
  assert.equal(h.revision.ledgerRevision(), 1)
  assert.equal(h.chat.deletingId.value, '')
})

test('failed delete preserves the record and exposes a retryable error', async () => {
  const old = response('latest-session', '午餐', 'old')
  const h = setup({ listAiMessages: async () => [old.assistant_message], deleteRecord: async () => { throw new Error('删除失败') } })
  await h.chat.initialize()
  assert.equal(await h.chat.removeRecord('record-1'), false)
  assert.equal(h.chat.messages.value[0].records[0].id, 'record-1')
  assert.equal(h.revision.ledgerRevision(), 0)
  assert.equal(h.chat.errorMessage.value, '删除失败')
})

test('returning from record editor refreshes changed linked records and skips unchanged reloads', async () => {
  let amount = 2800
  let historyCalls = 0
  const h = setup({ listAiMessages: async () => {
    historyCalls += 1
    const old = response('latest-session', '午餐', 'old', [record('record-1', amount)])
    return [old.user_message, old.assistant_message]
  } })
  await h.chat.initialize()
  await h.chat.initialize()
  assert.equal(historyCalls, 1)
  amount = 3200
  h.revision.markLedgerChanged()
  await h.chat.initialize()
  assert.equal(historyCalls, 2)
  assert.equal(h.chat.messages.value[1].records[0].amount_cent, 3200)
  await h.chat.initialize()
  assert.equal(historyCalls, 2)
})

test('failure to persist a new pending message never submits or clears the input', async () => {
  const h = setup()
  await h.chat.initialize()
  const save = h.uni.setStorageSync
  h.uni.setStorageSync = (key, value) => {
    if (key === PENDING_KEY) throw new Error('storage full')
    save(key, value)
  }
  h.chat.input.value = '午餐 28'
  await h.chat.send()
  assert.equal(h.requests.sent.length, 0)
  assert.equal(h.chat.input.value, '午餐 28')
  assert.equal(h.chat.pending.value, null)
  assert.match(h.chat.errorMessage.value, /存储/)
})

test('disposing leaves the application request alive and completion clears pending and refreshes the ledger', async () => {
  let finish
  const h = setup({ sendAiMessage: (id, content, clientId) => new Promise(resolve => {
    finish = () => resolve(response(id, content, clientId))
  }) })
  await h.chat.initialize()
  h.chat.input.value = '午餐 28'
  const sending = h.chat.send()
  await flush()
  h.chat.dispose()
  finish()
  await sending
  assert.equal(h.chat.messages.value.length, 0)
  assert.equal(h.storage.has(PENDING_KEY), false)
  assert.equal(h.revision.ledgerRevision(), 1)
})

test('a late confirmed save from an old login cannot invalidate a different account ledger', async () => {
  let finish
  const h = setup({ sendAiMessage: (id, content, clientId) => new Promise(resolve => {
    finish = () => resolve(response(id, content, clientId))
  }) })
  await h.chat.initialize()
  h.chat.input.value = '午餐 28'
  const sending = h.chat.send()
  await flush()
  const pendingId = h.storage.get(PENDING_KEY).id
  h.chat.dispose()
  h.auth.saveSession(authenticated({ user: { id: 'other-user', phone: '13900000000', needs_phone_binding: false } }))
  finish()
  await sending
  assert.equal(h.revision.ledgerRevision(), 0)
  assert.equal(h.chat.messages.value.length, 0)
  assert.equal(h.storage.get(PENDING_KEY).id, pendingId)
  assert.equal(h.storage.has('ledger_mate_pending_ai:other-user'), false)
})

test('a late save from a previous session of the same user also stays isolated', async () => {
  let finish
  const h = setup({ sendAiMessage: (id, content, clientId) => new Promise(resolve => {
    finish = () => resolve(response(id, content, clientId))
  }) })
  await h.chat.initialize()
  h.chat.input.value = '午餐 28'
  const sending = h.chat.send()
  await flush()
  h.auth.saveSession(authenticated())
  finish()
  await sending
  assert.equal(h.revision.ledgerRevision(), 0)
  assert.equal(h.chat.messages.value.length, 0)
  assert.ok(h.chat.pending.value)
})

test('deleting from a closed chat still invalidates records for the same login', async () => {
  let finish
  const h = setup({ deleteRecord: () => new Promise(resolve => { finish = resolve }) })
  await h.chat.initialize()
  const removing = h.chat.removeRecord('record-1')
  h.chat.dispose()
  finish()
  assert.equal(await removing, false)
  assert.equal(h.revision.ledgerRevision(), 1)
})

test('a restored pending message remains retryable after a successful initialization with no error', async () => {
  let finish
  const pending = { id: 'restored-pending', content: '午餐 28', sessionId: 'latest-session' }
  const h = setup({ sendAiMessage: (id, content, clientId) => new Promise(resolve => {
    finish = () => resolve(response(id, content, clientId))
  }) }, { storage: { [PENDING_KEY]: pending } })
  assert.equal(h.chat.canRetryPending.value, false)
  await h.chat.initialize()
  assert.equal(h.chat.errorMessage.value, '')
  assert.equal(h.chat.loaded.value, true)
  assert.equal(h.chat.canRetryPending.value, true)
  const retry = h.chat.send()
  assert.equal(h.chat.canRetryPending.value, false)
  await flush()
  finish()
  await retry
  assert.equal(h.chat.pending.value, null)
  assert.equal(h.chat.canRetryPending.value, false)
})

test('a restored new-session request does not load or mix the latest existing conversation', async () => {
  const pending = { id: 'new-session-pending', content: '午餐 28', sessionId: null }
  const old = response('latest-session', '旧会话晚饭', 'old')
  let historyCalls = 0
  const h = setup({ listAiMessages: async () => {
    historyCalls += 1
    return [old.user_message, old.assistant_message]
  } }, { storage: { [PENDING_KEY]: pending } })
  await h.chat.initialize()
  assert.equal(h.chat.sessionId.value, null)
  assert.equal(historyCalls, 0)
  assert.equal(h.chat.messages.value.length, 0)
  assert.equal(h.chat.visibleMessages.value.length, 1)
  await h.chat.send()
  assert.equal(h.requests.created, 1)
  assert.equal(h.requests.sent[0].id, 'created-session')
  assert.equal(h.requests.sent[0].clientId, pending.id)
  assert.equal(h.chat.messages.value.length, 2)
  assert.equal(h.chat.messages.value.some(item => item.id === old.user_message.id), false)
})

test('every retry persists the created session before sending after a storage failure', async () => {
  const h = setup({ listAiSessions: async () => [] })
  await h.chat.initialize()
  const save = h.uni.setStorageSync
  let storageFailing = true
  h.uni.setStorageSync = (key, value) => {
    if (key === PENDING_KEY && value.sessionId && storageFailing) throw new Error('storage full')
    save(key, value)
  }
  h.chat.input.value = '午餐 28'
  await h.chat.send()
  const pendingId = h.chat.pending.value.id
  assert.equal(h.requests.created, 1)
  assert.equal(h.requests.sent.length, 0)
  assert.equal(h.storage.get(PENDING_KEY).sessionId, null)
  assert.equal(h.chat.pending.value.sessionId, 'created-session')
  await h.chat.send()
  assert.equal(h.requests.sent.length, 0)
  assert.equal(h.requests.created, 1)
  assert.match(h.chat.errorMessage.value, /存储/)
  storageFailing = false
  await h.chat.send()
  assert.equal(h.requests.sent.length, 1)
  assert.equal(h.requests.sent[0].id, 'created-session')
  assert.equal(h.requests.sent[0].clientId, pendingId)
  assert.equal(h.chat.pending.value, null)
})

test('a ledger change during history loading triggers a refresh when the cached chat returns', async () => {
  let finish
  let historyCalls = 0
  const initial = response('latest-session', '午餐 28', 'old', [record('record-1', 2800)])
  const updated = response('latest-session', '午餐 28', 'old', [record('record-1', 4500)])
  const h = setup({ listAiMessages: async () => {
    historyCalls += 1
    if (historyCalls === 1) return new Promise(resolve => { finish = () => resolve([initial.user_message, initial.assistant_message]) })
    return [updated.user_message, updated.assistant_message]
  } })
  const loading = h.chat.initialize()
  await flush()
  h.revision.markLedgerChanged()
  finish()
  await loading
  assert.equal(h.chat.messages.value[1].records[0].amount_cent, 2800)
  await h.chat.initialize()
  assert.equal(historyCalls, 2)
  assert.equal(h.chat.messages.value[1].records[0].amount_cent, 4500)
  await h.chat.initialize()
  assert.equal(historyCalls, 2)
})

test('a restored pending request waits for initialization retry after loading fails', async () => {
  const pending = { id: 'pending-after-load-error', content: '午餐 28', sessionId: 'latest-session' }
  let failed = true
  const h = setup({ listAiSessions: async () => {
    if (failed) throw new Error('加载失败')
    return [session()]
  } }, { storage: { [PENDING_KEY]: pending } })
  await h.chat.initialize()
  assert.equal(h.chat.loaded.value, false)
  assert.equal(h.chat.canRetryPending.value, false)
  await h.chat.send()
  assert.equal(h.requests.sent.length, 0)
  failed = false
  await h.chat.initialize(true)
  assert.equal(h.chat.errorMessage.value, '')
  assert.equal(h.chat.canRetryPending.value, true)
})

test('legacy history with missing or null records becomes safe message arrays', async () => {
  const legacy = response('latest-session', '午餐 28', 'legacy')
  delete legacy.user_message.records
  legacy.assistant_message.records = null
  const h = setup({ listAiMessages: async () => [legacy.user_message, legacy.assistant_message] })
  await h.chat.initialize()
  assert.equal(h.chat.loaded.value, true)
  assert.equal(h.chat.errorMessage.value, '')
  assert.equal(h.chat.visibleMessages.value.length, 2)
  for (const message of h.chat.visibleMessages.value) {
    assert.equal(Array.isArray(message.records), true)
    assert.equal(message.records.length, 0)
  }
  assert.equal(h.chat.visibleMessages.value[1].content, legacy.assistant_message.content)
  await h.chat.selectSession('older-session')
  assert.equal(h.chat.sessionId.value, 'older-session')
  assert.equal(h.chat.messages.value[1].records.length, 0)
})

test('legacy send responses without linked records preserve real reply text without inventing cards', async () => {
  const h = setup({ sendAiMessage: async (id, content, clientId) => {
    const result = response(id, content, clientId, [])
    delete result.user_message.records
    result.assistant_message.records = null
    return result
  } })
  await h.chat.initialize()
  h.chat.input.value = '午餐'
  await h.chat.send()
  assert.equal(h.chat.pending.value, null)
  assert.equal(h.chat.errorMessage.value, '')
  assert.equal(h.chat.messages.value[1].content, '这笔金额是多少？')
  assert.equal(h.chat.messages.value.every(message => Array.isArray(message.records) && message.records.length === 0), true)
  assert.equal(h.revision.ledgerRevision(), 0)
})

test('malformed history lists and record collections expose retryable errors instead of reaching the renderer', async () => {
  const old = response('latest-session', '午餐', 'old')
  for (const malformed of [{ items: [] }, null, [null], [{ ...old.assistant_message, records: {} }], [{ ...old.assistant_message, records: [null] }]]) {
    let failed = true
    const h = setup({ listAiMessages: async () => failed ? malformed : [old.user_message, old.assistant_message] })
    await h.chat.initialize()
    assert.equal(h.chat.loaded.value, false)
    assert.match(h.chat.errorMessage.value, /格式异常/)
    assert.equal(h.chat.visibleMessages.value.length, 0)
    failed = false
    await h.chat.initialize(true)
    assert.equal(h.chat.loaded.value, true)
    assert.equal(h.chat.errorMessage.value, '')
    assert.equal(h.chat.messages.value[1].records[0].id, 'record-1')
  }
})

test('invalid session and category lists fail visibly before exposing data to the page', async () => {
  for (const overrides of [{ listAiSessions: async () => ({ items: [] }) }, { listCategories: async () => null }]) {
    const h = setup(overrides)
    await h.chat.initialize()
    assert.equal(h.chat.loaded.value, false)
    assert.match(h.chat.errorMessage.value, /格式异常/)
    assert.equal(h.requests.sent.length, 0)
    assert.equal(h.chat.messages.value.length, 0)
  }
})

test('malformed AI replies keep the original pending request until a valid retry confirms it', async () => {
  for (const corrupt of [
    (result) => ({ ...result, session: null }),
    (result) => ({ ...result, assistant_message: { ...result.assistant_message, role: 'user' } }),
    (result) => ({ ...result, assistant_message: { ...result.assistant_message, records: {} } }),
  ]) {
    const attempts = []
    const h = setup({ sendAiMessage: async (id, content, clientId) => {
      attempts.push({ id, content, clientId })
      const result = response(id, content, clientId)
      return attempts.length === 1 ? corrupt(result) : result
    } })
    await h.chat.initialize()
    h.chat.input.value = '午餐 28'
    await h.chat.send()
    assert.ok(h.chat.pending.value)
    assert.equal(h.chat.messages.value.length, 0)
    assert.equal(h.revision.ledgerRevision(), 0)
    assert.ok(h.chat.errorMessage.value)
    await h.chat.send()
    assert.deepEqual(attempts[1], attempts[0])
    assert.equal(h.chat.pending.value, null)
    assert.equal(h.chat.messages.value.length, 2)
    assert.equal(h.revision.ledgerRevision(), 1)
  }
})

test('chat viewport accounts for overlay keyboards and already resized windows exactly once', () => {
  const { chatViewportHeight, chatSafeBottom } = createHarness().load('src/utils/chatLayout.ts')
  assert.equal(chatViewportHeight(844, 844, 380), 464)
  assert.equal(chatViewportHeight(844, 464, 380), 464)
  assert.equal(chatViewportHeight(844, 844, 0), 844)
  assert.equal(chatViewportHeight(844, 720, 0), 720)
  assert.equal(chatViewportHeight(0, 0, 0), 0)
  assert.equal(chatViewportHeight(844, 844, Number.NaN), 844)
  assert.equal(chatViewportHeight(844, 844, -20), 844)
  assert.equal(chatSafeBottom(844, 810), 34)
  assert.equal(chatSafeBottom(844, undefined), 0)
  assert.equal(chatSafeBottom(844, 900), 0)
})
