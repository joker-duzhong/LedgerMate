const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness, flush } = require('./helpers.cjs')

const utils = () => createHarness().load('src/utils/ledger.ts')
const record = (id, date, amount = 1234, type = 'expense', extra = {}) => ({ id, occurred_date: date.slice(0, 10), amount_cent: amount, record_type: type, category_id: 'food', source: 'manual', created_at: date, ...extra })
const categories = [{ id: 'food', name: '餐饮', record_type: 'expense', is_enabled: true, is_system: true }]
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

test('month boundaries use local calendar time and move across years', () => {
  const { monthRange, shiftMonth, monthTitle } = utils()
  const [start, end] = monthRange('2024-02')
  assert.equal(start, new Date(2024, 1, 1).toISOString())
  assert.equal(end, new Date(2024, 2, 1).toISOString())
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(monthTitle('2026-09'), '2026年9月')
  assert.throws(() => monthRange('2026-13'), /月份/)
})

test('month/type/search filtering and daily grouping keep integer cent totals', () => {
  const { filterRecords, groupRecordsByDay, recordTotals } = utils()
  const records = [record('old', '2026-08-31T12:00:00'), record('a', '2026-09-01T12:00:00', 1234, 'expense', { note: '午饭' }), record('b', '2026-09-01T16:00:00', 5000, 'income'), record('c', '2026-09-02T12:00:00', 250)]
  const all = filterRecords(records, categories, { month: '2026-09', type: 'all', keyword: '' })
  assert.equal(all.length, 3)
  assert.deepEqual(JSON.parse(JSON.stringify(recordTotals(all))), { income: 5000, expense: 1484, balance: 3516 })
  assert.equal(filterRecords(records, categories, { month: '2026-09', type: 'expense', keyword: '午饭' })[0].id, 'a')
  assert.equal(filterRecords(records, categories, { month: '2026-09', type: 'expense', keyword: '12.34' }).length, 1)
  assert.equal(filterRecords(records, categories, { month: '2026-09', type: 'expense', keyword: '餐饮' }).length, 2)
  const groups = groupRecordsByDay(all)
  assert.equal(groups[0].date, '2026-09-02')
  assert.equal(groups[1].income, 5000)
  assert.equal(groups[1].expense, 1234)
  assert.equal(groups[1].records[0].id, 'b')
})

test('loads every page before exposing a complete monthly total', async () => {
  const { collectRecords, recordTotals } = utils()
  const rows = Array.from({ length: 73 }, (_, index) => record(String(index), '2026-09-01T12:00:00', 100))
  const pages = []
  const loaded = await collectRecords(async ({ page, page_size }) => {
    pages.push(page)
    return { items: rows.slice((page - 1) * page_size, page * page_size), total: rows.length, page, page_size }
  })
  assert.deepEqual(pages, [1, 2])
  assert.equal(loaded.length, 73)
  assert.equal(recordTotals(loaded).expense, 7300)
})

test('backdated entries retain global created-at order across calendar date groups', () => {
  const { filterRecords, groupRecordsByDay } = utils()
  const rows = [record('old', '2026-09-20T12:00:00', 100), record('new', '2026-09-05T12:00:00', 200, 'expense', { created_at: '2026-09-26T12:00:00' }), record('middle', '2026-09-20T12:00:00', 300, 'expense', { created_at: '2026-09-25T12:00:00' })]
  const result = filterRecords(rows, categories, { month: '2026-09', type: 'all', keyword: '' })
  assert.equal(result[0].id, 'new')
  assert.deepEqual(Array.from(groupRecordsByDay(result).flatMap(group => group.records.map(item => item.id))), ['new', 'middle', 'old'])
})

test('does not publish partial data when pagination stops making progress', async () => {
  const { collectRecords } = utils()
  let calls = 0
  await assert.rejects(collectRecords(async () => { calls++; return { items: [record('same', '2026-09-01T12:00:00')], total: 2 } }), /未加载完整/)
  assert.equal(calls, 2)
})

test('discarded load stops fetching more pages', async () => {
  const { collectRecords } = utils()
  let active = true
  let calls = 0
  const result = await collectRecords(async () => { calls++; active = false; return { items: [], total: 99 } }, () => {}, () => active)
  assert.equal(result, null)
  assert.equal(calls, 1)
})

test('home refresh ignores old responses and preserves active loading state', async () => {
  const older = deferred()
  const newer = deferred()
  let calls = 0
  let stopped = 0
  const harness = createHarness({ globals: { Error }, uni: { stopPullDownRefresh: () => stopped++ }, mocks: { '@/api/ledger': { listRecords: () => (++calls === 1 ? older.promise : newer.promise), listCategories: async () => categories } } })
  harness.auth.saveSession(authenticated())
  const home = harness.load('src/composables/useHomeLedger.ts').useHomeLedger()
  home.month.value = '2026-09'
  const first = home.load()
  const second = home.load(true)
  older.reject(new Error('old request failure'))
  await first
  assert.equal(home.loading.value, true)
  assert.equal(home.errorMessage.value, '')
  newer.resolve({ items: [record('new', '2026-09-01T12:00:00')], total: 1 })
  await second
  assert.equal(home.visibleRecords.value[0].id, 'new')
  assert.equal(stopped, 1)
})

test('home category failure cancels remaining pagination and leaves an explicit error', async () => {
  const page = deferred()
  let calls = 0
  const harness = createHarness({ globals: { Error }, uni: { stopPullDownRefresh() {} }, mocks: { '@/api/ledger': { listRecords: () => { calls++; return page.promise }, listCategories: async () => { throw new Error('分类读取失败') } } } })
  harness.auth.saveSession(authenticated())
  const home = harness.load('src/composables/useHomeLedger.ts').useHomeLedger()
  await home.load()
  page.resolve({ items: [record('first', '2026-09-01T12:00:00')], total: 100 })
  await flush()
  assert.equal(calls, 1)
  assert.equal(home.errorMessage.value, '分类读取失败')
  assert.equal(home.visibleRecords.value.length, 0)
})

test('changing total during pagination rejects a mixed snapshot', async () => {
  const { collectRecords } = utils()
  const rows = Array.from({ length: 100 }, (_, index) => record(String(index), '2026-09-01T12:00:00', 100))
  await assert.rejects(collectRecords(async ({ page }) => page === 1 ? { items: rows.slice(0, 50), total: 100 } : { items: rows.slice(51), total: 99 }), /刚刚有更新/)
})
