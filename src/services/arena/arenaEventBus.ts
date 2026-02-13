// Arena event bus — typed pub/sub for game events (Rewritten from scratch)
import type { ArenaEventMap } from '@/types/arena'

type EventHandler<K extends keyof ArenaEventMap> = (payload: ArenaEventMap[K]) => void

class ArenaEventBus {
  private listeners = new Map<keyof ArenaEventMap, Set<EventHandler<never>>>()

  on<K extends keyof ArenaEventMap>(event: K, handler: EventHandler<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler as EventHandler<never>)
  }

  off<K extends keyof ArenaEventMap>(event: K, handler: EventHandler<K>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<never>)
  }

  emit<K extends keyof ArenaEventMap>(event: K, payload: ArenaEventMap[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      (handler as EventHandler<K>)(payload)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const arenaEventBus = new ArenaEventBus()
