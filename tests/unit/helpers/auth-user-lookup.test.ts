import { describe, expect, it, vi } from 'vitest'
import { findAuthUserByEmail } from '../../fixtures/auth'

describe('findAuthUserByEmail', () => {
  it('continues through auth pages instead of creating a duplicate user', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `other-${index}`,
      email: `other-${index}@test.flowstate`,
    }))
    const target = { id: 'playwright-user', email: 'playwright@test.flowstate' }
    const listUsers = vi.fn()
      .mockResolvedValueOnce({ data: { users: firstPage }, error: null })
      .mockResolvedValueOnce({ data: { users: [target] }, error: null })

    const result = await findAuthUserByEmail({
      auth: { admin: { listUsers } },
    } as never, target.email)

    expect(result).toEqual(target)
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 })
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 })
  })

  it('stops after a partial page when the user does not exist', async () => {
    const listUsers = vi.fn().mockResolvedValue({
      data: { users: [{ id: 'other', email: 'other@test.flowstate' }] },
      error: null,
    })

    await expect(findAuthUserByEmail({
      auth: { admin: { listUsers } },
    } as never, 'missing@test.flowstate')).resolves.toBeNull()
    expect(listUsers).toHaveBeenCalledTimes(1)
  })
})
