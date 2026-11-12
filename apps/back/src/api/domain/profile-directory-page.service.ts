import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { ProfileDirectoryPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { PaginationDto } from '../pagination/pagination.dto'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class ProfileDirectoryPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getProfileDirectoryPage(
    url: string,
    kind: string,
    query: PaginationDto,
    userId: string | null
  ): Promise<ProfileDirectoryPageData> {
    if (kind !== 'friends' && kind !== 'communities') {
      throw new BadRequestException('INVALID_PROFILE_DIRECTORY')
    }
    return this.data.getProfileDirectoryPage(
      normalizeEntityUrl(url),
      kind,
      userId,
      query.page,
      query.query,
      query.sort
    ).then(page => {
      if (page.kind === 'friends') {
        return {
          ...page,
          profile: page.profile ? {
            ...page.profile,
            about: sanitizeRichText(page.profile.about ?? '')
          } : null,
          friends: {
            ...page.friends,
            items: page.friends.items.map(friend => ({
              ...friend,
              about: sanitizeRichText(friend.about ?? '')
            }))
          }
        }
      }
      return {
        ...page,
        profile: page.profile ? {
          ...page.profile,
          about: sanitizeRichText(page.profile.about ?? '')
        } : null,
        communities: {
          ...page.communities,
          items: page.communities.items.map(community => ({
            ...community,
            about: sanitizeRichText(community.about ?? '')
          }))
        }
      }
    }).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      throw error
    })
  }
}
