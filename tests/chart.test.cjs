const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { parse } = require('@vue/compiler-sfc')

const root = path.resolve(__dirname, '..')
const chartSource = fs.readFileSync(path.join(root, 'src/components/LedgerChart.vue'), 'utf8')
const descriptor = parse(chartSource, { filename: 'LedgerChart.vue' }).descriptor
assert.ok(descriptor.scriptSetup)
assert.ok(descriptor.template)

function platformSource(source, platform) {
  const stack = [true]
  const lines = []
  for (const line of source.split(/\r?\n/)) {
    const normalized = line.trim().replace(/^<!--\s*/, '// ').replace(/\s*-->$/, '')
    const directive = normalized.match(/^\/\/\s*#(ifdef|ifndef|endif)(?:\s+([\w-]+))?\s*$/)
    if (!directive) { if (stack.at(-1)) lines.push(line); continue }
    if (directive[1] === 'endif') {
      assert.ok(stack.length > 1)
      stack.pop()
    } else stack.push(stack.at(-1) && (directive[1] === 'ifdef' ? directive[2] === platform : directive[2] !== platform))
  }
  assert.equal(stack.length, 1)
  return lines.join('\n')
}

function evaluate(source, filename, globals = {}, requireModule = () => { throw new Error('unexpected import') }) {
  const module = { exports: {} }
  const { outputText } = ts.transpileModule(source, { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
  vm.runInNewContext(outputText, { module, exports: module.exports, require: requireModule, ...globals }, { filename })
  return module.exports
}

const adapter = evaluate(fs.readFileSync(path.join(root, 'src/utils/chartCanvas.ts'), 'utf8'), 'chartCanvas.ts')

function canvasNode() {
  const operations = []
  let scaleX = 1
  let scaleY = 1
  let bitmapWidth = 0
  let bitmapHeight = 0
  let broken = false
  const styles = { lineWidth: 1, fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif', textAlign: 'start' }
  const context = {}
  const record = (op, args) => {
    if (broken) throw new Error('canvas unavailable')
    operations.push({ op, args: [...args], ...styles, scaleX, scaleY })
  }
  for (const property of Object.keys(styles)) Object.defineProperty(context, property, {
    get: () => styles[property],
    set: (value) => { styles[property] = value; operations.push({ op: property, value }) },
  })
  for (const op of ['clearRect', 'beginPath', 'arc', 'stroke', 'fillText', 'moveTo', 'lineTo', 'fill', 'fillRect']) context[op] = (...args) => record(op, args)
  context.scale = (x, y) => { scaleX *= x; scaleY *= y; record('scale', [x, y]) }
  const resetTransform = () => { scaleX = 1; scaleY = 1 }
  const node = {
    get width() { return bitmapWidth },
    set width(value) { bitmapWidth = value; resetTransform(); operations.push({ op: 'bitmap.width', value }) },
    get height() { return bitmapHeight },
    set height(value) { bitmapHeight = value; resetTransform(); operations.push({ op: 'bitmap.height', value }) },
    getContext(type) { assert.equal(type, '2d'); operations.push({ op: 'getContext', type }); return context },
  }
  return { node, context, operations, breakDrawing: (value) => { broken = value } }
}

function legacyContext() {
  const operations = []
  const context = {}
  for (const op of ['clearRect', 'setLineWidth', 'beginPath', 'setStrokeStyle', 'arc', 'stroke', 'setFontSize', 'setTextAlign', 'setFillStyle', 'fillText', 'moveTo', 'lineTo', 'fill', 'fillRect', 'draw']) {
    context[op] = (...args) => operations.push({ op, args })
  }
  return { context, operations }
}

function chartHarness(platform = 'MP-WEIXIN', initialProps = {}, options = {}) {
  const props = { kind: 'bar', values: [100, 200], ...initialProps }
  const hooks = { mounted: [], unmounted: [], watchers: [] }
  const queries = []
  const emitted = []
  const legacyCalls = []
  const legacy = legacyContext()
  const proxy = { marker: 'chart-component' }
  let throwQuery = false
  const vue = {
    ref: (value) => ({ value }),
    computed: (getter) => ({ get value() { return getter() } }),
    getCurrentInstance: () => ({ uid: 73, proxy }),
    nextTick: async () => {},
    onMounted: (callback) => hooks.mounted.push(callback),
    onUnmounted: (callback) => hooks.unmounted.push(callback),
    watch: (getter, callback, config) => hooks.watchers.push({ getter, callback, config }),
  }
  const uni = {
    upx2px: (value) => value / 2,
    getWindowInfo: () => ({ pixelRatio: options.ratio ?? 3 }),
    getSystemInfoSync: () => ({ pixelRatio: options.ratio ?? 3 }),
    createCanvasContext: (id, owner) => {
      legacyCalls.push({ id, owner })
      return legacy.context
    },
    createSelectorQuery: () => {
      if (throwQuery) throw new Error('selector unavailable')
      const query = { executed: false }
      const chain = {
        in(owner) { query.owner = owner; return chain },
        select(selector) { query.selector = selector; return chain },
        fields(fields, callback) { query.mode = 'node'; query.fields = { ...fields }; query.callback = callback; return chain },
        boundingClientRect(callback) { query.mode = 'legacy'; query.callback = callback; return chain },
        exec() { query.executed = true; queries.push(query); return chain },
      }
      return chain
    },
  }
  if (options.noWindowInfo) delete uni.getWindowInfo
  if (options.windowInfoThrows) uni.getWindowInfo = () => { throw new Error('unsupported') }
  const exposed = '\nexport const chartTestApi = { draw, select, failed, fallback, chartId }\n'
  const api = evaluate(platformSource(descriptor.scriptSetup.content, platform) + exposed, `LedgerChart.${platform}.ts`, {
    uni,
    defineProps: () => props,
    withDefaults: (value, defaults) => {
      for (const [key, fallback] of Object.entries(defaults)) if (value[key] === undefined) value[key] = typeof fallback === 'function' ? fallback() : fallback
      return value
    },
    defineEmits: () => (name, value) => emitted.push({ name, value }),
  }, (specifier) => {
    if (specifier === 'vue') return vue
    if (specifier === '@/utils/chartCanvas') return adapter
    throw new Error(`unexpected import: ${specifier}`)
  }).chartTestApi
  return {
    api, props, hooks, queries, emitted, legacyCalls, legacy, uni, proxy,
    mount: async () => { for (const hook of hooks.mounted) await hook() },
    redraw: async (nextProps = {}) => { Object.assign(props, nextProps); for (const watcher of hooks.watchers) await watcher.callback() },
    unmount: () => { for (const hook of hooks.unmounted) hook() },
    throwQuery: (value) => { throwQuery = value },
    respond: (result, index = queries.length - 1) => queries[index].callback(result),
  }
}

const ops = (canvas, name) => canvas.operations.filter((item) => item.op === name)
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`)

test('MP template keeps its Canvas 2D node mounted underneath the failure fallback', () => {
  const template = platformSource(descriptor.template.content, 'MP-WEIXIN')
  const canvas = template.match(/<canvas\b[^>]*>/g) || []
  assert.equal(canvas.length, 1)
  assert.match(canvas[0], /type="2d"/)
  assert.match(canvas[0], /@tap="select"/)
  assert.doesNotMatch(canvas[0], /@touchstart/)
  assert.doesNotMatch(canvas[0], /canvas-id|v-if|v-else/)
  assert.match(template, /<text\s+v-if="failed"/)
  assert.doesNotMatch(template, /<view[^>]+v-if="!?failed"/)
})

test('MP uses selector node fields and getContext(2d), never the legacy canvas API', async () => {
  const h = chartHarness()
  const canvas = canvasNode()
  await h.mount()
  assert.equal(h.queries.length, 1)
  assert.equal(h.queries[0].mode, 'node')
  assert.deepEqual(h.queries[0].fields, { node: true, size: true })
  assert.equal(h.queries[0].owner, h.proxy)
  assert.equal(h.queries[0].selector, '#ledger-chart-73')
  assert.equal(h.queries[0].executed, true)
  h.respond({ node: canvas.node, width: 320, height: 180 })
  assert.equal(h.legacyCalls.length, 0)
  assert.equal(ops(canvas, 'getContext').length, 1)
  assert.deepEqual(ops(canvas, 'clearRect')[0].args, [0, 0, 320, 180])
  assert.equal(h.api.failed.value, false)
})

test('DPR 3 resets the bitmap before every scale and repeated redraws do not compound transforms', async () => {
  const h = chartHarness('MP-WEIXIN', {}, { ratio: 3 })
  const canvas = canvasNode()
  for (let index = 0; index < 3; index += 1) {
    const before = canvas.operations.length
    await h.api.draw()
    h.respond({ node: canvas.node, width: 320, height: 180 })
    assert.deepEqual(canvas.operations.slice(before, before + 4).map((item) => item.op), ['bitmap.width', 'bitmap.height', 'getContext', 'scale'])
    assert.equal(canvas.node.width, 960)
    assert.equal(canvas.node.height, 540)
  }
  assert.deepEqual(ops(canvas, 'scale').map((operation) => [operation.scaleX, operation.scaleY]), [[3, 3], [3, 3], [3, 3]])
  assert.equal(ops(canvas, 'clearRect').length, 3)
})

test('MP uses the system-info fallback and sanitizes unavailable or invalid pixel ratios', async () => {
  for (const [options, expected] of [[{ noWindowInfo: true, ratio: 2 }, 2], [{ ratio: 0 }, 1], [{ ratio: Number.NaN }, 1], [{ windowInfoThrows: true }, 1]]) {
    const h = chartHarness('MP-WEIXIN', {}, options)
    const canvas = canvasNode()
    await h.api.draw()
    h.respond({ node: canvas.node, width: 200, height: 100 })
    assert.equal(canvas.node.width, 200 * expected)
    assert.equal(canvas.node.height, 100 * expected)
    assert.equal(ops(canvas, 'scale')[0].scaleX, expected)
  }
})

test('bar charts retain positive and negative values on opposite sides of the zero baseline', async () => {
  const h = chartHarness('MP-WEIXIN', { values: [-100, 200], labels: ['1日', '2日'], colors: ['#27AE60'] })
  const canvas = canvasNode()
  await h.api.draw()
  h.respond({ node: canvas.node, width: 320, height: 180 })
  const bars = ops(canvas, 'fillRect')
  assert.equal(bars.length, 2)
  assert.equal(bars[0].fillStyle, '#B94738')
  assert.equal(bars[1].fillStyle, '#27AE60')
  const zero = 154 - 100 / 300 * 142
  closeTo(bars[0].args[1], zero)
  closeTo(bars[0].args[1] + bars[0].args[3], 154)
  closeTo(bars[1].args[1], 12)
  closeTo(bars[1].args[1] + bars[1].args[3], zero)
  assert.ok(bars.every((bar) => bar.args.every(Number.isFinite) && bar.args[2] > 0 && bar.args[3] > 0))
  assert.ok(ops(canvas, 'fillText').some((operation) => operation.args[0] === '-1.00'))
  assert.ok(ops(canvas, 'fillText').some((operation) => operation.args[0] === '2日'))
})

test('line charts connect negative, zero and positive entries and preserve nonzero point markers', async () => {
  const h = chartHarness('MP-WEIXIN', { kind: 'line', values: [-100, 0, 200], labels: ['1', '2', '3'] })
  const canvas = canvasNode()
  await h.api.draw()
  h.respond({ node: canvas.node, width: 320, height: 180 })
  const start = ops(canvas, 'moveTo').find((operation) => operation.args[0] === 85)
  assert.ok(start)
  closeTo(start.args[1], 154)
  const middle = ops(canvas, 'lineTo').find((operation) => operation.args[0] === 175)
  closeTo(middle.args[1], 154 - 100 / 300 * 142)
  const end = ops(canvas, 'lineTo').find((operation) => operation.args[0] === 265)
  closeTo(end.args[1], 12)
  assert.equal(ops(canvas, 'arc').filter((operation) => operation.args[2] === 2).length, 2)
  assert.equal(ops(canvas, 'fill').length, 2)
  assert.equal(ops(canvas, 'fillRect').length, 0)
})

test('ring charts use positive totals, retain category colors and skip negative slices', async () => {
  const h = chartHarness('MP-WEIXIN', { kind: 'ring', values: [100, -50, 300], colors: ['#111111', '#222222', '#333333'] })
  const canvas = canvasNode()
  await h.api.draw()
  h.respond({ node: canvas.node, width: 320, height: 180 })
  const arcs = ops(canvas, 'arc')
  assert.equal(arcs.length, 2)
  assert.equal(arcs[0].strokeStyle, '#111111')
  assert.equal(arcs[1].strokeStyle, '#333333')
  closeTo(arcs[0].args[3], -Math.PI / 2)
  closeTo(arcs[0].args[4], 0)
  closeTo(arcs[1].args[3], 0)
  closeTo(arcs[1].args[4], Math.PI * 1.5)
  assert.equal(ops(canvas, 'stroke').length, 2)
})

test('empty or all-negative ring values draw the neutral complete circle', async () => {
  for (const values of [[], [0, 0], [-100, 0]]) {
    const h = chartHarness('MP-WEIXIN', { kind: 'ring', values })
    const canvas = canvasNode()
    await h.api.draw()
    h.respond({ node: canvas.node, width: 320, height: 180 })
    const arcs = ops(canvas, 'arc')
    assert.equal(arcs.length, 1)
    assert.equal(arcs[0].strokeStyle, '#F1ECD9')
    closeTo(arcs[0].args[3], 0)
    closeTo(arcs[0].args[4], Math.PI * 2)
  }
})

test('a missing node or zero layout can recover through the real reactive redraw callback', async () => {
  for (const failedResult of [null, { width: 320, height: 180 }, { node: canvasNode().node, width: 0, height: 180 }]) {
    const h = chartHarness('MP-WEIXIN', { labels: ['1日', '2日'] })
    await h.mount()
    h.respond(failedResult)
    assert.equal(h.api.failed.value, true)
    assert.match(h.api.fallback.value, /1日：1\.00元/)
    const canvas = canvasNode()
    assert.equal(h.hooks.watchers[0].config.deep, true)
    await h.redraw({ values: [300, 400] })
    h.respond({ node: canvas.node, width: 320, height: 180 })
    assert.equal(h.api.failed.value, false)
    assert.equal(ops(canvas, 'fillRect').length, 2)
  }
})

test('a failed drawing context or selector can recover without remounting the canvas', async () => {
  const h = chartHarness()
  const canvas = canvasNode()
  canvas.breakDrawing(true)
  await h.api.draw()
  h.respond({ node: canvas.node, width: 320, height: 180 })
  assert.equal(h.api.failed.value, true)
  canvas.breakDrawing(false)
  await h.api.draw()
  h.respond({ node: canvas.node, width: 320, height: 180 })
  assert.equal(h.api.failed.value, false)
  h.throwQuery(true)
  await h.api.draw()
  assert.equal(h.api.failed.value, true)
  h.throwQuery(false)
  await h.api.draw()
  h.respond({ node: canvas.node, width: 320, height: 180 })
  assert.equal(h.api.failed.value, false)
})

test('MP ignores stale selector callbacks instead of replacing a newer successful chart', async () => {
  const h = chartHarness()
  const older = canvasNode()
  const latest = canvasNode()
  await h.api.draw()
  await h.redraw({ values: [700] })
  h.respond({ node: latest.node, width: 400, height: 200 }, 1)
  h.respond({ node: older.node, width: 320, height: 180 }, 0)
  assert.equal(older.operations.length, 0)
  assert.equal(ops(latest, 'fillRect').length, 1)
  h.respond(null, 0)
  assert.equal(h.api.failed.value, false)
})

test('unmount cancels both queued drawing work and late Canvas 2D node callbacks', async () => {
  const h = chartHarness()
  const canvas = canvasNode()
  await h.api.draw()
  h.unmount()
  h.respond({ node: canvas.node, width: 320, height: 180 })
  assert.equal(canvas.operations.length, 0)
  await h.api.draw()
  assert.equal(h.queries.length, 1)
  assert.equal(h.api.failed.value, false)
  const beforeNextTick = chartHarness()
  const pending = beforeNextTick.api.draw()
  beforeNextTick.unmount()
  await pending
  assert.equal(beforeNextTick.queries.length, 0)
})

test('successive changes before nextTick only query for the latest drawing version', async () => {
  const h = chartHarness()
  const first = h.api.draw()
  const second = h.api.draw()
  await Promise.all([first, second])
  assert.equal(h.queries.length, 1)
})

test('H5 retains legacy bar, line and ring drawing with draw(false)', async () => {
  const template = platformSource(descriptor.template.content, 'H5')
  assert.match(template, /<canvas[^>]+:canvas-id="chartId"/)
  assert.doesNotMatch(template, /type="2d"/)
  for (const kind of ['bar', 'line', 'ring']) {
    const h = chartHarness('H5', { kind, values: [-100, 200, 300] })
    await h.mount()
    assert.equal(h.queries[0].mode, 'legacy')
    h.respond({ width: 320, height: 180 })
    assert.equal(h.legacyCalls.length, 1)
    assert.equal(h.legacyCalls[0].id, 'ledger-chart-73')
    assert.equal(h.legacyCalls[0].owner, h.proxy)
    assert.deepEqual(h.legacy.operations.at(-1), { op: 'draw', args: [false] })
    assert.equal(h.api.failed.value, false)
    if (kind === 'bar') assert.equal(h.legacy.operations.filter((operation) => operation.op === 'fillRect').length, 3)
    else assert.ok(h.legacy.operations.some((operation) => operation.op === 'arc'))
  }
})

test('H5 missing rectangles recover and omitted height falls back to the configured rpx height', async () => {
  const h = chartHarness('H5', { height: 360 })
  await h.api.draw()
  h.respond(null)
  assert.equal(h.api.failed.value, true)
  await h.api.draw()
  h.respond({ width: 320 })
  assert.equal(h.api.failed.value, false)
  assert.deepEqual(h.legacy.operations.find((operation) => operation.op === 'clearRect').args, [0, 0, 320, 180])
  await h.api.draw()
  h.unmount()
  h.respond({ width: 320, height: 180 })
  assert.equal(h.legacyCalls.length, 1)
})

test('date selection maps local canvas x coordinates to the displayed record index', async () => {
  const h = chartHarness('MP-WEIXIN', { values: [100, 200, 300, 400] })
  await h.api.draw()
  h.respond({ node: canvasNode().node, width: 320, height: 180 })
  const step = (320 - 50) / 4
  for (let index = 0; index < 4; index += 1) h.api.select({ touches: [{ x: 40 + (index + .5) * step }] })
  h.api.select({ changedTouches: [{ x: 40 + 1.5 * step }], touches: [{ x: 40 + 3.5 * step }] })
  h.api.select({})
  h.api.select({ touches: [{ x: Number.NaN }] })
  assert.deepEqual(h.emitted, [0, 1, 2, 3, 1].map((value) => ({ name: 'select', value })))
  h.props.kind = 'ring'
  h.api.select({ detail: { x: 100 } })
  h.props.kind = 'bar'
  h.props.values = []
  h.api.select({ detail: { x: 100 } })
  assert.equal(h.emitted.length, 5)
})

test('viewport detail.x and clientX subtract the measured canvas offset before selecting a date', async () => {
  const h = chartHarness('MP-WEIXIN', { values: [100, 200, 300, 400] })
  await h.api.draw()
  h.respond({ node: canvasNode().node, width: 320, height: 180 })
  const step = (320 - 50) / 4
  h.api.select({ detail: { x: 24 + 40 + 1.5 * step } })
  assert.equal(h.queries.at(-1).mode, 'legacy')
  assert.equal(h.emitted.length, 0)
  h.respond({ left: 24, width: 320, height: 180 })
  assert.deepEqual(h.emitted, [{ name: 'select', value: 1 }])
  h.api.select({ changedTouches: [{ clientX: 90 + 40 + 3.5 * step }] })
  h.respond({ left: 90, width: 320, height: 180 })
  assert.deepEqual(h.emitted.at(-1), { name: 'select', value: 3 })
  assert.equal(h.legacyCalls.length, 0)
  const queryCount = h.queries.length
  h.api.select({ touches: [{ pageX: 200 }] })
  assert.equal(h.queries.length, queryCount)
  assert.equal(h.emitted.length, 2)
})

test('date selection ignores failed geometry and callbacks arriving after redraw or unmount', async () => {
  const h = chartHarness('MP-WEIXIN', { values: [100, 200] })
  await h.api.draw()
  h.respond({ node: canvasNode().node, width: 320, height: 180 })
  h.api.select({ detail: { x: 120 } })
  h.respond(null)
  assert.equal(h.emitted.length, 0)
  h.api.select({ detail: { x: 120 } })
  const previousSelection = h.queries.length - 1
  await h.redraw({ values: [100, 200, 300] })
  h.respond({ left: 20, width: 320 }, previousSelection)
  assert.equal(h.emitted.length, 0)
  h.respond({ node: canvasNode().node, width: 320, height: 180 })
  h.api.select({ detail: { x: 120 } })
  const lastSelection = h.queries.length - 1
  h.unmount()
  h.respond({ left: 20, width: 320 }, lastSelection)
  h.api.select({ touches: [{ x: 100 }] })
  assert.equal(h.emitted.length, 0)
})
