// Run with: node --test --test-isolation=none tests/auth.test.cjs
const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticated, createHarness, flush } = require('./helpers.cjs')

const refreshed = { access_token: 'test-access-refreshed', refresh_token: 'test-refresh-refreshed', token_type: 'bearer' }

function requestHarness(options) {
  const harness = createHarness(options)
  harness.auth.saveSession(authenticated())
  const { request, ApiError } = harness.load('src/utils/request.ts')
  return { ...harness, request, ApiError }
}

test('cached credentials do not authenticate a cold start', () => {
  const { auth } = createHarness({ storage: {
    ledger_mate_access_token: 'test-legacy-access',
    ledger_mate_refresh_token: 'test-legacy-refresh',
  } })
  assert.equal(auth.isLoggedIn, false)
  assert.equal(auth.accessToken, '')
  assert.equal(auth.refreshToken, '')
  assert.equal(auth.user, null)
})

test('a verified session persists tokens; refresh preserves identity and session version', () => {
  const { auth, storage } = createHarness()
  const initialVersion = auth.sessionVersion
  auth.saveSession(authenticated())
  assert.equal(auth.isLoggedIn, true)
  assert.ok(auth.sessionVersion > initialVersion)
  const sessionVersion = auth.sessionVersion
  const user = auth.user
  auth.saveToken(refreshed)
  assert.equal(auth.sessionVersion, sessionVersion)
  assert.equal(auth.user, user)
  assert.equal(auth.appScope, 'hope_ledger_mate')
  assert.equal(storage.get('ledger_mate_access_token'), refreshed.access_token)
  assert.equal(storage.get('ledger_mate_refresh_token'), refreshed.refresh_token)
  auth.clear()
  assert.equal(auth.isLoggedIn, false)
  assert.equal(auth.user, null)
  assert.ok(auth.sessionVersion > sessionVersion)
  assert.equal(storage.has('ledger_mate_access_token'), false)
  assert.equal(storage.has('ledger_mate_refresh_token'), false)
})

test('wrong business scope, incomplete identity, and invalid tokens cannot create a session', () => {
  const invalid = [
    { app_scope: 'different_app' },
    { status: 'PHONE_REQUIRED' },
    { access_token: '' },
    { refresh_token: '' },
    { token_type: 'unsupported' },
    { user: { id: 'test-user', phone: '', needs_phone_binding: false } },
    { user: { id: 'test-user', phone: '13800000000', needs_phone_binding: true } },
    { user: { phone: '13800000000', needs_phone_binding: false } },
  ]
  for (const overrides of invalid) {
    const { auth, storage } = createHarness()
    auth.saveSession(authenticated())
    assert.throws(() => auth.saveSession(authenticated(overrides)))
    assert.equal(auth.isLoggedIn, false)
    assert.equal(storage.size, 0)
  }
})

test('tokens alone cannot establish an authenticated session', () => {
  const { auth } = createHarness()
  assert.throws(() => auth.saveToken(refreshed))
  assert.equal(auth.isLoggedIn, false)
})

test('a partial storage failure during login or refresh clears all session state', () => {
  for (const isRefresh of [false, true]) {
    const h = createHarness()
    if (isRefresh) h.auth.saveSession(authenticated())
    h.uni.setStorageSync = (key, value) => {
      if (key === 'ledger_mate_refresh_token') throw new Error('test storage unavailable')
      h.storage.set(key, value)
    }
    assert.throws(() => isRefresh ? h.auth.saveToken(refreshed) : h.auth.saveSession(authenticated()), /存储/)
    assert.equal(h.auth.isLoggedIn, false)
    assert.equal(h.auth.accessToken, '')
    assert.equal(h.auth.refreshToken, '')
    assert.equal(h.auth.user, null)
    assert.equal(h.storage.size, 0)
  }
})

test('identity and SMS endpoints use exact request bodies and never attach existing authorization', async () => {
  const h = requestHarness()
  const { miniappLogin, sendSmsCode, completeSmsLogin } = h.load('src/api/auth.ts')
  const identity = miniappLogin('test-weixin-code', 'test-appid')
  assert.equal(h.calls[0].url, 'https://api.example.test/api/v1/auth/identity/miniapp')
  assert.equal(JSON.stringify(h.calls[0].data), JSON.stringify({ code: 'test-weixin-code', appid: 'test-appid' }))
  assert.equal(h.calls[0].header.Authorization, undefined)
  h.respond(h.calls[0], 200, { status: 'PHONE_REQUIRED', login_ticket: 'test-ticket', expires_at: '2099-01-01T00:00:00Z' })
  assert.equal((await identity).status, 'PHONE_REQUIRED')
  const send = sendSmsCode('13800000000')
  assert.equal(h.calls[1].url, 'https://api.example.test/api/v1/auth/sms/send')
  assert.equal(h.calls[1].method, 'POST')
  assert.equal(JSON.stringify(h.calls[1].data), JSON.stringify({ phone: '13800000000' }))
  assert.equal(h.calls[1].header.Authorization, undefined)
  h.respond(h.calls[1], 200, null)
  assert.equal(await send, null)
  const completionData = { login_ticket: 'test-ticket', phone: '13800000000', code: '0123', accepted_terms: true }
  const completion = completeSmsLogin(completionData)
  assert.equal(h.calls[2].url, 'https://api.example.test/api/v1/auth/identity/complete/sms')
  assert.equal(h.calls[2].method, 'POST')
  assert.equal(h.calls[2].data, completionData)
  assert.equal(h.calls[2].header.Authorization, undefined)
  h.respond(h.calls[2], 200, authenticated())
  assert.equal((await completion).status, 'AUTHENTICATED')
})

