const assert = require('node:assert/strict')
const path = require('node:path')
const { Module } = require('node:module')
const { test } = require('node:test')
const ts = require('typescript')

function loadTypeScriptModule(relativePath) {
  const filename = path.resolve(__dirname, '../src', relativePath)
  const source = require('node:fs').readFileSync(filename, 'utf8')
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
  assert.deepEqual(errors, [], 'Realtime utility should transpile without diagnostics')

  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(compiled.outputText, filename)
  return loaded.exports
}

function createFakeScheduler() {
  let now = 0
  let nextHandle = 0
  const timers = new Map()

  return {
    now: () => now,
    setTimeout(callback, delayMs) {
      const handle = ++nextHandle
      timers.set(handle, { callback, dueAt: now + delayMs })
      return handle
    },
    clearTimeout(handle) {
      timers.delete(handle)
    },
    advanceBy(durationMs) {
      const target = now + durationMs
      while (true) {
        const next = [...timers.entries()]
          .sort((left, right) => left[1].dueAt - right[1].dueAt)[0]
        if (!next || next[1].dueAt > target) break
        now = next[1].dueAt
        timers.delete(next[0])
        next[1].callback()
      }
      now = target
    },
    get pendingCount() {
      return timers.size
    }
  }
}

test('topic refresh executes immediately and coalesces burst notifications', () => {
  const { createThrottledTopicRefresh } = loadTypeScriptModule(
    'Services/Realtime/realtime-refresh.utils.ts'
  )
  const scheduler = createFakeScheduler()
  let refreshCount = 0
  const refresh = createThrottledTopicRefresh(
    () => { refreshCount += 1 },
    1_000,
    scheduler
  )

  refresh.notify()
  for (let index = 0; index < 100; index += 1) refresh.notify()

  assert.equal(refreshCount, 1)
  assert.equal(scheduler.pendingCount, 1)

  scheduler.advanceBy(999)
  assert.equal(refreshCount, 1)

  scheduler.advanceBy(1)
  assert.equal(refreshCount, 2)
  assert.equal(scheduler.pendingCount, 0)

  refresh.cancel()
})

test('topic refresh never exceeds one trailing refresh per interval during a sustained burst', () => {
  const { createThrottledTopicRefresh } = loadTypeScriptModule(
    'Services/Realtime/realtime-refresh.utils.ts'
  )
  const scheduler = createFakeScheduler()
  let refreshCount = 0
  const refresh = createThrottledTopicRefresh(
    () => { refreshCount += 1 },
    1_000,
    scheduler
  )

  refresh.notify()
  for (let second = 0; second < 5; second += 1) {
    for (let index = 0; index < 50; index += 1) refresh.notify()
    scheduler.advanceBy(1_000)
  }

  assert.equal(refreshCount, 6)
  assert.equal(scheduler.pendingCount, 0)
  refresh.cancel()
})

test('cancelling a topic subscription clears pending refreshes', () => {
  const { createThrottledTopicRefresh } = loadTypeScriptModule(
    'Services/Realtime/realtime-refresh.utils.ts'
  )
  const scheduler = createFakeScheduler()
  let refreshCount = 0
  const refresh = createThrottledTopicRefresh(
    () => { refreshCount += 1 },
    1_000,
    scheduler
  )

  refresh.notify()
  refresh.notify()
  assert.equal(refreshCount, 1)
  assert.equal(scheduler.pendingCount, 1)

  refresh.cancel()
  assert.equal(scheduler.pendingCount, 0)
  scheduler.advanceBy(5_000)
  refresh.notify()

  assert.equal(refreshCount, 1)
  assert.equal(scheduler.pendingCount, 0)
})
