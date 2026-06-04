import sys

filename = 'src/components/settings/tabs/AccountSettingsTab.vue'
with open(filename, 'r') as f:
    content = f.read()

content = content.replace('e.message', '(e as Error).message')

with open(filename, 'w') as f:
    f.write(content)
print("Success: AccountSettingsTab.vue fixed.")
