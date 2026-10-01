const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { parse } = require('@vue/compiler-sfc')
const { createHarness, flush } = require('./helpers.cjs')

const exported = { file_name: 'ledger-mate-export.csv', content: '\ufeff时间,金额\n2026-10-01,12.30', mime_type: 'text/csv; charset=utf-8', record_count: 1 }

function exportHarness(platform = 'ios') {
  const calls = { writes: [], disks: [], shares: [], toasts: [], requests: 0 }
  const api = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => ({ writeFile: (options) => calls.writes.push(options) }),
    saveFileToDisk: (options) => calls.disks.push(options),
    shareFileMessage: (options) => calls.shares.push(options),
    openDocument: () => assert.fail('CSV/JSON must not use document preview'),
  }
  const h = createHarness({ globals: { Error } })
  const { saveWeChatExport } = h.load('src/utils/exportFile.ts')
  return { ...h, api, calls, save: (result = exported) => saveWeChatExport(api, platform, result) }
}

test('iOS and Android write the intact file before sharing and never call PC saving', async () => {
  for (const platform of ['ios', 'android']) {
    for (const result of [exported, { ...exported, file_name: 'ledger-mate-export.json', content: '[{"amount":"12.30"}]', mime_type: 'application/json' }]) {
      const h = exportHarness(platform)
      const pending = h.save(result)
      let settled = false
      pending.then(() => { settled = true })
      assert.equal(h.calls.writes[0].data, result.content)
      assert.equal(h.calls.writes[0].encoding, 'utf8')
      assert.equal(h.calls.shares.length, 0)
      h.calls.writes[0].success()
      await flush()
      assert.equal(h.calls.disks.length, 0)
      assert.equal(h.calls.shares[0].filePath, 'wxfile://usr/' + result.file_name)
      assert.equal(h.calls.shares[0].fileName, result.file_name)
      assert.equal(settled, false)
      h.calls.shares[0].success()
      assert.equal(await pending, 'shared')
    }
  }
})

test('Windows and Mac wait for disk save success without opening chat', async () => {
  for (const platform of ['windows', 'mac']) {
    const h = exportHarness(platform)
    const pending = h.save()
    h.calls.writes[0].success()
    await flush()
    assert.equal(h.calls.disks.length, 1)
    assert.equal(h.calls.shares.length, 0)
    h.calls.disks[0].success()
    assert.equal(await pending, 'saved')
  }
})

test('cancelled sharing or saving is a neutral outcome', async () => {
  for (const platform of ['ios', 'windows']) {
    const h = exportHarness(platform)
    const pending = h.save()
    h.calls.writes[0].success()
    await flush()
    const action = h.calls.shares[0] || h.calls.disks[0]
    action.fail({ errMsg: 'fail cancel' })
    assert.equal(await pending, 'cancelled')
  }
})

test('file writing and delivery failures reject with stage-specific feedback', async () => {
  const h = exportHarness()
  const pending = h.save()
  const rejected = assert.rejects(pending, /文件写入失败/)
  h.calls.writes[0].fail({ errMsg: 'writeFile:fail quota exceeded' })
  await rejected
  assert.equal(h.calls.shares.length, 0)
  for (const platform of ['ios', 'windows']) {
    const actionHarness = exportHarness(platform)
    const actionPending = actionHarness.save()
    const actionRejected = assert.rejects(actionPending, platform === 'ios' ? /文件分享失败/ : /文件保存失败/)
    actionHarness.calls.writes[0].success()
    await flush()
    const action = actionHarness.calls.shares[0] || actionHarness.calls.disks[0]
    action.fail({ errMsg: 'fail unsupported' })
    await actionRejected
  }
})

