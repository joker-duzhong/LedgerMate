const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./helpers.cjs')

const category = (name, recordType = 'expense', enabled = true) => ({ id: `${recordType}-${name}`, name, record_type: recordType, is_enabled: enabled, is_system: true })
const payment = (name, isDefault = false, enabled = true) => ({ id: name, name, is_default: isDefault, is_enabled: enabled })

function setup(overrides = {}) {
  const created = []
  const api = {
    listCategories: async () => [category('餐饮'), category('工资', 'income'), category('旧分类', 'expense', false)],
    listPaymentMethods: async () => [payment('微信支付', true), payment('旧卡', false, false)],
    createCategory: async (data) => { created.push(data); return { id: 'new-category', is_enabled: true, is_system: false, ...data } },
    createPaymentMethod: async (data) => { created.push(data); return { id: 'new-payment', is_enabled: true, ...data } },
    ...overrides,
  }
  const h = createHarness({ mocks: { '@/api/ledger': api } })
  return { ...h, created, settings: h.load('src/composables/useLedgerSettings.ts').useLedgerSettings() }
}

test('settings counts only enabled items and separates income and expense categories', async () => {
  const { settings } = setup()
  assert.equal(settings.loaded.value, false)
  await settings.load()
  assert.equal(settings.loaded.value, true)
  assert.equal(settings.categoryCount.value, 2)
  assert.equal(settings.paymentCount.value, 1)
  assert.equal(settings.visibleCategories.value.length, 2)
  settings.selectType('income')
  assert.equal(settings.visibleCategories.value.length, 1)
  assert.equal(settings.visibleCategories.value[0].name, '工资')
})

test('empty, overlong and duplicate names never submit, including disabled names', async () => {
  const { settings, created } = setup()
  await settings.load()
  for (const name of ['  ', '字'.repeat(31), ' 餐饮 ', '旧分类']) {
    settings.name.value = name
    assert.equal(await settings.add(), false)
    assert.ok(settings.formError.value)
  }
  settings.selectSection('payments')
  settings.name.value = ' 微信支付 '
  assert.equal(await settings.add(), false)
  assert.equal(created.length, 0)
})

test('same category name is allowed across types and successful add updates the view', async () => {
  const { settings, created } = setup()
  await settings.load()
  settings.selectType('income')
  settings.expanded.value = true
  settings.name.value = ' 餐饮 '
  assert.equal(await settings.add(), true)
  assert.equal(created[0].name, '餐饮')
  assert.equal(created[0].record_type, 'income')
  assert.equal(settings.categoryCount.value, 3)
  assert.equal(settings.visibleCategories.value.length, 2)
  assert.equal(settings.name.value, '')
  assert.equal(settings.expanded.value, false)
})

test('repeated add and section changes are blocked while one submission is pending', async () => {
  let resolveCreate
  let requests = 0
  const { settings } = setup({ createCategory: (data) => {
    requests += 1
    return new Promise((resolve) => { resolveCreate = () => resolve({ ...category(data.name), is_system: false }) })
  } })
  await settings.load()
  settings.expanded.value = true
  settings.name.value = '交通'
  const pending = settings.add()
  assert.equal(settings.saving.value, true)
  assert.equal(await settings.add(), false)
  settings.selectSection('payments')
  settings.selectType('income')
  settings.toggleForm()
  assert.equal(settings.section.value, 'categories')
  assert.equal(settings.activeType.value, 'expense')
  assert.equal(settings.expanded.value, true)
  assert.equal(requests, 1)
  resolveCreate()
  assert.equal(await pending, true)
  assert.equal(settings.saving.value, false)
})

test('failed creation keeps the name and form open for retry', async () => {
  const { settings } = setup({ createCategory: async () => { throw new Error('temporarily unavailable') } })
  await settings.load()
  settings.expanded.value = true
  settings.name.value = '交通'
  assert.equal(await settings.add(), false)
  assert.equal(settings.name.value, '交通')
  assert.equal(settings.expanded.value, true)
  assert.equal(settings.categoryCount.value, 2)
  assert.equal(settings.saving.value, false)
  assert.ok(settings.formError.value)
})

test('payment default is set only when there is no enabled default', async () => {
  for (const [methods, expected] of [
    [[], true],
    [[payment('旧卡', true, false)], true],
    [[payment('微信支付', true)], false],
  ]) {
    const { settings, created } = setup({ listPaymentMethods: async () => methods })
    await settings.load()
    settings.selectSection('payments')
    settings.name.value = '现金'
    assert.equal(await settings.add(), true)
    assert.equal(created[0].is_default, expected)
  }
})

test('load failure is visible and prevents creation until retry succeeds', async () => {
  let failed = true
  const { settings, created } = setup({ listCategories: async () => {
    if (failed) throw new Error('offline')
    return []
  } })
  await settings.load()
  assert.equal(settings.loaded.value, false)
  assert.equal(settings.loading.value, false)
  assert.ok(settings.loadError.value)
  settings.name.value = '交通'
  assert.equal(await settings.add(), false)
  assert.equal(created.length, 0)
  failed = false
  await settings.load()
  assert.equal(settings.loadError.value, '')
  assert.equal(await settings.add(), true)
})

test('an older response cannot overwrite the latest refreshed settings', async () => {
  let resolveFirst
  let calls = 0
  const { settings } = setup({ listCategories: () => {
    calls += 1
    return calls === 1 ? new Promise((resolve) => { resolveFirst = resolve }) : Promise.resolve([category('新分类')])
  } })
  const first = settings.load()
  await settings.load()
  resolveFirst([category('旧结果')])
  await first
  assert.equal(settings.categories.value[0].name, '新分类')
})

test('successful category and payment additions invalidate cached tabs; failures do not', async () => {
  let fail = true
  const { settings, load } = setup({ createCategory: async (data) => {
    if (fail) throw new Error('temporarily unavailable')
    return category(data.name, data.record_type)
  } })
  const { ledgerRevision } = load('src/utils/navigation.ts')
  const initial = ledgerRevision()
  await settings.load()
  settings.name.value = '新分类'
  assert.equal(await settings.add(), false)
  assert.equal(ledgerRevision(), initial)
  fail = false
  assert.equal(await settings.add(), true)
  assert.equal(ledgerRevision(), initial + 1)
  settings.selectSection('payments')
  settings.name.value = '现金'
  assert.equal(await settings.add(), true)
  assert.equal(ledgerRevision(), initial + 2)
})