test('a login HTTP 401 is not retried, refreshed, or redirected', async () => {
  const h = requestHarness()
  const pending = h.request({ url: '/auth/identity/miniapp', method: 'POST', data: { code: 'test-once-only-code' } }, { auth: false })
  h.respond(h.calls[0], 401, null, '身份验证失败')
  await assert.rejects(pending, (error) => error instanceof h.ApiError && error.statusCode === 401)
  assert.equal(h.calls.length, 1)
  assert.equal(h.navigations.length, 0)
  assert.equal(h.auth.isLoggedIn, true)
})

test('concurrent business HTTP 401 responses share one refresh and retry with new credentials', async () => {
  const h = requestHarness()
  const first = h.request({ url: '/records' })
  const second = h.request({ url: '/categories' })
  h.respond(h.calls[0], 401)
  h.respond(h.calls[1], 401)
  await flush()
  assert.equal(h.calls.length, 3)
  assert.ok(h.calls[2].url.endsWith('/auth/refresh'))
  assert.equal(h.calls[2].data.refresh_token, 'test-refresh-initial')
  assert.equal(h.calls[2].header?.Authorization, undefined)
  h.respond(h.calls[2], 200, refreshed)
  await flush()
  assert.equal(h.calls.length, 5)
  for (const call of h.calls.slice(3)) {
    assert.equal(call.header.Authorization, `Bearer ${refreshed.access_token}`)
    h.respond(call, 200, { path: call.url })
  }
  const values = await Promise.all([first, second])
  assert.ok(values[0].path.endsWith('/records'))
  assert.ok(values[1].path.endsWith('/categories'))
  assert.equal(h.auth.isLoggedIn, true)
})

test('a delayed HTTP 401 retries with the already refreshed token without another refresh', async () => {
  const h = requestHarness()
  const first = h.request({ url: '/records' })
  const delayed = h.request({ url: '/categories' })
  h.respond(h.calls[0], 401)
  await flush()
  h.respond(h.calls[2], 200, refreshed)
  await flush()
  h.respond(h.calls[3], 200, 'first-result')
  assert.equal(await first, 'first-result')
  h.respond(h.calls[1], 401)
  await flush()
  assert.equal(h.calls.filter((call) => call.url.endsWith('/auth/refresh')).length, 1)
  assert.equal(h.calls[4].header.Authorization, `Bearer ${refreshed.access_token}`)
  h.respond(h.calls[4], 200, 'delayed-result')
  assert.equal(await delayed, 'delayed-result')
})

test('HTTP 403 and a token-looking message do not trigger credential refresh', async () => {
  const h = requestHarness()
  const pending = h.request({ url: '/records' })
  h.respond(h.calls[0], 403, null, 'token 无权限，认证失败')
  await assert.rejects(pending, (error) => error.statusCode === 403)
  assert.equal(h.calls.length, 1)
  assert.equal(h.navigations.length, 0)
  assert.equal(h.auth.isLoggedIn, true)
})

test('ordinary network failure preserves the current session', async () => {
  const h = requestHarness()
  const pending = h.request({ url: '/records' })
  h.calls[0].fail({ errMsg: 'request:fail offline' })
  await assert.rejects(pending, /网络/)
  assert.equal(h.calls.length, 1)
  assert.equal(h.navigations.length, 0)
  assert.equal(h.auth.isLoggedIn, true)
})

test('HTTP 401 without a refresh token clears state and returns to login', async () => {
  const h = requestHarness()
  h.auth.refreshToken = ''
  const pending = h.request({ url: '/records' })
  if (h.calls[0]) h.respond(h.calls[0], 401)
  await assert.rejects(pending)
  assert.equal(h.calls.some((call) => call.url.endsWith('/auth/refresh')), false)
  assert.equal(h.auth.accessToken, '')
  assert.equal(h.navigations.length, 1)
  assert.equal(h.navigations[0].url, '/pages/login/index')
})

test('failed refresh clears credentials once for concurrent requests', async () => {
  const h = requestHarness()
  const first = h.request({ url: '/records' })
  const second = h.request({ url: '/categories' })
  const results = Promise.allSettled([first, second])
  h.respond(h.calls[0], 401)
  h.respond(h.calls[1], 401)
  await flush()
  h.respond(h.calls[2], 401, null, 'refresh expired')
  assert.ok((await results).every((result) => result.status === 'rejected'))
  assert.equal(h.calls.length, 3)
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.storage.size, 0)
  assert.equal(h.navigations.length, 1)
})

test('storage failure after refreshing clears credentials and redirects without replaying the request', async () => {
  const h = requestHarness()
  h.uni.setStorageSync = () => { throw new Error('test storage unavailable') }
  const pending = h.request({ url: '/records' })
  h.respond(h.calls[0], 401)
  await flush()
  h.respond(h.calls[1], 200, refreshed)
  await assert.rejects(pending)
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.storage.size, 0)
  assert.equal(h.navigations.length, 1)
  assert.equal(h.navigations[0].url, '/pages/login/index')
  assert.equal(h.calls.length, 2)
})

