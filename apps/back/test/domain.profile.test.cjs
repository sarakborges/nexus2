const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

function createHarness({ uploads, failAfterProfileLink = false } = {}) {
  const collections = new Map([['profiles', []]])
  const account = {
    id: 'user-1',
    email: 'user@example.test',
    profiles: ['existing-profile'],
    currentProfile: 'existing-profile'
  }
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
    async write(name, records) { collections.set(name, structuredClone(records)) }
  }
  const auth = {
    async getUser() {
      return { id: account.id, email: account.email, profiles: [...account.profiles], currentProfile: account.currentProfile }
    },
    async addProfile(_userId, profileId) {
      if (!account.profiles.includes(profileId)) account.profiles.push(profileId)
      if (failAfterProfileLink) throw new Error('ACCOUNT_PROFILE_LINK_FAILED')
    },
    async removeProfile(_userId, profileId, previousCurrentProfileId = null) {
      account.profiles = account.profiles.filter(id => id !== profileId)
      if (account.currentProfile === profileId) {
        account.currentProfile = previousCurrentProfileId && account.profiles.includes(previousCurrentProfileId)
          ? previousCurrentProfileId
          : account.profiles[0] ?? null
      }
    }
  }
  return { service: new DomainService(data, auth, uploads), collections, account }
}

const input = {
  name: 'New Profile',
  url: 'new-profile',
  picture: '',
  about: '<p>Backend profile content</p>',
  type: 'social'
}

test('profile creation returns the persisted profile and links it to the authenticated account', async () => {
  const { service, collections, account } = createHarness()
  const created = await service.createProfile(account.id, input)

  assert.equal(collections.get('profiles').length, 1)
  assert.deepEqual(collections.get('profiles')[0], created)
  assert.deepEqual(account.profiles, ['existing-profile', created.id])
  assert.equal(account.currentProfile, 'existing-profile')
})

test('profile creation rollback removes both the profile row and account ownership after attachment failure', async () => {
  let attached = false
  const uploads = {
    async validateAvatarUrl() {},
    async validateEditorImages() {},
    async attachAvatarUrl() { attached = true },
    async attachEditorImages() { throw new Error('EDITOR_ATTACHMENT_FAILED') },
    async detachResourceAttachments() { attached = false }
  }
  const { service, collections, account } = createHarness({ uploads })

  await assert.rejects(service.createProfile(account.id, { ...input, picture: 'https://example.test/avatar.png' }), /EDITOR_ATTACHMENT_FAILED/)

  assert.deepEqual(collections.get('profiles'), [])
  assert.deepEqual(account.profiles, ['existing-profile'])
  assert.equal(account.currentProfile, 'existing-profile')
  assert.equal(attached, false)
})


test('profile creation removes a partially linked account profile when account persistence throws', async () => {
  const { service, collections, account } = createHarness({ failAfterProfileLink: true })

  await assert.rejects(service.createProfile(account.id, input), /ACCOUNT_PROFILE_LINK_FAILED/)

  assert.deepEqual(collections.get('profiles'), [])
  assert.deepEqual(account.profiles, ['existing-profile'])
  assert.equal(account.currentProfile, 'existing-profile')
})
