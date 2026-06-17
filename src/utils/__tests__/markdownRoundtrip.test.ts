import { describe, it, expect } from 'vitest'
import { parseMarkdown, htmlToMarkdown } from '../markdown'

/**
 * BUG-1872 / TASK-1873: the TipTap editor stores markdown but renders HTML, round-tripping
 * `htmlToMarkdown(parseMarkdown(md))` on every autosave echo. That converter (a hand-rolled
 * regex in src/utils/markdown.ts) is not byte-stable, which is what drove the "description
 * keeps resetting" loop.
 *
 * BUG-1872 is fixed at the state layer (useTaskEditState pins the in-editor description while
 * the modal is open, so drift can no longer reset the editor). The converter itself is still
 * lossy — replacing it with a real markdown serializer is tracked as TASK-1873. These tests
 * document the current contract: which inputs are stable today, and the known drift that
 * TASK-1873 must close.
 */
const editorRoundtrip = (md: string): string => htmlToMarkdown(parseMarkdown(md))

const stableCases: Record<string, string> = {
  plainEnglish: 'Hello world',
  hebrew: 'כלים שאני רוצה לנסות',
  hebrewSentence: 'לא לחכות עד שאפשר ליצור תוכן',
  multiParagraph: 'First line\n\nSecond line',
  withBold: 'this is **bold** text',
  trailingNewline: 'text with trailing\n',
}

describe('markdown converter idempotency (BUG-1872 / TASK-1873)', () => {
  for (const [name, md] of Object.entries(stableCases)) {
    it(`is stable for: ${name}`, () => {
      const once = editorRoundtrip(md)
      expect(editorRoundtrip(once)).toBe(once)
    })
  }

  // KNOWN DEBT (regex converter): bullet lists gain a blank line on every round-trip
  // ('- a\n\n- b' -> '- a\n\n\n- b'). This converter is no longer on any EDIT path — TASK-1873
  // moved the editor onto the real tiptap-markdown serializer (see
  // src/components/common/__tests__/tiptapMarkdownRoundtrip.test.ts, which proves idempotency
  // for these exact cases). `htmlToMarkdown` now only survives as legacy; `parseMarkdown` is
  // used only for one-way display in MarkdownRenderer, where idempotency is irrelevant. Kept
  // skipped as a record of why the converter was replaced, not as a target to fix in place.
  it.skip('regex converter list-drift (superseded by tiptap-markdown serializer)', () => {
    const md = '- one\n- two\n- three'
    const once = editorRoundtrip(md)
    expect(editorRoundtrip(once)).toBe(once)
  })
})
