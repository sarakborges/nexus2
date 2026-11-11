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
