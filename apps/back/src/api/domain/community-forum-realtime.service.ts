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
    if (!config.enabled) return

    const topic = `nexus-forum-topic-${encodeURIComponent(topicId)}`
    const endpoint = new URL(
      `/realtime/v1/api/broadcast/${topic}/events/topic_changed`,
      config.supabaseUrl
    )

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ changedAt: Date.now() })
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
