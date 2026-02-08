/**
 * Challenge Template System for Cyberflow RPG
 * FEATURE-1132: Fallback templates when AI is unavailable
 *
 * This provides pre-written cyberpunk-flavored challenges that can be
 * generated using real user data without requiring AI.
 */

import type {
  ChallengeObjective,
  ChallengeDifficulty,
  AIGeneratedChallenge,
} from '@/types/challenges'
import {
  OBJECTIVE_CONSTRAINTS,
  DIFFICULTY_SCALING,
  XP_REWARDS,
} from '@/types/challenges'

// =============================================================================
// Template Types
// =============================================================================

interface ChallengeTemplate {
  titleTemplate: string
  descriptionTemplate: string
  narrativeTemplate: string
}

// =============================================================================
// Challenge Templates by Objective Type
// =============================================================================

const CHALLENGE_TEMPLATES: Record<ChallengeObjective, ChallengeTemplate[]> = {
  complete_tasks: [
    {
      titleTemplate: 'Grid Maintenance Protocol',
      descriptionTemplate: 'Clear {target} data packets from the CyberGrid.',
      narrativeTemplate: 'Routine maintenance keeps the Grid stable, netrunner.',
    },
    {
      titleTemplate: 'Hack Quota',
      descriptionTemplate: 'Complete {target} hacks to maintain system efficiency.',
      narrativeTemplate: 'The Grid demands productivity. Let\'s move.',
    },
    {
      titleTemplate: 'Data Purge Initiative',
      descriptionTemplate: 'Process {target} pending tasks in your queue.',
      narrativeTemplate: 'Clean data, clear mind. Execute.',
    },
    {
      titleTemplate: 'Neural Throughput',
      descriptionTemplate: 'Push {target} tasks through your neural interface.',
      narrativeTemplate: 'Your synapses are warming up. Keep them hot.',
    },
    {
      titleTemplate: 'System Sweep',
      descriptionTemplate: 'Eliminate {target} tasks from the backlog.',
      narrativeTemplate: 'Backlogs breed corruption. Sweep them clean.',
    },
    {
      titleTemplate: 'Productivity Burst',
      descriptionTemplate: 'Execute {target} rapid-fire completions.',
      narrativeTemplate: 'Speed and precision. Show me both.',
    },
    {
      titleTemplate: 'Grid Stabilization',
      descriptionTemplate: 'Complete {target} tasks to stabilize sector integrity.',
      narrativeTemplate: 'Each task reinforces the Grid\'s structure.',
    },
    {
      titleTemplate: 'Data Flow Optimization',
      descriptionTemplate: 'Process {target} work units through your queue.',
      narrativeTemplate: 'Optimized flow equals optimized output.',
    },
  ],

  complete_pomodoros: [
    {
      titleTemplate: 'Deep Dive Session',
      descriptionTemplate: 'Execute {target} focused dive cycles.',
      narrativeTemplate: 'Sustained focus amplifies your neural output.',
    },
    {
      titleTemplate: 'Neural Immersion',
      descriptionTemplate: 'Complete {target} uninterrupted focus sessions.',
      narrativeTemplate: 'Immerse yourself in the data stream.',
    },
    {
      titleTemplate: 'Concentration Protocol',
      descriptionTemplate: 'Maintain {target} focused work intervals.',
      narrativeTemplate: 'Concentration is power. Wield it.',
    },
    {
      titleTemplate: 'Flow State Activation',
      descriptionTemplate: 'Achieve {target} flow state sessions.',
      narrativeTemplate: 'The flow state is where legends are made.',
    },
    {
      titleTemplate: 'Chrono-Lock Sessions',
      descriptionTemplate: 'Lock into {target} time-boxed work cycles.',
      narrativeTemplate: 'Time is malleable when you control it.',
    },
    {
      titleTemplate: 'Focus Matrix',
      descriptionTemplate: 'Enter the focus matrix {target} times.',
      narrativeTemplate: 'Each session strengthens your neural pathways.',
    },
  ],

  clear_overdue: [
    {
      titleTemplate: 'Corruption Cleanup',
      descriptionTemplate: 'Clear {target} corrupted data packets (overdue tasks).',
      narrativeTemplate: 'Corruption spreads. Contain it before it consumes you.',
    },
    {
      titleTemplate: 'Legacy Purge',
      descriptionTemplate: 'Eliminate {target} legacy items from your backlog.',
      narrativeTemplate: 'Old code rots. Delete it.',
    },
    {
      titleTemplate: 'Debt Collection',
      descriptionTemplate: 'Resolve {target} outstanding obligations.',
      narrativeTemplate: 'Technical debt compounds. Pay it down.',
    },
    {
      titleTemplate: 'Decay Reversal',
      descriptionTemplate: 'Rescue {target} decaying tasks before deletion.',
      narrativeTemplate: 'Some data can still be salvaged. Act fast.',
    },
    {
      titleTemplate: 'Zombie Protocol',
      descriptionTemplate: 'Terminate {target} zombie tasks haunting your queue.',
      narrativeTemplate: 'Dead tasks walk among the living. End them.',
    },
  ],

  focus_time_minutes: [
    {
      titleTemplate: 'Time Investment',
      descriptionTemplate: 'Invest {target} minutes in deep focus work.',
      narrativeTemplate: 'Time invested returns compound interest.',
    },
    {
      titleTemplate: 'Neural Marathon',
      descriptionTemplate: 'Sustain {target} minutes of concentrated effort.',
      narrativeTemplate: 'Endurance distinguishes the elite from the average.',
    },
    {
      titleTemplate: 'Attention Allocation',
      descriptionTemplate: 'Allocate {target} minutes to high-value work.',
      narrativeTemplate: 'Attention is currency. Spend it wisely.',
    },
    {
      titleTemplate: 'Grid Time',
      descriptionTemplate: 'Log {target} minutes connected to the Grid.',
      narrativeTemplate: 'Connection time equals capability growth.',
    },
    {
      titleTemplate: 'Deep Work Protocol',
      descriptionTemplate: 'Engage in {target} minutes of distraction-free work.',
      narrativeTemplate: 'Depth over breadth. Always.',
    },
  ],

  complete_high_priority: [
    {
      titleTemplate: 'Priority Override',
      descriptionTemplate: 'Execute {target} high-priority directives.',
      narrativeTemplate: 'Critical tasks demand immediate attention.',
    },
    {
      titleTemplate: 'Red Alert Response',
      descriptionTemplate: 'Handle {target} urgent system alerts.',
      narrativeTemplate: 'When the Grid screams, you respond.',
    },
    {
      titleTemplate: 'Mission Critical',
      descriptionTemplate: 'Complete {target} mission-critical objectives.',
      narrativeTemplate: 'Some tasks can\'t wait. These are them.',
    },
    {
      titleTemplate: 'First Responder',
      descriptionTemplate: 'Address {target} priority-flagged items.',
      narrativeTemplate: 'First to respond, first to succeed.',
    },
  ],

  complete_project_tasks: [
    {
      titleTemplate: 'Sector Focus: {projectName}',
      descriptionTemplate: 'Complete {target} tasks in the {projectName} sector.',
      narrativeTemplate: 'This sector needs your attention, netrunner.',
    },
    {
      titleTemplate: '{projectName} Offensive',
      descriptionTemplate: 'Push {target} completions in {projectName}.',
      narrativeTemplate: 'Concentrated force on a single sector. Effective.',
    },
    {
      titleTemplate: 'Project Acceleration',
      descriptionTemplate: 'Fast-track {target} items in {projectName}.',
      narrativeTemplate: 'Momentum builds momentum. Start here.',
    },
    {
      titleTemplate: 'Sector Sweep: {projectName}',
      descriptionTemplate: 'Clear {target} tasks from the {projectName} queue.',
      narrativeTemplate: 'A clean sector is a productive sector.',
    },
  ],

  complete_before_hour: [
    {
      titleTemplate: 'Morning Strike',
      descriptionTemplate: 'Complete {target} tasks before {hour}:00.',
      narrativeTemplate: 'Early action sets the day\'s trajectory.',
    },
    {
      titleTemplate: 'Dawn Raid',
      descriptionTemplate: 'Finish {target} hacks before the clock strikes {hour}.',
      narrativeTemplate: 'Strike while the Grid is quiet.',
    },
    {
      titleTemplate: 'Pre-Peak Protocol',
      descriptionTemplate: 'Clear {target} tasks before {hour}:00.',
      narrativeTemplate: 'Beat the traffic. Beat the competition.',
    },
    {
      titleTemplate: 'Early Bird Protocol',
      descriptionTemplate: 'Execute {target} completions before {hour}:00.',
      narrativeTemplate: 'Those who start early, finish strong.',
    },
  ],

  complete_variety: [
    {
      titleTemplate: 'Multi-Sector Operation',
      descriptionTemplate: 'Complete tasks across {target} different sectors (projects).',
      narrativeTemplate: 'Versatility is strength in the Grid.',
    },
    {
      titleTemplate: 'Cross-Domain Hack',
      descriptionTemplate: 'Touch {target} different projects today.',
      narrativeTemplate: 'A netrunner who\'s only good at one thing isn\'t good at all.',
    },
    {
      titleTemplate: 'Portfolio Balance',
      descriptionTemplate: 'Spread your work across {target} project sectors.',
      narrativeTemplate: 'Balance prevents burnout and blind spots.',
    },
    {
      titleTemplate: 'Diversification Protocol',
      descriptionTemplate: 'Engage with {target} unique project domains.',
      narrativeTemplate: 'Diverse skills make for dangerous netrunners.',
    },
  ],
}

