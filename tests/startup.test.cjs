const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness, flush } = require('./helpers.cjs')

function startupHarness({ storage = {}, canUseWechat = true, identity, miniappLogin } = {}) {
  const wechatCalls = []
  let harness
  const h = createHarness({
    storage,
    env: { VITE_WECHAT_APP_ID: 'test-miniapp-id' },
    uni: {
      login: (request) => wechatCalls.push(request),
      switchTab: (navigation) => {
        harness.navigations.push(navigation)
        navigation.success?.({ errMsg: 'switchTab:ok' })
      },
    },
    mocks: {
      '@/api/auth': { miniappLogin: miniappLogin || (async () => authenticated()) },
      '@/utils/wechatIdentity': {
        PRIVACY_AGREED_KEY: 'ledger_mate_privacy_agreed',
        getWechatCode: identity || (async () => 'test-startup-code'),
      },
    },
  })
  harness = h
  const { useStartup } = h.load('src/composables/useStartup.ts')
  return { ...h, startup: useStartup(canUseWechat), wechatCalls }
}

test('startup silently restores a complete session before opening the preview', async () => {
  const h = startupHarness({ storage: { ledger_mate_privacy_agreed: true } })
  await h.startup.start()
  await flush()
  assert.equal(h.wechatCalls.length, 0)
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.navigations[0].url, '/pages/home/index')
  h.startup.dispose()
})

test('startup sends PHONE_REQUIRED users to preview without storing an incomplete session', async () => {
  const h = startupHarness({
    storage: { ledger_mate_privacy_agreed: true },
    miniappLogin: async () => ({ status: 'PHONE_REQUIRED', login_ticket: 'ticket', expires_at: '2099-01-01T00:00:00Z' }),
  })
  await h.startup.start()
  await flush()
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.auth.accessToken, '')
  assert.equal(h.navigations[0].url, '/pages/home/index')
  h.startup.dispose()
})

test('startup skips identity requests when privacy has not been accepted', async () => {
  let identityCalls = 0
  let loginCalls = 0
  const h = startupHarness({
    identity: async () => { identityCalls += 1; return 'unexpected' },
    miniappLogin: async () => { loginCalls += 1; return authenticated() },
  })
  await h.startup.start()
  await flush()
  assert.equal(identityCalls, 0)
  assert.equal(loginCalls, 0)
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.navigations[0].url, '/pages/home/index')
  h.startup.dispose()
})
