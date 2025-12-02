module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint', 'vue', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript'
  ],
  rules: {
    // ESLint core rules
    'no-duplicate-imports': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'prefer-const': 'warn',
    'no-var': 'error',

    // Vue-specific rules
    'vue/multi-word-component-names': 'off',
    'vue/require-default-prop': 'warn',
    'vue/require-prop-types': 'warn',
    'vue/component-definition-name-casing': ['error', 'PascalCase'],

    // TypeScript rules
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // Import rules
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'object',
          'type'
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }
    ],
    'import/no-duplicates': 'error',

    // Custom rules for detecting competing systems
    'custom/no-competing-stores': 'error',
    'custom/no-duplicate-composables': 'warn',
    'custom/prefer-single-fetch-pattern': 'warn',
    'custom/consistent-reactive-patterns': 'warn',
    'custom/centralize-error-handling': 'warn',
    'custom/no-duplicate-utilities': 'warn',

    // Disallow multiple similar patterns
    'custom/no-similar-component-names': 'warn',
    'custom/no-multiple-form-patterns': 'error',
    'custom/no-multiple-filter-implementations': 'error',
    'custom/single-calendar-system': 'error'
  },
  overrides: [
    {
      files: ['src/stores/**/*.ts'],
      rules: {
        'custom/no-competing-stores': 'error',
        '@typescript-eslint/no-unused-vars': 'error',
        'custom/prefer-store-actions': 'warn'
      }
    },
    {
      files: ['src/composables/**/*.ts'],
      rules: {
        'custom/no-duplicate-composables': 'error',
        'custom/consistent-composable-patterns': 'warn',
        'custom/prefer-composable-return-object': 'warn'
      }
    },
    {
      files: ['src/components/**/*.vue'],
      rules: {
        'custom/no-duplicate-fetch-in-components': 'error',
        'custom/prefer-store-over-component-fetch': 'warn',
        'custom/consistent-component-naming': 'warn'
      }
    },
    {
      files: ['src/utils/**/*.ts', 'src/helpers/**/*.ts'],
      rules: {
        'custom/no-duplicate-utilities': 'error',
        'custom/prefer-shared-constants': 'warn'
      }
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*'],
      rules: {
        'custom/no-competing-stores': 'off',
        'custom/no-duplicate-composables': 'off',
        'no-console': 'off'
      }
    }
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    }
  },
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  globals: {
    defineProps: 'readonly',
    defineEmits: 'readonly',
    defineExpose: 'readonly',
    withDefaults: 'readonly'
  }
};

// Custom ESLint rules would be implemented as separate plugins
// These are placeholders for the custom rules referenced above