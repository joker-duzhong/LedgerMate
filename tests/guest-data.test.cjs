const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness, flush } = require('./helpers.cjs')

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const variants = [
  { name: 'home', path: 'src/composables/useHomeLedger.ts', create: module => module.useHomeLedger(), records: page => page.visibleRecords.value },
  { name: 'analysis', path: 'src/composables/useMonthAnalysis.ts', create: module => module.useMonthAnalysis(true), records: page => page.snapshot.value?.records || [] },
]

function setup(variant, options = {}) {
  const requests = []
  const recordRequests = []
  let h
  const api = (name, result) => (...args) => { requests.push(name); return result(...args) }
  h = createHarness({
    uni: { stopPullDownRefresh() {} },
    mocks: {
      ...(options.vue ? { vue: options.vue } : {}),
      '@/api/ledger': {
        listRecords: api('records', query => {
          recordRequests.push(query)
          return options.listRecords ? options.listRecords(query) : Promise.resolve(response(h.auth.user.id, query.start_date))
        }),
        listCategories: api('categories', async () => [{ id: h.auth.user.id, name: '私人分类', record_type: 'expense', is_enabled: true, is_system: false }]),
        listPaymentMethods: api('payments', async () => [{ id: h.auth.user.id, name: '私人账户', is_enabled: true, is_system: false }]),
        getStatistics: api('statistics', async () => ({ balance_cent: -1234, income_cent: 0, expense_cent: 1234, daily: [], category_expenses: [] })),
      },
    },
  })
  if (options.authenticated) h.auth.saveSession(authenticated())
  const page = variant.create(h.load(variant.path))
  return { h, page, requests, recordRequests }
}

function response(id, date) {
  return { items: [{ id, occurred_date: date, amount_cent: 1234, record_type: 'expense', category_id: id, source: 'manual', created_at: `${date}T12:00:00` }], total: 1 }
}

function assertEmpty(variant, page) {
  assert.equal(variant.records(page).length, 0)
  assert.equal(page.loading.value, false)
  assert.equal(page.errorMessage.value, '')
  if (variant.name === 'home') {
    assert.equal(page.loaded.value, false)
    assert.equal(page.loadedMonth.value, '')
    assert.equal(page.loadedCount.value, 0)
    assert.equal(page.totalCount.value, 0)
    assert.equal(page.categoryNames.value.size, 0)
  } else {
    assert.equal(page.snapshot.value.month, page.month.value)
    assert.equal(page.snapshot.value.categories.length, 0)
    assert.equal(page.snapshot.value.payments.length, 0)
    assert.equal(page.snapshot.value.statistics, null)
    assert.equal(page.stale.value, false)
  }
}

for (const variant of variants) {
  test(`${variant.name} guest preview and month changes do not request or navigate, then login loads data`, async () => {
    const { h, page, requests } = setup(variant)
    assert.equal(page.isGuest.value, true)
    assertEmpty(variant, page)
    await page.load()
    await page.load(true)
    page.month.value = page.month.value === '2026-01' ? '2026-02' : '2026-01'
    await flush()
    assertEmpty(variant, page)
    assert.equal(requests.length, 0)
    assert.equal(h.navigations.length, 0)

    h.auth.saveSession(authenticated())
    assert.equal(page.isGuest.value, false)
    await page.load()
    assert.equal(variant.records(page)[0].id, 'test-user')
    assert.ok(requests.length > 0)
    page.dispose()
  })

  test(`${variant.name} logout clears cached data synchronously and discards an in-flight refresh`, async () => {
    const pending = deferred()
    let calls = 0
    const { h, page } = setup(variant, {
      authenticated: true,
      listRecords: query => ++calls === 1 ? Promise.resolve(response('test-user', query.start_date)) : pending.promise,
    })
    await page.load()
    assert.equal(variant.records(page).length, 1)
    const refresh = page.load(true)
    assert.equal(page.loading.value, true)
    h.auth.clear()
    assert.equal(page.isGuest.value, true)
    assertEmpty(variant, page)
    pending.resolve(response('previous-user', `${page.month.value}-01`))
    await refresh
    assertEmpty(variant, page)
    assert.equal(calls, 2)
    assert.equal(h.navigations.length, 0)
    page.dispose()
  })

  test(`${variant.name} changing accounts invalidates cache and cannot restore the prior account's response`, async () => {
    const previous = deferred()
    const current = deferred()
    let calls = 0
    const { h, page } = setup(variant, {
      authenticated: true,
      listRecords: query => ++calls === 1 ? Promise.resolve(response('test-user', query.start_date)) : calls === 2 ? previous.promise : current.promise,
    })
    await page.load()
    await page.load()
    assert.equal(calls, 1)
    const oldRefresh = page.load(true)
    h.auth.saveSession(authenticated({ user: { id: 'another-user', phone: '13900000000', needs_phone_binding: false } }))
    assertEmpty(variant, page)
    const newLoad = page.load()
    assert.equal(calls, 3)
    previous.resolve(response('test-user', `${page.month.value}-01`))
    await oldRefresh
    assert.equal(page.loading.value, true)
    assert.equal(variant.records(page).length, 0)
    current.resolve(response('another-user', `${page.month.value}-01`))
    await newLoad
    assert.equal(variant.records(page)[0].id, 'another-user')
    await page.load()
    assert.equal(calls, 3)
    if (variant.name === 'home') assert.equal(page.categoryNames.value.has('test-user'), false)
    else assert.equal(page.snapshot.value.payments[0].id, 'another-user')
    page.dispose()
  })

  test(`${variant.name} ignores an old request failure after logout`, async () => {
    const pending = deferred()
    const { h, page } = setup(variant, { authenticated: true, listRecords: () => pending.promise })
    const loading = page.load()
    h.auth.clear()
    pending.reject(new Error('previous account failure'))
    await loading
    assertEmpty(variant, page)
    page.dispose()
  })

  test(`${variant.name} disposal stops both watchers and prevents further requests`, async () => {
    const vue = require('vue')
    let stopped = 0
    const { h, page, requests } = setup(variant, {
      authenticated: true,
      vue: { ...vue, watch(...args) { const stop = vue.watch(...args); return () => { stopped++; stop() } } },
    })
    page.dispose()
    assert.equal(stopped, 2)
    page.month.value = page.month.value === '2026-01' ? '2026-02' : '2026-01'
    h.auth.clear()
    await flush()
    await page.load()
    assert.equal(requests.length, 0)
  })
}
