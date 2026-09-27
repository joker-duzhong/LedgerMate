const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { createPinia, setActivePinia } = require('pinia')

const root = path.resolve(__dirname, '..')

function createLoader({ globals = {}, mocks = {}, env = {} } = {}) {
  const cache = new Map()
  const context = vm.createContext({ console, setTimeout, clearTimeout, ...globals })

  function load(filename) {
    const resolved = path.resolve(root, filename)
    if (cache.has(resolved)) return cache.get(resolved).exports
    const module = { exports: {} }
    cache.set(resolved, module)
    const source = fs.readFileSync(resolved, 'utf8').replace(/import\.meta\.env/g, JSON.stringify(env))
    const { outputText } = ts.transpileModule(source, {
      fileName: resolved,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    })
    const localRequire = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier]
      if (specifier.startsWith('@/')) return load(`src/${specifier.slice(2)}.ts`)
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(resolved), `${specifier}.ts`))
      return require(specifier)
    }
    const evaluate = vm.runInContext(`(function(require, module, exports) {\n${outputText}\n})`, context, { filename: resolved })
    evaluate(localRequire, module, module.exports)
    return module.exports
  }

  return load
}

function authenticated(overrides = {}) {
  return {
    status: 'AUTHENTICATED',
    access_token: 'test-access-initial',
    refresh_token: 'test-refresh-initial',
    token_type: 'bearer',
    app_scope: 'hope_ledger_mate',
    user: { id: 'test-user', phone: '13800000000', needs_phone_binding: false },
    ...overrides,
  }
}

function createHarness(options = {}) {
  setActivePinia(createPinia())
  const calls = []
  const navigations = []
  const storage = new Map(Object.entries(options.storage || {}))
  const pages = options.pages || [{ route: 'pages/home/index' }]
  const uni = {
    request: (request) => { calls.push(request); return { abort() {} } },
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    reLaunch: (navigation) => navigations.push(navigation),
    switchTab: (navigation) => navigations.push(navigation),
    navigateTo: (navigation) => navigations.push(navigation),
    redirectTo: (navigation) => navigations.push(navigation),
    navigateBack: (navigation) => navigations.push(navigation),
    ...options.uni,
  }
  const load = createLoader({
    globals: { uni, getCurrentPages: () => pages, ...options.globals },
    env: { VITE_API_BASE_URL: 'https://api.example.test/api/v1', ...options.env },
    mocks: options.mocks,
  })
  const { useAuthStore } = load('src/stores/auth.ts')
  const auth = useAuthStore()

  function respond(call, statusCode = 200, data = null, message = 'ok', header = {}) {
    call.success({ statusCode, data: { code: statusCode, message, data }, header })
  }

  return { auth, calls, navigations, storage, uni, load, respond }
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

module.exports = { authenticated, createHarness, flush }
