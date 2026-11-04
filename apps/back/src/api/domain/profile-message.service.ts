import { ConflictException, Inject, Injectable, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { PaginatedResult, Profile, ProfileMessage } from '@nexus/common'
import { DATA_REPOSITORY, type DataRepository } from '../../storage/repository.interface'
import { AuthService } from '../auth/auth.service'
import { paginate, type PaginationDto } from '../pagination/pagination.dto'
import { getRichTextPlainText, sanitizeRichText } from './rich-text-sanitizer'
import { UploadsService, type UploadedFileRecord } from '../uploads/uploads.service'
import { DomainAccessService } from './domain-access.service'
import type { AccountRecord } from '../auth/auth.types'

@Injectable()
export class ProfileMessageService {
  constructor(
    @Inject(DATA_REPOSITORY) private readonly data: DataRepository,
    private readonly auth: AuthService,
    private readonly access: DomainAccessService,
    @Optional() private readonly uploads?: UploadsService
  ) {}

  async getMessages(profileId: string, userId: string | null, q: PaginationDto): Promise<PaginatedResult<ProfileMessage>> {
    const messages = await this.readMessages()
    const viewerProfiles = userId ? (await this.auth.getUser(userId)).profiles : []
    const own = viewerProfiles.includes(profileId)
    const visible = messages.filter(m => m.toProfileId === profileId && (own || viewerProfiles.includes(m.fromProfileId)))
      .sort((a, b) => b.createdAt - a.createdAt)
    return paginate(visible, q)
  }
  async sendMessage(userId: string, fromProfileId: string, toProfileId: string, content: string): Promise<ProfileMessage> {
    await this.access.assertOwns(userId, fromProfileId)
    const initialProfiles = await this.access.readProfiles()
    this.access.assertSameType(
      initialProfiles.find(profile => profile.id === fromProfileId),
      initialProfiles.find(profile => profile.id === toProfileId)
    )
    const normalized = sanitizeRichText(content)
    await this.uploads?.validateEditorImages(userId, normalized)
    const plainText = getRichTextPlainText(normalized)
    const hasImage = /<img\b/i.test(normalized)
    const message: ProfileMessage = {
      id: randomUUID(),
      fromProfileId,
      toProfileId,
      content: normalized,
      createdAt: Date.now()
    }

    return this.data.transaction<ProfileMessage>(
      ['accounts', 'profiles', 'profile_messages', 'media_files'],
      collections => {
        const accounts = collections.accounts as AccountRecord[]
        const profiles = collections.profiles as Profile[]
        const messages = collections.profile_messages as ProfileMessage[]
        const mediaFiles = collections.media_files as UploadedFileRecord[]
        this.access.assertOwnsInRecords(userId, fromProfileId, accounts, profiles)
        this.access.assertSameType(
          profiles.find(profile => profile.id === fromProfileId),
          profiles.find(profile => profile.id === toProfileId)
        )
        if ((!plainText && !hasImage) || plainText.length > 4000 || normalized.length > 12000) {
          throw new ConflictException('INVALID_MESSAGE')
        }

        const nextMediaFiles = this.uploads
          ? this.uploads.attachEditorImagesToRecords(
              mediaFiles,
              userId,
              normalized,
              'profile-message',
              message.id,
              { fromProfileId, toProfileId }
            )
          : mediaFiles
        return {
          records: {
            ...collections,
            profile_messages: [...messages, message],
            media_files: nextMediaFiles
          },
          result: message
        }
      }
    )
  }


  private async readMessages(): Promise<ProfileMessage[]> {
    const messages = await this.data.read<ProfileMessage>('profile_messages')
    return messages.map(message => ({
      ...message,
      content: sanitizeRichText(message.content ?? '')
    }))
  }
}
