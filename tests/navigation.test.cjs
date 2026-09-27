const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const routes = ['pages/home/index', 'pages/assets/index', 'pages/statistics/index', 'pages/manage/index']
const chat = 'pages/ai-chat/index'
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
function platformSource(source, platform) {
  const stack = [true]
  return source.split(/\r?\n/).filter((line) => {
    const d = line.match(/^\s*\/\/\s*#(ifdef|ifndef|endif)(?:\s+([\w-]+))?\s*$/)
    if (!d) return stack.at(-1)
    if (d[1] === 'endif') stack.pop()
    else stack.push(stack.at(-1) && (d[1] === 'ifdef' ? d[2] === platform : d[2] !== platform))
    return false
  }).join('\n')
}
function navigation(platform, options = {}) {
  let route = options.route || routes[0]
  const calls = { switches: [], pushes: [], backs: [], native: [], hide: [], show: [] }
  const bar = { setData: (data) => { calls.native.push({ ...data }); options.onNative?.(data) } }
  const uni = {
    switchTab: (v) => calls.switches.push(v), navigateTo: (v) => calls.pushes.push(v), navigateBack: (v) => calls.backs.push(v),
    hideTabBar: (v) => calls.hide.push(v), showTabBar: (v) => calls.show.push(v),
    reLaunch: () => assert.fail('do not recreate the app'),
  }
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(platformSource(read('src/utils/navigation.ts'), platform), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
  const getCurrentPages = () => [...(options.previous || []), options.noBar ? { route } : options.scope ? { route, $scope: { getTabBar: () => bar } } : { route, getTabBar: () => bar }]
  const require = (specifier) => {
    if (specifier === '@/stores/auth') return { useAuthStore: () => ({ isLoggedIn: true }) }
    if (specifier === '@/utils/authNavigation') return { ensureLogin: () => true, PREVIEW_PATHS: routes.map(v => '/' + v) }
    throw new Error('Unexpected import: ' + specifier)
  }
  vm.runInNewContext(outputText, { module, exports: module.exports, uni, getCurrentPages, require })
  return { api: module.exports, calls, route: (v) => { route = v } }
}
function native(route = routes[0], loggedIn = true) {
  let definition, current = route
  const switches = [], pushes = []
  vm.runInNewContext(read('src/custom-tab-bar/index.js'), {
    Component: (v) => { definition = v }, getCurrentPages: () => [{ route: current }],
    wx: { switchTab: (v) => switches.push(v), navigateTo: (v) => pushes.push(v), reLaunch: () => assert.fail('do not recreate tabs') },
  })
  const instance = { data: JSON.parse(JSON.stringify(definition.data)), setData(v) { Object.assign(this.data, v) } }
  for (const [key, method] of Object.entries(definition.methods)) instance[key] = method.bind(instance)
  definition.lifetimes.attached.call(instance)
  instance.setData({ loggedIn })
  return { instance, switches, pushes, tap: (index) => instance.switchTab({ currentTarget: { dataset: { index } } }), show: (v) => { current = v; definition.pageLifetimes.show.call(instance) } }
}
test('four native tabs are registered separately from the standalone chat on MP and H5', () => {
  for (const platform of ['MP-WEIXIN', 'H5']) {
    const config = JSON.parse(platformSource(read('src/pages.json'), platform))
    assert.equal(config.pages[0].path, 'pages/startup/index')
    assert.deepEqual(config.tabBar.list.map((v) => v.pagePath), routes)
    assert.equal(config.tabBar.custom === true, platform === 'MP-WEIXIN')
    assert.equal(config.pages.filter((v) => v.path === chat).length, 1)
    assert.equal(config.pages.find((v) => v.path === chat).style.disableScroll, true)
    for (const item of config.tabBar.list) {
      assert.equal(config.pages.filter((v) => v.path === item.pagePath).length, 1)
      if (platform === 'H5') for (const key of ['iconPath', 'selectedIconPath']) assert.ok(fs.existsSync(path.join(root, 'src', item[key])))
    }
  }
  assert.deepEqual(native().instance.data.tabs.map((v) => v.pagePath), routes.map((v) => '/' + v))
})
test('native bar synchronizes selection with the actual route', () => {
  const h = native(routes[2])
  assert.equal(h.instance.data.selected, 2)
  h.instance.data.switching = true
  h.show(routes[3])
  assert.equal(h.instance.data.selected, 3)
  assert.equal(h.instance.data.switching, false)
})
test('reselecting current tab or invalid tab does not navigate', () => {
  const h = native(routes[1])
  for (const value of [1, '1', -1, 4, 5, 'invalid', undefined]) h.tap(value)
  assert.equal(h.switches.length, 0)
})
test('native tabs use switchTab and serialize taps until navigation completes', () => {
  const h = native()
  h.tap('1'); h.tap(3)
  assert.equal(h.switches.length, 1)
  assert.equal(h.pushes.length, 0)
  assert.equal(h.switches[0].url, '/' + routes[1])
  assert.equal(h.instance.data.selected, 0)
  h.switches[0].success(); h.switches[0].complete()
  assert.equal(h.instance.data.selected, 1)
  assert.equal(h.instance.data.switching, false)
})
test('failed tab navigation retains selection and permits retry', () => {
  const h = native(routes[2])
  h.tap(3); h.switches[0].complete()
  assert.equal(h.instance.data.selected, 2)
  assert.equal(h.instance.data.hidden, false)
  h.tap(1)
  assert.equal(h.switches.length, 2)
})
test('center action pushes chat without selecting it and returns to the previous tab', () => {
  const h = native(routes[2])
  h.instance.openChat(); h.instance.openChat(); h.tap(1)
  assert.equal(h.pushes.length, 1)
  assert.equal(h.switches.length, 0)
  assert.equal(h.pushes[0].url, '/' + chat)
  assert.equal(h.instance.data.selected, 2)
  h.pushes[0].complete(); h.show(chat)
  assert.equal(h.instance.data.hidden, true)
  h.show(routes[2])
  assert.equal(h.instance.data.hidden, false)
  assert.equal(h.instance.data.selected, 2)
})
test('failed center action can be retried without changing the selected tab', () => {
  const h = native(routes[3])
  h.instance.openChat(); h.pushes[0].complete()
  assert.equal(h.instance.data.selected, 3)
  assert.equal(h.instance.data.hidden, false)
  h.instance.openChat()
  assert.equal(h.pushes.length, 2)
})

test('native guest can switch preview tabs and the center action opens login once', () => {
  const h = native(routes[2], false)
  h.instance.openChat(); h.instance.openChat()
  assert.equal(h.pushes.length, 1)
  assert.equal(h.pushes[0].url, '/pages/login/index')
  assert.equal(h.instance.data.selected, 2)
  h.pushes[0].complete()
  h.tap(3)
  assert.equal(h.switches[0].url, '/' + routes[3])
})
test('goHome switches tab while goChat pushes once and prevents duplicate chat pages', () => {
  for (const platform of ['MP-WEIXIN', 'H5']) {
    const h = navigation(platform)
    h.api.goHome(); h.api.goChat(); h.api.goChat()
    assert.equal(h.calls.switches[0].url, '/' + routes[0])
    assert.equal(h.calls.pushes.length, 1)
    assert.equal(h.calls.pushes[0].url, '/' + chat)
    h.calls.pushes[0].complete(); h.route(chat); h.api.goChat()
    assert.equal(h.calls.pushes.length, 1)
    h.route(routes[0]); h.api.goChat()
    assert.equal(h.calls.pushes.length, 2)
  }
})
test('chat back preserves the existing stack and has a home fallback', () => {
  const h = navigation('MP-WEIXIN', { route: chat, previous: [{ route: routes[2] }] })
  h.api.backFromChat()
  assert.equal(h.calls.backs[0].delta, 1)
  assert.equal(h.calls.switches.length, 0)
  h.calls.backs[0].fail()
  assert.equal(h.calls.switches[0].url, '/' + routes[0])
  const direct = navigation('H5', { route: chat })
  direct.api.backFromChat()
  assert.equal(direct.calls.backs.length, 0)
  assert.equal(direct.calls.switches[0].url, '/' + routes[0])
})
test('ledger writes invalidate data without navigation', () => {
  const h = navigation('MP-WEIXIN')
  h.api.markLedgerChanged(); h.api.markLedgerChanged()
  assert.equal(h.api.ledgerRevision(), 2)
  assert.equal(h.calls.switches.length, 0)
})
test('MP supports direct and uni wrapped native component access', () => {
  for (const scope of [false, true]) {
    const h = navigation('MP-WEIXIN', { scope })
    h.api.setTabBarHidden(true); h.api.setTabBarHidden(false); h.api.syncNativeTab(3)
    assert.deepEqual(h.calls.native.map((v) => v.hidden), [true, false, false])
    assert.equal(h.calls.native.at(-1).selected, 3)
    assert.equal(h.calls.show.length, 0)
  }
})
test('calendar close cannot expose a tab bar on standalone chat', () => {
  const h = navigation('MP-WEIXIN', { route: chat, noBar: true })
  assert.doesNotThrow(() => h.api.setTabBarHidden(false))
  assert.equal(h.calls.native.length, 0)
  const web = navigation('H5', { route: chat })
  web.api.setTabBarHidden(false)
  assert.equal(web.calls.show.length, 0)
  assert.equal(web.calls.hide.length, 1)
})
test('foreground synchronization keeps a calendar open on all four MP tabs', () => {
  for (let index = 0; index < routes.length; index++) {
    const bar = native(routes[index])
    const h = navigation('MP-WEIXIN', { route: routes[index], onNative: (v) => bar.instance.setData(v) })
    h.api.setTabBarHidden(true); h.api.syncNativeTab(index); bar.show(routes[index])
    assert.equal(bar.instance.data.hidden, true)
    h.api.setTabBarHidden(false); bar.show(routes[index])
    assert.equal(bar.instance.data.hidden, false)
  }
})
test('H5 uses framework tab visibility and preserves open calendar state', () => {
  const h = navigation('H5')
  h.api.setTabBarHidden(true); h.api.syncNativeTab(2)
  assert.equal(h.calls.show.length, 0)
  h.api.setTabBarHidden(false); h.api.syncNativeTab(2)
  assert.equal(h.calls.show.length, 2)
  assert.equal(h.calls.native.length, 0)
})