test('a second HTTP 401 clears the session without another refresh', async () => {
  const h = requestHarness()
  const pending = h.request({ url: '/records' })
  h.respond(h.calls[0], 401)
  await flush()
  h.respond(h.calls[1], 200, refreshed)
  await flush()
  h.respond(h.calls[2], 401)
  await assert.rejects(pending, (error) => error.statusCode === 401)
  assert.equal(h.calls.length, 3)
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.navigations.length, 1)
})

test('expired requests do not redirect when the user is already on the login page', async () => {
  const h = requestHarness({ pages: [{ route: 'pages/login/index' }] })
  h.auth.refreshToken = ''
  const pending = h.request({ url: '/records' })
  if (h.calls[0]) h.respond(h.calls[0], 401)
  await assert.rejects(pending)
  assert.equal(h.navigations.length, 0)
  assert.equal(h.auth.isLoggedIn, false)
})

test('a late refresh result cannot overwrite a newly signed-in account or replay old requests', async () => {
  const h = requestHarness()
  const pending = h.request({ url: '/records' })
  h.respond(h.calls[0], 401)
  await flush()
  const newSession = authenticated({ access_token: 'test-other-access', refresh_token: 'test-other-refresh', user: { id: 'other-user', phone: '13900000000', needs_phone_binding: false } })
  h.auth.saveSession(newSession)
  h.respond(h.calls[1], 200, refreshed)
  await assert.rejects(pending)
  assert.equal(h.calls.length, 2)
  assert.equal(h.auth.accessToken, newSession.access_token)
  assert.equal(h.auth.user.id, 'other-user')
  assert.equal(h.navigations.length, 0)
})

test('a late failed refresh cannot clear a newly signed-in account', async () => {
  const h = requestHarness()
  const pending = h.request({ url: '/records' })
  h.respond(h.calls[0], 401)
  await flush()
  h.auth.saveSession(authenticated({ access_token: 'test-other-access', refresh_token: 'test-other-refresh' }))
  h.respond(h.calls[1], 401)
  await assert.rejects(pending)
  assert.equal(h.auth.accessToken, 'test-other-access')
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.calls.length, 2)
  assert.equal(h.navigations.length, 0)
})

test('a late business response is discarded after the session changes', async () => {
  for (const statusCode of [200, 401]) {
    const h = requestHarness()
    const pending = h.request({ url: '/records' })
    h.auth.saveSession(authenticated({ access_token: 'test-other-access', refresh_token: 'test-other-refresh' }))
    h.respond(h.calls[0], statusCode, { private: 'old-account-data' })
    await assert.rejects(pending)
    assert.equal(h.calls.length, 1)
    assert.equal(h.auth.accessToken, 'test-other-access')
    assert.equal(h.navigations.length, 0)
  }
})

test('HTTP 429 preserves Retry-After for the login flow', async () => {
  const h = requestHarness()
  const pending = h.request({ url: '/auth/identity/miniapp' }, { auth: false })
  h.respond(h.calls[0], 429, null, '请稍后再试', { 'rEtRy-AfTeR': '37' })
  await assert.rejects(pending, (error) => error.statusCode === 429 && error.retryAfterSeconds === 37)
  assert.equal(h.calls.length, 1)
})

test('an envelope error under HTTP 200 does not masquerade as an HTTP 401', async () => {
  const h = requestHarness()
  const pending = h.request({ url: '/records' })
  h.calls[0].success({ statusCode: 200, data: { code: 401, message: '认证失败', data: null }, header: {} })
  await assert.rejects(pending, (error) => error.statusCode === 200)
  assert.equal(h.calls.length, 1)
  assert.equal(h.auth.isLoggedIn, true)
})

function loginHarness(options = {}) {
  let timestamp = Date.parse('2030-01-01T00:00:00Z')
  let nextTimer = 0
  const timers = new Map()
  const timeouts = new Map()
  const wechatCalls = []
  class TestDate extends Date {
    static now() { return timestamp }
  }
  const h = createHarness({
    ...options,
    env: { VITE_WECHAT_APP_ID: 'test-miniapp-id', ...options.env },
    uni: { login: (request) => wechatCalls.push(request), ...options.uni },
    globals: {
      Date: TestDate,
      setInterval: (callback) => { const id = ++nextTimer; timers.set(id, callback); return id },
      clearInterval: (id) => timers.delete(id),
      setTimeout: (callback, delay) => { const id = ++nextTimer; timeouts.set(id, { callback, due: timestamp + delay }); return id },
      clearTimeout: (id) => timeouts.delete(id),
      ...options.globals,
    },
  })
  for (const method of ['switchTab', 'navigateBack']) {
    if (!options.uni?.[method]) {
      h.uni[method] = (navigation) => {
        h.navigations.push(navigation)
        if (!options.deferNavigation) navigation.success?.({ errMsg: `${method}:ok` })
      }
    }
  }
  const { useLogin } = h.load('src/composables/useLogin.ts')
  const login = useLogin(options.canUseWechat !== false)
  const advance = (seconds) => {
    timestamp += seconds * 1000
    for (const callback of [...timers.values()]) callback()
    for (const [id, timer] of [...timeouts.entries()]) {
      if (timer.due <= timestamp) { timeouts.delete(id); timer.callback() }
    }
  }
  return { ...h, login, wechatCalls, timers, timeouts, advance }
}

