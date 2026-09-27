const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = (filename) => fs.readFileSync(path.join(root, filename), 'utf8')

function platformSource(source, platform) {
  const stack = [true]
  const lines = []
  for (const line of source.split(/\r?\n/)) {
    const directive = line.match(/^\s*\/\/\s*#(ifdef|ifndef|endif)(?:\s+([\w-]+))?\s*$/)
    if (!directive) { if (stack.at(-1)) lines.push(line); continue }
    if (directive[1] === 'endif') { assert.ok(stack.length > 1); stack.pop() }
    else stack.push(stack.at(-1) && (directive[1] === 'ifdef' ? directive[2] === platform : directive[2] !== platform))
  }
  assert.equal(stack.length, 1)
  return lines.join('\n')
}

function loadModule(filename, platform = 'MP-WEIXIN', globals = {}, mocks = {}) {
  const module = { exports: {} }
  const source = platformSource(read(filename), platform)
  const { outputText } = ts.transpileModule(source, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
  vm.runInNewContext(outputText, {
    module, exports: module.exports, ...globals,
    require: (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier]
      if (specifier.startsWith('@/')) return loadModule('src/' + specifier.slice(2) + '.ts', platform, globals, mocks)
      return require(specifier)
    },
  }, { filename })
  return module.exports
}

const calculate = (info, capsule, isWechat = true) => loadModule('src/utils/navigationLayout.ts').calculateNavigationLayout(info, capsule, isWechat)
const rectangle = (top = 28, height = 32, left = 278, width = 88) => ({ top, height, left, width, right: left + width, bottom: top + height })
const snapshot = (layout) => ({ statusBarHeight: layout.statusBarHeight, navigationBarHeight: layout.navigationBarHeight, capsuleInsetRight: layout.capsuleInsetRight, totalHeight: layout.totalHeight })

test('ordinary iOS navigation keeps a 44px toolbar below the measured status bar', () => {
  const result = calculate({ windowWidth: 375, statusBarHeight: 20, safeArea: { top: 20 } }, rectangle(24))
  assert.deepEqual(snapshot(result), { statusBarHeight: 20, navigationBarHeight: 44, capsuleInsetRight: 105, totalHeight: 64 })
})

test('notched iOS and Android capsule gaps determine the actual toolbar height', () => {
  const notch = calculate({ windowWidth: 390, statusBarHeight: 47, safeArea: { top: 47 } }, rectangle(55, 32, 294))
  assert.deepEqual(snapshot(notch), { statusBarHeight: 47, navigationBarHeight: 48, capsuleInsetRight: 104, totalHeight: 95 })
  const android = calculate({ windowWidth: 360, statusBarHeight: 24, safeArea: { top: 24 } }, rectangle(36, 32, 262))
  assert.deepEqual(snapshot(android), { statusBarHeight: 24, navigationBarHeight: 56, capsuleInsetRight: 106, totalHeight: 80 })
})

test('a higher safe-area top wins over an underreported status bar without double counting', () => {
  const result = calculate({ windowWidth: 390, statusBarHeight: 44, safeArea: { top: 60 } }, rectangle(68, 32, 294))
  assert.deepEqual(snapshot(result), { statusBarHeight: 60, navigationBarHeight: 48, capsuleInsetRight: 104, totalHeight: 108 })
})

test('a higher status bar wins over safeArea.top, while a small capsule gap does not shrink navigation', () => {
  const result = calculate({ windowWidth: 375, statusBarHeight: 44, safeArea: { top: 20 } }, rectangle(45, 30))
  assert.deepEqual(snapshot(result), { statusBarHeight: 44, navigationBarHeight: 44, capsuleInsetRight: 105, totalHeight: 88 })
})

test('missing WeChat measurements retain a safe 44px status area and capsule reservation', () => {
  for (const info of [undefined, null, {}]) {
    assert.deepEqual(snapshot(calculate(info, undefined)), { statusBarHeight: 44, navigationBarHeight: 44, capsuleInsetRight: 104, totalHeight: 88 })
  }
})

test('untrusted status and safe-area fields cannot produce NaN or negative navigation geometry', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -10, '47', 9999]) {
    const result = calculate({ windowWidth: 375, statusBarHeight: value, safeArea: { top: value } }, undefined)
    assert.deepEqual(snapshot(result), { statusBarHeight: 44, navigationBarHeight: 44, capsuleInsetRight: 104, totalHeight: 88 })
  }
  const validSafeArea = calculate({ windowWidth: 390, statusBarHeight: Number.NaN, safeArea: { top: 47 } }, rectangle(55, 32, 294))
  assert.equal(validSafeArea.statusBarHeight, 47)
  assert.equal(validSafeArea.totalHeight, 95)
})

test('invalid capsules fall back without changing an otherwise valid status area', () => {
  const info = { windowWidth: 375, statusBarHeight: 47, safeArea: { top: 47 } }
  for (const capsule of [undefined, null, {}, rectangle(10), rectangle(55, 0), rectangle(55, Number.NaN), rectangle(55, 32, -10), rectangle(55, 32, 400)]) {
    const result = calculate(info, capsule)
    assert.deepEqual(snapshot(result), { statusBarHeight: 47, navigationBarHeight: 44, capsuleInsetRight: 104, totalHeight: 91 })
  }
})