// =============================================================================
// Boss Fight Templates
// =============================================================================

const BOSS_TEMPLATES = [
  {
    title: 'THE PROCRASTINATOR',
    description: 'A massive data corruption entity born from neglected tasks. It feeds on your inaction.',
    narrativeTemplate: 'Warning: Major data anomaly detected. This one\'s been growing for a while.',
  },
  {
    title: 'SCOPE CREEP',
    description: 'An ever-expanding nightmare that consumes everything in its path. Kill it before it kills your momentum.',
    narrativeTemplate: 'It keeps growing. You need to contain it. Now.',
  },
  {
    title: 'THE DISTRACTION DAEMON',
    description: 'A multi-headed entity that fragments your attention into useless shards.',
    narrativeTemplate: 'Multiple threat vectors detected. Focus is your only weapon.',
  },
  {
    title: 'DEADLINE REAPER',
    description: 'An ancient entity that harvests souls from missed deadlines.',
    narrativeTemplate: 'It\'s been stalking you for weeks. Time to end this.',
  },
  {
    title: 'THE BURNOUT BEAST',
    description: 'A parasitic entity that drains energy and motivation. Sustained effort is the only cure.',
    narrativeTemplate: 'Careful. This one gets stronger if you push too hard.',
  },
  {
    title: 'ENTROPY INCARNATE',
    description: 'The embodiment of chaos and disorder. Only structure can defeat it.',
    narrativeTemplate: 'Everything tends toward chaos. Impose order.',
  },
  {
    title: 'THE BLOCKER',
    description: 'A immovable obstacle that stops all progress. Break through or be broken.',
    narrativeTemplate: 'It\'s been blocking critical paths. Time to clear the way.',
  },
  {
    title: 'ANALYSIS PARALYSIS',
    description: 'A crystalline entity that freezes decision-making. Action is the antidote.',
    narrativeTemplate: 'Stop thinking. Start doing. That\'s how you beat this.',
  },
]

