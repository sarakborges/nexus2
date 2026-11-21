const assert = require('node:assert/strict')
const { readdirSync, readFileSync } = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const migrationDirectory = path.resolve(__dirname, '../sql')
const migrationFiles = readdirSync(migrationDirectory)
  .filter(file => /^\d{3}_.*\.sql$/i.test(file))
  .sort((left, right) => left.localeCompare(right))
const laterMigrations = migrationFiles.filter(file => Number(file.slice(0, 3)) > 68)

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
}

function extractPolicyRoles(statement) {
  const match = statement.match(/\bto\s+([\s\S]*?)(?=\s+(?:using|with\s+check)\b|;)/i)
  return match
    ? match[1].split(',').map(role => role.trim().replace(/^"|"$/g, '').toLowerCase()).filter(Boolean)
    : []
}

function extractAclRoles(statement, direction) {
  const match = statement.match(new RegExp('\\b' + direction + '\\s+([\\s\\S]*?);', 'i'))
  return match
    ? match[1].split(',').map(role => role.trim().replace(/^"|"$/g, '').toLowerCase()).filter(Boolean)
    : []
}


function getTableAclStatements(sql, tableName) {
  const escapedName = escapeRegExp(tableName)
  const targetPattern = new RegExp(
    '\\bon\\s+(?:table\\s+)?public\\.' + escapedName + '\\b',
    'i'
  )
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map(statement => statement.trim())
    .filter(statement =>
      /^(?:grant|revoke)\b/i.test(statement) && targetPattern.test(statement)
    )
}

function getFunctionAclStatements(sql, functionName) {
  const escapedName = escapeRegExp(functionName)
  const pattern = new RegExp(
    '\\b(?:grant\\s+execute|revoke\\s+(?:all(?:\\s+privileges)?|execute))\\s+on\\s+function\\s+public\\.' +
      escapedName +
      '\\s*\\([^;]*;',
    'gi'
  )
  return [...sql.matchAll(pattern)].map(match => match[0])
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

      if (getFunctionAclStatements(sql, functionName).length === 0) {
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

test('public RLS policies target exactly the backend-only anon role', () => {
  const publicPolicies = []

  for (const file of migrationFiles) {
    const sql = readFileSync(path.join(migrationDirectory, file), 'utf8')
    for (const match of sql.matchAll(/create\s+policy\b[\s\S]*?;/gi)) {
      const statement = match[0]
      if (!/\bon\s+public\./i.test(statement)) continue
      publicPolicies.push({ file, statement })
    }
  }

  assert.ok(publicPolicies.length > 0, 'Expected to inspect public RLS policy declarations')

  const invalidPolicies = publicPolicies
    .filter(({ statement }) => {
      const roles = extractPolicyRoles(statement)
      return roles.length !== 1 || roles[0] !== 'anon'
    })
    .map(({ file, statement }) => file + ': ' + statement)

  assert.deepEqual(
    invalidPolicies,
    [],
    'Public RLS policies must target anon only; additional roles such as authenticated or PUBLIC are forbidden.'
  )
})

test('policy role parsing rejects multi-role and PUBLIC targets', () => {
  assert.deepEqual(extractPolicyRoles('create policy p on public.t to anon using (true);'), ['anon'])
  assert.deepEqual(extractPolicyRoles('create policy p on public.t to anon, authenticated using (true);'), ['anon', 'authenticated'])
  assert.deepEqual(extractPolicyRoles('create policy p on public.t to anon, public with check (true);'), ['anon', 'public'])
  assert.deepEqual(extractPolicyRoles('create policy p on public.t to public using (true);'), ['public'])
})

test('public RPCs created after the privilege-hardening baseline revoke PUBLIC EXECUTE', () => {
  const seenFunctions = new Set()
  const missingPublicRevokes = []
  const unsafeGrants = []

  for (const file of laterMigrations) {
    const sql = readFileSync(path.join(migrationDirectory, file), 'utf8')
    const declarationPattern = /create\s+(?:or\s+replace\s+)?function\s+public\.("?)([a-zA-Z_][\w$]*)\1\s*\(/gi

    for (const match of sql.matchAll(declarationPattern)) {
      const functionName = match[2].toLowerCase()
      if (seenFunctions.has(functionName)) continue
      seenFunctions.add(functionName)

      const aclStatements = getFunctionAclStatements(sql, functionName)
      const revokesPublic = aclStatements.some(statement =>
        /^revoke\b/i.test(statement) && extractAclRoles(statement, 'from').includes('public')
      )
      if (!revokesPublic) missingPublicRevokes.push(file + ': public.' + functionName)

      for (const statement of aclStatements) {
        if (!/^grant\b/i.test(statement)) continue
        const roles = extractAclRoles(statement, 'to')
        if (roles.includes('public') || roles.includes('authenticated')) {
          unsafeGrants.push(file + ': ' + statement)
        }
      }
    }
  }

  assert.deepEqual(
    missingPublicRevokes,
    [],
    'Every new public RPC must explicitly revoke inherited EXECUTE from PUBLIC.'
  )
  assert.deepEqual(
    unsafeGrants,
    [],
    'New public RPCs must not grant EXECUTE to PUBLIC or authenticated.'
  )
})

test('table ACL scanning isolates statements and matches the exact target table', () => {
  const sql = [
    'grant select on table public.other_table to authenticated;',
    'revoke all on table public.target_table from public;',
    'grant select on table public.target_table to anon;',
    'grant select on table public.target_table_archive to authenticated;'
  ].join('\n')

  const statements = getTableAclStatements(sql, 'target_table')
  assert.equal(statements.length, 2)
  assert.deepEqual(extractAclRoles(statements[0] + ';', 'from'), ['public'])
  assert.deepEqual(extractAclRoles(statements[1] + ';', 'to'), ['anon'])
})

test('public tables created after the privilege-hardening baseline declare explicit safe ACLs', () => {
  const missingAcl = []
  const unsafeGrants = []

  for (const file of laterMigrations) {
    const sql = readFileSync(path.join(migrationDirectory, file), 'utf8')
    const tablePattern = /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.("?)([a-zA-Z_][\w$]*)\1/gi

    for (const match of sql.matchAll(tablePattern)) {
      const tableName = match[2]
      const statements = getTableAclStatements(sql, tableName)
      if (statements.length === 0) {
        missingAcl.push(file + ': public.' + tableName)
      }

      for (const statement of statements) {
        if (!/^grant\b/i.test(statement)) continue
        const roles = extractAclRoles(statement, 'to')
        if (roles.includes('public') || roles.includes('authenticated')) {
          unsafeGrants.push(file + ': ' + statement)
        }
      }
    }
  }

  assert.deepEqual(
    missingAcl,
    [],
    'New public tables must declare their intended grants or revokes after default privileges become opt-in.'
  )
  assert.deepEqual(
    unsafeGrants,
    [],
    'New public tables must not grant privileges to PUBLIC or authenticated.'
  )
})