test('H5 ignores the WeChat capsule and reserves only its own status plus standard toolbar', () => {
  const ordinary = calculate({ windowWidth: 390, statusBarHeight: 0, safeArea: { top: 0 } }, rectangle(80, 40, 250), false)
  assert.deepEqual(snapshot(ordinary), { statusBarHeight: 0, navigationBarHeight: 44, capsuleInsetRight: 0, totalHeight: 44 })
  assert.deepEqual(snapshot(calculate(undefined, undefined, false)), { statusBarHeight: 0, navigationBarHeight: 44, capsuleInsetRight: 0, totalHeight: 44 })
  assert.deepEqual(snapshot(calculate({ windowWidth: 390, statusBarHeight: 24, safeArea: { top: 28 } }, rectangle(), false)), { statusBarHeight: 28, navigationBarHeight: 44, capsuleInsetRight: 0, totalHeight: 72 })
})

function layoutHarness(platform = 'MP-WEIXIN', overrides = {}) {
  const state = {
    modern: { windowWidth: 390, statusBarHeight: 47, safeArea: { top: 47 } },
    legacy: { windowWidth: 375, statusBarHeight: 44, safeArea: { top: 44 } },
    capsule: rectangle(55, 32, 294),
    modernThrows: false, legacyThrows: false, capsuleThrows: false, subscribeThrows: false,
    ...overrides,
  }
  const calls = { modern: 0, legacy: 0, capsule: 0, subscriptions: [], removals: [] }
  const listeners = new Set()
  const hooks = { show: [], hide: [], unload: [] }
  const uni = {
    getWindowInfo: () => { calls.modern += 1; if (state.modernThrows) throw new Error('window API unavailable'); return state.modern },
    getSystemInfoSync: () => { calls.legacy += 1; if (state.legacyThrows) throw new Error('legacy API unavailable'); return state.legacy },
    getMenuButtonBoundingClientRect: () => { calls.capsule += 1; if (state.capsuleThrows) throw new Error('capsule API unavailable'); return state.capsule },
    onWindowResize: (callback) => {
      calls.subscriptions.push(callback)
      if (state.subscribeThrows) throw new Error('resize listener unavailable')
      listeners.add(callback)
    },
    offWindowResize: (callback) => { calls.removals.push(callback); listeners.delete(callback) },
  }
  for (const key of overrides.missing || []) delete uni[key]
  const composable = loadModule('src/composables/useNavigationLayout.ts', platform, { uni }, {
    '@dcloudio/uni-app': {
      onShow: (callback) => hooks.show.push(callback),
      onHide: (callback) => hooks.hide.push(callback),
      onUnload: (callback) => hooks.unload.push(callback),
    },
  })
  const api = composable.useNavigationLayout()
  return {
    api, state, calls, listeners,
    style: () => Object.fromEntries(Object.entries(api.navigationStyle.value)),
    show: () => { for (const callback of hooks.show) callback() },
    hide: () => { for (const callback of hooks.hide) callback() },
    unload: () => { for (const callback of hooks.unload) callback() },
    resize: () => { for (const callback of [...listeners]) callback() },
  }
}

const expectedStyle = (status, navigation, inset) => ({
  '--app-status-bar-height': status + 'px',
  '--app-nav-bar-height': navigation + 'px',
  '--app-capsule-right': inset + 'px',
  '--app-nav-total-height': status + navigation + 'px',
})

test('the composable reads synchronously so its first render has real safe-area CSS variables', () => {
  const h = layoutHarness()
  assert.deepEqual(h.style(), expectedStyle(47, 48, 104))
  assert.equal(h.calls.modern, 1)
  assert.equal(h.calls.legacy, 0)
  assert.equal(h.calls.capsule, 1)
  assert.equal(h.calls.subscriptions.length, 0)
})

test('a missing or throwing modern API falls back to usable legacy window measurements', () => {
  for (const overrides of [{ missing: ['getWindowInfo'] }, { modernThrows: true }]) {
    const h = layoutHarness('MP-WEIXIN', { ...overrides, legacy: { windowWidth: 360, statusBarHeight: 24, safeArea: { top: 24 } }, capsule: rectangle(36, 32, 262) })
    assert.deepEqual(h.style(), expectedStyle(24, 56, 106))
    assert.equal(h.calls.legacy, 1)
  }
})

test('modern results missing navigation fields fall back even when other window fields exist', () => {
  for (const modern of [undefined, {}, { windowWidth: 390 }, { windowWidth: 0, statusBarHeight: 47 }, { windowWidth: Number.NaN, statusBarHeight: 47 }, { windowWidth: 390, statusBarHeight: Number.POSITIVE_INFINITY, safeArea: { top: -5 } }]) {
    const h = layoutHarness('MP-WEIXIN', { modern, capsule: rectangle(52) })
    assert.equal(h.calls.legacy, 1)
    assert.deepEqual(h.style(), expectedStyle(44, 48, 105))
  }
})

