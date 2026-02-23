import { describe, it, expect } from 'vitest'
import { mergePayloads } from '@/services/offline/operationCoalescer'

describe('mergePayloads', () => {
  // ---------------------------------------------------------------------------
  // Basic merging
  // ---------------------------------------------------------------------------
  describe('basic merging', () => {
    it('returns override values when base is empty', () => {
      const result = mergePayloads({}, { title: 'hello', count: 3 })
      expect(result).toEqual({ title: 'hello', count: 3 })
    })

    it('preserves base keys that are absent from override', () => {
      const result = mergePayloads({ a: 1, b: 2 }, { b: 99 })
      expect(result).toEqual({ a: 1, b: 99 })
    })

    it('override value replaces base value for the same key', () => {
      const result = mergePayloads({ status: 'pending' }, { status: 'done' })
      expect(result).toEqual({ status: 'done' })
    })

    it('merges multiple keys correctly', () => {
      const base = { a: 1, b: 2, c: 3 }
      const override = { b: 20, d: 40 }
      expect(mergePayloads(base, override)).toEqual({ a: 1, b: 20, c: 3, d: 40 })
    })

    it('returns a new object and does not mutate base', () => {
      const base = { x: 1 }
      const result = mergePayloads(base, { x: 2 })
      expect(result).not.toBe(base)
      expect(base.x).toBe(1)
    })

    it('returns a new object and does not mutate override', () => {
      const override = { x: 2 }
      mergePayloads({ x: 1 }, override)
      expect(override.x).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Undefined handling
  // ---------------------------------------------------------------------------
  describe('undefined handling', () => {
    it('undefined override value does NOT overwrite base value', () => {
      const result = mergePayloads({ title: 'keep me' }, { title: undefined })
      expect(result).toEqual({ title: 'keep me' })
    })

    it('undefined override value does NOT add a key that was absent in base', () => {
      const result = mergePayloads({ a: 1 }, { b: undefined })
      expect(result).toEqual({ a: 1 })
    })

    it('null override value DOES overwrite base value', () => {
      const result = mergePayloads({ title: 'original' }, { title: null })
      expect(result).toEqual({ title: null })
    })

    it('null override value DOES add key absent from base', () => {
      const result = mergePayloads({ a: 1 }, { b: null })
      expect(result).toEqual({ a: 1, b: null })
    })

    it('mix of undefined and defined override values — only defined ones apply', () => {
      const base = { a: 1, b: 2, c: 3 }
      const override = { a: undefined, b: 99, c: undefined }
      expect(mergePayloads(base, override)).toEqual({ a: 1, b: 99, c: 3 })
    })
  })

  // ---------------------------------------------------------------------------
  // Nested object merging (shallow, one level deep)
  // ---------------------------------------------------------------------------
  describe('nested object merging', () => {
    it('merges nested objects one level deep when both base and override have an object at the same key', () => {
      const base = { meta: { color: 'red', size: 'large' } }
      const override = { meta: { size: 'small', weight: 5 } }
      expect(mergePayloads(base, override)).toEqual({
        meta: { color: 'red', size: 'small', weight: 5 }
      })
    })

    it('nested override keys that are new are added to base nested object', () => {
      const base = { meta: { existing: true } }
      const override = { meta: { newKey: 42 } }
      expect(mergePayloads(base, override)).toEqual({
        meta: { existing: true, newKey: 42 }
      })
    })

    it('nested override keys replace matching base nested keys', () => {
      const base = { meta: { priority: 'low' } }
      const override = { meta: { priority: 'high' } }
      expect(mergePayloads(base, override)).toEqual({
        meta: { priority: 'high' }
      })
    })

    it('non-overlapping nested keys in base are preserved after merge', () => {
      const base = { meta: { alpha: 1, beta: 2 } }
      const override = { meta: { gamma: 3 } }
      const result = mergePayloads(base, override)
      expect(result).toEqual({ meta: { alpha: 1, beta: 2, gamma: 3 } })
    })

    it('does NOT perform deep merge beyond one level — second level object replaces entirely', () => {
      const base = { a: { b: { c: 1, d: 2 } } }
      const override = { a: { b: { c: 99 } } }
      // a is shallow-merged, so a.b from override replaces a.b from base entirely
      expect(mergePayloads(base, override)).toEqual({ a: { b: { c: 99 } } })
    })

    it('does not mutate base nested object', () => {
      const base = { meta: { x: 1 } }
      mergePayloads(base, { meta: { x: 2 } })
      expect(base.meta.x).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Array handling
  // ---------------------------------------------------------------------------
  describe('array handling', () => {
    it('array in override replaces array in base entirely (no concatenation)', () => {
      const base = { tags: ['a', 'b', 'c'] }
      const override = { tags: ['x'] }
      expect(mergePayloads(base, override)).toEqual({ tags: ['x'] })
    })

    it('empty array in override replaces non-empty array in base', () => {
      const base = { tags: [1, 2, 3] }
      const override = { tags: [] }
      expect(mergePayloads(base, override)).toEqual({ tags: [] })
    })

    it('array in override replaces an object in base (no shallow merge)', () => {
      const base = { data: { key: 'value' } }
      const override = { data: [1, 2, 3] }
      expect(mergePayloads(base, override)).toEqual({ data: [1, 2, 3] })
    })

    it('object in base is NOT shallow-merged with array in override', () => {
      const base = { info: { keep: true } }
      const override = { info: ['replaced'] }
      const result = mergePayloads(base, override)
      expect(Array.isArray(result.info)).toBe(true)
      expect(result.info).toEqual(['replaced'])
    })

    it('nested array within override object is replaced, not merged', () => {
      const base = { meta: { ids: [1, 2] } }
      const override = { meta: { ids: [3] } }
      // meta is shallow-merged, but ids is an array so it is replaced
      expect(mergePayloads(base, override)).toEqual({ meta: { ids: [3] } })
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('both empty objects produces an empty object', () => {
      expect(mergePayloads({}, {})).toEqual({})
    })

    it('empty override returns a copy of base', () => {
      const base = { a: 1, b: 'two' }
      const result = mergePayloads(base, {})
      expect(result).toEqual(base)
      expect(result).not.toBe(base)
    })

    it('base has nested object, override has primitive at same key — primitive wins', () => {
      const base = { config: { debug: true } }
      const override = { config: 'disabled' }
      expect(mergePayloads(base, override)).toEqual({ config: 'disabled' })
    })

    it('base has primitive, override has nested object at same key — nested object wins', () => {
      const base = { config: 'simple' }
      const override = { config: { debug: true } }
      expect(mergePayloads(base, override)).toEqual({ config: { debug: true } })
    })

    it('override with empty object replaces base primitive value', () => {
      const base = { settings: 42 }
      const override = { settings: {} }
      expect(mergePayloads(base, override)).toEqual({ settings: {} })
    })

    it('base has null at a key, override has object — override replaces null', () => {
      const base = { meta: null }
      const override = { meta: { color: 'blue' } }
      // base[key] is null so the nested-merge condition is false → replacement
      expect(mergePayloads(base, override)).toEqual({ meta: { color: 'blue' } })
    })

    it('base has array at a key, override has object — object replaces array (no shallow merge)', () => {
      const base = { data: [1, 2] }
      const override = { data: { length: 2 } }
      // base[key] is array so the nested-merge condition is false → replacement
      expect(mergePayloads(base, override)).toEqual({ data: { length: 2 } })
    })
  })

  // ---------------------------------------------------------------------------
  // Type mixing
  // ---------------------------------------------------------------------------
  describe('type mixing', () => {
    it('string value in base replaced by number in override', () => {
      const result = mergePayloads({ score: 'ten' }, { score: 10 })
      expect(result).toEqual({ score: 10 })
    })

    it('object value replaced by null', () => {
      const result = mergePayloads({ details: { a: 1 } }, { details: null })
      expect(result).toEqual({ details: null })
    })

    it('array replaced by plain object', () => {
      const result = mergePayloads({ items: [1, 2] }, { items: { count: 2 } })
      expect(result).toEqual({ items: { count: 2 } })
    })

    it('null replaced by plain object', () => {
      const result = mergePayloads({ meta: null }, { meta: { x: 1 } })
      expect(result).toEqual({ meta: { x: 1 } })
    })

    it('boolean false in override replaces base value (falsy but not undefined/null)', () => {
      const result = mergePayloads({ enabled: true }, { enabled: false })
      expect(result).toEqual({ enabled: false })
    })

    it('zero in override replaces non-zero base value', () => {
      const result = mergePayloads({ count: 5 }, { count: 0 })
      expect(result).toEqual({ count: 0 })
    })

    it('empty string in override replaces base value', () => {
      const result = mergePayloads({ title: 'original' }, { title: '' })
      expect(result).toEqual({ title: '' })
    })
  })
})
