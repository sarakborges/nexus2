import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import type { ProfileMessagesPageData } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import type { ProfileMessagesPageDto } from './domain.dto'
import { normalizeEntityUrl } from './domain.utils'
import { sanitizeRichText } from './rich-text-sanitizer'

@Injectable()
export class ProfileMessagesPageService {
  constructor(@Inject(DATA_REPOSITORY) private readonly data: DataRepository) {}

  getProfileMessagesPage(
    profileUrl: string,
    query: ProfileMessagesPageDto,
    userId: string | null
  ): Promise<ProfileMessagesPageData> {
    return this.data.getProfileMessagesPage(
      normalizeEntityUrl(profileUrl),
      userId,
      query.page,
      query.query,
      query.sort,
      query.messageTab
    ).then(page => ({
      ...page,
      profile: page.profile ? {
        ...page.profile,
        about: sanitizeRichText(page.profile.about ?? '')
      } : null,
      messages: {
        ...page.messages,
        items: page.messages.items.map(message => ({
          ...message,
          content: sanitizeRichText(message.content ?? ''),
          isFavorite: message.isFavorite === true
        }))
      },
      senders: page.senders.map(sender => ({
        ...sender,
        about: sanitizeRichText(sender.about ?? '')
      }))
    })).catch(error => {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('ACCOUNT_NOT_FOUND')) {
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND')
      }
      throw error
    })
  }
}