test('missing APIs and synchronous native failures cannot report success or hang', async () => {
  const unsupported = exportHarness()
  delete unsupported.api.shareFileMessage
  await assert.rejects(unsupported.save(), /升级微信或使用电脑版/)
  assert.equal(unsupported.calls.writes.length, 0)
  const writeFailure = exportHarness()
  writeFailure.api.getFileSystemManager = () => { throw new Error('native unavailable') }
  await assert.rejects(writeFailure.save(), /文件写入失败/)
  const shareFailure = exportHarness()
  shareFailure.api.shareFileMessage = () => { throw new Error('native unavailable') }
  const pending = shareFailure.save()
  const rejected = assert.rejects(pending, /文件分享失败/)
  shareFailure.calls.writes[0].success()
  await rejected
})

function exportPageHarness() {
  const h = exportHarness()
  const filename = path.resolve(__dirname, '../src/pages/data-management/index.vue')
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'))
  const stack = [true]
  const source = descriptor.scriptSetup.content.split(/\r?\n/).filter((line) => {
    const directive = line.match(/^\s*\/\/\s*#(ifdef|ifndef|endif)(?:\s+([\w-]+))?\s*$/)
    if (!directive) return stack.at(-1)
    if (directive[1] === 'endif') stack.pop()
    else stack.push(stack.at(-1) && (directive[1] === 'ifdef' ? directive[2] === 'MP-WEIXIN' : directive[2] !== 'MP-WEIXIN'))
    return false
  }).join('\n')
  const { outputText } = ts.transpileModule(source + '\nexport { downloadExport, exporting, resultMessage, errorMessage }', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  })
  const module = { exports: {} }
  const mocks = {
    vue: require('vue'),
    '@dcloudio/uni-app': { onLoad() {}, onShow() {} },
    '@/api/ledger': { exportRecords: async () => { h.calls.requests++; return exported } },
    '@/utils/authNavigation': { ensureLogin: () => true },
    '@/utils/navigation': { goHome() {}, markLedgerChanged() {} },
    '@/composables/useNavigationLayout': { useNavigationLayout: () => ({ navigationStyle: {} }) },
  }
  vm.runInNewContext(outputText, {
    module, exports: module.exports, Error, wx: h.api,
    uni: { getSystemInfoSync: () => ({ platform: 'ios' }), showToast: (options) => h.calls.toasts.push(options) },
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : h.load('src/' + name.slice(2) + '.ts'),
  }, { filename })
  return { ...h, page: module.exports }
}

test('export page keeps busy and suppresses success until sharing completes', async () => {
  const h = exportPageHarness()
  const pending = h.page.downloadExport()
  await flush()
  assert.equal(h.page.exporting.value, true)
  assert.equal(h.page.resultMessage.value, '')
  await h.page.downloadExport()
  assert.equal(h.calls.requests, 1)
  h.calls.writes[0].success()
  await flush()
  assert.equal(h.page.exporting.value, true)
  assert.equal(h.page.resultMessage.value, '')
  h.calls.shares[0].success()
  await pending
  assert.equal(h.page.exporting.value, false)
  assert.match(h.page.resultMessage.value, /文件已分享/)
  assert.equal(h.page.errorMessage.value, '')
})

test('export page exposes failure, permits retry, and treats cancellation as neutral', async () => {
  const h = exportPageHarness()
  const pending = h.page.downloadExport()
  await flush()
  h.calls.writes[0].fail({ errMsg: 'writeFile:fail' })
  await pending
  assert.match(h.page.errorMessage.value, /文件写入失败/)
  assert.equal(h.page.resultMessage.value, '')
  assert.equal(h.page.exporting.value, false)
  const retry = h.page.downloadExport()
  await flush()
  assert.equal(h.page.errorMessage.value, '')
  h.calls.writes[1].success()
  await flush()
  h.calls.shares[0].fail({ errMsg: 'shareFileMessage:fail cancel' })
  await retry
  assert.equal(h.page.errorMessage.value, '')
  assert.equal(h.page.resultMessage.value, '')
  assert.equal(h.page.exporting.value, false)
  assert.match(h.calls.toasts[0].title, /已取消/)
})
