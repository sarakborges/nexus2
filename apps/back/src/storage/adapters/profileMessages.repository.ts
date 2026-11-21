import type { ListSort, PaginatedResult, ProfileMessage, ProfileMessageFavoriteChange, ProfileMessageRemoval, ProfileMessageWrite, ProfileMessagesPageData } from '../repository.types'
import { SupabaseRepositoryClient } from '../supabase-repository.client'
import type { ProfileMessagesRepository } from '../contracts/profileMessages.repository.interface'

export class SupabaseProfileMessagesRepository extends SupabaseRepositoryClient implements ProfileMessagesRepository {
  constructor(projectUrl: string, publishableKey: string, apiSecret: string) {
    super(projectUrl, publishableKey, apiSecret)
  }

  async createProfileMessage(change: ProfileMessageWrite): Promise<ProfileMessage> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_send_profile_message', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_message_id: change.message.id,
        p_from_profile_id: change.message.fromProfileId,
        p_to_profile_id: change.message.toProfileId,
        p_content: change.message.content,
        p_created_at_ms: change.message.createdAt,
        p_image_ids: [...change.imageIds]
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase profile message write returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.from_profile_id !== 'string' ||
      typeof row.to_profile_id !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      typeof row.is_favorite !== 'boolean'
    ) {
      throw new Error('Supabase profile message write returned an invalid row.')
    }
    return {
      id: row.id,
      fromProfileId: row.from_profile_id,
      toProfileId: row.to_profile_id,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      isFavorite: row.is_favorite
    }
  }

  async deleteProfileMessage(change: ProfileMessageRemoval): Promise<void> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_delete_profile_message', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_recipient_profile_id: change.recipientProfileId,
        p_message_id: change.messageId,
        p_actor_profile_id: change.actorProfileId
      })
    })
    await this.assertSuccess(response)
  }

  async setProfileMessageFavorite(change: ProfileMessageFavoriteChange): Promise<ProfileMessage> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_set_profile_message_favorite', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_user_id: change.userId,
        p_recipient_profile_id: change.recipientProfileId,
        p_message_id: change.messageId,
        p_actor_profile_id: change.actorProfileId,
        p_is_favorite: change.isFavorite
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new Error('Supabase profile message favorite returned an invalid result.')
    }
    const row = rows[0] as Record<string, unknown>
    if (
      typeof row.id !== 'string' ||
      typeof row.from_profile_id !== 'string' ||
      typeof row.to_profile_id !== 'string' ||
      typeof row.content !== 'string' ||
      !Number.isFinite(Number(row.created_at_ms)) ||
      typeof row.is_favorite !== 'boolean'
    ) {
      throw new Error('Supabase profile message favorite returned an invalid row.')
    }
    return {
      id: row.id,
      fromProfileId: row.from_profile_id,
      toProfileId: row.to_profile_id,
      content: row.content,
      createdAt: Number(row.created_at_ms),
      isFavorite: row.is_favorite
    }
  }

  async getProfileMessages(
    profileId: string,
    userId: string | null,
    page: number
  ): Promise<import('@nexus/common').PaginatedResult<ProfileMessage>> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_messages', {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_profile_id: profileId,
        p_user_id: userId,
        p_page: page
      })
    })
    await this.assertSuccess(response)

    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) {
      throw new Error('Supabase profile messages read returned an invalid page.')
    }
    if (rows.length === 0) {
      return { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 }
    }

    const metadata = rows[0] as Record<string, unknown>
    const totalItems = Number(metadata.total_items)
    const currentPage = Number(metadata.page)
    const pageSize = Number(metadata.page_size)
    const totalPages = Number(metadata.total_pages)
    if (
      !Number.isSafeInteger(totalItems) || totalItems < 1 ||
      !Number.isSafeInteger(currentPage) || currentPage < 1 ||
      pageSize !== 20 ||
      !Number.isSafeInteger(totalPages) || totalPages < 1
    ) {
      throw new Error('Supabase profile messages read returned invalid pagination metadata.')
    }

    const items = rows.map(value => {
      const row = value as Record<string, unknown>
      if (
        typeof row.id !== 'string' ||
        typeof row.from_profile_id !== 'string' ||
        typeof row.to_profile_id !== 'string' ||
        typeof row.content !== 'string' ||
        !Number.isFinite(Number(row.created_at_ms)) ||
        typeof row.is_favorite !== 'boolean'
      ) {
        throw new Error('Supabase profile messages read returned an invalid row.')
      }
      return {
        id: row.id,
        fromProfileId: row.from_profile_id,
        toProfileId: row.to_profile_id,
        content: row.content,
        createdAt: Number(row.created_at_ms),
        isFavorite: row.is_favorite
      }
    })

    return {
      items,
      page: currentPage,
      pageSize,
      totalItems,
      totalPages
    }
  }

  async getProfileMessagesPage(
    url: string,
    userId: string | null,
    page: number,
    query: string | undefined,
    sort: ListSort,
    messageTab: 'all' | 'favorites'
  ): Promise<ProfileMessagesPageData> {
    const response = await this.fetchWithTimeout(this.baseUrl + '/rest/v1/rpc/nexus_get_profile_messages_page', {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_url: url,
        p_user_id: userId,
        p_page: page,
        p_query: query ?? null,
        p_sort: sort,
        p_message_tab: messageTab
      })
    })
    await this.assertSuccess(response)

    const result: unknown = await response.json()
    if (typeof result !== 'object' || result === null) {
      throw new Error('Supabase profile messages page returned an invalid result.')
    }
    const record = result as Record<string, unknown>
    const messages = record.messages as Record<string, unknown> | null
    if (
      !messages || typeof messages !== 'object' ||
      !Array.isArray(messages.items) ||
      !Array.isArray(record.senders) ||
      typeof record.messagePermissions !== 'object' ||
      record.messagePermissions === null ||
      typeof record.isProfileOwner !== 'boolean' ||
      (record.messageTab !== 'all' && record.messageTab !== 'favorites')
    ) {
      throw new Error('Supabase profile messages page returned invalid data.')
    }
    const pageResult = result as ProfileMessagesPageData
    if (
      pageResult.messages.pageSize !== 20 ||
      !Number.isSafeInteger(pageResult.messages.totalItems) ||
      !Number.isSafeInteger(pageResult.messages.totalPages)
    ) {
      throw new Error('Supabase profile messages page returned invalid pagination metadata.')
    }
    return pageResult
  }
}
