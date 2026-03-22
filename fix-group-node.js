const fs = require('fs');
const filePath = 'src/components/canvas/GroupNodeSimple.vue';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /const props = defineProps<{\s*id: string\s*data: unknown\s*selected\?: boolean\s*dragging\?: boolean\s*}>()/m,
  `const props = defineProps<{
  id: string
  data: Record<string, any>
  selected?: boolean
  dragging?: boolean
}>()`
);

fs.writeFileSync(filePath, content);
