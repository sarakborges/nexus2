const assert = require('node:assert/strict')
const { test } = require('node:test')
const { SupabaseRelationalRepository } = require('../dist/storage/supabase-relational.repository.js')

const url = 'https://example.supabase.co'
const key = 'sb_publishable_example'
const secret = 'example-header-value'

function withFetch(t, handler) {
  const previous = global.fetch
  global.fetch = handler
  t.after(() => { global.fetch = previous })
}

function rowsFor(call, table) {
  const parsed = new URL(String(call))
  return parsed.pathname === '/rest/v1/' + table
}

test('reads accounts from accounts, account_profiles and account_preferences tables', async t => {
  const calls = []
  withFetch(t, async (input, options) => {
    calls.push({ url: new URL(String(input)), options })
    const path = calls.at(-1).url.pathname
    if (path.endsWith('/nexus_collection_versions')) {
      return new Response(JSON.stringify([{ collection: 'accounts', revision: 3 }]), { status: 200 })
    }
    if (path.endsWith('/accounts')) {
      return new Response(JSON.stringify([{
        id: 'account-1',
        email: 'person@example.com',
        password_hash: 'hash',
        password_salt: 'salt',
        current_profile_id: 'profile-2'
      }]), { status: 200 })
    }
    if (path.endsWith('/account_profiles')) {
      return new Response(JSON.stringify([
        { account_id: 'account-1', profile_id: 'profile-2', position: 1 },
        { account_id: 'account-1', profile_id: 'profile-1', position: 0 }
      ]), { status: 200 })
    }
    if (path.endsWith('/account_preferences')) {
      return new Response(JSON.stringify([{
        account_id: 'account-1',
        language: 'pt-BR',
        theme: 'dark'
      }]), { status: 200 })
    }
    throw new Error('Unexpected request: ' + path)
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const [account] = await repo.read('accounts')

  assert.deepEqual(account, {
    id: 'account-1',
    email: 'person@example.com',
    password: { hash: 'hash', salt: 'salt' },
    profiles: ['profile-1', 'profile-2'],
    currentProfile: 'profile-2',
    preferences: { language: 'pt-BR', theme: 'dark' }
  })
  assert.ok(calls.every(call => call.options.headers.apikey === key))
  assert.ok(calls.every(call => call.options.headers['x-nexus-api-secret'] === secret))
})

test('reads persisted feed activity rows from the feed_activities table', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'post:post-1',
      type: 'profile_post',
      actor_profile_id: 'profile-1',
      target_profile_id: null,
      community_id: null,
      profile_post_id: 'post-1',
      role: null,
      updated_at_ms: '1700000000000'
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  assert.deepEqual(await repo.read('feed_activities'), [{
    id: 'post:post-1',
    type: 'profile_post',
    profileId: 'profile-1',
    friendId: null,
    communityId: null,
    postId: 'post-1',
    role: null,
    updatedAt: 1700000000000
  }])
  assert.equal(call.url.pathname, '/rest/v1/feed_activities')
  assert.equal(call.options.headers.Range, '0-999')
})

test('commits changed relational rows through the atomic database RPC', async t => {
  const calls = []
  withFetch(t, async (input, options) => {
    const url = new URL(String(input))
    calls.push({ url, options })
    if (url.pathname.endsWith('/nexus_collection_versions')) {
      return new Response(JSON.stringify([{ collection: 'profiles', revision: 7 }]), { status: 200 })
    }
    if (url.pathname.endsWith('/profiles')) {
      return new Response(JSON.stringify([{
        id: 'profile-1',
        name: 'Profile',
        url: 'profile',
        picture: '',
        about: '',
        type: 'social',
        created_at_ms: 100,
        last_activity_ms: 100
      }]), { status: 200 })
    }
    if (url.pathname.endsWith('/rpc/nexus_commit_relational')) {
      assert.equal(options.method, 'POST')
      assert.equal(options.headers.apikey, key)
      assert.equal(options.headers['x-nexus-api-secret'], secret)
      return new Response(JSON.stringify({ committed: true }), { status: 200 })
    }
    throw new Error('Unexpected request: ' + url.pathname)
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const result = await repo.update('profiles', records => [
    ...records,
    { id: 'profile-2', name: 'Second' }
  ])

  assert.equal(result.length, 2)
  const commit = calls.find(call => call.url.pathname.endsWith('/rpc/nexus_commit_relational'))
  const body = JSON.parse(commit.options.body)
  assert.deepEqual(body.p_changes, [{
    collection: 'profiles',
    expected_revision: 7,
    records: [
      {
        id: 'profile-1',
        name: 'Profile',
        url: 'profile',
        picture: '',
        about: '',
        type: 'social',
        createdAt: 100,
        lastActivity: 100
      },
      { id: 'profile-2', name: 'Second' }
    ]
  }])
})

test('rejects unsupported and duplicate relational collections before querying', async () => {
  const repo = new SupabaseRelationalRepository(url, key, secret)
  const updater = records => ({ records, result: undefined })
  await assert.rejects(() => repo.transaction([], updater), /non-empty list/)
  await assert.rejects(() => repo.transaction(['profiles', 'profiles'], updater), /unique collections/)
  await assert.rejects(() => repo.read('unknown'), /Unsupported relational collection/)
})

test('reports PostgREST errors with the failing status', async t => {
  withFetch(t, async () => new Response('denied', { status: 403 }))
  const repo = new SupabaseRelationalRepository(url, key, secret)
  await assert.rejects(() => repo.read('feed_activities'), /Supabase relational request failed \(403\)/)
})


test('readByIds queries only the requested relational profiles', async t => {
  let call
  withFetch(t, async input => {
    call = new URL(String(input))
    return new Response(JSON.stringify([{
      id: 'profile-1',
      name: 'Requested',
      url: 'requested',
      picture: '',
      about: '',
      type: 'social',
      created_at_ms: '100',
      last_activity_ms: '200'
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const result = await repo.readByIds('profiles', ['profile-1'])

  assert.deepEqual(result, [{
    id: 'profile-1',
    name: 'Requested',
    url: 'requested',
    picture: '',
    about: '',
    type: 'social',
    createdAt: 100,
    lastActivity: 200
  }])
  assert.equal(call.pathname, '/rest/v1/profiles')
  assert.equal(call.searchParams.get('id'), 'in.("profile-1")')
})

test('findAccountByEmail filters accounts in Postgres and maps only that account relation data', async t => {
  const calls = []
  withFetch(t, async input => {
    const requestUrl = new URL(String(input))
    calls.push(requestUrl)
    if (requestUrl.pathname.endsWith('/accounts')) {
      assert.equal(requestUrl.searchParams.get('email'), 'eq.person@example.com')
      return new Response(JSON.stringify([{
        id: 'account-1',
        email: 'person@example.com',
        password_hash: 'hash',
        password_salt: 'salt',
        current_profile_id: 'profile-1'
      }]), { status: 200 })
    }
    if (requestUrl.pathname.endsWith('/account_profiles')) {
      assert.equal(requestUrl.searchParams.get('account_id'), 'in.("account-1")')
      return new Response(JSON.stringify([
        { account_id: 'account-1', profile_id: 'profile-1', position: 0 }
      ]), { status: 200 })
    }
    if (requestUrl.pathname.endsWith('/account_preferences')) {
      assert.equal(requestUrl.searchParams.get('account_id'), 'in.("account-1")')
      return new Response(JSON.stringify([]), { status: 200 })
    }
    throw new Error('Unexpected request: ' + requestUrl.pathname)
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const account = await repo.findAccountByEmail('person@example.com')

  assert.deepEqual(account, {
    id: 'account-1',
    email: 'person@example.com',
    password: { hash: 'hash', salt: 'salt' },
    profiles: ['profile-1'],
    currentProfile: 'profile-1'
  })
  assert.equal(calls.length, 3)
})


test('creates a profile post through the atomic relational RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'post-1',
      profile_id: 'profile-1',
      content: '<p>Hello</p>',
      created_at_ms: '1700000000000'
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const result = await repo.createProfilePost(
    'account-1',
    {
      id: 'post-1',
      profileId: 'profile-1',
      content: '<p>Hello</p>',
      createdAt: 1700000000000
    },
    ['image-1']
  )

  assert.deepEqual(result, {
    id: 'post-1',
    profileId: 'profile-1',
    content: '<p>Hello</p>',
    createdAt: 1700000000000
  })
  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_create_profile_post')
  assert.equal(call.options.method, 'POST')
  assert.equal(call.options.headers.apikey, key)
  assert.equal(call.options.headers['x-nexus-api-secret'], secret)
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_post_id: 'post-1',
    p_profile_id: 'profile-1',
    p_content: '<p>Hello</p>',
    p_created_at_ms: 1700000000000,
    p_image_ids: ['image-1']
  })
})


test('issues and rotates refresh tokens through an atomic relational RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(null, { status: 204 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.issueRefreshToken(
    { id: 'next-token', userId: 'account-1', tokenHash: 'next-hash', expiresAt: 2000 },
    { id: 'previous-token', userId: 'account-1', tokenHash: 'previous-hash' },
    1000
  )

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_issue_refresh_token')
  assert.equal(call.options.method, 'POST')
  assert.equal(call.options.headers.apikey, key)
  assert.equal(call.options.headers['x-nexus-api-secret'], secret)
  assert.deepEqual(JSON.parse(call.options.body), {
    p_id: 'next-token',
    p_user_id: 'account-1',
    p_token_hash: 'next-hash',
    p_expires_at_ms: 2000,
    p_now_ms: 1000,
    p_previous_id: 'previous-token',
    p_previous_user_id: 'account-1',
    p_previous_token_hash: 'previous-hash'
  })
})

test('revokes a refresh token by hash without reading the refresh-token table', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(null, { status: 204 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.deleteRefreshTokenByHash('stored-token-hash')

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_revoke_refresh_token')
  assert.deepEqual(JSON.parse(call.options.body), { p_token_hash: 'stored-token-hash' })
})


test('changes account profile membership through a targeted relational RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(null, { status: 204 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.changeAccountProfile({
    accountId: 'account-1',
    profileId: 'profile-2',
    action: 'remove',
    makeCurrent: false,
    previousCurrentProfileId: 'profile-1'
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_change_account_profile')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_account_id: 'account-1',
    p_profile_id: 'profile-2',
    p_action: 'remove',
    p_make_current: false,
    p_previous_current_profile_id: 'profile-1'
  })
})


test('writes profile relationships through an atomic relational upsert RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(null, { status: 204 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.upsertProfileRelationship({
    userId: 'account-1',
    sourceProfileId: 'profile-1',
    targetProfileId: 'profile-2',
    type: 'requested',
    updatedAt: 1700000000000
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_upsert_profile_relationship')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_source_profile_id: 'profile-1',
    p_target_profile_id: 'profile-2',
    p_type: 'requested',
    p_updated_at_ms: 1700000000000
  })
})

test('removes profile relationships through a targeted relational RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(null, { status: 204 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.removeProfileRelationship({
    userId: 'account-1',
    sourceProfileId: 'profile-1',
    targetProfileId: 'profile-2',
    updatedAt: 1700000000000
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_remove_profile_relationship')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_source_profile_id: 'profile-1',
    p_target_profile_id: 'profile-2',
    p_updated_at_ms: 1700000000000
  })
})


