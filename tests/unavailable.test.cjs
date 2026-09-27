const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { parse } = require('@vue/compiler-sfc')

function pageHarness(query) {
  const filename = path.resolve(__dirname, '../src/pages/unavailable/index.vue')
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'))
  const { outputText } = ts.transpileModule(descriptor.scriptSetup.content + '\nexport { feature, description }', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  })
  let onLoad
  let chatVisits = 0
  const module = { exports: {} }
  const mocks = {
    vue: require('vue'),
    '@dcloudio/uni-app': { onLoad: (callback) => { onLoad = callback } },
    '@/utils/navigation': { goChat: () => { chatVisits += 1 }, goHome: () => {} },
    '@/composables/useNavigationLayout': { useNavigationLayout: () => ({ navigationStyle: {} }) },
  }
  vm.runInNewContext(outputText, { module, exports: module.exports, require: (name) => {
    if (!Object.hasOwn(mocks, name)) throw new Error('Unexpected dependency: ' + name)
    return mocks[name]
  } }, { filename })
  onLoad(query)
  return { ...module.exports, chatVisits }
}

test('encoded feature routes display the Chinese title and matching description', () => {
  for (const [name, icon] of [['账单导入', 'upload'], ['数据导出', 'download'], ['隐私与账户设置', 'shield']]) {
    const page = pageHarness({ feature: encodeURIComponent(name) })
    assert.equal(page.feature.value, name)
    assert.equal(page.description.value.icon, icon)
    assert.equal(page.chatVisits, 0)
  }
})

test('already decoded Chinese remains unchanged and both AI route forms open the chat', () => {
  assert.equal(pageHarness({ feature: '隐私与账户设置' }).feature.value, '隐私与账户设置')
  for (const feature of ['AI记账', encodeURIComponent('AI记账')]) {
    const page = pageHarness({ feature })
    assert.equal(page.feature.value, 'AI记账')
    assert.equal(page.chatVisits, 1)
  }
})

test('missing or malformed feature parameters show a readable fallback without throwing', () => {
  for (const query of [undefined, {}, { feature: '' }, { feature: 123 }, { feature: '%' }, { feature: '%E5%ZZ' }, { feature: '%E5%8D' }]) {
    const page = pageHarness(query)
    assert.equal(page.feature.value, '这项功能')
    assert.equal(page.description.value.icon, 'leaf')
    assert.equal(page.chatVisits, 0)
  }
})
