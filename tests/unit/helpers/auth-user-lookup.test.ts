import { describe, expect, it, vi } from 'vitest'
import { ensureAuthUser } from '../../fixtures/auth'

describe('ensureAuthUser', () => {
  const attributes = {
    email: 'playwright@test.flowstate',
    password: 'pw-playwright-e2e-2026!',
    email_confirm: true,
  }

  it('returns a newly created disposable user', async () => {
    const target = { id: 'playwright-user', email: 'playwright@test.flowstate' }
    const createUser = vi.fn().mockResolvedValue({ data: { user: target }, error: null })
    const signInWithPassword = vi.fn()
    const signOut = vi.fn()

    const result = await ensureAuthUser({
      auth: { admin: { createUser }, signInWithPassword, signOut },
    } as never, attributes)

    expect(result).toEqual(target)
    expect(createUser).toHaveBeenCalledWith(attributes)
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('resolves an existing disposable user by its owned credentials', async () => {
    const target = { id: 'playwright-user', email: 'playwright@test.flowstate' }
    const createUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { status: 422, message: 'User already registered' },
    })
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: target },
      error: null,
    })
    const signOut = vi.fn().mockResolvedValue({ error: null })

    await expect(ensureAuthUser({
      auth: { admin: { createUser }, signInWithPassword, signOut },
    } as never, attributes)).resolves.toEqual(target)
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: attributes.email,
      password: attributes.password,
    })
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
