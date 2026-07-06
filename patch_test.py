import os

file_path = "tests/e2e/canvas-sync-regressions.spec.ts"
with open(file_path, "r") as f:
    content = f.read()

content = content.replace(
    '''    if (!user) { const { data } = await admin.auth.admin.createUser({ email: 'playwright@test.flowstate', password: 'pw-playwright-e2e-2026!', email_confirm: true }); user = data.user; }
    userId = user.id''',
    '''    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({ email: 'playwright@test.flowstate', password: 'pw-playwright-e2e-2026!', email_confirm: true })
      if (error && error.message.includes('already registered')) {
        for (let i = 0; i < 5 && !user; i++) {
          await new Promise(r => setTimeout(r, 1000))
          const res = await admin.auth.admin.listUsers()
          user = res.data.users.find((u) => u.email === 'playwright@test.flowstate')
        }
      } else if (data?.user) {
        user = data.user
      }
    }

    if (!user) {
      throw new Error('Failed to create or find test user')
    }

    userId = user.id'''
)

with open(file_path, "w") as f:
    f.write(content)
