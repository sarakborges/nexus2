const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

function makeService(collections, ownedProfiles = ['sender'], uploads, beforeTransaction) {
  if (!collections.has('accounts')) {
    collections.set('accounts', [{
      id: 'user',
      email: 'user@example.test',
      profiles: [...ownedProfiles],
      currentProfile: ownedProfiles[0] ?? null
    }])
  }
  const data = {
    async read(name) {
      return structuredClone(collections.get(name) ?? [])
    },
    async update(name, updater) {
      const next = updater(structuredClone(collections.get(name) ?? []))
      collections.set(name, structuredClone(next))
      return structuredClone(next)
    },
    async transaction(names, updater) {
      beforeTransaction?.(names, collections)
      const records = Object.fromEntries(names.map(name => [
        name,
        structuredClone(collections.get(name) ?? [])
      ]))
      const outcome = updater(records)
      for (const name of names) {
        if (!Array.isArray(outcome.records[name])) throw new Error('INVALID_TRANSACTION_RECORDS')
      }
      for (const name of names) collections.set(name, structuredClone(outcome.records[name]))
      return structuredClone(outcome.result)
    }
  }
  const auth = {
    async ownsProfile(_userId, profileId) {
      return ownedProfiles.includes(profileId)
    },
    async getUser(id) {
      return {
        id,
        email: 'user@example.test',
        profiles: ownedProfiles,
        currentProfile: ownedProfiles[0] ?? null
      }
    }
  }
  return new DomainService(data, auth, uploads)
}

test('sanitizes HTML before persisting profile messages', async () => {
  const collections = new Map([
    ['profiles', [
      { id: 'sender', name: 'Sender', url: 'sender', picture: '', about: '', type: 'social' },
      { id: 'recipient', name: 'Recipient', url: 'recipient', picture: '', about: '', type: 'social' }
    ]],
    ['profile_messages', []]
  ])
  const service = makeService(collections)

  const message = await service.sendMessage(
    'user',
    'sender',
    'recipient',
    '<p class="external" style="color:#123;position:fixed">Hello</p><script>alert(1)</script>'
  )

  const saved = collections.get('profile_messages')[0]
  assert.equal(message.content, saved.content)
  assert.match(saved.content, /Hello/)
  assert.match(saved.content, /color:#123/)
  assert.doesNotMatch(saved.content, /class=|position|script|alert/i)
})

test('sanitizes legacy profile, community, and message HTML on reads', async () => {
  const collections = new Map([
    ['profiles', [
      { id: 'sender', name: 'Sender', url: 'sender', picture: '', about: '<p class="old">About</p><script>bad()</script>', type: 'social' },
      { id: 'recipient', name: 'Recipient', url: 'recipient', picture: '', about: '', type: 'social' }
    ]],
    ['communities', [
      { id: 'community', name: 'Community', url: 'community', picture: '', about: '<p style="display:none;color:red">Community text</p>', type: 'social' }
    ]],
    ['profile_messages', [
      { id: 'message', fromProfileId: 'sender', toProfileId: 'recipient', content: '<p>Message</p><iframe>unsafe</iframe>', createdAt: Date.now() }
    ]]
  ])
  const service = makeService(collections)

  const profile = await service.getProfile('sender')
  const community = await service.getCommunity('community')
  const messages = await service.getMessages('recipient', 'user', { page: 1, pageSize: 20 })

  assert.match(profile.about, /About/)
  assert.doesNotMatch(profile.about, /class=|script|bad\(\)/i)
  assert.match(community.about, /Community text/)
  assert.doesNotMatch(community.about, /display:none/i)
  assert.match(messages.items[0].content, /Message/)
  assert.doesNotMatch(messages.items[0].content, /iframe|unsafe/i)
})

test('validates and attaches uploaded image references in the message transaction', async () => {
  const imageId = '123e4567-e89b-42d3-a456-426614174000'
  const imageReference = '/api/uploads/' + imageId + '/content'
  const calls = []
  const uploads = {
    attachEditorImagesToRecords(records, userId, html, resourceType, resourceId, participants) {
      calls.push({ method: 'attach', userId, html, resourceType, resourceId, participants })
      return records
    }
  }
  const collections = new Map([
    ['profiles', [
      { id: 'sender', name: 'Sender', url: 'sender', picture: '', about: '', type: 'social' },
      { id: 'recipient', name: 'Recipient', url: 'recipient', picture: '', about: '', type: 'social' }
    ]],
    ['profile_messages', []]
  ])
  const service = makeService(collections, ['sender'], uploads)

  const message = await service.sendMessage(
    'user',
    'sender',
    'recipient',
    '<p>Hello</p><img src="' + imageReference + '" alt="Uploaded">'
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'attach')
  assert.ok(calls[0].html.includes(imageReference))
  assert.equal(calls[0].resourceType, 'profile-message')
  assert.equal(calls[0].resourceId, message.id)
  assert.deepEqual(calls[0].participants, { fromProfileId: 'sender', toProfileId: 'recipient' })
})


test('private inbox reads use the current account profile links from the message snapshot', async () => {
  const collections = new Map([
    ['profiles', [
      { id: 'sender', name: 'Sender', url: 'sender', picture: '', about: '', type: 'social' },
      { id: 'recipient', name: 'Recipient', url: 'recipient', picture: '', about: '', type: 'social' }
    ]],
    ['profile_messages', [
      { id: 'message', fromProfileId: 'sender', toProfileId: 'recipient', content: '<p>Private</p>', createdAt: 1 }
    ]]
  ])
  const service = makeService(collections, ['sender'], null, (names, current) => {
    if (names.includes('profile_messages')) {
      current.set('accounts', [{
        id: 'user',
        email: 'user@example.test',
        profiles: [],
        currentProfile: null
      }])
    }
  })

  const result = await service.getMessages('recipient', 'user', { page: 1, pageSize: 20 })
  assert.deepEqual(result.items, [])
})
