/**
 * TASK-1814 — AI prioritization quality eval (LLM-as-judge).
 *
 * Measures how good the chat's prioritization answers actually are — relevance,
 * actionability, non-genericness, holistic insight, honesty — instead of guessing.
 * For each eval case it (1) generates an answer with the SAME formatter prompt the
 * app uses, then (2) has a judge score it against a rubric. Compares the current
 * "rich data, no pre-digest" approach vs the old "pre-digested facts" baseline.
 *
 * Uses the local `claude` CLI (same model the bridge runs) — no auth/network needed.
 * RUN:
 *   node tests/manual/ai-prioritization-eval.mjs            # current approach
 *   node tests/manual/ai-prioritization-eval.mjs --baseline # also run old approach
 *
 * Makes ~2 claude calls per case (generate + judge); --baseline doubles the generate.
 */
import { execFile } from 'node:child_process'

const WITH_BASELINE = process.argv.includes('--baseline')

// ── The app's formatter system prompt (keep in sync with useAIChat.ts) ──
const GENERATOR_SYSTEM = [
  'You format task data into natural language. Output ONLY in English.',
  'WHEN RANKING BY PRIORITY/URGENCY: "X days overdue" and "high priority" are METADATA, never a reason. Lead EACH task with the real-world STAKE inferred from its wording/notes. You MAY mention lateness only as a brief aside. If a task gives no clue to its stakes, say so honestly instead of inventing urgency.',
  'LOOK ACROSS THE WHOLE LIST: GROUP related tasks (same project/theme or sequential steps of one effort), flag DEPENDENCIES, and call out the TREND you see (a project stalling, one theme dominating the overdue pile). This cross-task insight is the most valuable part; a per-task list without it is a failure.',
  'USE the task notes and the user work patterns. Tailor to how they actually work; no generic advice.',
].join('\n')

// Old approach reproduced faithfully: the real app's reasoningDirective force-fed
// pre-computed FACTS and locked the format. This mirrors that — metadata only, no
// reasoning/grouping/trends — so the eval shows the TRUE gap vs the new approach.
const BASELINE_SYSTEM = [
  'You format task data into a list. Output ONLY in English.',
  'For EACH task output exactly one bullet: **<task title>** — <priority> priority, <N> days overdue.',
  'Order by most overdue first. Do NOT add stakes, reasons, grouping, dependencies, trends, or advice. Output ONLY the metadata bullets — nothing else.',
].join('\n')

const PATTERNS = 'User work patterns: averages ~4 tasks/day; currently overloaded with 24 overdue; productive Sun-Tue.'

const CASES = [
  {
    name: 'rich notes (sales + personal mix)',
    query: 'what are my most urgent tasks and why?',
    data: `• Check payment via Cardcom | priority=high | OVERDUE (was due 06-01) | notes: "A customer charge failed in the gateway; if not re-run they are never billed and we lose this month's revenue."
• Gift for Sivan | priority=high | OVERDUE (was due 06-03) | notes: "Her birthday party is Saturday June 7; buy and wrap before then."
• Build list of 10 real cold-outreach targets | priority=high | OVERDUE (was due 06-03) | notes: "First step of the new sales push."
• Write one cold opener from the target list | priority=high | OVERDUE (was due 06-03) | notes: "Needs the target list first."
• Water the plants | priority=low | OVERDUE (was due 06-04) | notes: ""`,
  },
  {
    name: 'bare titles, no notes (real user case)',
    query: 'what should I focus on?',
    data: `• Check payments on the site via Cardcom | priority=high | OVERDUE (was due 06-01)
• Check with Reuital about her birthday | priority=high | OVERDUE (was due 06-01)
• Gift for Sivan | priority=high | OVERDUE (was due 06-01)
• Build list of 10 real cold-outreach targets | priority=high | OVERDUE (was due 06-03)
• Write one cold opener from the target list | priority=high | OVERDUE (was due 06-03)
• Order laundry | priority=low | OVERDUE (was due 06-04)`,
  },
]

const RUBRIC = `Score the assistant's prioritization answer 1-5 on EACH dimension (5=excellent):
- relevance: does it lead with what is genuinely at stake, not metadata?
- actionability: concrete next steps (what to do, in what order) vs vague?
- non_genericness: specific to THESE tasks and THIS user's patterns vs generic productivity advice?
- holistic: groups related tasks, flags dependencies, names a real cross-task trend?
- honesty: flags uncertainty / no invented urgency for vague tasks?
Penalize hard any answer that justifies priority with "X days overdue" or "high priority".
Return ONLY JSON: {"relevance":n,"actionability":n,"non_genericness":n,"holistic":n,"honesty":n,"overall":n,"note":"one line"}`

function claude(system, prompt, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    execFile('claude', [
      '-p', prompt,
      '--append-system-prompt', system,
      '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--output-format', 'text',
    ], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) return reject(err)
      resolve((stdout || '').trim())
    })
  })
}

function parseScores(text) {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

async function evalOne(genSystem, label, c) {
  const answer = await claude(genSystem, `User: ${c.query}\n\n${PATTERNS}\n\nData:\n${c.data}`)
  const judgePrompt = `${RUBRIC}\n\nUser asked: "${c.query}"\nTasks:\n${c.data}\n\nAssistant answer:\n"""\n${answer}\n"""`
  const scores = parseScores(await claude('You are a strict evaluator of productivity-assistant answers. Output only JSON.', judgePrompt))
  return { label, answer, scores }
}

const avg = (s) => s ? ((s.relevance + s.actionability + s.non_genericness + s.holistic + s.honesty) / 5).toFixed(2) : '?'

;(async () => {
  console.log('=== AI prioritization quality eval ===\n')
  const totals = { current: [], baseline: [] }
  for (const c of CASES) {
    console.log(`\n▶ CASE: ${c.name}`)
    const cur = await evalOne(GENERATOR_SYSTEM, 'current', c)
    totals.current.push(cur.scores)
    console.log(`  CURRENT  avg=${avg(cur.scores)}  ${cur.scores ? JSON.stringify(cur.scores) : '(judge parse failed)'}`)
    if (WITH_BASELINE) {
      const base = await evalOne(BASELINE_SYSTEM, 'baseline', c)
      totals.baseline.push(base.scores)
      console.log(`  BASELINE avg=${avg(base.scores)}  ${base.scores ? JSON.stringify(base.scores) : '(judge parse failed)'}`)
    }
  }
  const mean = (arr) => { const v = arr.filter(Boolean).map(s => +avg(s)); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '?' }
  console.log(`\n=== OVERALL ===`)
  console.log(`  current mean:  ${mean(totals.current)} / 5`)
  if (WITH_BASELINE) console.log(`  baseline mean: ${mean(totals.baseline)} / 5  (the old pre-digested approach)`)
})().catch(e => { console.error('eval error:', e.message); process.exit(1) })
