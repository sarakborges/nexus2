const test = require('node:test')
const assert = require('node:assert/strict')
const { DomainService } = require('../dist/api/domain/domain.service.js')

function createHarness({ uploads, failTransaction = false, beforeTransaction } = {}) {
  const account = {
    id: 'user-1',
    email: 'user@example.test',
    profiles: ['existing-profile'],
    currentProfile: 'existing-profile'
  }
  const collections = new Map([
    ['profiles', []],
    ['accounts', [account]],
    ['communities', []],
    ['community_relationships', []],
    ['media_files', []]
  ])
  const data = {
    async read(name) { return structuredClone(collections.get(name) ?? []) },
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
      if (failTransaction) throw new Error('ACCOUNT_TRANSACTION_FAILED')
      for (const name of names) {
        if (!Array.isArray(outcome.records[name])) throw new Error('INVALID_TRANSACTION_RECORDS')
      }
      for (const name of names) collections.set(name, structuredClone(outcome.records[name]))
      return structuredClone(outcome.result)
    }
  }
  const auth = {
    async getUser(userId) {
      const saved = (collections.get('accounts') ?? []).find(item => item.id === userId)
      if (!saved) throw new Error('ACCOUNT_NOT_FOUND')
      return {
        id: saved.id,
        email: saved.email,
        profiles: [...saved.profiles],
        currentProfile: saved.currentProfile
      }
    },
    async ownsProfile(userId, profileId) {
      return (collections.get('accounts') ?? []).some(item =>
        item.id === userId && item.profiles.includes(profileId)
      )
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

test('profile creation atomically persists the profile and links it to the authenticated account', async () => {
  const { service, collections, account } = createHarness()
  const created = await service.createProfile(account.id, input)
  const savedAccount = collections.get('accounts')[0]

  assert.equal(collections.get('profiles').length, 1)
  assert.deepEqual(collections.get('profiles')[0], created.profile)
  assert.deepEqual(savedAccount.profiles, ['existing-profile', created.profile.id])
  assert.equal(savedAccount.currentProfile, created.profile.id)
  assert.equal(created.user.id, account.id)
  assert.deepEqual(created.user.profiles, savedAccount.profiles)
  assert.equal(created.user.currentProfile, created.profile.id)
})

test('profile, account and media metadata remain unchanged when attachment validation fails inside the transaction', async () => {
  const uploads = {
    attachAvatarUrlToRecords(records) { return records },
    attachEditorImagesToRecords() { throw new Error('EDITOR_ATTACHMENT_FAILED') }
  }
  const { service, collections, account } = createHarness({ uploads })

  await assert.rejects(
    service.createProfile(account.id, { ...input, picture: 'https://example.test/avatar.png' }),
    /EDITOR_ATTACHMENT_FAILED/
  )

  assert.deepEqual(collections.get('profiles'), [])
  assert.deepEqual(collections.get('accounts')[0].profiles, ['existing-profile'])
  assert.equal(collections.get('accounts')[0].currentProfile, 'existing-profile')
  assert.deepEqual(collections.get('media_files'), [])
})

test('failed atomic profile and account persistence leaves both collections unchanged', async () => {
  const { service, collections, account } = createHarness({ failTransaction: true })

  await assert.rejects(service.createProfile(account.id, input), /ACCOUNT_TRANSACTION_FAILED/)

  assert.deepEqual(collections.get('profiles'), [])
  assert.deepEqual(collections.get('accounts')[0].profiles, ['existing-profile'])
  assert.equal(collections.get('accounts')[0].currentProfile, 'existing-profile')
})

test('profile creation derives a sanitized URL from the name when URL is omitted', async () => {
  const { service, collections, account } = createHarness()
  const created = await service.createProfile(account.id, {
    name: 'Árvore & Mar',
    picture: '',
    about: '',
    type: 'social'
  })

  assert.equal(created.profile.url, 'arvore-mar')
  assert.equal(collections.get('accounts')[0].currentProfile, created.profile.id)
  assert.equal(created.user.currentProfile, created.profile.id)
  assert.equal(collections.get('profiles')[0].url, 'arvore-mar')
})

test('community creation and update sanitize explicit URLs and regenerate blank URLs from the name', async () => {
  const { service, collections, account } = createHarness()
  const owner = {
    id: 'existing-profile',
    name: 'Owner',
    url: 'owner',
    picture: '',
    about: '',
    type: 'social'
  }
  collections.set('profiles', [owner])

  const created = await service.createCommunity(account.id, owner.id, {
    name: 'Café & Pão',
    url: '  @Meu Caminho!!  ',
    picture: '',
    about: '',
    privacy: 'public'
  })
  assert.equal(created.url, 'meu-caminho')
  assert.equal(collections.get('community_relationships').length, 1)
  assert.equal(collections.get('community_relationships')[0].type, 'owner')

  const updated = await service.updateCommunity(account.id, created.id, {
    name: 'Novo Nome',
    url: '',
    picture: '',
    about: '',
    privacy: 'public'
  })
  assert.equal(updated.url, 'novo-nome')
})


test('community, owner membership and media metadata remain unchanged when attachment validation fails', async () => {
  const uploads = {
    attachAvatarUrlToRecords(records) { return records },
    attachEditorImagesToRecords() { throw new Error('COMMUNITY_EDITOR_ATTACHMENT_FAILED') }
  }
  const { service, collections, account } = createHarness({ uploads })
  collections.set('profiles', [{
    id: 'existing-profile',
    name: 'Owner',
    url: 'owner',
    picture: '',
    about: '',
    type: 'social'
  }])

  await assert.rejects(service.createCommunity(account.id, 'existing-profile', {
    name: 'Community',
    url: 'community',
    picture: '',
    about: '<img src="/api/uploads/123e4567-e89b-42d3-a456-426614174000/content">'
  }), /COMMUNITY_EDITOR_ATTACHMENT_FAILED/)

  assert.deepEqual(collections.get('communities'), [])
  assert.deepEqual(collections.get('community_relationships'), [])
  assert.deepEqual(collections.get('media_files'), [])
})

test('profile update keeps content and media metadata atomic when an attachment fails', async () => {
  const uploads = {
    attachAvatarUrlToRecords(records) {
      return [...records, { id: 'staged-avatar' }]
    },
    attachEditorImagesToRecords() {
      throw new Error('PROFILE_EDITOR_ATTACHMENT_FAILED')
    }
  }
  const { service, collections, account } = createHarness({ uploads })
  const original = {
    id: 'existing-profile',
    name: 'Owner',
    url: 'owner',
    picture: '',
    about: '',
    type: 'social'
  }
  collections.set('profiles', [original])

  await assert.rejects(
    service.updateProfile(account.id, original.id, {
      name: 'Updated Owner',
      url: 'updated-owner',
      picture: 'https://example.test/new-avatar.png',
      about: '<p>Updated</p><img src="/api/uploads/123e4567-e89b-42d3-a456-426614174000/content">'
    }),
    /PROFILE_EDITOR_ATTACHMENT_FAILED/
  )

  assert.deepEqual(collections.get('profiles'), [original])
  assert.deepEqual(collections.get('media_files'), [])
})

test('community update keeps content and media metadata atomic when an attachment fails', async () => {
  const uploads = {
    attachAvatarUrlToRecords(records) {
      return [...records, { id: 'staged-avatar' }]
    },
    attachEditorImagesToRecords() {
      throw new Error('COMMUNITY_EDITOR_ATTACHMENT_FAILED')
    }
  }
  const { service, collections, account } = createHarness({ uploads })
  const owner = {
    id: 'existing-profile',
    name: 'Owner',
    url: 'owner',
    picture: '',
    about: '',
    type: 'social'
  }
  const original = {
    id: 'community-1',
    name: 'Community',
    url: 'community',
    picture: '',
    about: '',
    type: 'social',
    privacy: 'public'
  }
  collections.set('profiles', [owner])
  collections.set('communities', [original])
  collections.set('community_relationships', [{
    profiles: [owner.id, original.id],
    type: 'owner',
    requestedBy: null,
    blockedBy: null,
    updatedAt: 1
  }])

  await assert.rejects(
    service.updateCommunity(account.id, original.id, {
      name: 'Updated Community',
      url: 'updated-community',
      picture: 'https://example.test/new-avatar.png',
      about: '<p>Updated</p><img src="/api/uploads/123e4567-e89b-42d3-a456-426614174000/content">',
      privacy: 'private'
    }),
    /COMMUNITY_EDITOR_ATTACHMENT_FAILED/
  )

  assert.deepEqual(collections.get('communities'), [original])
  assert.deepEqual(collections.get('media_files'), [])
})



test('profile update rechecks account ownership in the transaction that writes profile content', async () => {
  const original = {
    id: 'existing-profile',
    name: 'Owner',
    url: 'owner',
    picture: '',
    about: '',
    type: 'social'
  }
  const { service, collections } = createHarness({
    beforeTransaction(_names, current) {
      current.set('accounts', current.get('accounts').map(account => ({
        ...account,
        profiles: [],
        currentProfile: null
      })))
    }
  })
  collections.set('profiles', [original])

  await assert.rejects(
    service.updateProfile('user-1', original.id, {
      name: 'Updated Owner',
      url: 'updated-owner',
      picture: '',
      about: 'Updated'
    }),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )

  assert.deepEqual(collections.get('profiles'), [original])
})

test('community update rejects an owner transferred before its write transaction', async () => {
  const oldOwner = {
    id: 'existing-profile',
    name: 'Old Owner',
    url: 'old-owner',
    picture: '',
    about: '',
    type: 'social'
  }
  const newOwner = {
    id: 'new-owner',
    name: 'New Owner',
    url: 'new-owner',
    picture: '',
    about: '',
    type: 'social'
  }
  const original = {
    id: 'community-1',
    name: 'Community',
    url: 'community',
    picture: '',
    about: '',
    type: 'social',
    privacy: 'public'
  }
  const { service, collections } = createHarness({
    beforeTransaction(_names, current) {
      current.set('community_relationships', [{
        profiles: [newOwner.id, original.id],
        type: 'owner',
        requestedBy: null,
        blockedBy: null,
        updatedAt: 2
      }])
    }
  })
  collections.set('profiles', [oldOwner, newOwner])
  collections.set('communities', [original])
  collections.set('community_relationships', [{
    profiles: [oldOwner.id, original.id],
    type: 'owner',
    requestedBy: null,
    blockedBy: null,
    updatedAt: 1
  }])

  await assert.rejects(
    service.updateCommunity('user-1', original.id, {
      name: 'Updated Community',
      url: 'updated-community',
      picture: '',
      about: '',
      privacy: 'private'
    }),
    error => error.getStatus() === 403 && error.message === 'PROFILE_NOT_OWNED'
  )

  assert.deepEqual(collections.get('communities'), [original])
  assert.deepEqual(collections.get('community_relationships'), [{
    profiles: [newOwner.id, original.id],
    type: 'owner',
    requestedBy: null,
    blockedBy: null,
    updatedAt: 2
  }])
})
