const test = require('node:test')
const assert = require('node:assert/strict')
const { ProfileService } = require('../dist/api/domain/profile.service.js')

function createService(repository) {
  return new ProfileService(repository, {}, {}, {}, {})
}

test('deleteProfile delegates account ownership and profile identity to one repository operation', async () => {
  const calls = []
  const service = createService({
    async deleteProfile(userId, profileId) {
      calls.push({ userId, profileId })
    }
  })

  await service.deleteProfile('account-1', 'profile-1')

  assert.deepEqual(calls, [{ userId: 'account-1', profileId: 'profile-1' }])
})

test('deleteProfile maps ownership failures to forbidden', async () => {
  const service = createService({
    async deleteProfile() {
      throw new Error('PROFILE_NOT_OWNED')
    }
  })

  await assert.rejects(
    service.deleteProfile('account-1', 'profile-1'),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )
})

test('deleteProfile maps a missing profile to not found', async () => {
  const service = createService({
    async deleteProfile() {
      throw new Error('PROFILE_NOT_FOUND')
    }
  })

  await assert.rejects(
    service.deleteProfile('account-1', 'missing-profile'),
    error => error.getStatus() === 404 && error.message === 'PROFILE_NOT_FOUND'
  )
})
