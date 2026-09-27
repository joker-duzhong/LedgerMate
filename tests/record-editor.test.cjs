const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness } = require('./helpers.cjs')

const categories = [
  { id: 'food', name: '餐饮', record_type: 'expense', is_enabled: true, is_system: true },
  { id: 'transport', name: '交通', record_type: 'expense', is_enabled: true, is_system: true },
  { id: 'salary', name: '工资', record_type: 'income', is_enabled: true, is_system: true },
]
const payments = [{ id: 'cash', name: '现金', is_default: true, is_enabled: true }]
const record = {
  id: 'existing-record', record_type: 'expense', amount_cent: 1520, category_id: 'food', payment_method_id: 'cash',
  occurred_date: '2026-09-26', note: '午餐', source: 'manual', created_at: '2026-09-26T00:00:00Z',
}

function editorHarness() {
  let ledgerChanges = 0
  const h = createHarness({ mocks: { '@/utils/navigation': { markLedgerChanged: () => { ledgerChanges += 1 } } } })
  h.auth.saveSession(authenticated())
  const { useRecordEditor } = h.load('src/composables/useRecordEditor.ts')
  return { ...h, editor: useRecordEditor(), ledgerChanges: () => ledgerChanges }
}

async function prepare(h, editing = false) {
  const loading = h.editor.load(editing ? record.id : '')
  h.respond(h.calls[0], 200, categories)
  h.respond(h.calls[1], 200, payments)
  if (editing) h.respond(h.calls[2], 200, record)
  await loading
}

test('amount parsing enforces the backend limit without rounding invalid precision', () => {
  const h = createHarness()
  const { parseRecordAmount } = h.load('src/utils/recordEditor.ts')
  assert.equal(parseRecordAmount('0.01'), 1)
  assert.equal(parseRecordAmount('12.30'), 1230)
  assert.equal(parseRecordAmount('1000000.00'), 100000000)
  for (const amount of ['', '0', '0.00', '-1', '1.001', 'NaN', 'Infinity', '1e3', '12a', '1000000.01', '90071992547409.92']) {
    assert.equal(parseRecordAmount(amount), null, amount)
  }
})

test('record dates stay date-only without timezone conversion or fabricated time', () => {
  const h = createHarness()
  const { localRecordFields, draftToPayload } = h.load('src/utils/recordEditor.ts')
  const local = localRecordFields(record.occurred_date)
  assert.equal(local.occurredDate, '2026-09-26')
  assert.equal(local.occurredTime, undefined)
  const payload = draftToPayload({ recordType: 'expense', amount: '15.20', categoryId: 'food', paymentMethodId: '', note: '', ...local })
  assert.equal(payload.occurred_date, record.occurred_date)
  assert.equal(Object.hasOwn(payload, 'occurred_at'), false)
  assert.throws(() => localRecordFields('not-a-date'))
  assert.throws(() => localRecordFields('2026-09-26T00:00:00Z'))
  assert.throws(() => draftToPayload({ recordType: 'expense', amount: '1', categoryId: 'food', paymentMethodId: '', note: '', occurredDate: '2026-02-30' }))
})

test('editor starts clean, uses the default payment method and switches categories with record type', async () => {
  const h = editorHarness()
  await prepare(h)
  assert.equal(h.editor.draft.paymentMethodId, 'cash')
  assert.equal(h.editor.draft.categoryId, 'food')
  assert.equal(h.editor.dirty.value, false)
  h.editor.changeType('income')
  assert.equal(h.editor.draft.categoryId, 'salary')
  assert.equal(h.editor.filteredCategories.value.length, 1)
  assert.equal(h.editor.dirty.value, true)
})

test('invalid amounts and missing categories never send create requests', async () => {
  const h = editorHarness()
  await prepare(h)
  h.editor.draft.amount = '90071992547409.92'
  assert.equal(await h.editor.save(), false)
  assert.equal(h.calls.length, 2)
  h.editor.draft.amount = '10.00'
  h.editor.draft.categoryId = ''
  assert.equal(await h.editor.save(), false)
  assert.equal(h.calls.length, 2)
  assert.match(h.editor.errorMessage.value, /分类/)
})