async function enterPhoneRequired(h) {
  h.login.agreed.value = true
  const pending = h.login.login()
  h.wechatCalls.at(-1).success({ code: 'test-fresh-wechat-code' })
  await flush()
  h.respond(h.calls.at(-1), 200, {
    status: 'PHONE_REQUIRED', login_ticket: 'test-ephemeral-ticket', expires_at: '2030-01-01T00:10:00Z',
  })
  await pending
}

test('login waits for agreement and a supported miniapp environment', async () => {
  const h = loginHarness()
  h.login.onShow()
  await h.login.login()
  assert.equal(h.wechatCalls.length, 0)
  assert.equal(h.calls.length, 0)
  h.login.dispose()

  const unsupported = loginHarness({ canUseWechat: false })
  unsupported.login.agreed.value = true
  await unsupported.login.login()
  assert.match(unsupported.login.errorMessage.value, /微信小程序/)
  assert.equal(unsupported.wechatCalls.length, 0)
  unsupported.login.dispose()
})

test('remembered agreement still requires a login tap and repeated taps share one identity request', async () => {
  const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true } })
  h.login.onShow()
  h.login.onShow()
  assert.equal(h.wechatCalls.length, 0)
  assert.equal(h.calls.length, 0)
  const completion = h.login.login()
  await h.login.login()
  assert.equal(h.wechatCalls.length, 1)
  assert.equal(h.wechatCalls[0].provider, 'weixin')
  h.wechatCalls[0].success({ code: 'test-new-launch-code' })
  await flush()
  assert.equal(h.calls[0].data.code, 'test-new-launch-code')
  assert.equal(h.calls[0].data.appid, 'test-miniapp-id')
  h.respond(h.calls[0], 200, authenticated())
  await completion
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.login.loading.value, false)
  assert.equal(h.storage.get('ledger_mate_privacy_agreed'), true)
  assert.equal(h.navigations[0].url, '/pages/home/index')
  h.login.dispose()
})

test('a real login tap stays on phone binding until SMS verification succeeds', async () => {
  const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true } })
  h.login.onShow()
  const tapEvent = { type: 'tap', timeStamp: 1, detail: { x: 160, y: 650 }, target: {}, currentTarget: {} }
  const pending = h.login.login(tapEvent)
  assert.equal(h.wechatCalls.length, 1)
  h.wechatCalls[0].success({ code: 'test-tap-wechat-code' })
  await flush()
  h.respond(h.calls[0], 200, {
    status: 'PHONE_REQUIRED', login_ticket: 'test-tap-ticket', expires_at: '2030-01-01T00:10:00Z',
  })
  await pending
  assert.equal(h.login.phoneRequired.value, true)
  assert.equal(h.login.initializing.value, false)
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.navigations.length, 0)

  h.login.onShow()
  h.login.onShow()
  assert.equal(h.login.phoneRequired.value, true)
  assert.equal(h.wechatCalls.length, 1)
  assert.equal(h.calls.length, 1)
  assert.equal(h.navigations.length, 0)

  h.login.phone.value = '13800000000'
  const sending = h.login.sendCode()
  assert.ok(h.calls[1].url.endsWith('/auth/sms/send'))
  h.respond(h.calls[1], 200, null)
  await sending
  h.login.smsCode.value = '0123'
  const completion = h.login.completePhoneLogin()
  assert.equal(h.calls[2].data.login_ticket, 'test-tap-ticket')
  h.respond(h.calls[2], 200, authenticated())
  await completion
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.login.phoneRequired.value, false)
  assert.equal(h.wechatCalls.length, 1)
  assert.equal(h.navigations.length, 1)
  assert.equal(h.navigations[0].url, '/pages/home/index')
  h.login.dispose()
})

test('manual login does not silently request identity and still logs in after a tap', async () => {
  const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true } })
  h.login.onShow()
  assert.equal(h.wechatCalls.length, 0)
  const completion = h.login.login()
  assert.equal(h.wechatCalls.length, 1)
  h.wechatCalls[0].success({ code: 'test-manual-wechat-code' })
  await flush()
  h.respond(h.calls[0], 200, authenticated())
  await completion
  assert.equal(h.auth.isLoggedIn, true)
  h.login.dispose()
})

test('PHONE_REQUIRED remains unauthenticated and the ticket stays in memory', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  assert.equal(h.login.phoneRequired.value, true)
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.auth.accessToken, '')
  assert.equal(h.login.loading.value, false)
  assert.equal(h.calls.length, 1)
  assert.equal(h.navigations.length, 0)
  assert.equal([...h.storage.values()].includes('test-ephemeral-ticket'), false)
  assert.equal(h.storage.has('ledger_mate_access_token'), false)
  h.login.dispose()
  assert.equal(h.timers.size, 0)
})

test('invalid phone numbers cannot send SMS or complete login', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.smsCode.value = '0123'
  for (const phone of ['', '12345678901', '1380000000', '138000000000', '1380000000x']) {
    h.login.phone.value = phone
    await h.login.sendCode()
    await h.login.completePhoneLogin()
    assert.equal(h.calls.length, 1)
    assert.match(h.login.errorMessage.value, /手机号/)
  }
  assert.equal(h.login.phoneRequired.value, true)
  h.login.dispose()
})

