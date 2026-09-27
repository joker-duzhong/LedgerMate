const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness } = require('./helpers.cjs')

const loadStatistics = () => createHarness().load('src/utils/statistics.ts')

test('expense shares use monthly expense rather than the largest category and sort descending', () => {
  const { expenseShares } = loadStatistics()
  const result = expenseShares([
    { category_id: 'food', amount_cent: 2500 },
    { name: '交通', amount_cent: 7500 },
    { name: '空项', amount_cent: 0 },
    { name: '无效项', amount_cent: Number.NaN },
  ], [{ id: 'food', name: '餐饮' }], 10000)
  assert.equal(result.length, 2)
  assert.equal(result[0].name, '交通')
  assert.equal(result[0].percentage, 75)
  assert.equal(result[1].name, '餐饮')
  assert.equal(result[1].percentage, 25)
})

test('daily amounts keep only valid selected-month dates and preserve unknown direction', () => {
  const { dailyAmounts } = loadStatistics()
  const result = dailyAmounts([
    { date: '2026-09-02', income_cent: 500, expense_cent: 100 },
    { date: '2026-09-01', expense_cent: 0 },
    { date: '2026-09-02', income_cent: 200 },
    { date: '2026-09-03', amount_cent: 900 },
    { date: '2026-08-31', income_cent: 400 },
    { date: '2026-09-31', income_cent: 400 },
    { date: 'invalid', income_cent: 400 },
    { date: '2026-09-04', income_cent: Number.NaN, expense_cent: -1 },
  ], '2026-09')
  assert.equal(result.length, 2)
  assert.equal(result[0].date, '2026-09-01')
  assert.equal(result[0].income, null)
  assert.equal(result[0].expense, 0)
  assert.equal(result[1].income, 700)
  assert.equal(result[1].expense, 100)
})

test('daily amounts accept leap days only in leap years and do not fabricate empty days', () => {
  const { dailyAmounts } = loadStatistics()
  assert.equal(dailyAmounts([{ date: '2024-02-29', expense_cent: 300 }], '2024-02').length, 1)
  assert.equal(dailyAmounts([{ date: '2025-02-29', expense_cent: 300 }], '2025-02').length, 0)
  assert.equal(dailyAmounts([], '2026-09').length, 0)
})

test('month averages use elapsed days now, complete historical months and symmetric negative rounding', () => {
  const { averageDayCount, dailyAverage } = loadStatistics()
  const now = new Date(2026, 8, 26)
  assert.equal(averageDayCount('2026-09', now), 26)
  assert.equal(averageDayCount('2026-08', now), 31)
  assert.equal(averageDayCount('2024-02', now), 29)
  assert.equal(averageDayCount('2026-10', now), 0)
  assert.equal(dailyAverage(2600, 26), 100)
  assert.equal(dailyAverage(-101, 2), -51)
  assert.equal(dailyAverage(101, 2), 51)
  assert.equal(dailyAverage(300, 0), 0)
})

const record = (id, amount, type = 'expense', overrides = {}) => ({ id, amount_cent: amount, record_type: type, category_id: 'food', occurred_date: '2026-09-02', ...overrides })

test('record analysis respects date-only months, ignores invalid dates and represents negative daily balances', () => {
  const { monthDates, monthRecords, recordTrend, recordSummary } = loadStatistics()
  assert.equal(monthDates('2026-12').end_date, '2027-01-01')
  const input = [record('a', 500), record('b', 100, 'income'), record('c', 800, 'expense', { occurred_date: '2026-10-01' }), record('d', 300, 'expense', { occurred_date: '2026-09-31' }), record('e', 1, 'expense', { occurred_date: undefined }), record('f', Number.NaN)]
  const filtered = monthRecords(input, '2026-09')
  assert.equal(filtered.length, 2)
  const days = recordTrend(input, '2026-09')
  assert.equal(days.length, 30)
  assert.equal(days[0].balance, 0)
  assert.equal(days[1].balance, -400)
  assert.equal(recordSummary(filtered).balance, -400)
})