// =============================================================================
// Template Generation Functions
// =============================================================================

/**
 * Select a random template for the given objective type
 */
function selectTemplate(objectiveType: ChallengeObjective): ChallengeTemplate {
  const templates = CHALLENGE_TEMPLATES[objectiveType]
  return templates[Math.floor(Math.random() * templates.length)]
}

/**
 * Fill in template placeholders with actual values
 */
function fillTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  let result = template
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return result
}

/**
 * Calculate target value based on user's average and difficulty
 */
function calculateTarget(
  objectiveType: ChallengeObjective,
  averageValue: number,
  difficulty: ChallengeDifficulty
): number {
  const constraints = OBJECTIVE_CONSTRAINTS[objectiveType]
  const scaling = DIFFICULTY_SCALING[difficulty]

  // Scale the average by difficulty
  let target = Math.round(averageValue * scaling)

  // Clamp to constraints
  target = Math.max(constraints.min, Math.min(constraints.max, target))

  // Ensure at least 1
  return Math.max(1, target)
}

/**
 * Calculate XP reward based on difficulty and target
 */
function calculateReward(
  difficulty: ChallengeDifficulty,
  target: number
): number {
  const range = XP_REWARDS[difficulty]
  // Higher targets get higher rewards within the range
  const normalized = Math.min(target / 5, 1) // Normalize target to 0-1
  const reward = Math.round(range.min + (range.max - range.min) * normalized)
  return reward
}

