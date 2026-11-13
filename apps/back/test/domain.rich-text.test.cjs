const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

function makeService(collections, ownedProfiles = ['sender'], uploads, beforeTransaction, beforeCreateMessage) {
  if (!collections.has('accounts')) {
    collections.set('accounts', [{
      id: 'user',
      email: 'user@example.test',
      profiles: [...ownedProfiles],
      currentProfile: ownedProfiles[0] ?? null
    }])
  }
  const data = {
    async getProfileByUrl(url) {
      const profile = (collections.get('profiles') ?? []).find(item => item.url === url)
      if (!profile) throw new Error('PROFILE_NOT_FOUND')
      return structuredClone(profile)
    },
    async getCommunityByUrl(url, userId) {
      const community = (collections.get('communities') ?? []).find(item => item.url === url)
      if (!community) throw new Error('COMMUNITY_NOT_FOUND')
      return structuredClone(community)
    },
    async createProfileMessage(change) {
      beforeCreateMessage?.(structuredClone(change))
      const messages = collections.get('profile_messages') ?? []
      messages.push(structuredClone(change.message))
      collections.set('profile_messages', messages)
      return structuredClone(change.message)
    },
    async getProfileMessages(profileId, userId, page) {
      const account = userId
        ? (collections.get('accounts') ?? []).find(item => item.id === userId)
        : undefined
      if (userId && !account) throw new Error('ACCOUNT_NOT_FOUND')
      const viewerProfiles = account?.profiles ?? []
      const own = viewerProfiles.includes(profileId)
      const visible = (collections.get('profile_messages') ?? [])
        .filter(message =>
          message.toProfileId === profileId &&
          (own || viewerProfiles.includes(message.fromProfileId))
        )
        .sort((a, b) => b.createdAt - a.createdAt)
      const pageSize = 20
      const totalItems = visible.length
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
      const safePage = Math.min(Math.max(Math.trunc(page) || 1, 1), totalPages)
      const offset = (safePage - 1) * pageSize
      return {
        items: structuredClone(visible.slice(offset, offset + pageSize)),
        page: safePage,
        pageSize,
        totalItems,
        totalPages
      }
    },
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
    async ownsProfile() {
      throw new Error('Profile message flows must use repository snapshot authorization')
    },
    async getUser() {
      throw new Error('Profile message flows must not perform separate auth reads')
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

test('preserves editor font family and font size while sanitizing rich text', async () => {
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
    '<p><font face="Arial" size="6">Formatted text</font></p>'
  )
  const saved = collections.get('profile_messages')[0]

  assert.equal(message.content, saved.content)
  assert.match(saved.content, /font-family:Arial/i)
  assert.match(saved.content, /font-size:24px/i)
  assert.match(saved.content, /Formatted text/)
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

test('passes uploaded image IDs to the relational message write', async () => {
  const imageId = '123e4567-e89b-42d3-a456-426614174000'
  const imageReference = '/api/uploads/' + imageId + '/content'
  const calls = []
  const uploads = {
    getEditorImageIds(html) {
      calls.push({ method: 'getEditorImageIds', html })
      return [imageId]
    }
  }
  const collections = new Map([
    ['profiles', [
      { id: 'sender', name: 'Sender', url: 'sender', picture: '', about: '', type: 'social' },
      { id: 'recipient', name: 'Recipient', url: 'recipient', picture: '', about: '', type: 'social' }
    ]],
    ['profile_messages', []]
  ])
  const service = makeService(collections, ['sender'], uploads, undefined, change => {
    calls.push({ method: 'createProfileMessage', imageIds: change.imageIds, message: change.message })
  })

  const message = await service.sendMessage(
    'user',
    'sender',
    'recipient',
    '<p>Hello</p><img src="' + imageReference + '" alt="Uploaded">'
  )

  assert.equal(calls.length, 2)
  assert.equal(calls[0].method, 'getEditorImageIds')
  assert.ok(calls[0].html.includes(imageReference))
  assert.equal(calls[1].method, 'createProfileMessage')
  assert.deepEqual(calls[1].imageIds, [imageId])
  assert.equal(calls[1].message.id, message.id)
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
  const service = makeService(collections, [])

  const result = await service.getMessages('recipient', 'user', { page: 1, pageSize: 20 })
  assert.deepEqual(result.items, [])
})
