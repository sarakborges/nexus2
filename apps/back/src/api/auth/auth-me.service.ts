import { Injectable } from '@nestjs/common'
import type { AuthMeResponse } from '@nexus/common'
import { AuthService } from './auth.service'
import { ActivityService } from '../domain/activity.service'
import { DomainAccessService } from '../domain/domain-access.service'

@Injectable()
export class AuthMeService {
  constructor(
    private readonly auth: AuthService,
    private readonly activity: ActivityService,
    private readonly access: DomainAccessService
  ) {}

  async getMe(userId: string): Promise<AuthMeResponse> {
    const user = await this.auth.getUser(userId)
    const currentProfileId = user.currentProfile && user.profiles.includes(user.currentProfile)
      ? user.currentProfile
      : user.profiles[0] ?? null

    const [profiles, activityPage] = await Promise.all([
      currentProfileId ? this.access.readProfilesByIds([currentProfileId]) : Promise.resolve([]),
      this.activity.getRecentActivityPage(userId, 10)
    ])

    return {
      user,
      currentProfile: profiles[0] ?? null,
      activities: activityPage.items,
      activityCursor: activityPage.nextCursor,
      hasMoreActivities: activityPage.hasMore
    }
  }
}
