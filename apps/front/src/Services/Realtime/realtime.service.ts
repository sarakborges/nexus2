import { api } from '@/Services/Http/api'

type RealtimeConfig =
  | { enabled: false }
  | { enabled: true; supabaseUrl: string; publishableKey: string }

type RealtimeMessage = {
  topic?: string
  event?: string
  payload?: {
    status?: string
    event?: string
  }
}

async function getRealtimeConfig(): Promise<RealtimeConfig> {
  const { data } = await api.get<RealtimeConfig>('/realtime/config')
  return data
}

export function subscribeToCommunityForumTopic(
  topicId: string,
  onTopicChanged: () => void
): () => void {
  const channel = `realtime:nexus-forum-topic-${topicId}`
  let socket: WebSocket | null = null
  let heartbeatTimer: number | undefined
  let reconnectTimer: number | undefined
  let reconnectAttempt = 0
  let messageRef = 0
  let stopped = false

  const clearHeartbeat = () => {
    if (heartbeatTimer !== undefined) {
      window.clearInterval(heartbeatTimer)
      heartbeatTimer = undefined
    }
  }

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== undefined) return
    const delay = Math.min(30_000, 1_000 * 2 ** reconnectAttempt)
    reconnectAttempt += 1
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined
      void connect()
    }, delay)
  }

  const connect = async () => {
    if (stopped) return

    try {
      const config = await getRealtimeConfig()
      if (stopped || !config.enabled) return

      const websocketUrl = new URL('/realtime/v1/websocket', config.supabaseUrl)
      websocketUrl.protocol = websocketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      websocketUrl.searchParams.set('apikey', config.publishableKey)
      websocketUrl.searchParams.set('vsn', '1.0.0')

      const currentSocket = new WebSocket(websocketUrl)
      socket = currentSocket

      currentSocket.addEventListener('open', () => {
        if (stopped) {
          currentSocket.close(1000, 'Topic page left')
          return
        }

        const joinRef = String(++messageRef)
        currentSocket.send(JSON.stringify({
          topic: channel,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { enabled: false },
              private: false
            }
          },
          ref: joinRef,
          join_ref: joinRef
        }))

        heartbeatTimer = window.setInterval(() => {
          if (currentSocket.readyState !== WebSocket.OPEN) return
          currentSocket.send(JSON.stringify({
            topic: 'phoenix',
            event: 'heartbeat',
            payload: {},
            ref: String(++messageRef)
          }))
        }, 20_000)
      })

      currentSocket.addEventListener('message', (message) => {
        let payload: RealtimeMessage
        try {
          payload = JSON.parse(String(message.data)) as RealtimeMessage
        } catch {
          return
        }

        if (payload.topic !== channel) return

        if (payload.event === 'phx_reply') {
          if (payload.payload?.status === 'ok') {
            reconnectAttempt = 0
            // Re-read once after joining to cover changes made during connection setup.
            onTopicChanged()
          } else if (payload.payload?.status === 'error') {
            currentSocket.close()
          }
          return
        }

        if (
          payload.event === 'broadcast' &&
          payload.payload?.event === 'topic_changed'
        ) {
          onTopicChanged()
        }

        if (payload.event === 'phx_error' || payload.event === 'phx_close') {
          currentSocket.close()
        }
      })

      currentSocket.addEventListener('close', () => {
        clearHeartbeat()
        if (socket === currentSocket) socket = null
        scheduleReconnect()
      })

      currentSocket.addEventListener('error', () => currentSocket.close())
    } catch {
      scheduleReconnect()
    }
  }

  void connect()

  return () => {
    stopped = true
    clearHeartbeat()
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    socket?.close(1000, 'Topic page left')
    socket = null
  }
}