test('only a four-digit SMS code may complete login, preserving a leading zero', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.phone.value = '13800000000'
  for (const code of ['', '123', '12345', '12a3']) {
    h.login.smsCode.value = code
    await h.login.completePhoneLogin()
    assert.equal(h.calls.length, 1)
    assert.match(h.login.errorMessage.value, /4|四/)
  }
  h.login.smsCode.value = '0123'
  const completion = h.login.completePhoneLogin()
  assert.equal(h.login.verifyingPhone.value, true)
  assert.equal(h.calls.length, 2)
  assert.equal(JSON.stringify(h.calls[1].data), JSON.stringify({
    login_ticket: 'test-ephemeral-ticket', phone: '13800000000', code: '0123', accepted_terms: true,
  }))
  await h.login.completePhoneLogin()
  assert.equal(h.calls.length, 2)
  h.respond(h.calls[1], 200, authenticated())
  await completion
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.login.verifyingPhone.value, false)
  assert.equal(h.login.loading.value, false)
  assert.equal(h.navigations[0].url, '/pages/home/index')
  h.login.dispose()
})

test('SMS sending waits 60 seconds before another request and normalizes supported phone prefixes', async () => {
  for (const phone of [' 13800000000 ', '+86 13800000000', '0086 13800000000']) {
    const h = loginHarness()
    await enterPhoneRequired(h)
    h.login.phone.value = phone
    const sending = h.login.sendCode()
    assert.equal(h.calls.length, 2)
    assert.equal(h.calls[1].data.phone, '13800000000')
    await h.login.sendCode()
    assert.equal(h.calls.length, 2)
    h.respond(h.calls[1], 200, null)
    await sending
    assert.equal(h.login.sendRetrySeconds.value, 60)
    h.advance(59)
    assert.equal(h.login.sendRetrySeconds.value, 1)
    await h.login.sendCode()
    assert.equal(h.calls.length, 2)
    h.advance(1)
    assert.equal(h.login.sendRetrySeconds.value, 0)
    const resend = h.login.sendCode()
    assert.equal(h.calls.length, 3)
    h.respond(h.calls[2], 200, null)
    await resend
    assert.equal(h.login.phoneRequired.value, true)
    assert.equal(h.auth.isLoggedIn, false)
    h.login.dispose()
  }
})

test('SMS HTTP 400 and 422 leave the ticket available for correcting the code', async () => {
  for (const status of [400, 422]) {
    const h = loginHarness()
    await enterPhoneRequired(h)
    h.login.phone.value = '13800000000'
    h.login.smsCode.value = '1234'
    const wrongCode = h.login.completePhoneLogin()
    h.respond(h.calls[1], status, null, '验证码错误或已过期')
    await wrongCode
    assert.equal(h.auth.isLoggedIn, false)
    assert.equal(h.login.phoneRequired.value, true)
    assert.match(h.login.errorMessage.value, /验证码错误/)
    assert.equal(h.login.loading.value, false)
    h.login.smsCode.value = '0123'
    const corrected = h.login.completePhoneLogin()
    assert.equal(h.wechatCalls.length, 1)
    assert.equal(h.calls[2].data.login_ticket, 'test-ephemeral-ticket')
    assert.equal(h.calls[2].data.code, '0123')
    h.respond(h.calls[2], 200, authenticated())
    await corrected
    assert.equal(h.auth.isLoggedIn, true)
    h.login.dispose()
  }
})

test('changing the normalized phone clears its code while an equivalent prefix preserves it', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  h.login.successMessage.value = '验证码已发送，5 分钟内有效'
  h.login.phone.value = '+86 13800000000'
  assert.equal(h.login.smsCode.value, '0123')
  assert.ok(h.login.successMessage.value)
  h.login.phone.value = '13900000000'
  assert.equal(h.login.smsCode.value, '')
  assert.equal(h.login.successMessage.value, '')
  h.login.smsCode.value = '0123'
  h.login.phone.value = '0086 13900000000'
  assert.equal(h.login.smsCode.value, '0123')
  const completion = h.login.completePhoneLogin()
  assert.equal(h.calls[1].data.phone, '13900000000')
  assert.equal(h.calls[1].data.code, '0123')
  h.respond(h.calls[1], 200, authenticated({ user: { id: 'test-user', phone: '13900000000', needs_phone_binding: false } }))
  await completion
  assert.equal(h.auth.isLoggedIn, true)
  h.login.dispose()
})

test('first render and repeated page shows display login controls without identity requests', () => {
  for (const options of [{}, { storage: { ledger_mate_privacy_agreed: true } }, { canUseWechat: false, storage: { ledger_mate_privacy_agreed: true } }]) {
    const h = loginHarness(options)
    assert.equal(h.login.initializing.value, false)
    h.login.onShow()
    h.login.onShow()
    assert.equal(h.login.initializing.value, false)
    assert.equal(h.wechatCalls.length, 0)
    assert.equal(h.calls.length, 0)
    h.login.dispose()
  }
})

