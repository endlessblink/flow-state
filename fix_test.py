import re

file_path = "tests/e2e/canvas-sync-regressions.spec.ts"
with open(file_path, "r") as f:
    content = f.read()

# Replace the block and ensure if user is still undefined we don't try to access user.id
old_code = """    if (!user) {
      try {
        const { data, error } = await admin.auth.admin.createUser({ email: 'playwright@test.flowstate', password: 'pw-playwright-e2e-2026!', email_confirm: true })
        if (error) {
           console.log('createUser error:', error)
        } else {
           user = data.user
        }
      } catch (e) {
         console.log('createUser exception:', e)
      }
      // If user creation failed (e.g. race condition), try listing users again
      for (let i = 0; i < 10 && !user; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const res = await admin.auth.admin.listUsers()
        user = res.data.users.find((u) => u.email === 'playwright@test.flowstate')
      }
    }
    userId = user.id"""

new_code = """    if (!user) {
      try {
        const { data, error } = await admin.auth.admin.createUser({ email: 'playwright@test.flowstate', password: 'pw-playwright-e2e-2026!', email_confirm: true })
        if (error) {
           console.log('createUser error:', error)
        } else if (data && data.user) {
           user = data.user
        }
      } catch (e) {
         console.log('createUser exception:', e)
      }
      // If user creation failed (e.g. race condition), try listing users again
      for (let i = 0; i < 10 && !user; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const res = await admin.auth.admin.listUsers()
        user = res.data.users.find((u) => u.email === 'playwright@test.flowstate')
      }
    }

    if (!user) {
      throw new Error("Failed to create or find test user")
    }

    userId = user.id"""

content = content.replace(old_code, new_code)

with open(file_path, "w") as f:
    f.write(content)

print("Patched tests/e2e/canvas-sync-regressions.spec.ts")
