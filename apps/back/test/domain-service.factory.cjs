const { DomainService } = require('../dist/api/domain/domain.service.js')
const { ActivityService } = require('../dist/api/domain/activity.service.js')
const { CommunityForumService } = require('../dist/api/domain/community-forum.service.js')
const { CommunityService } = require('../dist/api/domain/community.service.js')
const { DomainAccessService } = require('../dist/api/domain/domain-access.service.js')
const { ProfileMessageService } = require('../dist/api/domain/profile-message.service.js')
const { ProfileService } = require('../dist/api/domain/profile.service.js')

function createDomainService(data, auth = {}, uploads) {
  const access = new DomainAccessService(data)

  return new DomainService(
    data,
    new ProfileService(data, auth, access, uploads),
    new CommunityService(data, auth, access, uploads),
    new CommunityForumService(data, uploads),
    new ProfileMessageService(data, uploads),
    new ActivityService(data)
  )
}

module.exports = { createDomainService }