test('explicit login shows the launch screen only after verification and until navigation completes', async () => {
  const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true }, deferNavigation: true })
  h.login.onShow()
  const completion = h.login.login()
  assert.equal(h.login.initializing.value, false)
  assert.equal(h.login.loading.value, true)
  h.wechatCalls[0].success({ code: 'test-launch-code' })
  await flush()
  assert.equal(h.login.initializing.value, false)
  h.respond(h.calls[0], 200, authenticated())
  await completion
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.login.initializing.value, true)
  assert.equal(h.login.loading.value, false)
  assert.equal(h.navigations.length, 1)
  assert.equal(h.timeouts.size, 1)
  h.login.onShow()
  await h.login.login()
  assert.equal(h.navigations.length, 1)
  assert.equal(h.wechatCalls.length, 1)
  h.navigations[0].success({ errMsg: 'switchTab:ok' })
  assert.equal(h.login.initializing.value, true)
  assert.equal(h.timeouts.size, 0)
  h.login.dispose()
})

test('explicit verification keeps controls visible on failure, missing setup and PHONE_REQUIRED', async () => {
  const missing = loginHarness({ storage: { ledger_mate_privacy_agreed: true }, env: { VITE_WECHAT_APP_ID: '' } })
  missing.login.onShow()
  await missing.login.login()
  assert.equal(missing.login.initializing.value, false)
  assert.ok(missing.login.errorMessage.value)
  missing.login.dispose()

  for (const outcome of ['wechat-failure', 'http-failure', 'phone-required']) {
    const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true } })
    h.login.onShow()
    const completion = h.login.login()
    if (outcome === 'wechat-failure') {
      h.wechatCalls[0].fail({ errMsg: 'login:fail' })
    } else {
      h.wechatCalls[0].success({ code: 'test-launch-code' })
      await flush()
      if (outcome === 'http-failure') h.respond(h.calls[0], 401, null, '请重新登录')
      else h.respond(h.calls[0], 200, { status: 'PHONE_REQUIRED', login_ticket: 'test-ticket', expires_at: '2030-01-01T00:10:00Z' })
    }
    await completion
    assert.equal(h.login.initializing.value, false)
    assert.equal(h.login.loading.value, false)
    assert.equal(h.login.phoneRequired.value, outcome === 'phone-required')
    assert.equal(h.auth.isLoggedIn, false)
    assert.equal(h.navigations.length, 0)
    h.login.dispose()
  }
})

test('navigation failure reveals a retry and preserves the verified session without another identity request', async () => {
  const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true }, deferNavigation: true })
  h.login.onShow()
  const completion = h.login.login()
  h.wechatCalls[0].success({ code: 'test-launch-code' })
  await flush()
  h.respond(h.calls[0], 200, authenticated())
  await completion
  const sessionVersion = h.auth.sessionVersion
  h.navigations[0].fail({ errMsg: 'switchTab:fail' })
  assert.equal(h.login.initializing.value, false)
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.timeouts.size, 0)
  assert.match(h.login.errorMessage.value, /未能打开账本/)
  await h.login.login()
  assert.equal(h.login.initializing.value, true)
  assert.equal(h.navigations.length, 2)
  assert.equal(h.wechatCalls.length, 1)
  assert.equal(h.calls.length, 1)
  assert.equal(h.auth.sessionVersion, sessionVersion)
  h.navigations[1].success({ errMsg: 'switchTab:ok' })
  h.login.dispose()
})

test('existing verified sessions use the launch screen and navigation timeout remains retryable', async () => {
  const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true }, deferNavigation: true })
  h.auth.saveSession(authenticated())
  h.login.onShow()
  assert.equal(h.login.initializing.value, true)
  assert.equal(h.navigations.length, 1)
  assert.equal(h.wechatCalls.length, 0)
  h.advance(11)
  assert.equal(h.login.initializing.value, true)
  h.advance(1)
  assert.equal(h.login.initializing.value, false)
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.timeouts.size, 0)
  await h.login.login()
  assert.equal(h.navigations.length, 2)
  h.navigations[0].success({ errMsg: 'late-switchTab:ok' })
  assert.equal(h.timeouts.size, 1)
  assert.equal(h.login.initializing.value, true)
  h.login.dispose()
  assert.equal(h.timeouts.size, 0)
  h.navigations[1].fail({ errMsg: 'late-switchTab:fail' })
  assert.equal(h.login.errorMessage.value, '')
})

test('a synchronous navigation error recovers the controls and keeps the authenticated session', () => {
  const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true }, uni: { switchTab: () => { throw new Error('navigation unavailable') } } })
  h.auth.saveSession(authenticated())
  h.login.onShow()
  assert.equal(h.login.initializing.value, false)
  assert.equal(h.auth.isLoggedIn, true)
  assert.equal(h.timeouts.size, 0)
  assert.match(h.login.errorMessage.value, /重试/)
  h.login.dispose()
})

test('SMS controls stay visible while verifying and return to the launch screen only after verification succeeds', async () => {
  const h = loginHarness({ deferNavigation: true })
  h.login.onShow()
  await enterPhoneRequired(h)
  assert.equal(h.login.initializing.value, false)
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  const completion = h.login.completePhoneLogin()
  assert.equal(h.login.initializing.value, false)
  assert.equal(h.login.verifyingPhone.value, true)
  h.respond(h.calls[1], 200, authenticated())
  await completion
  assert.equal(h.login.initializing.value, true)
  assert.equal(h.login.phoneRequired.value, false)
  assert.equal(h.navigations.length, 1)
  h.navigations[0].fail({ errMsg: 'switchTab:fail' })
  assert.equal(h.login.initializing.value, false)
  assert.equal(h.login.loading.value, false)
  assert.equal(h.auth.isLoggedIn, true)
  h.login.dispose()
})

