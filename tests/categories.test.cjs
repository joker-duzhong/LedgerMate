const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./helpers.cjs')

const load = (file) => createHarness().load(file)

test('category responses accept global-template aliases and keep icon paths', () => {
  const { normalizeCategories } = load('src/utils/categories.ts')
  const categories = normalizeCategories({ items: [
    { id: 'income-1', type: 'income', name: '工资', icon_url: 'https://cdn.example.test/wage.png', is_global: true, sort: 20 },
    { id: 'expense-1', record_type: 'expense', name: '餐饮', icon: 'food', is_active: true, sort_order: 1 },
  ] })
  assert.equal(categories[0].id, 'expense-1')
  assert.equal(categories[0].icon, 'food')
  assert.equal(categories[1].icon, 'https://cdn.example.test/wage.png')
  assert.equal(categories[1].is_system, true)
})

test('category icon source keeps remote URLs and paths while local names use AppIcon fallback', () => {
  const { categoryIconSource } = load('src/utils/icons.ts')
  assert.equal(categoryIconSource('https://cdn.example.test/icon.svg'), 'https://cdn.example.test/icon.svg')
  assert.equal(categoryIconSource('uploads/ledger/icon.png'), '/uploads/ledger/icon.png')
  assert.equal(categoryIconSource('food'), null)
  assert.equal(categoryIconSource(''), null)
})