test('changes community memberships through the targeted relational RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(null, { status: 204 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.changeCommunityRelationship({
    userId: 'account-1',
    communityId: 'community-1',
    targetProfileId: 'profile-2',
    actorProfileId: 'profile-1',
    action: 'connection',
    updatedAt: 1700000000000
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_change_community_relationship')
  assert.equal(call.options.method, 'POST')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_community_id: 'community-1',
    p_target_profile_id: 'profile-2',
    p_actor_profile_id: 'profile-1',
    p_action: 'connection',
    p_updated_at_ms: 1700000000000
  })
})


test('reads one profile settings record and its activity preferences through the targeted RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      message_audience: 'friends',
      publish_activity_types: ['profile_post'],
      show_friend_activity_types: ['community_created']
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const settings = await repo.getProfileSettings('account-1', 'profile-1')

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_profile_settings')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_profile_id: 'profile-1'
  })
  assert.deepEqual(settings, {
    messageAudience: 'friends',
    publishActivityTypes: ['profile_post'],
    showFriendActivityTypes: ['community_created']
  })
})

test('updates profile settings with a partial patch through the targeted RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      message_audience: 'everyone',
      publish_activity_types: ['friend_connected', 'community_created'],
      show_friend_activity_types: ['friend_connected', 'profile_post', 'community_created', 'community_membership']
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const settings = await repo.updateProfileSettings('account-1', 'profile-1', {
    messageAudience: 'everyone',
    publishActivityTypes: ['friend_connected', 'community_created']
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_update_profile_settings')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_profile_id: 'profile-1',
    p_patch: {
      messageAudience: 'everyone',
      publishActivityTypes: ['friend_connected', 'community_created']
    }
  })
  assert.equal(settings.showFriendActivityTypes.length, 4)
})


