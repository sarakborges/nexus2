const assert = require('node:assert/strict')
const { readdirSync, readFileSync } = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const migrationDirectory = path.resolve(__dirname, '../sql')
const migrationFiles = readdirSync(migrationDirectory)
  .filter(file => /^\d{3}_.*\.sql$/i.test(file))
  .sort((left, right) => left.localeCompare(right))

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
}

test('first public RPC definitions declare an explicit EXECUTE grant or revoke', () => {
  const seenFunctions = new Set()
  const missingPrivileges = []

  for (const file of migrationFiles) {
    const sql = readFileSync(path.join(migrationDirectory, file), 'utf8')
    const declarationPattern = /create\s+(?:or\s+replace\s+)?function\s+public\.("?)([a-zA-Z_][\w$]*)\1\s*\(/gi

    for (const match of sql.matchAll(declarationPattern)) {
      const functionName = match[2].toLowerCase()
      if (seenFunctions.has(functionName)) continue
      seenFunctions.add(functionName)

      const escapedName = escapeRegExp(functionName)
      const aclPattern = new RegExp(
        '(?:grant\\s+execute|revoke\\s+(?:all(?:\\s+privileges)?|execute))\\s+on\\s+function\\s+public\\.' +
          escapedName +
          '\\s*\\(',
        'i'
      )

      if (!aclPattern.test(sql)) {
        missingPrivileges.push(file + ': public.' + functionName)
      }
    }
  }

  assert.ok(seenFunctions.size > 0, 'Expected to inspect public RPC migrations')
  assert.deepEqual(
    missingPrivileges,
    [],
    'New public RPCs must opt in to EXECUTE explicitly; do not depend on PostgreSQL default ACLs.'
  )
})
