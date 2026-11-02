const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

function makeService(collections, ownedProfiles = ['sender']) {
  const data = {
    async read(name) {
      return structuredClone(collections.get(name) ?? [])
    },
    async write(name, records) {
      collections.set(name, structuredClone(records))
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
  return new DomainService(data, auth)
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
