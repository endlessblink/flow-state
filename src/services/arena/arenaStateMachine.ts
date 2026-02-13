// Arena state machine — game phase transitions (Rewritten from scratch)
import type { GamePhase } from '@/types/arena'

const TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  idle: ['loading'],
  loading: ['briefing'],
  briefing: ['wave_active'],
  wave_active: ['wave_cleared', 'defeat'],
  wave_cleared: ['boss_phase', 'victory'],
  boss_phase: ['victory', 'defeat'],
  victory: ['idle'],
  defeat: ['idle'],
}

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function getValidTransitions(phase: GamePhase): GamePhase[] {
  return TRANSITIONS[phase] ?? []
}
