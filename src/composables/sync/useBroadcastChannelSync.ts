import { ref, onUnmounted } from 'vue'

interface BroadcastMessage {
    type: string
    senderId: string
    timestamp: number
    data: any
}

export function useBroadcastChannelSync(channelName = 'pomo-flow-sync') {
    const tabId = ref(`tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    const isConnected = ref(false)

    let channel: BroadcastChannel | null = null
    const messageHandlers = new Map<string, (data: any) => void>()

    const connect = () => {
        if (channel) return

        channel = new BroadcastChannel(channelName)
        channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
            if (event.data.senderId === tabId.value) return // Ignore own messages

            const handler = messageHandlers.get(event.data.type)
            if (handler) {
                handler(event.data.data)
            }
        }

        isConnected.value = true
    }

    const disconnect = () => {
        if (channel) {
            channel.close()
            channel = null
        }
        isConnected.value = false
    }

    const broadcast = (type: string, data: any) => {
        if (!channel) return

        const message: BroadcastMessage = {
            type,
            senderId: tabId.value,
            timestamp: Date.now(),
            data
        }
        channel.postMessage(message)
    }

    const onMessage = (type: string, handler: (data: any) => void) => {
        messageHandlers.set(type, handler)
    }

    const offMessage = (type: string) => {
        messageHandlers.delete(type)
    }

    onUnmounted(() => {
        disconnect()
    })

    return {
        tabId,
        isConnected,
        connect,
        disconnect,
        broadcast,
        onMessage,
        offMessage
    }
}
