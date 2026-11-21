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

test('public RLS policies stay scoped to the backend-only anon role', () => {
  const publicPolicies = []

  for (const file of migrationFiles) {
    const sql = readFileSync(path.join(migrationDirectory, file), 'utf8')
    for (const match of sql.matchAll(/create\s+policy\b[\s\S]*?;/gi)) {
      const statement = match[0]
      if (!/\bon\s+public\./i.test(statement)) continue
      publicPolicies.push(file + ': ' + statement)
    }
  }

  assert.ok(publicPolicies.length > 0, 'Expected to inspect public RLS policy declarations')

  const invalidPolicies = publicPolicies.filter(statement =>
    !/\bto\s+anon\b/i.test(statement) ||
    /\bto\s+(?:authenticated|public)\b/i.test(statement)
  )

  assert.deepEqual(
    invalidPolicies,
    [],
    'Public RLS policies must stay on the backend-mediated anon role; do not enable Supabase Auth roles implicitly.'
  )
})

test('public tables created after the privilege-hardening baseline grant access explicitly', () => {
  const laterMigrations = migrationFiles.filter(file => Number(file.slice(0, 3)) > 68)
  const missingGrants = []

  for (const file of laterMigrations) {
    const sql = readFileSync(path.join(migrationDirectory, file), 'utf8')
    const tablePattern = /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.("?)([a-zA-Z_][\w$]*)\1/gi

    for (const match of sql.matchAll(tablePattern)) {
      const tableName = match[2]
      const grantPattern = new RegExp(
        '(?:grant\\s+[\\s\\S]*?\\s+on\\s+table\\s+public\\.' + escapeRegExp(tableName) + '\\b)',
        'i'
      )
      if (!grantPattern.test(sql)) missingGrants.push(file + ': public.' + tableName)
    }
  }

  assert.deepEqual(
    missingGrants,
    [],
    'New public tables must declare their intended role grants after default privileges become opt-in.'
  )
})
