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
    let user = await this.auth.getUser(userId)
    const currentProfileId = user.currentProfile && user.profiles.includes(user.currentProfile)
      ? user.currentProfile
      : user.profiles[0] ?? null

    // Keep the API session and accounts.current_profile_id aligned. Page RPCs
    // use the persisted selection to resolve the acting profile and ownership.
    if (currentProfileId && user.currentProfile !== currentProfileId) {
      user = await this.auth.updateCurrentProfile(userId, currentProfileId)
    }

    const [profiles, activityPage, currentProfileSettings, suggestedCommunities] = await Promise.all([
      currentProfileId ? this.access.readProfilesByIds([currentProfileId]) : Promise.resolve([]),
      this.activity.getRecentActivityPage(userId, 10),
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
