// Arena game phase state machine
import type { GamePhase } from '@/types/arena'

type TransitionCallback = (from: GamePhase, to: GamePhase) => void

const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  idle: ['loading'],
  loading: ['briefing'],
  briefing: ['wave_active'],
  wave_active: ['wave_cleared'],
  wave_cleared: ['boss_phase', 'victory'],
  boss_phase: ['victory'],
  victory: ['idle'],
}

class ArenaStateMachine {
  private _currentPhase: GamePhase = 'idle'
  private listeners: TransitionCallback[] = []

  get currentPhase(): GamePhase {
    return this._currentPhase
  }

  canTransition(to: GamePhase): boolean {
    return VALID_TRANSITIONS[this._currentPhase]?.includes(to) ?? false
  }

  transition(to: GamePhase): boolean {
    if (!this.canTransition(to)) {
      console.warn(`[ArenaStateMachine] Invalid transition: ${this._currentPhase} → ${to}`)
      return false
    }
    const from = this._currentPhase
    this._currentPhase = to
    for (const cb of this.listeners) {
      cb(from, to)
    }
    return true
  }

  onTransition(callback: TransitionCallback): () => void {
    this.listeners.push(callback)
    return () => {
      const idx = this.listeners.indexOf(callback)
      if (idx !== -1) this.listeners.splice(idx, 1)
    }
  }

  reset(): void {
    this._currentPhase = 'idle'
  }
}

export function createArenaStateMachine(): ArenaStateMachine {
  return new ArenaStateMachine()
}