/**
 * Calculate XP penalty (usually 0-20% of reward)
 */
function calculatePenalty(reward: number, difficulty: ChallengeDifficulty): number {
  const penaltyRate = difficulty === 'boss' ? 0.2 : difficulty === 'hard' ? 0.15 : 0.1
  return Math.round(reward * penaltyRate)
}

// =============================================================================
// Public API
// =============================================================================

export interface TemplateGenerationContext {
  averageTasksPerDay: number
  averagePomodorosPerDay: number
  overdueCount: number
  topProjects: { id: string; name: string }[]
}

/**
 * Generate daily challenges using templates (no AI required)
 */
export function generateDailyChallengesFromTemplates(
  difficulty: ChallengeDifficulty,
  context: TemplateGenerationContext,
  count: number = 3
): AIGeneratedChallenge[] {
  // Select diverse objective types
  const objectiveTypes = selectDiverseObjectives(count, context)

  return objectiveTypes.map((objectiveType) => {
    const template = selectTemplate(objectiveType)

    // Calculate target based on objective type
    let target: number
    let projectName: string | undefined
    let hour: number | undefined

    switch (objectiveType) {
      case 'complete_tasks':
        target = calculateTarget(objectiveType, context.averageTasksPerDay, difficulty)
        break
      case 'complete_pomodoros':
        target = calculateTarget(objectiveType, context.averagePomodorosPerDay, difficulty)
        break
      case 'clear_overdue':
        target = Math.max(1, Math.min(context.overdueCount, OBJECTIVE_CONSTRAINTS.clear_overdue.max))
        break
      case 'focus_time_minutes':
        target = calculateTarget(objectiveType, context.averagePomodorosPerDay * 25, difficulty)
        break
      case 'complete_high_priority':
        target = calculateTarget(objectiveType, 2, difficulty)
        break
      case 'complete_project_tasks':
        if (context.topProjects.length > 0) {
          const project = context.topProjects[Math.floor(Math.random() * context.topProjects.length)]
          projectName = project.name
        }
        target = calculateTarget(objectiveType, 3, difficulty)
        break
      case 'complete_before_hour':
        hour = 10 + Math.floor(Math.random() * 3) // 10, 11, or 12
        target = calculateTarget(objectiveType, 2, difficulty)
        break
      case 'complete_variety':
        target = Math.min(context.topProjects.length, OBJECTIVE_CONSTRAINTS.complete_variety.max)
        target = Math.max(target, OBJECTIVE_CONSTRAINTS.complete_variety.min)
        break
      default:
        target = 1
    }

    const reward = calculateReward(difficulty, target)
    const penalty = calculatePenalty(reward, difficulty)

    // Fill in templates
    const values = { target, projectName: projectName || 'Unknown', hour: hour || 10 }

    return {
      title: fillTemplate(template.titleTemplate, values),
      description: fillTemplate(template.descriptionTemplate, values),
      objective_type: objectiveType,
      objective_target: target,
      reward_xp: reward,
      penalty_xp: penalty,
      difficulty,
      narrative_flavor: fillTemplate(template.narrativeTemplate, values),
      project_name: projectName,
      hour,
    }
  })
}

