const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { compileTemplate, parse } = require('@vue/compiler-sfc')

const root = path.resolve(__dirname, '..')

function compilePage(relativePath) {
  const filename = path.join(root, relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { descriptor, errors: parseErrors } = parse(source, { filename })
  assert.deepEqual(parseErrors, [], `${relativePath} SFC should parse without errors`)
  const result = compileTemplate({
    id: relativePath,
    filename,
    source: descriptor.template.content,
  })
  assert.deepEqual(result.errors, [], `${relativePath} template should compile without errors`)
  return result.code
}

test('startup page is a return-free loading shell with retry only on navigation failure', () => {
  const code = compilePage('src/pages/startup/index.vue')
  assert.match(code, /正在打开你的账本/)
  assert.match(code, /retryNavigation\(\)/)
  assert.doesNotMatch(code, /cancelLogin|login-back/)
})

test('login page calls login without forwarding the tap event', () => {
  const code = compilePage('src/pages/login/index.vue')
  assert.match(code, /_ctx\.login\(\)/)
  assert.doesNotMatch(code, /_ctx\.login\(\$event\)/)
  assert.match(code, /_ctx\.completePhoneLogin/)
  assert.match(code, /中国大陆手机号/)
  assert.match(code, /短信验证码/)
})
