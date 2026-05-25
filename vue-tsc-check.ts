import { execSync } from 'child_process'
try {
  const result = execSync('npx vue-tsc --noEmit src/components/base/BaseDropdown.vue')
  console.log("Success!")
} catch(e: any) {
  console.log(e.stdout.toString())
}
