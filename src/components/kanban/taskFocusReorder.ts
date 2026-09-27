/** Pure list moves for the focused timeline "Up next" panel. Return the same
 *  array instance when nothing changes so callers can skip a save. */

export function moveIdBy(ids: string[], id: string, offset: number): string[] {
  const from = ids.indexOf(id)
  const to = from + offset
  if (from < 0 || offset === 0 || to < 0 || to >= ids.length) return ids
  const next = [...ids]
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}

/** Place `id` directly after `anchorId` (e.g. "make this the next task"). */
export function moveIdAfter(ids: string[], id: string, anchorId: string): string[] {
  if (id === anchorId || !ids.includes(id) || !ids.includes(anchorId)) return ids
  const without = ids.filter(candidate => candidate !== id)
  const anchorIndex = without.indexOf(anchorId)
  const next = [...without.slice(0, anchorIndex + 1), id, ...without.slice(anchorIndex + 1)]
  return next.every((candidate, index) => candidate === ids[index]) ? ids : next
}
