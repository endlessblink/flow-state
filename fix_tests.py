import os

file = "tests/e2e/lanes.spec.ts"
with open(file, 'r') as f:
    content = f.read()

content = content.replace("const userId = users!.users!.find(u => u.email === 'playwright@test.flowstate')!.id",
                          "const user = users!.users!.find(u => u.email === 'playwright@test.flowstate'); if (!user) throw new Error('Test user not found'); const userId = user.id")

with open(file, 'w') as f:
    f.write(content)

print("Fixed lanes.spec.ts.")
