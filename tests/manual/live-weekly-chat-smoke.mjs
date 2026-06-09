#!/usr/bin/env node

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'

const ROOT = new URL('../..', import.meta.url)
const TARGET_URL = process.env.FLOWSTATE_LIVE_SMOKE_URL || 'http://localhost:5546/#/tasks'
const DISPLAY = process.env.DISPLAY || ':0'
const XAUTHORITY = process.env.XAUTHORITY || '/run/user/1000/xauth_Mqgwcs'
const TEST_EMAIL = 'playwright@test.flowstate'
const TEST_PASSWORD = 'pw-playwright-e2e-2026!'

function envValue(text, name) {
  const match = text.match(new RegExp(`^${name}="?([^"\\n]+)"?`, 'm'))
  return match?.[1] || ''
}

async function loadEnv() {
  const text = await fs.readFile(new URL('.env.local', ROOT), 'utf8')
  return {
    supabaseUrl: envValue(text, 'VITE_SUPABASE_URL'),
    anonKey: envValue(text, 'VITE_SUPABASE_ANON_KEY'),
    serviceRoleKey: envValue(text, 'SUPABASE_SERVICE_ROLE_KEY'),
  }
}

async function ensureUserSession() {
  const env = await loadEnv()
  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const users = await admin.auth.admin.listUsers()
  if (users.error) throw users.error
  let user = users.data.users.find(item => item.email === TEST_EMAIL)
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Playwright Test User' },
    })
    if (created.error) throw created.error
    user = created.data.user
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (updated.error) throw updated.error
  }

  const auth = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: env.anonKey },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  if (!auth.ok) throw new Error(`Auth failed: ${auth.status} ${await auth.text()}`)
  return { session: await auth.json(), admin, userId: user.id }
}

async function resetUserData(admin, userId) {
  await admin.from('ai_parameter_beliefs').delete().eq('user_id', userId)
  await admin.from('ai_clarification_events').delete().eq('user_id', userId)
  await admin.from('ai_context_entities').delete().eq('user_id', userId)
  await admin.from('ai_recommendation_feedback').delete().eq('user_id', userId)
  await admin.from('project_contexts').delete().eq('user_id', userId)
  await admin.from('task_contexts').delete().eq('user_id', userId)
  await admin.from('memory_events').delete().eq('user_id', userId)
  await admin.from('ai_conversations').delete().eq('user_id', userId)
  await admin.from('tasks').delete().eq('user_id', userId)
  await admin.from('groups').delete().eq('user_id', userId)
  await admin.from('projects').delete().eq('user_id', userId)
  await admin.from('user_settings').delete().eq('user_id', userId)
}