test('sends profile messages through an atomic relational write RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'message-1',
      from_profile_id: 'profile-1',
      to_profile_id: 'profile-2',
      content: '<p>Hello</p>',
      created_at_ms: '1700000000000',
      is_favorite: false
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const message = await repo.createProfileMessage({
    userId: 'account-1',
    message: {
      id: 'message-1',
      fromProfileId: 'profile-1',
      toProfileId: 'profile-2',
      content: '<p>Hello</p>',
      createdAt: 1700000000000,
      isFavorite: false
    },
    imageIds: ['image-1']
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_send_profile_message')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_message_id: 'message-1',
    p_from_profile_id: 'profile-1',
    p_to_profile_id: 'profile-2',
    p_content: '<p>Hello</p>',
    p_created_at_ms: 1700000000000,
    p_image_ids: ['image-1']
  })
  assert.deepEqual(message, {
    id: 'message-1',
    fromProfileId: 'profile-1',
    toProfileId: 'profile-2',
    content: '<p>Hello</p>',
    createdAt: 1700000000000,
    isFavorite: false
  })
})

test('deletes profile messages through a targeted relational RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(null, { status: 204 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.deleteProfileMessage({
    userId: 'account-1',
    recipientProfileId: 'profile-2',
    messageId: 'message-1',
    actorProfileId: 'profile-1'
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_delete_profile_message')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_recipient_profile_id: 'profile-2',
    p_message_id: 'message-1',
    p_actor_profile_id: 'profile-1'
  })
})

test('updates a profile message favorite through a targeted relational RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'message-1',
      from_profile_id: 'profile-1',
      to_profile_id: 'profile-2',
      content: '<p>Hello</p>',
      created_at_ms: '1700000000000',
      is_favorite: true
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const message = await repo.setProfileMessageFavorite({
    userId: 'account-1',
    recipientProfileId: 'profile-2',
    messageId: 'message-1',
    actorProfileId: 'profile-2',
    isFavorite: true
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_set_profile_message_favorite')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_recipient_profile_id: 'profile-2',
    p_message_id: 'message-1',
    p_actor_profile_id: 'profile-2',
    p_is_favorite: true
  })
  assert.equal(message.isFavorite, true)
})


test('reads the requested private-message page through one relational RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'message-1',
      from_profile_id: 'profile-1',
      to_profile_id: 'profile-2',
      content: '<p>Hello</p>',
      created_at_ms: '1700000000000',
      is_favorite: false,
      total_items: 41,
      page: 2,
      page_size: 20,
      total_pages: 3
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const page = await repo.getProfileMessages('profile-2', 'account-1', 2)

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_profile_messages')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_profile_id: 'profile-2',
    p_user_id: 'account-1',
    p_page: 2
  })
  assert.deepEqual(page, {
    items: [{
      id: 'message-1',
      fromProfileId: 'profile-1',
      toProfileId: 'profile-2',
      content: '<p>Hello</p>',
      createdAt: 1700000000000,
      isFavorite: false
    }],
    page: 2,
    pageSize: 20,
    totalItems: 41,
    totalPages: 3
  })
})

test('an empty private-message page has the same empty pagination contract', async t => {
  withFetch(t, async () => new Response(JSON.stringify([]), { status: 200 }))
  const repo = new SupabaseRelationalRepository(url, key, secret)

  assert.deepEqual(
    await repo.getProfileMessages('profile-2', null, 6),
    { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
  )
})


test('creates a community forum topic with its image references through a targeted RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'topic-1',
      community_id: 'community-1',
      profile_id: 'profile-1',
      title: 'Topic',
      content: '<p>Hello</p>',
      created_at_ms: '1700000000000',
      updated_at_ms: '1700000000000',
      is_pinned: false,
      is_locked: false
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const topic = await repo.createCommunityForumTopic({
    userId: 'account-1',
    topic: {
      id: 'topic-1',
      communityId: 'community-1',
      profileId: 'profile-1',
      title: 'Topic',
      content: '<p>Hello</p>',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      isPinned: false,
      isLocked: false
    },
    imageIds: ['image-1']
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_create_community_forum_topic')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_topic_id: 'topic-1',
    p_community_id: 'community-1',
    p_profile_id: 'profile-1',
    p_title: 'Topic',
    p_content: '<p>Hello</p>',
    p_created_at_ms: 1700000000000,
    p_image_ids: ['image-1']
  })
  assert.equal(topic.id, 'topic-1')
})

test('creates a community forum reply through a targeted RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'reply-1',
      topic_id: 'topic-1',
      community_id: 'community-1',
      profile_id: 'profile-1',
      content: '<p>Reply</p>',
      created_at_ms: '1700000000100',
      updated_at_ms: '1700000000100'
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const reply = await repo.createCommunityForumReply({
    userId: 'account-1',
    reply: {
      id: 'reply-1',
      topicId: 'topic-1',
      communityId: 'community-1',
      profileId: 'profile-1',
      content: '<p>Reply</p>',
      createdAt: 1700000000100,
      updatedAt: 1700000000100
    },
    imageIds: []
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_create_community_forum_reply')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_reply_id: 'reply-1',
    p_topic_id: 'topic-1',
    p_community_id: 'community-1',
    p_profile_id: 'profile-1',
    p_content: '<p>Reply</p>',
    p_created_at_ms: 1700000000100,
    p_updated_at_ms: 1700000000100,
    p_image_ids: []
  })
  assert.equal(reply.topicId, 'topic-1')
})

test('moderates a community forum topic through a targeted RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify([{
      id: 'topic-1',
      community_id: 'community-1',
      profile_id: 'profile-1',
      title: 'Topic',
      content: '<p>Hello</p>',
      created_at_ms: '1700000000000',
      updated_at_ms: '1700000000200',
      is_pinned: true,
      is_locked: false
    }]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const topic = await repo.moderateCommunityForumTopic({
    userId: 'account-1',
    communityId: 'community-1',
    topicId: 'topic-1',
    actorProfileId: 'profile-1',
    isPinned: true,
    updatedAt: 1700000000200
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_moderate_community_forum_topic')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_community_id: 'community-1',
    p_topic_id: 'topic-1',
    p_actor_profile_id: 'profile-1',
    p_is_pinned: true,
    p_is_locked: null,
    p_updated_at_ms: 1700000000200
  })
  assert.equal(topic.isPinned, true)
})

