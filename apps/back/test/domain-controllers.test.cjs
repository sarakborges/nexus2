require('reflect-metadata')

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { RequestMethod } = require('@nestjs/common')
const { METHOD_METADATA, PATH_METADATA } = require('@nestjs/common/constants')
const { DomainController } = require('../dist/api/domain/domain.controller.js')
const { ProfilesController } = require('../dist/api/domain/profiles.controller.js')
const { ProfileMessagesController } = require('../dist/api/domain/profile-messages.controller.js')
const { CommunitiesController } = require('../dist/api/domain/communities.controller.js')
const { RelationshipsController } = require('../dist/api/domain/relationships.controller.js')

const controllers = [
  DomainController,
  ProfilesController,
  ProfileMessagesController,
  CommunitiesController,
  RelationshipsController
]

const expectedRoutes = [
  'GET search',
  'GET home',
  'GET activity',
  'GET profiles/by-url/:url/directory/:kind/page',
  'GET profiles/by-url/:url/edit/page',
  'GET profiles/by-url/:url/page',
  'GET profiles',
  'GET profiles/owned',
  'GET profiles/by-url/:url',
  'GET profiles/ids',
  'POST profiles',
  'PUT profiles/:profileId',
  'GET profiles/by-url/:url/messages/page',
  'GET profiles/:profileId/messages',
  'POST profiles/:profileId/messages',
  'DELETE profiles/:profileId/messages/:messageId',
  'PUT profiles/:profileId/messages/:messageId/favorite',
  'POST profiles/:profileId/posts',
  'GET communities/by-url/:url/page',
  'GET communities/by-url/:url/forum/page',
  'GET communities/by-url/:url/forum/composer-page',
  'GET communities/by-url/:url/edit/page',
  'GET communities/page',
  'GET communities',
  'GET communities/by-url/:url',
  'GET communities/ids',
  'GET communities/profile/:profileId',
  'POST communities',
  'PUT communities/:communityId',
  'GET communities/:communityId/forum/topics',
  'GET communities/by-url/:url/members/page',
  'GET communities/by-url/:url/forum/topics/:topicId/page',
  'GET communities/:communityId/forum/topics/:topicId',
  'POST communities/:communityId/forum/topics',
  'POST communities/:communityId/forum/topics/:topicId/replies',
  'PUT communities/:communityId/forum/topics/:topicId/moderation',
  'DELETE communities/:communityId/forum/topics/:topicId',
  'DELETE communities/:communityId/forum/replies/:replyId',
  'GET relationships',
  'GET relationships/friends/:profileId',
  'POST relationships',
  'POST relationships/remove',
  'GET communities/:communityId/relationships',
  'GET communities/:communityId/members/pending',
  'GET communities/:communityId/members',
  'POST communities/:communityId/relationships/:profileId',
  'POST communities/:communityId/relationships/:profileId/remove',
  'POST communities/:communityId/moderators/:profileId/demote',
  'POST communities/:communityId/ownership-transfer'
]

test('domain controllers preserve the complete HTTP route inventory', () => {
  const routes = controllers.flatMap(ControllerClass =>
    Object.getOwnPropertyNames(ControllerClass.prototype).flatMap(methodName => {
      const handler = ControllerClass.prototype[methodName]
      if (typeof handler !== 'function') return []

      const path = Reflect.getMetadata(PATH_METADATA, handler)
      if (path === undefined) return []

      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)]
      return (Array.isArray(path) ? path : [path]).map(route => `${method} ${route}`)
    })
  )

  assert.deepEqual(routes.sort(), expectedRoutes.sort())
})
