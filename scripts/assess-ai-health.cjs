#!/usr/bin/env node
/**
 * AI Memory Health Assessment CLI (TASK-1356)
 *
 * Evaluates the AI memory system's effectiveness from the command line.
 *
 * Usage:
 *   node scripts/assess-ai-health.cjs              # Fast mode (heuristic only)
 *   node scripts/assess-ai-health.cjs --full        # Full mode (includes LLM judge)
 *   node scripts/assess-ai-health.cjs --pretty      # Human-readable output
 *   node scripts/assess-ai-health.cjs --json        # JSON output (default)
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * (or use with: doppler run -- node scripts/assess-ai-health.cjs)
 */

const { createClient } = require('@supabase/supabase-js')

// ============================================================================
// Configuration
// ============================================================================

const FRESHNESS_HALF_LIFE_DAYS = 14
const MIN_OBSERVATIONS_GOOD = 8
const CONTRADICTION_PAIRS = [
  ['capacity_gap', 'reliable_planner'],
  ['overplans', 'reliable_planner'],
  ['underestimates', 'overestimates'],
]

const EXPECTED_FIELDS = [
  { key: 'work_days', label: 'Work days', computed: false },
  { key: 'days_off', label: 'Days off', computed: false },
  { key: 'heavy_meeting_days', label: 'Heavy meeting days', computed: false },
  { key: 'max_tasks_per_day', label: 'Max tasks/day', computed: false },
  { key: 'preferred_work_style', label: 'Work style', computed: false },
  { key: 'top_priority_note', label: 'Top priority note', computed: false },
  { key: 'avg_work_minutes_per_day', label: 'Avg work mins/day', computed: true },
  { key: 'avg_tasks_completed_per_day', label: 'Avg tasks/day', computed: true },
  { key: 'peak_productivity_days', label: 'Peak days', computed: true },
  { key: 'avg_plan_accuracy', label: 'Plan accuracy', computed: true },
  { key: 'weekly_history', label: 'Weekly history', computed: true },
  { key: 'interview_completed', label: 'Interview done', computed: false },
  { key: 'memory_graph', label: 'Memory graph', computed: true },
]

// ============================================================================
// Argument parsing
// ============================================================================

const args = process.argv.slice(2)
const isFullMode = args.includes('--full')
const isPretty = args.includes('--pretty')
const isHelp = args.includes('--help') || args.includes('-h')

if (isHelp) {
  console.log(`
AI Memory Health Assessment CLI

Usage:
  node scripts/assess-ai-health.cjs [options]

Options:
  --full      Run full assessment (includes LLM-as-judge tests)
  --pretty    Human-readable output (default: JSON)
  --json      JSON output (default)
  --help, -h  Show this help

Environment:
  Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)
  Use with: doppler run -- node scripts/assess-ai-health.cjs
`)
  process.exit(0)
}

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabaseClient() {
  // Try multiple env var patterns
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Missing Supabase credentials.')
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or use doppler run --)')
    process.exit(1)
  }

  return createClient(url, key)
}

// ============================================================================
// Assessment Functions
// ============================================================================

function isPopulated(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  if (typeof value === 'number' && value === 0) return false
  if (typeof value === 'boolean') return value
  return true
}

function assessCoverage(profile) {
  const checks = []

  if (!profile) {
    return {
      id: 'coverage', name: 'Profile Coverage', score: 0, weight: 0.25,
      checks: [{
        id: 'no_profile', name: 'Profile Exists', status: 'fail', score: 0,
        value: 'No profile found', threshold: 'Profile must exist',
        recommendation: 'Complete the AI interview in Settings > AI',
      }],
    }
  }

  let populated = 0
  const missing = []
  const missingComputed = []

  for (const field of EXPECTED_FIELDS) {
    if (isPopulated(profile[field.key])) {
      populated++
    } else if (field.computed) {
      missingComputed.push(field.label)
    } else {
      missing.push(field.label)
    }
  }

  const ratio = populated / EXPECTED_FIELDS.length
  const pct = Math.round(ratio * 100)

  checks.push({
    id: 'interview', name: 'Interview Completed',
    status: profile.interview_completed ? 'pass' : 'fail',
    score: profile.interview_completed ? 100 : 0,
    value: profile.interview_completed ? 'Yes' : 'No',
    threshold: 'Must be completed',
    recommendation: profile.interview_completed ? null : 'Complete work profile interview',
  })

  checks.push({
    id: 'field_coverage', name: 'Field Coverage',
    status: ratio >= 0.8 ? 'pass' : ratio >= 0.5 ? 'warn' : 'fail',
    score: pct,
    value: `${populated}/${EXPECTED_FIELDS.length} fields (${pct}%)`,
    threshold: '80%+',
    recommendation: missing.length > 0 ? `Missing: ${missing.join(', ')}` : null,
    details: missingComputed.length > 0 ? [`Auto-computed missing: ${missingComputed.join(', ')}`] : null,
  })

  return { id: 'coverage', name: 'Profile Coverage', score: pct, weight: 0.25, checks }
}

