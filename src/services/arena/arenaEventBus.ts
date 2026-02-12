// Arena event bus — typed pub/sub for game events
import type { GameEvent } from '@/types/arena'

type GameEventHandler<T extends GameEvent['type']> = (
  event: Extract<GameEvent, { type: T }>
) => void

class ArenaEventBus {
  private handlers = new Map<GameEvent['type'], Set<GameEventHandler<any>>>()

  on<T extends GameEvent['type']>(type: T, handler: GameEventHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
  }

  off<T extends GameEvent['type']>(type: T, handler: GameEventHandler<T>): void {
    this.handlers.get(type)?.delete(handler)
  }

  emit(event: GameEvent): void {
    const handlers = this.handlers.get(event.type)
    if (handlers) {
      for (const handler of handlers) {
        handler(event)
      }
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

export const arenaEventBus = new ArenaEventBus()