test('a failed create retries the exact payload and idempotency key; repeated taps are ignored', async () => {
  const h = editorHarness()
  await prepare(h)
  h.editor.draft.amount = '12.34'
  const first = h.editor.save()
  const request = h.calls[2]
  assert.equal(request.method, 'POST')
  assert.equal(request.data.amount_cent, 1234)
  assert.ok(request.data.idempotency_key)
  assert.equal(await h.editor.save(), false)
  assert.equal(h.calls.length, 3)
  h.calls[2].fail({ errMsg: 'request:fail timeout' })
  assert.equal(await first, false)
  assert.equal(h.editor.fieldsLocked.value, true)
  assert.equal(h.editor.dirty.value, true)
  h.editor.changeType('income')
  assert.equal(h.editor.draft.recordType, 'expense')
  h.editor.draft.amount = '999'
  const retry = h.editor.save()
  assert.equal(JSON.stringify(h.calls[3].data), JSON.stringify(request.data))
  h.respond(h.calls[3], 200, { ...record, id: 'new-record' })
  assert.equal(await retry, true)
  assert.equal(h.editor.pendingCreate.value, null)
  assert.equal(h.editor.dirty.value, false)
  assert.equal(await h.editor.save(), false)
  assert.equal(h.calls.length, 4)
  assert.equal(h.ledgerChanges(), 1)
})

test('save-and-continue clears the amount and note and creates a new key for the next entry', async () => {
  const h = editorHarness()
  await prepare(h)
  h.editor.draft.amount = '25.00'
  h.editor.draft.note = '早餐'
  const first = h.editor.save(true)
  const firstKey = h.calls[2].data.idempotency_key
  h.respond(h.calls[2], 200, record)
  assert.equal(await first, true)
  assert.equal(h.editor.draft.amount, '')
  assert.equal(h.editor.draft.note, '')
  assert.equal(h.editor.draft.categoryId, 'food')
  assert.equal(h.editor.draft.paymentMethodId, 'cash')
  assert.equal(h.editor.dirty.value, false)
  h.editor.draft.amount = '18.00'
  const second = h.editor.save(true)
  assert.notEqual(h.calls[3].data.idempotency_key, firstKey)
  h.respond(h.calls[3], 200, record)
  assert.equal(await second, true)
})

test('a definite validation rejection unlocks fields so the user can correct the entry', async () => {
  const h = editorHarness()
  await prepare(h)
  h.editor.draft.amount = '12.34'
  const first = h.editor.save()
  h.respond(h.calls[2], 422, null, '这个分类已停用')
  assert.equal(await first, false)
  assert.equal(h.editor.fieldsLocked.value, false)
  assert.equal(h.editor.pendingCreate.value, null)
  h.editor.selectCategory('transport')
  const corrected = h.editor.save()
  assert.equal(h.calls[3].data.category_id, 'transport')
  assert.notEqual(h.calls[3].data.idempotency_key, h.calls[2].data.idempotency_key)
  h.respond(h.calls[3], 200, record)
  assert.equal(await corrected, true)
})

test('editing clears an existing note explicitly and retains the exact calendar date', async () => {
  const h = editorHarness()
  await prepare(h, true)
  assert.equal(h.editor.draft.occurredDate, '2026-09-26')
  assert.equal(h.editor.draft.occurredTime, undefined)
  assert.equal(h.editor.dirty.value, false)
  h.editor.draft.note = ''
  assert.equal(h.editor.dirty.value, true)
  const pending = h.editor.save()
  const request = h.calls[3]
  assert.equal(request.method, 'PUT')
  assert.ok(request.url.endsWith('/records/existing-record'))
  assert.equal(request.data.note, '')
  assert.equal(request.data.idempotency_key, undefined)
  assert.equal(request.data.occurred_date, record.occurred_date)
  assert.equal(Object.hasOwn(request.data, 'occurred_at'), false)
  h.respond(request, 200, record)
  assert.equal(await pending, true)
})

test('editing can select no account and sends an explicit null payment method', async () => {
  const h = editorHarness()
  await prepare(h, true)
  assert.equal(h.editor.paymentOptions.value[0].id, '')
  h.editor.draft.paymentMethodId = ''
  const pending = h.editor.save()
  assert.equal(h.calls[3].data.payment_method_id, null)
  h.respond(h.calls[3], 200, { ...record, payment_method_id: null })
  assert.equal(await pending, true)
})

