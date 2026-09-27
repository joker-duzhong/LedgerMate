const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../src/utils/keypad.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
const compiledModule = { exports: {} }
vm.runInNewContext(outputText, { module: compiledModule, exports: compiledModule.exports }, { filename: 'keypad.ts' })
const { applyAmountKey } = compiledModule.exports

test('numeric keypad handles zero prefix, decimal precision and duplicate separators', () => {
  let amount = ''
  for (const key of ['0', '5', '.', '2', '3', '9']) amount = applyAmountKey(amount, key)
  assert.equal(amount, '5.23')
  assert.equal(applyAmountKey('5.23', '.'), '5.23')
  assert.equal(applyAmountKey('', '.'), '0.')
})

test('backspace clears digits and unknown operator keys cannot alter the amount', () => {
  assert.equal(applyAmountKey('12.30', 'backspace'), '12.3')
  assert.equal(applyAmountKey('1', 'backspace'), '')
  assert.equal(applyAmountKey('12.30', '+'), '12.30')
  assert.equal(applyAmountKey('1234567890', '9'), '1234567890')
})