async function seedTasks(admin, userId, scenario = 'compact') {
  const inDays = days => new Date(Date.now() + days * 86400000).toISOString()
  const workProjectId = '11111111-1111-1111-1111-111111111111'
  const personalProjectId = '22222222-2222-2222-2222-222222222222'

  await resetUserData(admin, userId)

  if (scenario === 'clarification') {
    const launchProjectId = '33333333-3333-3333-3333-333333333333'
    const renewalProjectId = '44444444-4444-4444-4444-444444444444'
    let result = await admin.from('projects').insert([
      { id: launchProjectId, user_id: userId, name: 'Quiet Launch', color: '#7C3AED', color_type: 'hex', view_type: 'status' },
      { id: renewalProjectId, user_id: userId, name: 'Renewal Desk', color: '#F59E0B', color_type: 'hex', view_type: 'status' },
    ])
    if (result.error) throw result.error

    result = await admin.from('tasks').insert([
      { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', user_id: userId, project_id: launchProjectId, title: 'Prepare quiet launch decision', description: '', status: 'planned', priority: 'high', due_date: inDays(2), estimated_duration: 120 },
      { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', user_id: userId, project_id: renewalProjectId, title: 'Outline renewal handoff', description: '', status: 'planned', priority: 'high', due_date: inDays(3), estimated_duration: 90 },
      { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', user_id: userId, project_id: launchProjectId, title: 'Map launch dependency cleanup', description: '', status: 'planned', priority: 'medium', due_date: inDays(4), estimated_duration: 75 },
      { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', user_id: userId, project_id: renewalProjectId, title: 'Review renewal loose ends', description: '', status: 'planned', priority: 'medium', due_date: inDays(5), estimated_duration: 60 },
    ])
    if (result.error) throw result.error

    result = await admin.from('user_settings').insert({
      user_id: userId,
      theme: 'dark',
      language: 'he',
      work_duration: 1200,
      short_break_duration: 300,
      long_break_duration: 900,
      auto_start_breaks: true,
      auto_start_pomodoros: true,
    })
    if (result.error) throw result.error
    return
  }

  let result = await admin.from('projects').insert([
    { id: workProjectId, user_id: userId, name: 'Work', color: '#4ECDC4', color_type: 'hex', view_type: 'status' },
    { id: personalProjectId, user_id: userId, name: 'Personal', color: '#FF6B6B', color_type: 'hex', view_type: 'priority' },
  ])
  if (result.error) throw result.error

  result = await admin.from('tasks').insert([
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', user_id: userId, project_id: workProjectId, title: 'Fix FlowState chat memory so it stops giving generic plans', description: 'Product quality work. Weekly planner should use memory and avoid generic dumps.', status: 'planned', priority: 'high', due_date: inDays(3), estimated_duration: 120 },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', user_id: userId, project_id: workProjectId, title: 'Prepare client renewal notes', description: 'Client/money commitment. Needs a compact decision before the end of the week.', status: 'in_progress', priority: 'high', due_date: inDays(1), estimated_duration: 90 },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', user_id: userId, project_id: workProjectId, title: 'Review stale weekly planning bug reports', description: 'Connects to the chat-memory lane and stale card suppression.', status: 'planned', priority: 'medium', due_date: inDays(5), estimated_duration: 75 },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04', user_id: userId, project_id: personalProjectId, title: 'Buy printer paper', description: 'Small admin errand. Should not outrank product or client work just because it is easy.', status: 'planned', priority: 'high', due_date: inDays(2), estimated_duration: 20 },
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05', user_id: userId, project_id: personalProjectId, title: 'Plan family weekend logistics', description: 'Personal commitment, useful but not the core work lane.', status: 'planned', priority: 'medium', due_date: inDays(4), estimated_duration: 45 },
  ])
  if (result.error) throw result.error

  result = await admin.from('user_settings').insert({
    user_id: userId,
    theme: 'dark',
    language: 'en',
    work_duration: 1200,
    short_break_duration: 300,
    long_break_duration: 900,
    auto_start_breaks: true,
    auto_start_pomodoros: true,
  })
  if (result.error) throw result.error
}

async function main() {
  const { session, admin, userId } = await ensureUserSession()
  const authStorageValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
    token_type: 'bearer',
    user: session.user,
  })

  const result = {
    ok: false,
    bridgeChat: false,
    ollamaLogs: [],
    decisionLogs: [],
    inlineQuestionLogs: [],
    clarificationRuntimeLogs: [],
    turnLogs: [],
    toolLogs: [],
    sectionCount: 0,
    clarification: {
      asked: false,
      answeredEventCount: 0,
      contextEntityCount: 0,
      postAnswerSectionCount: 0,
      activeQuestionOptionCountAfterAnswer: 0,
    },
    screenshot: '/tmp/flowstate-ai-weekly-live-smoke.png',
    clarificationScreenshot: '/tmp/flowstate-ai-weekly-clarification-smoke.png',
  }

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox'],
    env: { DISPLAY, XAUTHORITY },
  })

  try {
    await seedTasks(admin, userId, 'compact')
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.addInitScript(({ authStorageValue }) => {
      localStorage.setItem('flowstate-supabase-auth', authStorageValue)
      localStorage.removeItem('flowstate-ai-conversations')
      const settings = JSON.parse(localStorage.getItem('flowstate-settings-v2') || '{}')
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({
        ...settings,
        aiSetupComplete: true,
        aiUseSubscription: true,
        aiBrain: 'claude',
      }))
      localStorage.setItem('flowstate-ai-settings', JSON.stringify({
        provider: 'bridge',
        model: 'claude',
        chatDirection: 'rtl',
        chatLanguage: 'he',
      }))
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    }, { authStorageValue })

    const page = await context.newPage()
    page.on('console', msg => {
      const text = msg.text()
      if (/\[Ollama\]|Ollama/.test(text)) result.ollamaLogs.push(text)
      if (text.includes('[AIChat:WeeklyPlanDecision]')) result.decisionLogs.push(text)
      if (text.includes('[AIChat:WeeklyInlineQuestion]')) result.inlineQuestionLogs.push(text)
      if (text.includes('[AIChat:ClarificationRuntime]')) result.clarificationRuntimeLogs.push(text)
      if (text.includes('[AIChat:TurnLifecycle]')) result.turnLogs.push(text)
      if (text.includes('[AIChat:Deterministic]')) result.toolLogs.push(text)
    })
    page.on('request', req => {
      if (req.url().includes('/ai-bridge/v1/chat')) result.bridgeChat = true
    })

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.locator('.ai-toggle-btn').first().waitFor({ state: 'visible', timeout: 30000 })
    await page.locator('.ai-toggle-btn').first().click()
    const input = page.locator('.ai-chat-input').first()
    await input.waitFor({ state: 'visible', timeout: 30000 })
    await page.locator('.new-chat-btn').first().click({ timeout: 5000 }).catch(() => undefined)
    await input.fill('תעזור לי לארגן את שארית השבוע')
    await page.locator('.send-btn').click({ timeout: 5000 }).catch(async () => input.press('Enter'))
    await page.locator('[data-testid="ai-activity-running"]').waitFor({ state: 'detached', timeout: 90000 })

    const plan = page.locator('[data-testid="weekly-plan"]').last()
    await plan.waitFor({ state: 'visible', timeout: 60000 })
    const text = await page.locator('.ai-chat-messages').textContent({ timeout: 10000 }) || ''
    result.sectionCount = await plan.locator('.weekly-plan-section').count()

    if (!/נתיב|Lane|נתיבי עבודה|work lanes/i.test(text)) throw new Error('missing lane text')
    if (/נתיב\s*:?\s*(Work|My Projects|Personal)\b|Lane\s*:?\s*(Work|My Projects|Personal)\b/i.test(text)) throw new Error('generic project bucket rendered as lane')
    if (/נמצאו\s+\d+\s+משימות|Found\s+\d+\s+tasks/i.test(text)) throw new Error('generic task dump visible')
    if (/What kind of project is "Work"|איזה סוג פרויקט הוא "Work"/i.test(text)) throw new Error('generic Work bucket question visible')
    if (!(result.sectionCount > 0 && result.sectionCount <= 3)) throw new Error(`section count out of range: ${result.sectionCount}`)
    if (await plan.locator('[data-testid="inline-plan-card"]').count() < 1) throw new Error('no inline plan cards rendered')
    if (result.ollamaLogs.length) throw new Error(`Ollama logs present: ${result.ollamaLogs.join('\n')}`)
    if (!result.bridgeChat) throw new Error('no live bridge chat request observed')
    if (!result.decisionLogs.some(line => /ask|proceed|forced_compact_draft|plan_ready/.test(line))) throw new Error('missing weekly decision logs')
    if (!result.turnLogs.some(line => /weekly_plan_artifact_prepared/.test(line))) throw new Error('missing weekly artifact lifecycle log')

    await page.screenshot({ path: result.screenshot, fullPage: false })

    await context.close()

    await seedTasks(admin, userId, 'clarification')
    const clarifyContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await clarifyContext.addInitScript(({ authStorageValue }) => {
      localStorage.setItem('flowstate-supabase-auth', authStorageValue)
      localStorage.removeItem('flowstate-ai-conversations')
      localStorage.setItem('flowstate-settings-v2', JSON.stringify({
        aiSetupComplete: true,
        aiUseSubscription: true,
        aiBrain: 'claude',
      }))
      localStorage.setItem('flowstate-ai-settings', JSON.stringify({
        provider: 'bridge',
        model: 'claude',
        chatDirection: 'rtl',
        chatLanguage: 'he',
      }))
      localStorage.setItem('flowstate-onboarding-v2', 'true')
      localStorage.setItem('flowstate-welcome-seen', 'true')
    }, { authStorageValue })
    const clarifyPage = await clarifyContext.newPage()
    clarifyPage.on('console', msg => {
      const text = msg.text()
      if (/\[Ollama\]|Ollama/.test(text)) result.ollamaLogs.push(text)
      if (text.includes('[AIChat:WeeklyPlanDecision]')) result.decisionLogs.push(text)
      if (text.includes('[AIChat:WeeklyInlineQuestion]')) result.inlineQuestionLogs.push(text)
      if (text.includes('[AIChat:ClarificationRuntime]')) result.clarificationRuntimeLogs.push(text)
      if (text.includes('[AIChat:TurnLifecycle]')) result.turnLogs.push(text)
      if (text.includes('[AIChat:Deterministic]')) result.toolLogs.push(text)
    })
    clarifyPage.on('request', req => {
      if (req.url().includes('/ai-bridge/v1/chat')) result.bridgeChat = true
    })
    await clarifyPage.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await clarifyPage.locator('.ai-toggle-btn').first().waitFor({ state: 'visible', timeout: 30000 })
    await clarifyPage.locator('.ai-toggle-btn').first().click()
    const clarifyInput = clarifyPage.locator('.ai-chat-input').first()
    await clarifyInput.waitFor({ state: 'visible', timeout: 30000 })
    await clarifyPage.locator('.new-chat-btn').first().click({ timeout: 5000 }).catch(() => undefined)
    await clarifyInput.fill('תעזור לי לארגן את שארית השבוע')
    await clarifyPage.locator('.send-btn').click({ timeout: 5000 }).catch(async () => clarifyInput.press('Enter'))
    const clarificationCard = clarifyPage.locator('[data-testid="ai-clarification"]').last()
    try {
      await clarificationCard.waitFor({ state: 'visible', timeout: 60000 })
    } catch (error) {
      result.clarificationScreenshot = '/tmp/flowstate-ai-weekly-clarification-missing.png'
      await clarifyPage.screenshot({ path: result.clarificationScreenshot, fullPage: false }).catch(() => undefined)
      result.clarification.debugText = (await clarifyPage.locator('.ai-chat-messages').textContent({ timeout: 5000 }).catch(() => '')) || ''
      console.error(JSON.stringify(result, null, 2))
      throw error
    }
    result.clarification.asked = true
    await clarificationCard.locator('details').first().click().catch(() => undefined)
    await clarificationCard.locator('.weekly-question-option').first().click()
    const freeText = clarificationCard.locator('.weekly-question-free-text').first()
    if (await freeText.count()) {
      await freeText.fill('השבוע חשוב לסגור התחייבות עבודה אחת ולא לפתוח רשימה ארוכה.')
    }
    await clarificationCard.locator('.weekly-question-apply').first().click()
    await clarifyPage.locator('[data-testid="ai-activity-running"]').waitFor({ state: 'detached', timeout: 90000 })
    const postAnswerPlan = clarifyPage.locator('[data-testid="weekly-plan"]').last()
    try {
      await postAnswerPlan.waitFor({ state: 'visible', timeout: 60000 })
    } catch (error) {
      result.clarificationScreenshot = '/tmp/flowstate-ai-weekly-clarification-failed.png'
      await clarifyPage.screenshot({ path: result.clarificationScreenshot, fullPage: false }).catch(() => undefined)
      result.clarification.debugText = (await clarifyPage.locator('.ai-chat-messages').textContent({ timeout: 5000 }).catch(() => '')) || ''
      console.error(JSON.stringify(result, null, 2))
      throw error
    }
    result.clarification.postAnswerSectionCount = await postAnswerPlan.locator('.weekly-plan-section').count()
    result.clarification.activeQuestionOptionCountAfterAnswer = await clarificationCard.locator('.weekly-question-option').count()
    const clarifyText = await clarifyPage.locator('.ai-chat-messages').textContent({ timeout: 10000 }) || ''
    if (!/הקשר שעניתי עכשיו|תשובה:|נתיב|נתיבי עבודה/i.test(clarifyText)) throw new Error('answered context did not visibly affect the chat')
    if (result.clarification.activeQuestionOptionCountAfterAnswer !== 0) throw new Error('answered clarification still has active options visible')
    if (!(result.clarification.postAnswerSectionCount > 0 && result.clarification.postAnswerSectionCount <= 3)) {
      throw new Error(`post-answer section count out of range: ${result.clarification.postAnswerSectionCount}`)
    }
    await clarifyPage.screenshot({ path: result.clarificationScreenshot, fullPage: false })
    await clarifyContext.close()

    const answeredEvents = await admin.from('ai_clarification_events')
      .select('id, event_type, question_id, selected_label, free_text')
      .eq('user_id', userId)
      .eq('event_type', 'answered')
    if (answeredEvents.error) throw answeredEvents.error
    result.clarification.answeredEventCount = answeredEvents.data?.length ?? 0
    if (result.clarification.answeredEventCount < 1) throw new Error('no answered clarification event persisted')
    const contextEntities = await admin.from('ai_context_entities')
      .select('id, entity_key, facts')
      .eq('user_id', userId)
    if (contextEntities.error) throw contextEntities.error
    result.clarification.contextEntityCount = contextEntities.data?.length ?? 0
    if (result.clarification.contextEntityCount < 1) throw new Error('no AI context entity persisted from answer')
    if (!result.decisionLogs.some(line => /stage:\s*ask|stage: ask|\"stage\":\"ask\"/.test(line))) throw new Error('missing ask decision log')
    if (!result.decisionLogs.some(line => /forced_compact_draft/.test(line))) throw new Error('missing forced compact draft continuation log')
    if (result.clarificationRuntimeLogs.length) throw new Error(`browser localhost should not probe Electron Mastra runtime: ${result.clarificationRuntimeLogs.join('\n')}`)

    result.ok = true
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
