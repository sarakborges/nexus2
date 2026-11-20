import { createHmac, timingSafeEqual } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type PublicRealtimeConfig =
  | { enabled: false }
  | { enabled: true; supabaseUrl: string; publishableKey: string }

const TOPIC_CHANGE_SIGNATURE_CONTEXT = 'nexus:forum-topic-changed:v1'
const TOPIC_CHANGE_MAX_AGE_MS = 2 * 60 * 1000
const TOPIC_CHANGE_FUTURE_SKEW_MS = 30 * 1000
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/

@Injectable()
export class CommunityForumRealtimeService {
  private readonly logger = new Logger(CommunityForumRealtimeService.name)

  constructor(private readonly config: ConfigService) {}

  getPublicConfig(): PublicRealtimeConfig {
    const configuredUrl = this.config.get<string>('SUPABASE_URL')
    const publishableKey = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY')
    if (!configuredUrl || !publishableKey) return { enabled: false }

    return {
      enabled: true,
      supabaseUrl: new URL(configuredUrl).origin,
      publishableKey
    }
  }

  verifyTopicChanged(topicId: string, changedAt: number, signature: string): boolean {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET')?.trim()
    if (!secret || !Number.isSafeInteger(changedAt) || !SIGNATURE_PATTERN.test(signature)) {
      return false
    }

    const now = Date.now()
    if (
      changedAt < now - TOPIC_CHANGE_MAX_AGE_MS ||
      changedAt > now + TOPIC_CHANGE_FUTURE_SKEW_MS
    ) {
      return false
    }

    const expected = Buffer.from(
      this.createTopicChangedSignature(topicId, changedAt, secret),
      'base64url'
    )
    const supplied = Buffer.from(signature, 'base64url')
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  }

  async publishTopicChanged(topicId: string): Promise<void> {
    try {
      const config = this.getPublicConfig()
      const storageSecret = this.config.get<string>('SUPABASE_STORAGE_SECRET_KEY')
      const signingSecret = this.config.get<string>('JWT_REFRESH_SECRET')?.trim()
      if (!config.enabled || !storageSecret || !signingSecret) return

      const changedAt = Date.now()
      const signature = this.createTopicChangedSignature(topicId, changedAt, signingSecret)
      const topic = `nexus-forum-topic-${topicId}`
      const endpoint = new URL('/realtime/v1/api/broadcast', config.supabaseUrl)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: storageSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{
            topic,
            event: 'topic_changed',
            payload: { changedAt, signature }
          }]
        })
      })

      if (!response.ok) {
        this.logger.warn(`Realtime notification for topic ${topicId} failed (HTTP ${response.status}).`)
      }
    } catch (error) {
      this.logger.warn(
        `Realtime notification for topic ${topicId} failed: ${error instanceof Error ? error.message : 'unknown error'}`
      )
    }
  }

  private createTopicChangedSignature(topicId: string, changedAt: number, secret: string): string {
    return createHmac('sha256', secret)
      .update(`${TOPIC_CHANGE_SIGNATURE_CONTEXT}\n${topicId}\n${changedAt}`)
      .digest('base64url')
  }
}
