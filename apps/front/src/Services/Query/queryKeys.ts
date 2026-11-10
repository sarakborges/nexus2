export const queryKeys = {
  home: (userId: string) => ['home', userId] as const,
  search: (query: string, scope: string, sort: string, page: number, pageSize: number) =>
    ['search', query, scope, sort, page, pageSize] as const,
  communitiesPage: (
    userId: string,
    currentProfileId: string | null,
    page: number,
    pageSize: number,
    query: string,
    sort: string
  ) => ['communities-page', userId, currentProfileId, page, pageSize, query, sort] as const,
  profilePage: (url: string, viewerUserId: string | null, currentProfileId: string | null) =>
    ['profile-page', url, viewerUserId, currentProfileId] as const,
  profileMessagesPage: (
    url: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null,
    currentProfileId: string | null,
    query: string,
    sort: string,
    messageTab: 'all' | 'favorites'
  ) => ['profile-messages-page', url, page, pageSize, viewerUserId, currentProfileId, query, sort, messageTab] as const,
  profileDirectoryPage: (
    url: string,
    kind: 'friends' | 'communities',
    page: number,
    pageSize: number,
    viewerUserId: string | null,
    currentProfileId: string | null,
    query: string,
    sort: string
  ) => ['profile-directory-page', url, kind, page, pageSize, viewerUserId, currentProfileId, query, sort] as const,
  communityForumComposerPage: (
    url: string,
    viewerUserId: string | null,
    currentProfileId: string | null
  ) => ['community-forum-composer-page', url, viewerUserId, currentProfileId] as const,
  communityEditPage: (
    url: string,
    viewerUserId: string | null,
    currentProfileId: string | null
  ) => ['community-edit-page', url, viewerUserId, currentProfileId] as const,
  profileEditPage: (
    url: string,
    viewerUserId: string | null,
    currentProfileId: string | null
  ) => ['profile-edit-page', url, viewerUserId, currentProfileId] as const,
  communityPage: (url: string, viewerUserId: string | null, currentProfileId: string | null) =>
    ['community-page', url, viewerUserId, currentProfileId] as const,
  communityForumPage: (
    url: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null,
    currentProfileId: string | null,
    query: string,
    sort: string
  ) =>
    ['community-forum-page', url, page, pageSize, viewerUserId, currentProfileId, query, sort] as const,
  communityForumTopicPage: (
    url: string,
    topicId: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null,
    currentProfileId: string | null,
    query: string,
    sort: string
  ) =>
    ['community-forum-topic-page', url, topicId, page, pageSize, viewerUserId, currentProfileId, query, sort] as const,
  communityMembersPage: (
    url: string,
    tab: string,
    page: number,
    pendingPage: number,
    viewerUserId: string | null,
    profileIds: string[],
    currentProfileId: string | null,
    query: string,
    sort: string
  ) =>
    ['community-members-page', url, tab, page, pendingPage, viewerUserId, [...profileIds].sort(), currentProfileId, query, sort] as const,
  activity: {
    recent: (userId: string) => ['activity', 'recent', userId] as const
  },
  auth: {
    session: ['auth', 'session'] as const,
    preferences: (userId: string) => ['auth', 'preferences', userId] as const
  },
  profiles: {
    owned: (userId: string, page: number, pageSize: number) =>
      ['profiles', 'owned', userId, page, pageSize] as const,
    byUrl: (url: string) => ['profiles', 'by-url', url] as const,
    byIds: (ids: string[]) => ['profiles', 'by-ids', [...ids].sort()] as const,
    byId: (id: string | null) => ['profiles', 'by-id', id] as const,
    currentType: (profileId: string) =>
      ['profiles', 'current-type', profileId] as const
  },
  communities: {
    list: (page: number, pageSize: number) =>
      ['communities', 'list', page, pageSize] as const,
    byUrl: (url: string, viewerUserId: string | null = null) =>
      ['communities', 'by-url', url, viewerUserId] as const,
    byIds: (ids: string[]) =>
      ['communities', 'by-ids', [...ids].sort()] as const,
    byProfile: (profileId: string, page: number, pageSize: number) =>
      ['communities', 'by-profile', profileId, page, pageSize] as const
  },
  relationships: {
    byProfile: (profileId: string) =>
      ['relationships', 'by-profile', profileId] as const,
    friends: (profileId: string, page: number, pageSize: number) =>
      ['relationships', 'friends', profileId, page, pageSize] as const
  },
  communityRelationships: (communityId: string, userId: string | null) =>
    ['community-relationships', communityId, userId] as const,
  communityMembers: (
    communityId: string,
    tab: string,
    page: number,
    pageSize: number,
    actorProfileId?: string,
    viewerUserId: string | null = null
  ) =>
    [
      'community-members',
      communityId,
      tab,
      page,
      pageSize,
      actorProfileId ?? null,
      viewerUserId
    ] as const,
  pendingCommunityMembers: (
    communityId: string,
    actorProfileId: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null = null
  ) =>
    [
      'community-members',
      communityId,
      'pending',
      actorProfileId,
      page,
      pageSize,
      viewerUserId
    ] as const,
  profileMessages: (
    profileId: string,
    viewerUserId: string | null,
    page: number,
    pageSize: number
  ) => ['profile-messages', profileId, viewerUserId, page, pageSize] as const,
  communityForumTopics: (
    communityId: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null = null
  ) =>
    ['community-forum', communityId, 'topics', page, pageSize, viewerUserId] as const,
  communityForumTopic: (
    communityId: string,
    topicId: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null = null
  ) =>
    [
      'community-forum',
      communityId,
      'topic',
      topicId,
      page,
      pageSize,
      viewerUserId
    ] as const
}