test('a valid safe-area top is sufficient when the modern API omits statusBarHeight', () => {
  const h = layoutHarness('MP-WEIXIN', { modern: { windowWidth: 390, safeArea: { top: 59 } }, capsule: rectangle(67, 32, 294) })
  assert.equal(h.calls.legacy, 0)
  assert.deepEqual(h.style(), expectedStyle(59, 48, 104))
})

test('when all APIs are missing or throw, WeChat keeps safe defaults and H5 stays capsule-free', () => {
  for (const platform of ['MP-WEIXIN', 'H5']) {
    const expected = platform === 'MP-WEIXIN' ? expectedStyle(44, 44, 104) : expectedStyle(0, 44, 0)
    for (const overrides of [
      { missing: ['getWindowInfo', 'getSystemInfoSync', 'getMenuButtonBoundingClientRect'] },
      { modernThrows: true, legacyThrows: true, capsuleThrows: true },
      { modern: undefined, legacy: {}, capsule: undefined },
    ]) {
      const h = layoutHarness(platform, overrides)
      assert.deepEqual(h.style(), expected)
      assert.doesNotThrow(h.show)
      assert.deepEqual(h.style(), expected)
    }
  }
})

test('a null modern result and a failed legacy call cannot break page setup or onShow', () => {
  let h
  assert.doesNotThrow(() => { h = layoutHarness('MP-WEIXIN', { modern: null, legacyThrows: true, capsule: null }) })
  assert.deepEqual(h.style(), expectedStyle(44, 44, 104))
  assert.doesNotThrow(h.show)
  assert.deepEqual(h.style(), expectedStyle(44, 44, 104))
})

test('capsule API exceptions only fall back the toolbar and inset, never discard the measured status', () => {
  const h = layoutHarness('MP-WEIXIN', { capsuleThrows: true })
  assert.deepEqual(h.style(), expectedStyle(47, 44, 104))
  assert.doesNotThrow(h.show)
  assert.equal(h.calls.subscriptions.length, 1)
})

test('H5 never queries capsule APIs and respects trustworthy browser status or safe-top measurements', () => {
  const h = layoutHarness('H5', { modern: { windowWidth: 390, statusBarHeight: 0, safeArea: { top: 0 } }, capsuleThrows: true })
  assert.deepEqual(h.style(), expectedStyle(0, 44, 0))
  h.state.modern = { windowWidth: 390, statusBarHeight: 24, safeArea: { top: 28 } }
  h.show()
  assert.deepEqual(h.style(), expectedStyle(28, 44, 0))
  assert.equal(h.calls.capsule, 0)
})

test('repeated onShow refreshes measurements but registers only one resize listener', () => {
  const h = layoutHarness()
  h.state.modern = { windowWidth: 390, statusBarHeight: 59, safeArea: { top: 59 } }
  h.state.capsule = rectangle(67, 32, 294)
  h.show()
  h.show()
  assert.deepEqual(h.style(), expectedStyle(59, 48, 104))
  assert.equal(h.calls.modern, 3)
  assert.equal(h.calls.subscriptions.length, 1)
  assert.equal(h.listeners.size, 1)
  h.state.modern = { windowWidth: 844, statusBarHeight: 0, safeArea: { top: 0 } }
  h.state.capsule = rectangle(4, 32, 744)
  h.resize()
  assert.deepEqual(h.style(), expectedStyle(0, 44, 108))
})

test('onHide removes the exact resize callback and onShow can register it again', () => {
  const h = layoutHarness()
  h.show()
  const callback = h.calls.subscriptions[0]
  h.hide()
  h.hide()
  assert.equal(h.calls.removals.length, 1)
  assert.equal(h.calls.removals[0], callback)
  assert.equal(h.listeners.size, 0)
  const reads = h.calls.modern
  h.resize()
  assert.equal(h.calls.modern, reads)
  h.show()
  assert.equal(h.calls.subscriptions.length, 2)
  assert.equal(h.calls.subscriptions[1], callback)
  assert.equal(h.listeners.size, 1)
})

test('onUnload removes listeners and stale callbacks cannot update a disposed page', () => {
  const h = layoutHarness()
  h.show()
  const stale = h.calls.subscriptions[0]
  const before = h.style()
  const reads = h.calls.modern
  h.unload()
  h.unload()
  assert.equal(h.calls.removals.length, 1)
  assert.equal(h.listeners.size, 0)
  h.state.modern = { windowWidth: 390, statusBarHeight: 59 }
  stale()
  h.show()
  assert.equal(h.calls.modern, reads)
  assert.equal(h.calls.subscriptions.length, 1)
  assert.deepEqual(h.style(), before)
})

test('unsupported resize registration does not break layout and can recover on a later show', () => {
  const h = layoutHarness('MP-WEIXIN', { subscribeThrows: true })
  assert.doesNotThrow(h.show)
  assert.deepEqual(h.style(), expectedStyle(47, 48, 104))
  assert.equal(h.listeners.size, 0)
  h.state.subscribeThrows = false
  h.show()
  assert.equal(h.listeners.size, 1)
  h.unload()
  assert.equal(h.listeners.size, 0)
})
