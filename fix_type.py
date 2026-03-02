with open('tsconfig.json', 'r') as f:
    content = f.read()

# temporarily ignore vite/client types to check our files
content = content.replace('"types": [\n      "vite/client"\n    ],', '"types": [],')

with open('tsconfig.json', 'w') as f:
    f.write(content)