test('deletes a community forum topic through a targeted RPC', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(null, { status: 204 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.deleteCommunityForumTopic({
    userId: 'account-1',
    communityId: 'community-1',
    topicId: 'topic-1',
    actorProfileId: 'profile-1',
    updatedAt: 1700000000300
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_delete_community_forum_topic')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_community_id: 'community-1',
    p_topic_id: 'topic-1',
    p_actor_profile_id: 'profile-1',
    p_updated_at_ms: 1700000000300
  })
})

test('deletes a community forum reply and returns the updated topic id', async t => {
  let call
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify('topic-1'), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const topicId = await repo.deleteCommunityForumReply({
    userId: 'account-1',
    communityId: 'community-1',
    replyId: 'reply-1',
    actorProfileId: 'profile-1',
    updatedAt: 1700000000400
  })

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_delete_community_forum_reply')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_community_id: 'community-1',
    p_reply_id: 'reply-1',
    p_actor_profile_id: 'profile-1',
    p_updated_at_ms: 1700000000400
  })
  assert.equal(topicId, 'topic-1')
})


test('loads the community forum page and current-page authors through one targeted RPC', async t => {
  let call
  const expected = {
    community: {
      id: 'community-1', name: 'Community', url: 'community', picture: '',
      about: '', type: 'social', privacy: 'private', createdAt: 1, lastActivity: 2
    },
    viewerRelationship: null,
    currentProfileType: 'social',
    canReadForum: true,
    canPublish: true,
    topics: {
      items: [{
        id: 'topic-1', communityId: 'community-1', profileId: 'profile-1',
        title: 'Topic', content: '<p>Hello</p>', createdAt: 1, updatedAt: 2,
        isPinned: false, isLocked: false, replyCount: 3
      }],
      page: 2, pageSize: 20, totalItems: 21, totalPages: 2
    },
    authors: [{
      id: 'profile-1', name: 'Author', url: 'author', picture: '',
      about: '<p>Author</p>', type: 'social', createdAt: 1, lastActivity: 2
    }]
  }
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify(expected), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const page = await repo.getCommunityForumPage('community', 'account-1', 2, 'hello', 'name-asc')

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_community_forum_page')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_url: 'community',
    p_user_id: 'account-1',
    p_page: 2,
    p_query: 'hello',
    p_sort: 'name-asc'
  })
  assert.deepEqual(page, expected)
})


test('reads a community forum topic page with paginated replies through one targeted RPC', async t => {
  let call
  const expected = {
    community: {
      id: 'community-1', name: 'Community', url: 'community', picture: '',
      about: '', type: 'social', privacy: 'public', createdAt: 1, lastActivity: 2
    },
    detail: {
      topic: {
        id: 'topic-1', communityId: 'community-1', profileId: 'profile-1',
        title: 'Topic', content: '<p>Hello</p>', createdAt: 1, updatedAt: 2,
        isPinned: false, isLocked: false, replyCount: 21
      },
      replies: {
        items: [{
          id: 'reply-1', topicId: 'topic-1', communityId: 'community-1',
          profileId: 'profile-2', content: '<p>Reply</p>', createdAt: 2, updatedAt: 2
        }],
        page: 2, pageSize: 20, totalItems: 21, totalPages: 2
      }
    },
    forumProfileId: 'profile-1',
    viewerRelationship: null,
    currentProfileType: 'social',
    isMember: true,
    isStaff: true,
    authors: [{
      id: 'profile-1', name: 'Author', url: 'author', picture: '',
      about: '<p>Author</p>', type: 'social', createdAt: 1, lastActivity: 2
    }]
  }
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify(expected), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const page = await repo.getCommunityForumTopicPage(
    'community', 'topic-1', 'account-1', 2, 'reply', 'activity-asc'
  )

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_community_forum_topic_page')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_url: 'community',
    p_topic_id: 'topic-1',
    p_user_id: 'account-1',
    p_page: 2,
    p_query: 'reply',
    p_sort: 'activity-asc'
  })
  assert.deepEqual(page, expected)
})


test('loads a profile page, friends and public communities through a targeted RPC', async t => {
  let call
  const expected = {
    profile: {
      id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
      about: '<p>About</p>', type: 'social', createdAt: 1, lastActivity: 2
    },
    viewerRelationship: null,
    currentProfileType: 'social',
    friends: {
      items: [{
        id: 'profile-2', name: 'Friend', url: 'friend', picture: '',
        about: '<p>Friend</p>', type: 'social', createdAt: 1, lastActivity: 2
      }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    },
    communities: {
      items: [{
        id: 'community-1', name: 'Community', url: 'community', picture: '',
        about: 'Public', type: 'social', privacy: 'public', createdAt: 1, lastActivity: 2
      }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    }
  }
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify(expected), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const page = await repo.getProfilePage('profile', 'account-1')

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_profile_page')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_url: 'profile',
    p_user_id: 'account-1'
  })
  assert.deepEqual(page, expected)
})


test('reads a searchable, sortable profile messages page through one targeted RPC', async t => {
  let call
  const expected = {
    profile: {
      id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
      about: '<p>About</p>', type: 'social', createdAt: 1, lastActivity: 2
    },
    viewerRelationship: null,
    currentProfileType: 'social',
    isProfileOwner: true,
    messageTab: 'favorites',
    messages: {
      items: [{
        id: 'message-1', fromProfileId: 'profile-2', toProfileId: 'profile-1',
        content: '<p>Hello</p>', createdAt: 2, isFavorite: true
      }],
      page: 2, pageSize: 20, totalItems: 21, totalPages: 2
    },
    senders: [{
      id: 'profile-2', name: 'Sender', url: 'sender', picture: '',
      about: '<p>About sender</p>', type: 'social', createdAt: 1, lastActivity: 2
    }],
    messagePermissions: {
      'message-1': { canDelete: true, canFavorite: true, canReply: true }
    }
  }
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify(expected), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const page = await repo.getProfileMessagesPage(
    'profile', 'account-1', 2, 'hello', 'name-asc', 'favorites'
  )

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_profile_messages_page')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_url: 'profile',
    p_user_id: 'account-1',
    p_page: 2,
    p_query: 'hello',
    p_sort: 'name-asc',
    p_message_tab: 'favorites'
  })
  assert.deepEqual(page, expected)
})