test('SMS completion HTTP 429 preserves the ticket while Retry-After blocks submission', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  const limited = h.login.completePhoneLogin()
  h.respond(h.calls[1], 429, null, '请求过于频繁', { 'Retry-After': '3' })
  await limited
  assert.equal(h.login.phoneRequired.value, true)
  assert.equal(h.login.retrySeconds.value, 3)
  await h.login.completePhoneLogin()
  await h.login.sendCode()
  assert.equal(h.calls.length, 2)
  h.advance(3)
  const retried = h.login.completePhoneLogin()
  assert.equal(h.calls[2].data.login_ticket, 'test-ephemeral-ticket')
  assert.equal(h.wechatCalls.length, 1)
  h.respond(h.calls[2], 200, authenticated())
  await retried
  assert.equal(h.auth.isLoggedIn, true)
  h.login.dispose()
})

test('SMS delivery failure keeps its ticket and 60-second cooldown without automatic resend', async () => {
  for (const status of [502, 429, 0]) {
    const h = loginHarness()
    await enterPhoneRequired(h)
    h.login.phone.value = '13800000000'
    const sending = h.login.sendCode()
    assert.equal(h.login.sendRetrySeconds.value, 60)
    if (status === 0) h.calls[1].fail({ errMsg: 'request:fail timeout' })
    else h.respond(h.calls[1], status, null, '发送验证码失败，请稍后再试')
    await sending
    assert.equal(h.login.phoneRequired.value, true)
    assert.equal(h.login.sendRetrySeconds.value, 60)
    assert.ok(h.login.errorMessage.value)
    await h.login.sendCode()
    assert.equal(h.calls.length, 2)
    h.advance(60)
    const resend = h.login.sendCode()
    assert.equal(h.calls.length, 3)
    h.respond(h.calls[2], 200, null)
    await resend
    assert.equal(h.wechatCalls.length, 1)
    assert.equal(h.auth.isLoggedIn, false)
    h.login.dispose()
  }
})

test('SMS send and completion require agreement and a valid pending identity', async () => {
  const h = loginHarness()
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  await h.login.sendCode()
  await h.login.completePhoneLogin()
  assert.equal(h.calls.length, 0)
  await enterPhoneRequired(h)
  h.login.agreed.value = false
  await h.login.sendCode()
  await h.login.completePhoneLogin()
  assert.equal(h.calls.length, 1)
  h.login.dispose()
})

test('SMS sending and code verification cannot overlap', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  const sending = h.login.sendCode()
  assert.equal(h.login.sendingCode.value, true)
  await h.login.completePhoneLogin()
  await h.login.login()
  assert.equal(h.calls.length, 2)
  assert.equal(h.wechatCalls.length, 1)
  h.respond(h.calls[1], 200, null)
  await sending
  assert.equal(h.login.sendingCode.value, false)
  h.login.smsCode.value = '0123'
  const completion = h.login.completePhoneLogin()
  await h.login.sendCode()
  assert.equal(h.calls.length, 3)
  h.respond(h.calls[2], 200, authenticated())
  await completion
  assert.equal(h.auth.isLoggedIn, true)
  h.login.dispose()
})

test('disposing during SMS sending ignores late delivery feedback', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.phone.value = '13800000000'
  const sending = h.login.sendCode()
  h.login.dispose()
  h.respond(h.calls[1], 200, null)
  await sending
  assert.equal(h.login.successMessage.value, '')
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.navigations.length, 0)
  assert.equal(h.timers.size, 0)
})

test('HTTP 410 after phone submission discards the ticket and requires a fresh WeChat login', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  const completion = h.login.completePhoneLogin()
  h.respond(h.calls[1], 410, null, '登录票据已失效')
  await completion
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.login.phoneRequired.value, false)
  assert.match(h.login.errorMessage.value, /重新微信登录/)
  await h.login.completePhoneLogin()
  assert.equal(h.calls.length, 2)
  const restart = h.login.login()
  assert.equal(h.wechatCalls.length, 2)
  h.wechatCalls[1].success({ code: 'test-restarted-wechat-code' })
  await flush()
  assert.ok(h.calls[2].url.endsWith('/auth/identity/miniapp'))
  assert.equal(h.calls[2].data.code, 'test-restarted-wechat-code')
  h.respond(h.calls[2], 200, authenticated())
  await restart
  assert.equal(h.auth.isLoggedIn, true)
  h.login.dispose()
})

test('uncertain SMS completion failures discard the ticket and prevent automatic replay', async () => {
  for (const status of [502, 0]) {
    const h = loginHarness()
    await enterPhoneRequired(h)
    h.login.phone.value = '13800000000'
    h.login.smsCode.value = '0123'
    const completion = h.login.completePhoneLogin()
    if (status === 0) h.calls[1].fail({ errMsg: 'request:fail timeout' })
    else h.respond(h.calls[1], status, null, '验证暂不可用', { 'Retry-After': '3' })
    await completion
    assert.equal(h.login.phoneRequired.value, false)
    assert.match(h.login.errorMessage.value, /重新微信登录/)
    await h.login.completePhoneLogin()
    assert.equal(h.calls.length, 2)
    assert.equal(h.auth.isLoggedIn, false)
    h.login.dispose()
  }
})

