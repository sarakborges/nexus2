const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ForbiddenException } = require('@nestjs/common')
const { ProfileSettingsService, DEFAULT_PROFILE_SETTINGS } = require('../dist/api/domain/profile-settings.service.js')

function createService({ ownerProfiles = ['profile-1'], settings = [] } = {}) {
  const calls = []
  const records = {
    accounts: [{ id: 'user-1', profiles: [...ownerProfiles] }],
    profiles: [{ id: 'profile-1' }, { id: 'profile-2' }],
    profile_settings: structuredClone(settings)
  }

  const assertOwnsProfile = (userId, profileId) => {
    const account = records.accounts.find(item => item.id === userId)
    if (!account) throw new Error('ACCOUNT_NOT_FOUND')
    if (!records.profiles.some(profile => profile.id === profileId)) {
      throw new Error('PROFILE_NOT_FOUND')
    }
    if (!account.profiles.includes(profileId)) throw new Error('PROFILE_NOT_OWNED')
  }

  const repository = {
    async getProfileSettings(userId, profileId) {
      calls.push(['get', userId, profileId])
      assertOwnsProfile(userId, profileId)
      const stored = records.profile_settings.find(item => item.profileId === profileId)
      return {
        ...structuredClone(DEFAULT_PROFILE_SETTINGS),
        ...(stored ?? {})
      }
    },
    async updateProfileSettings(userId, profileId, patch) {
      calls.push(['update', userId, profileId, structuredClone(patch)])
      assertOwnsProfile(userId, profileId)
      const current = records.profile_settings.find(item => item.profileId === profileId)
      const next = {
        ...structuredClone(DEFAULT_PROFILE_SETTINGS),
        ...(current ?? {}),
        ...patch
      }
      records.profile_settings = [
        ...records.profile_settings.filter(item => item.profileId !== profileId),
        { profileId, ...structuredClone(next) }
      ]
      return structuredClone(next)
    }
  }

  return {
    service: new ProfileSettingsService(repository),
    records,
    calls
  }
}

test('profile settings return defaults for profiles without saved preferences', async () => {
  const { service } = createService()
  assert.deepEqual(await service.getSettings('user-1', 'profile-1'), DEFAULT_PROFILE_SETTINGS)
})

test('profile settings persist independently for each owned profile', async () => {
  const { service, records } = createService({ ownerProfiles: ['profile-1', 'profile-2'] })
  const saved = await service.updateSettings('user-1', 'profile-2', {
    messageAudience: 'friends',
    publishActivityTypes: ['profile_post'],
    showFriendActivityTypes: ['community_created']
  })
  assert.deepEqual(saved, {
    messageAudience: 'friends',
    publishActivityTypes: ['profile_post'],
    showFriendActivityTypes: ['community_created']
  })
  assert.equal(records.profile_settings.length, 1)
  assert.equal(records.profile_settings[0].profileId, 'profile-2')
})

test('profile settings cannot be read or changed for profiles not owned by the account', async () => {
  const { service } = createService()
  await assert.rejects(service.getSettings('user-1', 'profile-2'), error => error instanceof ForbiddenException)
  await assert.rejects(service.updateSettings('user-1', 'profile-2', { messageAudience: 'friends' }), error => error instanceof ForbiddenException)
})

test('profile settings use targeted relational reads and writes without collection snapshots', async () => {
  const calls = []
  const settings = {
    messageAudience: 'friends',
    publishActivityTypes: ['profile_post'],
    showFriendActivityTypes: ['community_created']
  }
  const repository = {
    async getProfileSettings(userId, profileId) {
      calls.push(['get', userId, profileId])
      return settings
    },
    async updateProfileSettings(userId, profileId, patch) {
      calls.push(['update', userId, profileId, patch])
      return { ...settings, ...patch }
    }
  }
  const service = new ProfileSettingsService(repository)

  assert.deepEqual(await service.getSettings('user-1', 'profile-1'), settings)
  assert.deepEqual(
    await service.updateSettings('user-1', 'profile-1', { messageAudience: 'everyone' }),
    { ...settings, messageAudience: 'everyone' }
  )
  assert.deepEqual(calls.map(call => call[0]), ['get', 'update'])
  assert.equal('transaction' in repository, false)
})