test('reads the community page aggregate through one targeted relational RPC', async t => {
  let call
  const expected = {
    community: {
      id: 'community-1', name: 'Community', url: 'community', picture: '',
      about: '<p>About</p>', type: 'social', privacy: 'public', createdAt: 1, lastActivity: 2
    },
    relationships: [{
      profiles: ['profile-1', 'community-1'],
      type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 1
    }],
    viewerRelationship: {
      profiles: ['profile-1', 'community-1'],
      type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 1
    },
    currentProfileType: 'social',
    canViewMembers: true,
    canEditCommunity: true,
    pendingRequestCount: 1,
    members: {
      items: [{
        id: 'profile-1', name: 'Owner', url: 'owner', picture: '',
        about: '', type: 'social', createdAt: 1, lastActivity: 2
      }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    },
    forumTopics: {
      items: [{
        id: 'topic-1', communityId: 'community-1', profileId: 'profile-1',
        title: 'Topic', content: '<p>Topic</p>', createdAt: 1, updatedAt: 2,
        isPinned: true, isLocked: false, replyCount: 2
      }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    },
    forumAuthors: [{
      id: 'profile-1', name: 'Owner', url: 'owner', picture: '',
      about: '', type: 'social', createdAt: 1, lastActivity: 2
    }]
  }
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify(expected), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const page = await repo.getCommunityPage('community', 'account-1')

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_community_page')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_url: 'community',
    p_user_id: 'account-1'
  })
  assert.deepEqual(page, expected)
})


test('reads community member and pending pages through one targeted RPC', async t => {
  let call
  const expected = {
    community: { id: 'community-1', name: 'Community', url: 'community', type: 'social' },
    relationships: [{
      profiles: ['profile-owner', 'community-1'],
      type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 10
    }],
    viewerRelationship: {
      profiles: ['profile-owner', 'community-1'],
      type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 10
    },
    currentProfileType: 'social',
    actorProfileId: 'profile-owner',
    actorRole: 'owner',
    isStaff: true,
    visibleTab: 'banned',
    members: {
      items: [{
        id: 'profile-blocked', name: 'Blocked', url: 'blocked', picture: '',
        about: '', type: 'social', createdAt: 1, lastActivity: 2, role: 'blocked'
      }],
      page: 2, pageSize: 20, totalItems: 21, totalPages: 2
    },
    pending: {
      items: [],
      page: 1, pageSize: 20, totalItems: 0, totalPages: 1
    }
  }
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify(expected), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const page = await repo.getCommunityMembersPage(
    'community', 'account-1', 2, 1, 'blocked', 'name-asc', 'banned'
  )

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_community_members_page')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_url: 'community',
    p_user_id: 'account-1',
    p_page: 2,
    p_pending_page: 1,
    p_query: 'blocked',
    p_sort: 'name-asc',
    p_tab: 'banned'
  })
  assert.deepEqual(page, expected)
})


