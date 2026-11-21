const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

test('BFF HTTP client has a finite default timeout for backend requests', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/app.module.ts'),
    'utf8'
  )

  assert.match(source, /BFF_BACKEND_TIMEOUT_MS\s*=\s*30_000/)
  assert.match(
    source,
    /HttpModule\.register\(\{\s*timeout:\s*BFF_BACKEND_TIMEOUT_MS\s*\}\)/
  )
  assert.doesNotMatch(source, /imports:\s*\[[^\]]*\bHttpModule\s*(?:,|\])/)
})
