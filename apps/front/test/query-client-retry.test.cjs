const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

function loadQueryClient() {
  const filename = path.resolve(__dirname, '../src/Services/Query/queryClient.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    reportDiagnostics: true
  })
  const errors = (compiled.diagnostics ?? []).filter(
    diagnostic => diagnostic.category === ts.DiagnosticCategory.Error
  )
  assert.deepEqual(errors, [], 'Query client should transpile without diagnostics')

  class QueryClient {
    constructor(options) {
      this.options = options
    }
  }

  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const originalLoad = Module._load

  Module._load = function (request, parent, isMain) {
    if (request === '@tanstack/react-query') return { QueryClient }
    if (request === 'axios') {
      return {
        isAxiosError: error => Boolean(error?.isAxiosError),
        isCancel: error => error?.code === 'ERR_CANCELED'
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    loaded._compile(compiled.outputText, filename)
  } finally {
    Module._load = originalLoad
  }

  return loaded.exports.queryClient
}

test('query retries only transient HTTP and transport failures', () => {
  const queryClient = loadQueryClient()
  const retry = queryClient.options.defaultOptions.queries.retry

  for (const status of [400, 401, 403, 404, 409, 422, 429]) {
    assert.equal(
      retry(0, { isAxiosError: true, response: { status } }),
      false,
      'must not retry HTTP ' + status
    )
  }

  for (const status of [408, 500, 502, 503, 504]) {
    assert.equal(
      retry(0, { isAxiosError: true, response: { status } }),
      true,
      'should retry transient HTTP ' + status
    )
  }

  assert.equal(
    retry(0, { isAxiosError: true }),
    true,
    'should retry transport failures without an HTTP response'
  )

  assert.equal(
    retry(0, { isAxiosError: true, code: 'ERR_CANCELED' }),
    false,
    'must not retry deliberately canceled requests'
  )
})

test('query retry budget is one attempt and non-Axios errors are not retried', () => {
  const queryClient = loadQueryClient()
  const retry = queryClient.options.defaultOptions.queries.retry

  assert.equal(
    retry(1, { isAxiosError: true, response: { status: 503 } }),
    false
  )
  assert.equal(retry(0, new Error('Invalid response payload')), false)
})
