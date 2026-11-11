import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type PublicRealtimeConfig =
  | { enabled: false }
  | { enabled: true; supabaseUrl: string; publishableKey: string }

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

  async publishTopicChanged(topicId: string): Promise<void> {
    const config = this.getPublicConfig()
    const secretKey = this.config.get<string>('SUPABASE_STORAGE_SECRET_KEY')
    if (!config.enabled || !secretKey) return

    const topic = `nexus-forum-topic-${topicId}`
    const endpoint = new URL('/realtime/v1/api/broadcast', config.supabaseUrl)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: secretKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{
            topic,
            event: 'topic_changed',
            payload: { changedAt: Date.now() }
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
}
