import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function writeSql(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), 'flowstate-ai-memory-safety-'))
  const file = join(dir, 'bundle.sql')
  writeFileSync(file, sql)
  return file
}

function runSafetyCheck(sql: string) {
  return execFileSync('node', ['scripts/check-ai-memory-migration-safety.cjs', writeSql(sql)], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function expectUnsafe(sql: string) {
  expect(() => runSafetyCheck(sql)).toThrow()
}

describe('AI memory migration safety check', () => {
  it('allows retry-safe policy and trigger drops', () => {
    const output = runSafetyCheck(`
      drop policy if exists "Users can view their own AI context entities" on public.ai_context_entities;
      create policy "Users can view their own AI context entities"
        on public.ai_context_entities for select using (auth.uid() = user_id);
      drop trigger if exists update_ai_parameter_beliefs_updated_at on public.ai_parameter_beliefs;
      create trigger update_ai_parameter_beliefs_updated_at
        before update on public.ai_parameter_beliefs
        for each row execute function public.update_updated_at_column();
    `)

    expect(output).toContain('passed destructive-operation safety check')
  })

  it('rejects destructive table and data operations', () => {
    expectUnsafe('drop table public.tasks;')
    expectUnsafe('drop schema public;')
    expectUnsafe('drop index public.idx_tasks_user_id;')
    expectUnsafe('truncate public.tasks;')
    expectUnsafe('delete from public.tasks where true;')
    expectUnsafe('alter table public.tasks drop column title;')
  })

  it('does not treat comments or foreign key ON DELETE clauses as destructive data deletion', () => {
    const output = runSafetyCheck(`
      -- delete from public.tasks;
      create table if not exists public.ai_parameter_beliefs (
        id uuid primary key,
        user_id uuid references auth.users(id) on delete cascade not null
      );
    `)

    expect(output).toContain('passed destructive-operation safety check')
  })

  it('passes the generated live AI memory migration bundle', () => {
    const bundlePath = join(tmpdir(), `flowstate-ai-memory-live-migration-${Date.now()}.sql`)
    execFileSync('node', ['scripts/build-ai-memory-migration-bundle.cjs', bundlePath], {
      cwd: root,
      encoding: 'utf8',
    })

    const output = execFileSync('node', ['scripts/check-ai-memory-migration-safety.cjs', bundlePath], {
      cwd: root,
      encoding: 'utf8',
    })

    expect(output).toContain('passed destructive-operation safety check')
  })
})