test('failed initial load exposes a retry and does not allow saving a partial form', async () => {
  const h = editorHarness()
  const first = h.editor.load()
  h.calls[0].fail({ errMsg: 'request:fail' })
  h.respond(h.calls[1], 200, payments)
  await first
  assert.equal(h.editor.loading.value, false)
  assert.ok(h.editor.loadError.value)
  assert.equal(await h.editor.save(), false)
  const retry = h.editor.load()
  h.respond(h.calls[2], 200, categories)
  h.respond(h.calls[3], 200, payments)
  await retry
  assert.equal(h.editor.loadError.value, '')
  assert.equal(h.editor.ready.value, true)
})

test('returning from category management refreshes choices without discarding the draft', async () => {
  const h = editorHarness()
  await prepare(h)
  h.editor.draft.amount = '66.00'
  h.editor.draft.note = '保留这条备注'
  const refresh = h.editor.refreshOptions()
  h.respond(h.calls[2], 200, [...categories, { id: 'coffee', name: '咖啡', record_type: 'expense', is_enabled: true }])
  h.respond(h.calls[3], 200, payments)
  await refresh
  assert.equal(h.editor.draft.amount, '66.00')
  assert.equal(h.editor.draft.note, '保留这条备注')
  assert.equal(h.editor.filteredCategories.value.length, 3)
})

test('delete is serialized, reports failures and succeeds on retry', async () => {
  const h = editorHarness()
  await prepare(h, true)
  const first = h.editor.remove()
  assert.equal(h.calls[3].method, 'DELETE')
  assert.equal(await h.editor.remove(), false)
  assert.equal(await h.editor.save(), false)
  h.calls[3].fail({ errMsg: 'request:fail' })
  assert.equal(await first, false)
  assert.ok(h.editor.errorMessage.value)
  const retry = h.editor.remove()
  h.respond(h.calls[4], 200, null)
  assert.equal(await retry, true)
  assert.equal(h.editor.completed.value, true)
})

test('late save responses do not finish a disposed screen', async () => {
  const h = editorHarness()
  await prepare(h)
  h.editor.draft.amount = '1.00'
  const pending = h.editor.save()
  h.editor.dispose()
  h.respond(h.calls[2], 200, record)
  assert.equal(await pending, false)
  assert.equal(h.editor.completed.value, false)
  assert.equal(h.ledgerChanges(), 1)
})

test('calendar grids start on Monday and expose selectable adjacent dates', () => {
  const { calendarDays } = createHarness().load('src/utils/calendar.ts')
  const september = calendarDays(2026, 9)
  assert.equal(september.length, 42)
  assert.equal(september[0].date, '2026-08-31')
  assert.equal(september[0].currentMonth, false)
  assert.equal(september[0].disabled, false)
  assert.equal(september[1].date, '2026-09-01')
  assert.equal(september[1].currentMonth, true)
  assert.equal(september.at(-1).date, '2026-10-11')
})

test('calendar validates leap days and clamps month navigation at supported bounds', () => {
  const { parseCalendarDate, calendarMonth, calendarDays, moveCalendarMonth } = createHarness().load('src/utils/calendar.ts')
  assert.ok(parseCalendarDate('2024-02-29'))
  assert.equal(parseCalendarDate('2026-02-29'), null)
  assert.equal(parseCalendarDate('2026-2-01'), null)
  assert.equal(parseCalendarDate('2026-09-26T00:00:00Z'), null)
  assert.equal(calendarMonth('2026-13'), null)
  assert.equal(JSON.stringify(moveCalendarMonth(2026, 12, 1)), JSON.stringify({ year: 2027, month: 1 }))
  assert.equal(JSON.stringify(moveCalendarMonth(1900, 1, -1)), JSON.stringify({ year: 1900, month: 1 }))
  assert.equal(JSON.stringify(moveCalendarMonth(9998, 12, 1)), JSON.stringify({ year: 9998, month: 12 }))
  assert.equal(calendarDays(9998, 12).filter((day) => day.date.startsWith('9999')).every((day) => day.disabled), true)
})
