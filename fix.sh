#!/bin/bash
# Apply fixes to the specific files listed in the annotations

# 1. src/components/base/BaseInput.vue
sed -i 's/        :disabled="disabled"/             :disabled="disabled"/g' src/components/base/BaseInput.vue
sed -i 's/        :readonly="readonly"/             :readonly="readonly"/g' src/components/base/BaseInput.vue
sed -i 's/        :required="required"/             :required="required"/g' src/components/base/BaseInput.vue
sed -i 's/        :aria-invalid="!!error"/             :aria-invalid="!!error"/g' src/components/base/BaseInput.vue

# 2. src/components/QuickSortCard.vue
sed -i 's/swipe-down/swipeDown/g' src/components/QuickSortCard.vue
sed -i 's/swipe-up/swipeUp/g' src/components/QuickSortCard.vue
sed -i 's/swipe-left/swipeLeft/g' src/components/QuickSortCard.vue
