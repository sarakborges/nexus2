const test = require('node:test')
const assert = require('node:assert/strict')
const { ConflictException, ForbiddenException } = require('@nestjs/common')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { ProfilePostService } = require('../dist/api/domain/profile-post.service.js')

function makeRepository() {
  const records = {
    accounts: [{ id: 'user-1', profiles: ['profile-1'], currentProfile: 'profile-1' }],
    profiles: [{ id: 'profile-1', name: 'Author', url: 'author', type: 'social', createdAt: 1, lastActivity: 1 }],
    profile_posts: [],
    media_files: []
  }
  return {
    records,
    async transaction(_collections, updater) {
      const outcome = updater(records)
      if (outcome.records) {
        for (const [key, value] of Object.entries(outcome.records)) records[key] = value
      }
      return outcome.result
    }
  }
}

test('profile post stores sanitized content and updates activity in one transaction', async () => {
  const repository = makeRepository()
  const access = new DomainAccessService(repository)
  const service = new ProfilePostService(repository, access)
  const result = await service.createProfilePost('user-1', 'profile-1', '<p>Hello</p><script>alert(1)</script>')
  assert.equal(result.profileId, 'profile-1')
  assert.equal(result.content.includes('<script>'), false)
  assert.equal(repository.records.profile_posts.length, 1)
  assert.ok(repository.records.profiles[0].lastActivity >= result.createdAt)
})

test('profile post rejects empty rich text', async () => {
  const repository = makeRepository()
  const service = new ProfilePostService(repository, new DomainAccessService(repository))
  await assert.rejects(
    service.createProfilePost('user-1', 'profile-1', '<p><br></p>'),
    error => error instanceof ConflictException
  )
})

test('profile post requires ownership of the publishing profile', async () => {
  const repository = makeRepository()
  const service = new ProfilePostService(repository, new DomainAccessService(repository))
  await assert.rejects(
    service.createProfilePost('user-1', 'other-profile', '<p>Hello</p>'),
    error => error instanceof ForbiddenException
  )
})


test('creates relational profile posts without loading or rewriting collection snapshots', async () => {
  let createArguments
  const postRepository = {
    async createProfilePost(userId, post, imageIds) {
      createArguments = { userId, post, imageIds }
      return post
    },
    async transaction() {
      throw new Error('Relational profile post writes must not load collection snapshots.')
    }
  }
  const uploads = {
    getEditorImageIds(html) {
      assert.match(html, /Hello/)
      return ['image-1']
    }
  }
  const service = new ProfilePostService(postRepository, {}, uploads)

  const result = await service.createProfilePost('user-1', 'profile-1', '<p>Hello</p>')

  assert.equal(result.profileId, 'profile-1')
  assert.deepEqual(createArguments, {
    userId: 'user-1',
    post: result,
    imageIds: ['image-1']
  })
})

test('rejects empty posts before invoking the relational write', async () => {
  let writeCalled = false
  const postRepository = {
    async createProfilePost() {
      writeCalled = true
      throw new Error('The relational write must not run for empty content.')
    }
  }
  const service = new ProfilePostService(postRepository, {}, {
    getEditorImageIds() { return [] }
  })

  await assert.rejects(
    service.createProfilePost('user-1', 'profile-1', '<p><br></p>'),
    error => error instanceof ConflictException && error.message === 'INVALID_POST'
  )
  assert.equal(writeCalled, false)
})