test('reads profile friends and communities directories through the targeted RPC', async t => {
  const calls = []
  const friendResult = {
    kind: 'friends',
    profile: {
      id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
      about: '', type: 'social', createdAt: 1, lastActivity: 2
    },
    viewerRelationship: null,
    currentProfileType: 'social',
    friendRelationships: [{
      profiles: ['profile-2', 'profile-3'], type: 'connection',
      requestedBy: null, blockedBy: null, updatedAt: 2
    }],
    friends: {
      items: [{
        id: 'profile-2', name: 'Friend', url: 'friend', picture: '',
        about: '', type: 'social', createdAt: 1, lastActivity: 2
      }],
      page: 2, pageSize: 20, totalItems: 21, totalPages: 2
    }
  }
  const communityResult = {
    kind: 'communities',
    profile: {
      id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
      about: '', type: 'social', createdAt: 1, lastActivity: 2
    },
    viewerRelationship: null,
    currentProfileType: 'social',
    communities: {
      items: [{
        id: 'community-1', name: 'Community', url: 'community', picture: '',
        about: '', type: 'social', privacy: 'public', createdAt: 1, lastActivity: 2
      }],
      page: 1, pageSize: 20, totalItems: 1, totalPages: 1
    }
  }
  withFetch(t, async (input, options) => {
    const body = JSON.parse(options.body)
    calls.push({ url: new URL(String(input)), body })
    return new Response(JSON.stringify(body.p_kind === 'friends' ? friendResult : communityResult), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const friends = await repo.getProfileDirectoryPage(
    'profile', 'friends', 'account-1', 2, 'friend', 'name-asc'
  )
  const communities = await repo.getProfileDirectoryPage(
    'profile', 'communities', null, 1, undefined, 'activity-desc'
  )

  assert.deepEqual(calls.map(call => call.url.pathname), [
    '/rest/v1/rpc/nexus_get_profile_directory_page',
    '/rest/v1/rpc/nexus_get_profile_directory_page'
  ])
  assert.deepEqual(calls.map(call => call.body), [
    {
      p_url: 'profile', p_kind: 'friends', p_user_id: 'account-1',
      p_page: 2, p_query: 'friend', p_sort: 'name-asc'
    },
    {
      p_url: 'profile', p_kind: 'communities', p_user_id: null,
      p_page: 1, p_query: null, p_sort: 'activity-desc'
    }
  ])
  assert.deepEqual(friends, friendResult)
  assert.deepEqual(communities, communityResult)
})


test('reads the authenticated communities directory through a targeted relational RPC', async t => {
  let call
  const expected = {
    currentProfile: {
      id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
      about: '<p>About</p>', type: 'social', createdAt: 1, lastActivity: 2
    },
    communityTab: 'managed',
    communities: {
      items: [{
        id: 'community-1', name: 'Community', url: 'community', picture: '',
        about: '<p>About</p>', type: 'rp', privacy: 'private',
        createdAt: 1, lastActivity: 2
      }],
      page: 2, pageSize: 20, totalItems: 21, totalPages: 2
    }
  }
  withFetch(t, async (input, options) => {
    call = { url: new URL(String(input)), options }
    return new Response(JSON.stringify(expected), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  const page = await repo.getCommunitiesPage('account-1', 2, 'community', 'name-asc', 'managed')

  assert.equal(call.url.pathname, '/rest/v1/rpc/nexus_get_communities_page')
  assert.deepEqual(JSON.parse(call.options.body), {
    p_user_id: 'account-1',
    p_page: 2,
    p_query: 'community',
    p_sort: 'name-asc',
    p_community_tab: 'managed'
  })
  assert.deepEqual(page, expected)
})


test('reads profile edit, community edit and forum composer pages through targeted RPCs', async t => {
  const calls = []
  const responses = [
    { profile: { id: 'profile-1' }, currentProfileType: 'social' },
    { community: { id: 'community-1' }, ownerProfileId: 'profile-1', currentProfileType: 'social' },
    { community: { id: 'community-1' }, forumProfile: { id: 'profile-1' }, viewerRelationship: null, currentProfileType: 'social' }
  ]
  withFetch(t, async (input, options) => {
    const url = new URL(String(input))
    calls.push({ path: url.pathname, body: JSON.parse(options.body) })
    const index = calls.length - 1
    return new Response(JSON.stringify(responses[index]), { status: 200 })
  })

  const repo = new SupabaseRelationalRepository(url, key, secret)
  assert.deepEqual(await repo.getProfileEditPage('profile', 'account-1'), responses[0])
  assert.deepEqual(await repo.getCommunityEditPage('community', null), responses[1])
  assert.deepEqual(await repo.getCommunityForumComposerPage('community', 'account-1'), responses[2])
  assert.deepEqual(calls, [
    { path: '/rest/v1/rpc/nexus_get_profile_edit_page', body: { p_url: 'profile', p_user_id: 'account-1' } },
    { path: '/rest/v1/rpc/nexus_get_community_edit_page', body: { p_url: 'community', p_user_id: null } },
    { path: '/rest/v1/rpc/nexus_get_community_forum_composer_page', body: { p_url: 'community', p_user_id: 'account-1' } }
  ])
})


test('reads profile and community relationship collections through targeted RPCs', async t => {
  const calls = []
  const responses = [
    [{ profiles: ['profile-1','profile-2'], type: 'connection', requestedBy: null, blockedBy: null, updatedAt: 2 }],
    { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
    [{ profiles: ['profile-1','community-1'], type: 'owner', requestedBy: null, blockedBy: null, updatedAt: 2 }]
  ]
  withFetch(t, async (input, options) => {
    const url = new URL(String(input))
    calls.push({ path: url.pathname, body: JSON.parse(options.body) })
    return new Response(JSON.stringify(responses[calls.length - 1]), { status: 200 })
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  assert.deepEqual(await repo.getProfileRelationships('account-1','profile-1'), responses[0])
  assert.deepEqual(await repo.getProfileFriends('profile-1',1), responses[1])
  assert.deepEqual(await repo.getCommunityRelationships('account-1','community-1'), responses[2])
  assert.deepEqual(calls.map(call => call.path), [
    '/rest/v1/rpc/nexus_get_profile_relationships',
    '/rest/v1/rpc/nexus_get_profile_friends',
    '/rest/v1/rpc/nexus_get_community_relationships'
  ])
})

test('reads community member and pending lists through their targeted RPCs', async t => {
  const calls = []
  const page = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
  withFetch(t, async (input, options) => {
    const url = new URL(String(input))
    calls.push({ path: url.pathname, body: JSON.parse(options.body) })
    return new Response(JSON.stringify(page), { status: 200 })
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.listCommunityMembers('community-1','staff',2,'account-1','profile-1')
  await repo.listPendingMembers('account-1','community-1','profile-1',3)
  assert.deepEqual(calls, [
    {
      path: '/rest/v1/rpc/nexus_list_community_members',
      body: {
        p_community_id: 'community-1', p_tab: 'staff', p_user_id: 'account-1',
        p_actor_profile_id: 'profile-1', p_page: 2
      }
    },
    {
      path: '/rest/v1/rpc/nexus_list_pending_members',
      body: {
        p_user_id: 'account-1', p_community_id: 'community-1',
        p_actor_profile_id: 'profile-1', p_page: 3
      }
    }
  ])
})


test('reads owned profiles, profile communities, community by URL and entity search through targeted RPCs', async t => {
  const calls = []
  const page = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
  const community = { id: 'community-1', name: 'Community', url: 'community', privacy: 'public' }
  const responses = [page, community, page, page]
  withFetch(t, async (input, options) => {
    const url = new URL(String(input))
    calls.push({ path: url.pathname, body: JSON.parse(options.body) })
    return new Response(JSON.stringify(responses[calls.length - 1]), { status: 200 })
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.getOwnedProfiles('account-1',2)
  assert.deepEqual(await repo.getCommunityByUrl('community','account-1'),community)
  await repo.getProfileCommunities('profile-1',3)
  await repo.searchEntities('term','all',4,'name-asc')
  assert.deepEqual(calls,[
    {path:'/rest/v1/rpc/nexus_get_owned_profiles',body:{p_user_id:'account-1',p_page:2}},
    {path:'/rest/v1/rpc/nexus_get_community_by_url',body:{p_url:'community',p_user_id:'account-1'}},
    {path:'/rest/v1/rpc/nexus_get_profile_communities',body:{p_profile_id:'profile-1',p_page:3}},
    {path:'/rest/v1/rpc/nexus_search_entities',body:{p_query:'term',p_scope:'all',p_page:4,p_sort:'name-asc'}}
  ])
})


test('reads legacy forum topic lists and details through targeted relational RPCs', async t => {
  const calls = []
  const topicPage = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
  const detail = {
    topic: { id: 'topic-1', replyCount: 0 },
    replies: { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
  }
  withFetch(t, async (input, options) => {
    const url = new URL(String(input))
    calls.push({ path: url.pathname, body: JSON.parse(options.body) })
    return new Response(JSON.stringify(calls.length === 1 ? topicPage : detail), { status: 200 })
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  assert.deepEqual(await repo.listCommunityForumTopics('community-1','account-1',2),topicPage)
  assert.deepEqual(await repo.getCommunityForumTopic('community-1','topic-1',null,3),detail)
  assert.deepEqual(calls,[
    {path:'/rest/v1/rpc/nexus_get_community_forum_topics',body:{p_community_id:'community-1',p_user_id:'account-1',p_page:2}},
    {path:'/rest/v1/rpc/nexus_get_community_forum_topic',body:{p_community_id:'community-1',p_topic_id:'topic-1',p_user_id:null,p_page:3}}
  ])
})


test('reads public profile lists, profile URL lookups and public community lists through paged RPCs', async t => {
  const calls = []
  const profilePage = { items: [], page: 2, pageSize: 20, totalItems: 21, totalPages: 2 }
  const profile = { id: 'profile-1', name: 'Profile', url: 'profile', picture: '', about: '', type: 'social', createdAt: 1, lastActivity: 2 }
  const communityPage = { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
  const responses = [profilePage, profile, communityPage]
  withFetch(t, async (input, options) => {
    const url = new URL(String(input))
    calls.push({ path: url.pathname, body: JSON.parse(options.body) })
    return new Response(JSON.stringify(responses[calls.length - 1]), { status: 200 })
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  assert.deepEqual(await repo.getProfilesPage(2), profilePage)
  assert.deepEqual(await repo.getProfileByUrl('profile'), profile)
  assert.deepEqual(await repo.getPublicCommunities(1), communityPage)
  assert.deepEqual(calls, [
    { path: '/rest/v1/rpc/nexus_list_profiles', body: { p_page: 2 } },
    { path: '/rest/v1/rpc/nexus_get_profile_by_url', body: { p_url: 'profile' } },
    { path: '/rest/v1/rpc/nexus_list_public_communities', body: { p_page: 1 } }
  ])
})


test('profile and community writes call targeted relational RPCs', async t => {
  const calls = []
  const profileRow = {
    id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
    about: '<p>About</p>', type: 'social', created_at_ms: 100, last_activity_ms: 100
  }
  const communityRow = {
    id: 'community-1', name: 'Community', url: 'community', picture: '',
    about: '<p>About</p>', type: 'social', privacy: 'public',
    created_at_ms: 200, last_activity_ms: 200
  }
  withFetch(t, async (input, options) => {
    const parsed = new URL(String(input))
    calls.push({ path: parsed.pathname, body: JSON.parse(options.body) })
    if (parsed.pathname.endsWith('/nexus_create_profile')) {
      return new Response(JSON.stringify([{
        account_id: 'account-1', email: 'person@example.test',
        profiles: ['profile-1'], current_profile_id: 'profile-1'
      }]), { status: 200 })
    }
    if (parsed.pathname.endsWith('/nexus_update_profile')) {
      return new Response(JSON.stringify([{ ...profileRow, previous_picture: 'https://old/avatar.png' }]), { status: 200 })
    }
    if (parsed.pathname.endsWith('/nexus_create_community')) {
      return new Response(JSON.stringify([communityRow]), { status: 200 })
    }
    if (parsed.pathname.endsWith('/nexus_update_community')) {
      return new Response(JSON.stringify([{ ...communityRow, previous_picture: null }]), { status: 200 })
    }
    throw new Error('Unexpected request: ' + parsed.pathname)
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  const profile = {
    id: 'profile-1', name: 'Profile', url: 'profile', picture: '',
    about: '<p>About</p>', type: 'social', createdAt: 100, lastActivity: 100
  }
  const user = await repo.createProfile({
    userId: 'account-1', profile, avatarPath: null, editorImageIds: ['image-1']
  })
  assert.deepEqual(user, {
    id: 'account-1', email: 'person@example.test',
    profiles: ['profile-1'], currentProfile: 'profile-1'
  })
  const updatedProfile = await repo.updateProfile({
    userId: 'account-1', profileId: 'profile-1', name: 'Profile', url: 'profile',
    picture: '', about: '<p>About</p>', lastActivity: 101, avatarPath: null,
    editorImageIds: ['image-1']
  })
  assert.equal(updatedProfile.profile.id, 'profile-1')
  assert.equal(updatedProfile.previousPicture, 'https://old/avatar.png')
  const createdCommunity = await repo.createCommunity({
    userId: 'account-1', ownerProfileId: 'profile-1', id: 'community-1',
    name: 'Community', url: 'community', picture: '', about: '<p>About</p>',
    privacy: 'public', createdAt: 200, avatarPath: null, editorImageIds: []
  })
  assert.equal(createdCommunity.id, 'community-1')
  const updatedCommunity = await repo.updateCommunity({
    userId: 'account-1', communityId: 'community-1', name: 'Community',
    url: 'community', picture: '', about: '<p>About</p>', privacy: null,
    lastActivity: 201, avatarPath: null, editorImageIds: []
  })
  assert.equal(updatedCommunity.community.id, 'community-1')
  assert.equal(updatedCommunity.previousPicture, null)
  assert.deepEqual(calls.map(call => call.path), [
    '/rest/v1/rpc/nexus_create_profile',
    '/rest/v1/rpc/nexus_update_profile',
    '/rest/v1/rpc/nexus_create_community',
    '/rest/v1/rpc/nexus_update_community'
  ])
  assert.equal(calls[0].body.p_editor_image_ids[0], 'image-1')
  assert.equal(calls[1].body.p_last_activity_ms, 101)
  assert.equal(calls[2].body.p_privacy, 'public')
  assert.equal(calls[3].body.p_privacy, null)
})


test('avatar changes use targeted media lookup and atomic relational RPCs', async t => {
  const calls = []
  withFetch(t, async (input, options) => {
    const parsed = new URL(String(input))
    if (options.method === 'GET') {
      calls.push({ path: parsed.pathname, method: 'GET', params: parsed.searchParams })
      return new Response(JSON.stringify([{ path: 'profiles/account-1/avatar.png' }]), { status: 200 })
    }
    calls.push({ path: parsed.pathname, method: 'POST', body: JSON.parse(options.body) })
    if (parsed.pathname.endsWith('/nexus_set_profile_avatar') ||
        parsed.pathname.endsWith('/nexus_set_community_avatar')) {
      return new Response(JSON.stringify([{ previous_picture: 'https://old/avatar.png' }]), { status: 200 })
    }
    throw new Error('Unexpected request: ' + parsed.pathname)
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  assert.equal(
    await repo.getAvatarUploadPath('account-1','upload-1','profile-avatar'),
    'profiles/account-1/avatar.png'
  )
  const profileResult = await repo.setProfileAvatar({
    userId:'account-1',profileId:'profile-1',uploadId:'upload-1',picture:'https://public/avatar.png'
  })
  const communityResult = await repo.setCommunityAvatar({
    userId:'account-1',communityId:'community-1',actorProfileId:'profile-1',
    uploadId:'upload-2',picture:'https://public/community.png'
  })
  assert.equal(profileResult.previousPicture,'https://old/avatar.png')
  assert.equal(communityResult.previousPicture,'https://old/avatar.png')
  assert.equal(calls[0].method,'GET')
  assert.equal(calls[0].params.get('owner_user_id'),'eq.account-1')
  assert.equal(calls[0].params.get('purpose'),'eq.profile-avatar')
  assert.equal(calls[1].body.p_upload_id,'upload-1')
  assert.equal(calls[2].body.p_actor_profile_id,'profile-1')
})


test('routes media upload lifecycle and authorized editor image reads through row-scoped RPCs', async t => {
  const calls = []
  const mediaRow = {
    id: 'upload-1', owner_user_id: 'account-1', purpose: 'editor-image',
    bucket: 'nexus-editor-images', path: 'editor/account-1/upload-1.png',
    content_type: 'image/png', expected_size: 10, size: 10, status: 'ready',
    deleting_at_ms: null, delete_after_ms: null, created_at_ms: 100,
    completed_at_ms: 200, expires_at_ms: 900, resource_type: 'profile',
    resource_id: 'profile-1', message_from_profile_id: null, message_to_profile_id: null
  }
  withFetch(t, async (input, options) => {
    const parsed = new URL(String(input))
    const body = options.body ? JSON.parse(options.body) : null
    calls.push({ path: parsed.pathname, body })
    if (parsed.pathname.endsWith('/media_files')) return new Response(JSON.stringify([mediaRow]), { status: 200 })
    if (parsed.pathname.endsWith('/nexus_create_upload')) return new Response(null, { status: 204 })
    if (parsed.pathname.endsWith('/nexus_delete_pending_upload')) return new Response(null, { status: 204 })
    if (parsed.pathname.endsWith('/nexus_complete_upload')) return new Response(JSON.stringify([mediaRow]), { status: 200 })
    if (parsed.pathname.endsWith('/nexus_claim_expired_uploads')) return new Response(JSON.stringify([mediaRow]), { status: 200 })
    if (parsed.pathname.endsWith('/nexus_finish_upload_deletions')) return new Response('1', { status: 200 })
    if (parsed.pathname.endsWith('/nexus_schedule_upload_deletion')) return new Response('true', { status: 200 })
    if (parsed.pathname.endsWith('/nexus_claim_upload_deletion')) return new Response(JSON.stringify([mediaRow]), { status: 200 })
    if (parsed.pathname.endsWith('/nexus_schedule_previous_avatar_deletion')) return new Response(null, { status: 204 })
    if (parsed.pathname.endsWith('/nexus_get_editor_image')) return new Response(JSON.stringify([mediaRow]), { status: 200 })
    throw new Error('Unexpected request: ' + parsed.pathname)
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  const record = {
    id: 'upload-1', ownerUserId: 'account-1', purpose: 'editor-image',
    bucket: 'nexus-editor-images', path: 'editor/account-1/upload-1.png',
    contentType: 'image/png', expectedSize: 10, size: null, status: 'pending',
    createdAt: 100, completedAt: null, expiresAt: null, resourceType: null,
    resourceId: null, messageFromProfileId: null, messageToProfileId: null
  }
  await repo.createUpload({ record, targetId: null, actorProfileId: null })
  assert.equal((await repo.getUploadById('account-1', 'upload-1')).id, 'upload-1')
  await repo.deletePendingUpload('account-1', 'upload-1')
  assert.equal((await repo.completeUpload({
    userId: 'account-1', id: 'upload-1', size: 10,
    completedAt: 200, expiresAt: 900, pendingMaxAge: 7200000
  })).status, 'ready')
  assert.equal((await repo.claimExpiredUploads({
    now: 1000, claimLeaseMs: 300000, safeAge: 10800000,
    orphanAvatarRetentionMs: 86400000, limit: 1000
  })).length, 1)
  assert.equal(await repo.finishUploadDeletions([{ id: 'upload-1', deletingAt: 1000 }]), 1)
  assert.equal(await repo.scheduleUploadDeletion({
    id: 'upload-1', userId: 'account-1', scheduledAt: 1000,
    allowReady: true, safeAge: 10800000, leaseMs: 300000
  }), true)
  assert.equal((await repo.claimUploadDeletion({
    id: 'upload-1', userId: 'account-1', deletingAt: 1100
  })).id, 'upload-1')
  await repo.schedulePreviousAvatarDeletion({
    path: 'profiles/account-1/avatar.png', keepId: null,
    deletingAt: 1200, safeAge: 10800000, leaseMs: 300000
  })
  assert.equal((await repo.getEditorImageRecord({
    userId: null, id: 'upload-1', now: 300
  })).resourceId, 'profile-1')
  assert.deepEqual(calls.map(call => call.path), [
    '/rest/v1/rpc/nexus_create_upload',
    '/rest/v1/media_files',
    '/rest/v1/rpc/nexus_delete_pending_upload',
    '/rest/v1/rpc/nexus_complete_upload',
    '/rest/v1/rpc/nexus_claim_expired_uploads',
    '/rest/v1/rpc/nexus_finish_upload_deletions',
    '/rest/v1/rpc/nexus_schedule_upload_deletion',
    '/rest/v1/rpc/nexus_claim_upload_deletion',
    '/rest/v1/rpc/nexus_schedule_previous_avatar_deletion',
    '/rest/v1/rpc/nexus_get_editor_image'
  ])
})


test('creates accounts with their first refresh token and updates preferences through targeted RPCs', async t => {
  const calls = []
  withFetch(t, async (input, options) => {
    const parsed = new URL(String(input))
    calls.push({ path: parsed.pathname, body: JSON.parse(options.body) })
    if (parsed.pathname.endsWith('/nexus_create_account_with_refresh_token')) {
      return new Response(null, { status: 204 })
    }
    if (parsed.pathname.endsWith('/nexus_update_account_preferences')) {
      return new Response(JSON.stringify([{ language: 'pt-BR', theme: 'dark' }]), { status: 200 })
    }
    throw new Error('Unexpected request: ' + parsed.pathname)
  })
  const repo = new SupabaseRelationalRepository(url, key, secret)
  await repo.createAccountWithRefreshToken({
    accountId: 'account-1',
    email: 'person@example.test',
    passwordHash: 'hash',
    passwordSalt: 'salt',
    refreshToken: {
      id: 'refresh-1', userId: 'account-1', tokenHash: 'token-hash',
      expiresAt: 1700000000000
    },
    now: 1699990000000
  })
  assert.deepEqual(await repo.updateAccountPreferences('account-1', {
    language: 'pt-BR', theme: 'dark'
  }), { language: 'pt-BR', theme: 'dark' })
  assert.deepEqual(calls.map(call => call.path), [
    '/rest/v1/rpc/nexus_create_account_with_refresh_token',
    '/rest/v1/rpc/nexus_update_account_preferences'
  ])
  assert.equal(calls[0].body.p_refresh_token_id, 'refresh-1')
  assert.equal(calls[1].body.p_language, 'pt-BR')
})