function assessFreshness(observations) {
  const checks = []

  if (observations.length === 0) {
    return {
      id: 'freshness', name: 'Memory Freshness', score: 0, weight: 0.20,
      checks: [{
        id: 'none', name: 'Observations Exist', status: 'fail', score: 0,
        value: 'No observations', threshold: '1+',
        recommendation: 'Use app for a week to generate memory observations',
      }],
    }
  }

  const now = Date.now()
  const scores = observations.map(o => {
    const age = (now - new Date(o.created_at || o.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    return Math.max(0, Math.pow(0.5, age / FRESHNESS_HALF_LIFE_DAYS))
  })

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const pct = Math.round(avg * 100)
  const stale = scores.filter(s => s < 0.3).length

  const sorted = [...observations].sort((a, b) =>
    new Date(a.created_at || a.createdAt).getTime() - new Date(b.created_at || b.createdAt).getTime()
  )
  const oldestAge = Math.round((now - new Date(sorted[0].created_at || sorted[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
  const newestAge = Math.round((now - new Date(sorted[sorted.length - 1].created_at || sorted[sorted.length - 1].createdAt).getTime()) / (1000 * 60 * 60 * 24))

  checks.push({
    id: 'avg_freshness', name: 'Average Freshness',
    status: avg >= 0.6 ? 'pass' : avg >= 0.4 ? 'warn' : 'fail',
    score: pct, value: `${pct}%`, threshold: '60%+',
    recommendation: avg < 0.4 ? 'Memory data is stale. Re-run capacity metrics.' : null,
  })

  checks.push({
    id: 'stale_count', name: 'Stale Observations',
    status: stale === 0 ? 'pass' : stale <= observations.length * 0.3 ? 'warn' : 'fail',
    score: Math.round(((observations.length - stale) / observations.length) * 100),
    value: `${stale}/${observations.length} stale`, threshold: '<30%',
  })

  checks.push({
    id: 'age_range', name: 'Data Age',
    status: newestAge <= 7 ? 'pass' : newestAge <= 14 ? 'warn' : 'fail',
    score: Math.max(0, Math.round(100 - newestAge * 3)),
    value: `Newest: ${newestAge}d, Oldest: ${oldestAge}d`, threshold: 'Newest <7d',
  })

  return { id: 'freshness', name: 'Memory Freshness', score: pct, weight: 0.20, checks }
}

function assessDensity(observations) {
  const checks = []
  const count = observations.length

  checks.push({
    id: 'count', name: 'Observation Count',
    status: count >= MIN_OBSERVATIONS_GOOD ? 'pass' : count >= MIN_OBSERVATIONS_GOOD / 2 ? 'warn' : 'fail',
    score: Math.min(100, Math.round((count / MIN_OBSERVATIONS_GOOD) * 100)),
    value: `${count} (target: ${MIN_OBSERVATIONS_GOOD}+)`, threshold: `${MIN_OBSERVATIONS_GOOD}+`,
  })

  const sources = new Set(observations.map(o => o.source))
  const expected = ['pomodoro_data', 'task_analysis', 'weekly_history', 'suggestion_feedback']
  const found = expected.filter(s => sources.has(s)).length
  checks.push({
    id: 'sources', name: 'Source Diversity',
    status: found >= 3 ? 'pass' : found >= 2 ? 'warn' : 'fail',
    score: Math.round((found / expected.length) * 100),
    value: `${found}/${expected.length} sources`, threshold: '3+',
    details: expected.filter(s => !sources.has(s)).map(s => `Missing: ${s}`),
  })

  const avgConf = count > 0
    ? observations.reduce((sum, o) => sum + (o.confidence || 0), 0) / count
    : 0
  checks.push({
    id: 'confidence', name: 'Avg Confidence',
    status: avgConf >= 0.7 ? 'pass' : avgConf >= 0.5 ? 'warn' : 'fail',
    score: Math.round(avgConf * 100),
    value: `${(avgConf * 100).toFixed(0)}%`, threshold: '70%+',
  })

  const feedback = observations.filter(o => o.source === 'suggestion_feedback').length
  checks.push({
    id: 'feedback', name: 'Feedback Loop',
    status: feedback >= 3 ? 'pass' : feedback >= 1 ? 'warn' : 'fail',
    score: Math.min(100, Math.round((feedback / 3) * 100)),
    value: `${feedback} corrections`, threshold: '3+',
  })

  const overall = checks.length > 0
    ? Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length) : 0

  return { id: 'density', name: 'Observation Density', score: overall, weight: 0.15, checks }
}

function assessContradictions(observations) {
  const contradictions = []

  for (const [relA, relB] of CONTRADICTION_PAIRS) {
    const a = observations.find(o => o.relation === relA)
    const b = observations.find(o => o.relation === relB)
    if (a && b) {
      contradictions.push(`"${a.entity} ${a.relation}" vs "${b.entity} ${b.relation}"`)
    }
  }

  const score = contradictions.length === 0 ? 100 : Math.max(0, 100 - contradictions.length * 30)

  return {
    id: 'contradictions', name: 'Consistency', score, weight: 0.15,
    checks: [{
      id: 'count', name: 'Contradictions',
      status: contradictions.length === 0 ? 'pass' : contradictions.length <= 1 ? 'warn' : 'fail',
      score,
      value: `${contradictions.length} found`, threshold: '0',
      details: contradictions,
      recommendation: contradictions.length > 0 ? 'Reset learned data to clear contradictions' : null,
    }],
  }
}

function computeGrade(score) {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

// ============================================================================
// Pretty Printer
// ============================================================================

function printPretty(report) {
  const gradeColors = { A: '\x1b[32m', B: '\x1b[32m', C: '\x1b[33m', D: '\x1b[33m', F: '\x1b[31m' }
  const reset = '\x1b[0m'
  const bold = '\x1b[1m'
  const dim = '\x1b[2m'

  console.log()
  console.log(`${bold}AI Memory Health Assessment${reset}`)
  console.log(`${'='.repeat(50)}`)
  console.log()

  const gc = gradeColors[report.grade] || ''
  console.log(`  Overall Grade: ${gc}${bold}${report.grade}${reset} (${report.overallScore}/100)`)
  console.log(`  Mode: ${report.mode} | Duration: ${report.durationMs}ms`)
  console.log(`  Generated: ${report.timestamp}`)
  console.log()

  for (const section of report.sections) {
    const statusIcon = section.score >= 70 ? '\x1b[32m+' : section.score >= 45 ? '\x1b[33m~' : '\x1b[31m!'
    console.log(`${statusIcon}${reset} ${bold}${section.name}${reset}: ${section.score}% (weight: ${(section.weight * 100).toFixed(0)}%)`)

    for (const check of section.checks) {
      const statusColor = check.status === 'pass' ? '\x1b[32m' : check.status === 'warn' ? '\x1b[33m' : '\x1b[31m'
      console.log(`    ${statusColor}[${check.status.toUpperCase()}]${reset} ${check.name}: ${check.value}`)
      if (check.recommendation) {
        console.log(`           ${dim}-> ${check.recommendation}${reset}`)
      }
      if (check.details?.length) {
        for (const d of check.details) {
          console.log(`           ${dim}   ${d}${reset}`)
        }
      }
    }
    console.log()
  }

  if (report.recommendations.length > 0) {
    console.log(`${bold}Recommendations:${reset}`)
    for (const rec of report.recommendations) {
      const pColor = rec.priority === 'high' ? '\x1b[31m' : rec.priority === 'medium' ? '\x1b[33m' : '\x1b[32m'
      console.log(`  ${pColor}[${rec.priority.toUpperCase()}]${reset} ${rec.action}`)
    }
    console.log()
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const supabase = getSupabaseClient()
  const startTime = Date.now()

  // Fetch the first user's work profile (single-user app)
  const { data: profiles, error: profileErr } = await supabase
    .from('ai_work_profiles')
    .select('*')
    .limit(1)

  if (profileErr) {
    console.error('Failed to fetch profile:', profileErr.message)
    process.exit(1)
  }

  const profile = profiles?.[0] || null
  const observations = profile?.memory_graph || []

  // Run assessments
  const sections = [
    assessCoverage(profile),
    assessFreshness(observations),
    assessDensity(observations),
    assessContradictions(observations),
  ]

  // Note: Behavioral metrics (acceptance rate, retry rate, session depth)
  // are tracked in browser localStorage and only available via in-app assessment.
  // CLI assessment covers profile-level metrics only.

  // Compute overall
  let totalWeight = 0
  let weightedSum = 0
  for (const s of sections) {
    weightedSum += s.score * s.weight
    totalWeight += s.weight
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  // Generate recommendations
  const recommendations = []
  for (const s of sections) {
    for (const c of s.checks) {
      if (c.recommendation) {
        recommendations.push({
          priority: c.status === 'fail' ? 'high' : c.status === 'warn' ? 'medium' : 'low',
          action: c.recommendation,
        })
      }
    }
  }
  recommendations.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })

  const report = {
    id: `mhr-${Date.now()}`,
    overallScore,
    grade: computeGrade(overallScore),
    sections,
    recommendations,
    mode: isFullMode ? 'full' : 'fast',
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  }

  if (isPretty) {
    printPretty(report)
  } else {
    console.log(JSON.stringify(report, null, 2))
  }

  // Exit with non-zero if grade is F
  if (report.grade === 'F') process.exit(2)
}

main().catch(e => {
  console.error('Assessment failed:', e.message)
  process.exit(1)
})
