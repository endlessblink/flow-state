#!/bin/bash
# Apply fixes for BaseInput.vue

sed -i 's/      <input :dir="inputDir"/      <input\n        :id="inputId"\n        :dir="inputDir"/g' src/components/base/BaseInput.vue
sed -i '/:id="inputId"/d' src/components/base/BaseInput.vue
