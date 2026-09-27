const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness } = require('./helpers.cjs')

function harness(routes) {
  const pages = routes.map(route => ({ route: 'pages/' + route + '/index' }))
  const calls = { push: [], replace: [], back: [], tab: [] }
  const h = createHarness({ pages, uni: {
    navigateTo: v => calls.push.push(v), redirectTo: v => calls.replace.push(v),
    navigateBack: v => calls.back.push(v), switchTab: v => calls.tab.push(v),
    reLaunch: () => assert.fail('login must preserve preview navigation'),
  } })
  return { ...h, pages, calls, api: h.load('src/utils/authNavigation.ts') }
}

test('guest actions open login once and permit retry after a failed navigation', () => {
  const h = harness(['statistics'])
  assert.equal(h.api.ensureLogin(), false)
  assert.equal(h.api.ensureLogin(), false)
  assert.equal(h.calls.push.length, 1)
  assert.equal(h.calls.push[0].url, '/pages/login/index')
  h.calls.push[0].complete()
  h.api.ensureLogin()
  assert.equal(h.calls.push.length, 2)
  assert.equal(h.calls.replace.length, 0)
  assert.equal(h.pages[0].route, 'pages/statistics/index')
})

test('authenticated actions proceed without opening login', () => {
  const h = harness(['home'])
  h.auth.saveSession(authenticated())
  assert.equal(h.api.ensureLogin(), true)
  h.load('src/utils/navigation.ts').goChat()
  assert.equal(h.calls.push.length, 1)
  assert.equal(h.calls.push[0].url, '/pages/ai-chat/index')
})

test('shared AI entry sends a guest directly to login', () => {
  const h = harness(['assets'])
  const navigation = h.load('src/utils/navigation.ts')
  navigation.goChat(); navigation.goChat()
  assert.equal(h.calls.push.length, 1)
  assert.equal(h.calls.push[0].url, '/pages/login/index')
})

test('protected direct entries are replaced so cancel cannot reopen the login guard', () => {
  for (const page of ['ai-chat', 'record-editor', 'record-detail', 'category-settings']) {
    const h = harness(['manage', page])
    assert.equal(h.api.ensureLogin(), false)
    assert.equal(h.calls.replace.length, 1)
    assert.equal(h.calls.replace[0].url, '/pages/login/index')
    assert.equal(h.calls.push.length, 0)
  }
})

test('login is never stacked on an existing login page', () => {
  const h = harness(['home', 'login'])
  h.api.openLogin(); h.api.ensureLogin()
  assert.equal(h.calls.push.length + h.calls.replace.length, 0)
})

test('return from login finds the nearest preview page and preserves its state', () => {
  const h = harness(['home', 'manage', 'record-editor', 'login'])
  let succeeded = false
  h.api.returnFromLogin({ success: () => { succeeded = true } })
  assert.equal(h.calls.back.length, 1)
  assert.equal(h.calls.back[0].delta, 2)
  h.calls.back[0].success()
  assert.equal(succeeded, true)
  assert.equal(h.calls.tab.length, 0)
})

test('direct login and failed back navigation fall back to the home preview', () => {
  for (const routes of [['login'], ['record-editor', 'login'], ['statistics', 'login']]) {
    const h = harness(routes)
    let failed = false
    h.api.returnFromLogin({ fail: () => { failed = true } })
    h.calls.back[0]?.fail()
    assert.equal(h.calls.tab.length, 1)
    assert.equal(h.calls.tab[0].url, '/pages/home/index')
    h.calls.tab[0].fail()
    assert.equal(failed, true)
  }
})

