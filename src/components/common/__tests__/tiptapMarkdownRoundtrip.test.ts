import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { Markdown } from 'tiptap-markdown'

/**
 * TASK-1873: replace the lossy regex converter with a real serializer.
 * This proves tiptap-markdown round-trips are idempotent for the cases that broke
 * the regex converter (BUG-1872). If a value survives one round-trip, it survives all.
 */
function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Markdown.configure({ html: true, tightLists: true, linkify: false, breaks: false }),
    ],
    content: '',
  })
}

const roundtrip = (md: string): string => {
  const editor = makeEditor()
  editor.commands.setContent(md)
  const out = (editor.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
  editor.destroy()
  return out
}

const cases: Record<string, string> = {
  plainEnglish: 'Hello world',
  hebrew: 'כלים שאני רוצה לנסות',
  hebrewSentence: 'לא לחכות עד שאפשר ליצור תוכן',
  multiParagraph: 'First line\n\nSecond line',
  bulletList: '- one\n- two\n- three',
  numberedList: '1. one\n2. two\n3. three',
  withBold: 'this is **bold** text',
  withItalic: 'this is *italic* text',
}

describe('TASK-1873 tiptap-markdown serializer is idempotent', () => {
  for (const [name, md] of Object.entries(cases)) {
    it(`stable round-trip: ${name}`, () => {
      const once = roundtrip(md)
      const twice = roundtrip(once)
      // Idempotent: a second pass must not change the value (this is what the regex failed).
      expect(twice).toBe(once)
    })
  }
})
