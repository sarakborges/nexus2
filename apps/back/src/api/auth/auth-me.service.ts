import { Injectable } from '@nestjs/common'
import type { AuthMeResponse } from '@nexus/common'
import { AuthService } from './auth.service'
import { ActivityService } from '../domain/activity.service'
import { DomainAccessService } from '../domain/domain-access.service'
import { ProfileSettingsService } from '../domain/profile-settings.service'

@Injectable()
export class AuthMeService {
  constructor(
    private readonly auth: AuthService,
    private readonly activity: ActivityService,
    private readonly access: DomainAccessService,
    private readonly profileSettings: ProfileSettingsService
  ) {}

  async getMe(userId: string): Promise<AuthMeResponse> {
    const user = await this.auth.getUser(userId)
    const currentProfileId = user.currentProfile && user.profiles.includes(user.currentProfile)
      ? user.currentProfile
      : null

    const [profiles, activityPage, currentProfileSettings, suggestedCommunities] = await Promise.all([
      currentProfileId ? this.access.readProfilesByIds([currentProfileId]) : Promise.resolve([]),
      currentProfileId
        ? this.activity.getRecentActivityPage(userId, 10)
        : Promise.resolve({ items: [], nextCursor: null, hasMore: false }),
      currentProfileId
        ? this.profileSettings.getSettings(userId, currentProfileId)
        : Promise.resolve(null),
      currentProfileId
        ? this.access.readSuggestedCommunities(currentProfileId)
        : Promise.resolve([])
    ])

    return {
      user,
      currentProfile: profiles[0] ?? null,
      currentProfileSettings,
      suggestedCommunities,
      activities: activityPage.items,
      activityCursor: activityPage.nextCursor,
      hasMoreActivities: activityPage.hasMore
    }
  }
}