test('an expired phone ticket cannot be sent to the completion endpoint', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.advance(601)
  assert.equal(h.login.phoneRequired.value, false)
  assert.match(h.login.errorMessage.value, /过期/)
  assert.equal(h.timers.size, 0)
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  await h.login.completePhoneLogin()
  await h.login.sendCode()
  assert.equal(h.calls.length, 1)
  assert.equal(h.auth.isLoggedIn, false)
  h.login.dispose()
})

test('HTTP 429 enforces Retry-After before obtaining another WeChat code', async () => {
  const h = loginHarness()
  h.login.agreed.value = true
  const pending = h.login.login()
  h.wechatCalls[0].success({ code: 'test-wechat-code' })
  await flush()
  h.respond(h.calls[0], 429, null, '请求过于频繁', { 'Retry-After': '3' })
  await pending
  assert.equal(h.login.retrySeconds.value, 3)
  await h.login.login()
  assert.equal(h.wechatCalls.length, 1)
  h.advance(2)
  assert.equal(h.login.retrySeconds.value, 1)
  await h.login.login()
  assert.equal(h.wechatCalls.length, 1)
  h.advance(1)
  assert.equal(h.login.retrySeconds.value, 0)
  const restart = h.login.login()
  assert.equal(h.wechatCalls.length, 2)
  h.wechatCalls[1].fail({ errMsg: 'login:fail' })
  await restart
  h.login.dispose()
})

test('invalid business scope is visible as a login error and cannot redirect to business pages', async () => {
  const h = loginHarness()
  h.login.agreed.value = true
  const pending = h.login.login()
  h.wechatCalls[0].success({ code: 'test-wechat-code' })
  await flush()
  h.respond(h.calls[0], 200, authenticated({ app_scope: 'other_business' }))
  await pending
  assert.equal(h.auth.isLoggedIn, false)
  assert.match(h.login.errorMessage.value, /账伴|登录信息无效/)
  assert.equal(h.login.loading.value, false)
  assert.equal(h.navigations.length, 0)
  h.login.dispose()
})

test('SMS completion with the wrong business scope discards the consumed ticket and requires login again', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  const completion = h.login.completePhoneLogin()
  h.respond(h.calls[1], 200, authenticated({ app_scope: 'other_business' }))
  await completion
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.login.phoneRequired.value, false)
  assert.equal(h.login.smsCode.value, '')
  assert.match(h.login.errorMessage.value, /账伴|登录信息无效/)
  assert.equal(h.navigations.length, 0)
  h.login.smsCode.value = '0123'
  await h.login.completePhoneLogin()
  await h.login.sendCode()
  assert.equal(h.calls.length, 2)
  const restart = h.login.login()
  assert.equal(h.wechatCalls.length, 2)
  h.wechatCalls[1].success({ code: 'test-wechat-code-after-invalid-session' })
  await flush()
  assert.ok(h.calls[2].url.endsWith('/auth/identity/miniapp'))
  h.respond(h.calls[2], 200, authenticated())
  await restart
  assert.equal(h.auth.isLoggedIn, true)
  h.login.dispose()
})

test('disposing a login screen prevents stale identity results from writing a session', async () => {
  const h = loginHarness()
  h.login.agreed.value = true
  const pending = h.login.login()
  h.wechatCalls[0].success({ code: 'test-wechat-code' })
  await flush()
  h.login.dispose()
  h.respond(h.calls[0], 200, authenticated())
  await pending
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.storage.has('ledger_mate_access_token'), false)
  assert.equal(h.navigations.length, 0)
  assert.equal(h.timers.size, 0)
})

test('disposing during phone completion prevents stale results from writing a session', async () => {
  const h = loginHarness()
  await enterPhoneRequired(h)
  h.login.phone.value = '13800000000'
  h.login.smsCode.value = '0123'
  const completion = h.login.completePhoneLogin()
  h.login.dispose()
  h.respond(h.calls[1], 200, authenticated())
  await completion
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.storage.has('ledger_mate_access_token'), false)
  assert.equal(h.navigations.length, 0)
})

test('withdrawing agreement while WeChat login is in progress does not send the identity request', async () => {
  const h = loginHarness()
  h.login.agreed.value = true
  const pending = h.login.login()
  h.login.agreed.value = false
  h.wechatCalls[0].success({ code: 'test-wechat-code' })
  await pending
  assert.equal(h.calls.length, 0)
  assert.equal(h.auth.isLoggedIn, false)
  assert.equal(h.login.loading.value, false)
  h.login.dispose()
})

test('returning from the login page cancels in-flight identity verification and ignores late success', async () => {
  const h = loginHarness({ storage: { ledger_mate_privacy_agreed: true } })
  const pending = h.login.login()
  assert.equal(h.wechatCalls.length, 1)
  h.login.cancelLogin()
  assert.equal(h.login.loading.value, false)
  assert.equal(h.login.phoneRequired.value, false)
  assert.equal(h.navigations.length, 1)
  assert.equal(h.navigations[0].url, '/pages/home/index')
  h.wechatCalls[0].success({ code: 'late-code' })
  await pending
  assert.equal(h.calls.length, 0)
  assert.equal(h.auth.isLoggedIn, false)
  h.login.dispose()
})

