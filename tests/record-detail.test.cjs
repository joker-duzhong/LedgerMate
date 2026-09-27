const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness } = require('./helpers.cjs')

const record = { id: 'record-1', record_type: 'expense', amount_cent: 2450, category_id: 'food', payment_method_id: 'cash', occurred_date: '2026-09-26', note: '午饭', source: 'ai_text', created_at: '2026-09-26T00:00:00Z' }
const categories = [{ id: 'food', name: '餐饮', record_type: 'expense', is_enabled: true, is_system: true }]
const payments = [{ id: 'cash', name: '现金', is_enabled: true }]

function detailHarness() {
  let changes = 0
  const h = createHarness({ mocks: { '@/utils/navigation': { markLedgerChanged: () => { changes += 1 } } } })
  h.auth.saveSession(authenticated())
  const { useRecordDetail } = h.load('src/composables/useRecordDetail.ts')
  return { ...h, detail: useRecordDetail(), changes: () => changes }
}

async function prepare(h) {
  const load = h.detail.load(record.id)
  h.respond(h.calls[0], 200, record)
  h.respond(h.calls[1], 200, categories)
  h.respond(h.calls[2], 200, payments)
  await load
}

test('record detail resolves category, payment, source and keeps a date-only record', async () => {
  const h = detailHarness()
  await prepare(h)
  assert.equal(h.detail.loading.value, false)
  assert.equal(h.detail.categoryName.value, '餐饮')
  assert.equal(h.detail.paymentName.value, '现金')
  assert.equal(h.detail.sourceName.value, '文字记账')
  assert.equal(h.detail.record.value.occurred_date, '2026-09-26')
})

test('a missing detail identifier produces a visible error without network requests', async () => {
  const h = detailHarness()
  await h.detail.load('')
  assert.equal(h.calls.length, 0)
  assert.match(h.detail.loadError.value, /没有找到/)
  assert.equal(await h.detail.remove(), false)
})

test('an older detail request cannot overwrite a newer record', async () => {
  const h = detailHarness()
  const first = h.detail.load('old')
  const second = h.detail.load('new')
  h.respond(h.calls[3], 200, { ...record, id: 'new', note: '新记录' })
  h.respond(h.calls[4], 200, categories)
  h.respond(h.calls[5], 200, payments)
  await second
  h.respond(h.calls[0], 200, { ...record, id: 'old' })
  h.respond(h.calls[1], 200, categories)
  h.respond(h.calls[2], 200, payments)
  await first
  assert.equal(h.detail.record.value.id, 'new')
})

test('detail load failures expose a retry and successful retries clear the error', async () => {
  const h = detailHarness()
  const initial = h.detail.load(record.id)
  h.calls[0].fail({ errMsg: 'timeout' })
  h.respond(h.calls[1], 200, categories)
  h.respond(h.calls[2], 200, payments)
  await initial
  assert.ok(h.detail.loadError.value)
  const retry = h.detail.load()
  h.respond(h.calls[3], 200, record)
  h.respond(h.calls[4], 200, categories)
  h.respond(h.calls[5], 200, payments)
  await retry
  assert.equal(h.detail.loadError.value, '')
  assert.equal(h.detail.record.value.id, record.id)
})

test('delete ignores duplicate taps and notifies other tabs after success', async () => {
  const h = detailHarness()
  await prepare(h)
  const pending = h.detail.remove()
  assert.equal(h.calls[3].method, 'DELETE')
  assert.equal(await h.detail.remove(), false)
  assert.equal(h.calls.length, 4)
  h.respond(h.calls[3], 200, null)
  assert.equal(await pending, true)
  assert.equal(h.detail.deleted.value, true)
  assert.equal(h.changes(), 1)
})

test('an uncertain delete can retry and accept a record already removed on the server', async () => {
  const h = detailHarness()
  await prepare(h)
  const first = h.detail.remove()
  h.calls[3].fail({ errMsg: 'timeout' })
  assert.equal(await first, false)
  assert.ok(h.detail.errorMessage.value)
  assert.equal(h.changes(), 0)
  const retry = h.detail.remove()
  h.respond(h.calls[4], 404, null, '账单不存在')
  assert.equal(await retry, true)
  assert.equal(h.changes(), 1)
})

test('successful deletion invalidates ledger data even if detail was closed meanwhile', async () => {
  const h = detailHarness()
  await prepare(h)
  const pending = h.detail.remove()
  h.detail.dispose()
  h.respond(h.calls[3], 200, null)
  assert.equal(await pending, false)
  assert.equal(h.changes(), 1)
})
