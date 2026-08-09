import re

with open("scripts/run-e2e.sh", "r") as f:
    script = f.read()

# Replace supabase status with npx supabase status
script = script.replace("supabase status -o env", "npx supabase status -o env")

with open("scripts/run-e2e.sh", "w") as f:
    f.write(script)
