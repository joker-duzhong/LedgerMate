const test = require('node:test')
const assert = require('node:assert/strict')
const { createHarness } = require('./helpers.cjs')

const record = (id, date, amount, record_type = 'expense') => ({ id, occurred_date: date, amount_cent: amount, record_type, category_id: 'food', source: 'manual', created_at: `${date}T12:00:00` })

test('daily calendar cells aggregate income and expense by date and retain adjacent days', () => {
  const { dailyCalendarCells } = createHarness().load('src/utils/dailyCalendar.ts')
  const cells = dailyCalendarCells(2026, 9, [record('a', '2026-09-01', 145197), record('b', '2026-09-01', 7600, 'income'), record('c', '2026-09-14', 422670)])
  const first = cells.find((cell) => cell.date === '2026-09-01')
  const fourteenth = cells.find((cell) => cell.date === '2026-09-14')
  const adjacent = cells.find((cell) => cell.date === '2026-08-31')
  assert.deepEqual({ income: first.income, expense: first.expense, balance: first.balance }, { income: 7600, expense: 145197, balance: -137597 })
  assert.equal(fourteenth.balance, -422670)
  assert.equal(adjacent.currentMonth, false)
})

test('empty days produce zero amounts and the fixed six-week grid', () => {
  const { dailyCalendarCells } = createHarness().load('src/utils/dailyCalendar.ts')
  const cells = dailyCalendarCells(2026, 2, [])
  assert.equal(cells.length, 42)
  assert.equal(cells.filter((cell) => cell.currentMonth).length, 28)
  assert.equal(cells.every((cell) => cell.income === 0 && cell.expense === 0 && cell.balance === 0), true)
})

test('September navigation keeps September geometry and excludes October dates', () => {
  const { calendarMonth, calendarDays } = createHarness().load('src/utils/calendar.ts')
  assert.equal(JSON.stringify(calendarMonth('2026-09')), JSON.stringify({ year: 2026, month: 9 }))
  const cells = calendarDays(2026, 9)
  assert.equal(cells.filter((cell) => cell.currentMonth).length, 30)
  assert.equal(cells.some((cell) => cell.currentMonth && cell.date.startsWith('2026-10-')), false)
})
