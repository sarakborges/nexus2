export const queryKeys = {
  home: (userId: string) => ['home', userId] as const,
  profilePage: (url: string) => ['profile-page', url] as const,
  profileMessagesPage: (
    url: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null
  ) => ['profile-messages-page', url, page, pageSize, viewerUserId] as const,
  profileDirectoryPage: (
    url: string,
    kind: 'friends' | 'communities',
    page: number,
    pageSize: number
  ) => ['profile-directory-page', url, kind, page, pageSize] as const,
  communityPage: (url: string, viewerUserId: string | null) =>
    ['community-page', url, viewerUserId] as const,
  communityForumPage: (
    url: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null,
    currentProfileId: string | null
  ) =>
    ['community-forum-page', url, page, pageSize, viewerUserId, currentProfileId] as const,
  communityForumTopicPage: (
    url: string,
    topicId: string,
    page: number,
    pageSize: number,
    viewerUserId: string | null,
    currentProfileId: string | null
  ) =>
    ['community-forum-topic-page', url, topicId, page, pageSize, viewerUserId, currentProfileId] as const,
  communityMembersPage: (
    url: string,
    tab: string,
    page: number,
    pendingPage: number,
    viewerUserId: string | null,
    profileIds: string[]
  ) =>
    ['community-members-page', url, tab, page, pendingPage, viewerUserId, [...profileIds].sort()] as const,
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