/**
 * Generate a weekly boss fight using templates
 */
export function generateBossFightFromTemplate(
  context: TemplateGenerationContext
): AIGeneratedChallenge & { total_hp: number; special_reward?: string } {
  const boss = BOSS_TEMPLATES[Math.floor(Math.random() * BOSS_TEMPLATES.length)]

  // Boss difficulty is always 'boss'
  const difficulty: ChallengeDifficulty = 'boss'

  // Boss targets are larger
  const target = Math.max(1, Math.round(context.averageTasksPerDay * 7 * DIFFICULTY_SCALING.boss))
  const reward = XP_REWARDS.boss.max
  const penalty = calculatePenalty(reward, difficulty)

  // HP is based on objective targets
  const totalHp = target * 10

  return {
    title: boss.title,
    description: boss.description,
    objective_type: 'complete_tasks',
    objective_target: target,
    reward_xp: reward,
    penalty_xp: penalty,
    difficulty,
    narrative_flavor: boss.narrativeTemplate,
    total_hp: totalHp,
    special_reward: 'boss_victor_badge',
  }
}

/**
 * Select diverse objective types (avoid repetition)
 */
function selectDiverseObjectives(
  count: number,
  context: TemplateGenerationContext
): ChallengeObjective[] {
  const allTypes: ChallengeObjective[] = [
    'complete_tasks',
    'complete_pomodoros',
    'focus_time_minutes',
    'complete_high_priority',
  ]

  // Conditionally add other types
  if (context.overdueCount > 0) {
    allTypes.push('clear_overdue')
  }
  if (context.topProjects.length > 1) {
    allTypes.push('complete_project_tasks')
    allTypes.push('complete_variety')
  }

  // Add time-based challenge for mornings
  const hour = new Date().getHours()
  if (hour < 12) {
    allTypes.push('complete_before_hour')
  }

  // Shuffle and take first N
  const shuffled = allTypes.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Get a random narrative for challenge completion
 */
export function getCompletionNarrative(): string {
  const narratives = [
    'Excellent work, netrunner. Grid integrity restored.',
    'Task executed with precision. Your efficiency impresses me.',
    'Data corruption contained. The Grid thanks you.',
    'Mission complete. Your skills grow stronger.',
    'Objective achieved. Sector stability improved.',
    'Well done. Your neural pathways are optimizing.',
    'Target eliminated. The Grid breathes easier.',
    'Success confirmed. Continue the momentum.',
  ]
  return narratives[Math.floor(Math.random() * narratives.length)]
}

/**
 * Get a random narrative for challenge failure
 */
export function getFailureNarrative(): string {
  const narratives = [
    'Mission failed. Corruption spreads. We\'ll try again.',
    'Time expired. The Grid suffers. Regroup and retry.',
    'Objective not met. But setbacks are just data points.',
    'Failed this time. Learn. Adapt. Execute.',
    'Mission incomplete. The Grid remembers, but so do you.',
    'Deadline breached. Corruption level increased. Stay vigilant.',
  ]
  return narratives[Math.floor(Math.random() * narratives.length)]
}
