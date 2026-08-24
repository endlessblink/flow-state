import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const runner = readFileSync('.claude/scripts/challenge_runner.py', 'utf8')

describe('project-local challenge runner', () => {
  it('fails closed when an acceptance item is open', () => {
    expect(runner).toContain('if item.get("status") != "PASS"')
    expect(runner).toContain('return fail(f"acceptance item is not PASS: {item[\'id\']}"')
  })

  it('requires exact snapshot-bound artifact hashes for PASS', () => {
    expect(runner).toContain('review.get("snapshot") != snapshot_hash')
    expect(runner).toContain('proof.get("bound_snapshot_sha256") != snapshot_hash')
    expect(runner).toContain('hashlib.sha256(artifact_path.read_bytes()).hexdigest() != artifact_hash')
  })

  it('requires isolated read-only reviewer metadata and complete evidence metadata', () => {
    expect(runner).toContain('reviewer.get("authority") != "read-only"')
    expect(runner).toContain('reviewer.get("isolation_evidence")')
    expect(runner).toContain('evidence does not cover exactly every acceptance item')
    expect(runner).toContain('for field in ("producer_id", "authority", "captured_at", "result")')
  })
})