test('category and detail rankings switch direction with correct counts, percentages and stable ordering', () => {
  const { categoryRanking, detailRanking } = loadStatistics()
  const input = [record('a', 100), record('b', 300), record('c', 600, 'expense', { category_id: 'transport' }), record('d', 8000, 'income', { category_id: 'salary' })]
  const expense = categoryRanking(input, [{ id: 'food', name: '餐饮' }], 'expense')
  assert.equal(expense[0].amount, 600)
  assert.equal(expense[0].name, '未命名分类')
  assert.equal(expense[0].percentage, 60)
  assert.equal(expense[1].count, 2)
  assert.equal(categoryRanking(input, [], 'income')[0].amount, 8000)
  assert.equal(detailRanking(input, 'expense')[0].id, 'c')
  assert.equal(detailRanking(input, 'income').length, 1)
})

test('payment flows group missing and retired methods without claiming an account balance', () => {
  const { paymentFlows } = loadStatistics()
  const flows = paymentFlows([
    record('a', 500, 'expense', { payment_method_id: 'wallet' }),
    record('b', 100, 'income', { payment_method_id: 'wallet' }),
    record('c', 400, 'expense'),
    record('d', 300, 'income', { payment_method_id: 'retired' }),
  ], [{ id: 'wallet', name: '微信支付' }])
  assert.equal(flows[0].name, '微信支付')
  assert.equal(flows[0].balance, -400)
  assert.equal(flows[0].count, 2)
  assert.equal(flows[1].name, '未指定支付方式')
  assert.equal(flows[2].name, '原支付方式')
})

test('month analysis caches tab visits, refreshes revisions, keeps stale data on error and ignores old responses', async () => {
  const pending = []
  const queries = []
  let refreshStops = 0
  let revision = 0
  const h = createHarness({
    uni: { stopPullDownRefresh: () => { refreshStops += 1 } },
    mocks: {
      vue: { ...require('vue'), watch() { return () => {} } },
      '@/utils/navigation': { ledgerRevision: () => revision },
      '@/api/ledger': {
        getStatistics: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
        listCategories: async () => [], listPaymentMethods: async () => [],
        listRecords: async (query) => { queries.push(query); return { items: [], total: 0 } },
      },
    },
  })
  h.auth.saveSession(authenticated())
  const page = h.load('src/composables/useMonthAnalysis.ts').useMonthAnalysis(true)
  page.month.value = '2026-09'
  const previous = page.load()
  page.month.value = '2026-08'
  const latest = page.load()
  pending[0].reject(new Error('outdated month failure'))
  await previous
  assert.equal(page.loading.value, true)
  assert.equal(page.errorMessage.value, '')
  assert.equal(refreshStops, 0)
  assert.equal(queries[0].start_date, '2026-09-01')
  assert.equal(queries[0].end_date, '2026-10-01')
  pending[1].resolve({ balance_cent: 1234, income_cent: 1234, expense_cent: 0, daily: [], category_expenses: [] })
  await latest
  assert.equal(page.snapshot.value.statistics.balance_cent, 1234)
  assert.equal(page.loading.value, false)
  assert.equal(refreshStops, 1)
  await page.load()
  assert.equal(pending.length, 2)

  revision += 1
  const slowSuccess = page.load()
  page.month.value = '2026-07'
  const fastSuccess = page.load()
  pending[3].resolve({ balance_cent: 5678, income_cent: 5678, expense_cent: 0, daily: [], category_expenses: [] })
  await fastSuccess
  pending[2].resolve({ balance_cent: 99, income_cent: 99, expense_cent: 0, daily: [], category_expenses: [] })
  await slowSuccess
  assert.equal(page.snapshot.value.statistics.balance_cent, 5678)
  assert.equal(page.snapshot.value.month, '2026-07')
  assert.equal(refreshStops, 2)
  page.month.value = '2026-06'
  const failure = page.load()
  pending[4].reject(new Error('network failure'))
  await failure
  assert.equal(page.snapshot.value.month, '2026-07')
  assert.equal(page.stale.value, true)
  assert.ok(page.errorMessage.value.length > 0)
})
