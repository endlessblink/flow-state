# Competing Composables

## Scenario: Multiple Form Handling Composables

### ❌ BAD - Three Composables Doing Same Thing

**Composable 1: src/composables/useFormValidation.ts**
```typescript
import { ref, computed } from 'vue';
import type { Ref } from 'vue';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  rules: Record<keyof T, ValidationRule>
) {
  const values = ref<T>({ ...initialValues });
  const errors = ref<Partial<Record<keyof T, string>>>({});
  const touched = ref<Partial<Record<keyof T, boolean>>>({});

  const validateField = (field: keyof T): string | null => {
    const value = values.value[field];
    const fieldRules = rules[field];
    const ruleErrors: string[] = [];

    if (fieldRules.required && (!value || value.toString().trim() === '')) {
      ruleErrors.push('This field is required');
    }

    if (fieldRules.minLength && value && value.toString().length < fieldRules.minLength) {
      ruleErrors.push(`Minimum ${fieldRules.minLength} characters required`);
    }

    if (fieldRules.maxLength && value && value.toString().length > fieldRules.maxLength) {
      ruleErrors.push(`Maximum ${fieldRules.maxLength} characters allowed`);
    }

    if (fieldRules.pattern && value && !fieldRules.pattern.test(value.toString())) {
      ruleErrors.push('Invalid format');
    }

    if (fieldRules.custom) {
      const customError = fieldRules.custom(value);
      if (customError) ruleErrors.push(customError);
    }

    const error = ruleErrors.length > 0 ? ruleErrors[0] : null;
    if (error) {
      errors.value[field] = error;
    } else {
      delete errors.value[field];
    }

    return error;
  };

  const validate = (): boolean => {
    let isValid = true;
    Object.keys(rules).forEach(field => {
      const error = validateField(field as keyof T);
      if (error) isValid = false;
    });
    return isValid;
  };

  const setFieldValue = (field: keyof T, value: any) => {
    values.value[field] = value;
    touched.value[field] = true;
    validateField(field);
  };

  const isValid = computed(() => Object.keys(errors.value).length === 0);

  return {
    values,
    errors,
    touched,
    isValid,
    validate,
    validateField,
    setFieldValue
  };
}
```

**Composable 2: src/composables/useTaskForm.ts**
```typescript
import { ref, computed } from 'vue';
import type { Task } from '@/types';

export function useTaskForm(initialTask?: Partial<Task>) {
  const task = ref<Task>({
    id: '',
    title: '',
    description: '',
    priority: 'medium',
    dueDate: null,
    category: '',
    completed: false,
    ...initialTask
  });

  const errors = ref<Partial<Record<keyof Task, string>>>({});
  const isSubmitting = ref(false);

  const validateTask = (): boolean => {
    const newErrors: Partial<Record<keyof Task, string>> = {};

    // Very similar validation logic (75% overlap)
    if (!task.value.title || task.value.title.trim().length === 0) {
      newErrors.title = 'Title is required';
    } else if (task.value.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (task.value.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    if (task.value.description && task.value.description.length > 1000) {
      newErrors.description = 'Description must be less than 1000 characters';
    }

    if (task.value.category && !/^[a-zA-Z0-9\s-_]+$/.test(task.value.category)) {
      newErrors.category = 'Category contains invalid characters';
    }

    if (task.value.dueDate && new Date(task.value.dueDate) < new Date()) {
      newErrors.dueDate = 'Due date cannot be in the past';
    }

    errors.value = newErrors;
    return Object.keys(newErrors).length === 0;
  };

  const isValid = computed(() => Object.keys(errors.value).length === 0);

  const updateField = (field: keyof Task, value: any) => {
    task.value[field] = value;
    // Immediate validation on field change
    if (errors.value[field]) {
      validateTask();
    }
  };

  const submit = async (onSubmit: (task: Task) => Promise<void>) => {
    if (!validateTask()) return false;

    isSubmitting.value = true;
    try {
      await onSubmit(task.value);
      return true;
    } catch (error) {
      console.error('Form submission failed:', error);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  };

  const reset = () => {
    task.value = {
      id: '',
      title: '',
      description: '',
      priority: 'medium',
      dueDate: null,
      category: '',
      completed: false,
      ...initialTask
    };
    errors.value = {};
  };

  return {
    task,
    errors,
    isSubmitting,
    isValid,
    validateTask,
    updateField,
    submit,
    reset
  };
}
```

**Composable 3: src/composables/useSmartForm.ts**
```typescript
import { ref, computed, watch } from 'vue';

export interface SmartFieldConfig {
  name: string;
  type: 'text' | 'email' | 'textarea' | 'select' | 'date';
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  options?: string[];
}

export function useSmartForm(fields: SmartFieldConfig[]) {
  const formData = ref<Record<string, any>>({});
  const fieldErrors = ref<Record<string, string>>({});
  const touchedFields = ref<Set<string>>(new Set());
  const isValidating = ref(false);

  // Initialize form data
  fields.forEach(field => {
    formData.value[field.name] = '';
  });

  const validateSmartField = (fieldName: string): string | null => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return null;

    const value = formData.value[fieldName];
    const errors: string[] = [];

    // Duplicate validation pattern (80% similar to useFormValidation)
    if (field.required && (!value || value.toString().trim() === '')) {
      errors.push(`${field.name} is required`);
    }

    if (field.validation) {
      if (field.validation.min && value && value.toString().length < field.validation.min) {
        errors.push(field.validation.message || `Minimum ${field.validation.min} characters`);
      }

      if (field.validation.max && value && value.toString().length > field.validation.max) {
        errors.push(field.validation.message || `Maximum ${field.validation.max} characters`);
      }

      if (field.validation.pattern && value && !new RegExp(field.validation.pattern).test(value.toString())) {
        errors.push(field.validation.message || 'Invalid format');
      }
    }

    const error = errors.length > 0 ? errors[0] : null;
    if (error) {
      fieldErrors.value[fieldName] = error;
    } else {
      delete fieldErrors.value[fieldName];
    }

    return error;
  };

  const validateAll = (): boolean => {
    let isValid = true;
    fields.forEach(field => {
      const error = validateSmartField(field.name);
      if (error) isValid = false;
    });
    return isValid;
  };

  const updateFieldValue = (fieldName: string, value: any) => {
    formData.value[fieldName] = value;
    touchedFields.value.add(fieldName);
    validateSmartField(fieldName);
  };

  const isFormValid = computed(() => Object.keys(fieldErrors.value).length === 0);

  const isFieldTouched = (fieldName: string) => touchedFields.value.has(fieldName);

  const hasError = (fieldName: string) => !!fieldErrors.value[fieldName];

  const getError = (fieldName: string) => fieldErrors.value[fieldName];

  return {
    formData,
    fieldErrors,
    isValidating,
    isFormValid,
    validateAll,
    validateSmartField,
    updateFieldValue,
    isFieldTouched,
    hasError,
    getError
  };
}
```

### ✅ GOOD - Unified Form Composable

**Consolidated: src/composables/useForm.ts**
```typescript
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp | string;
  custom?: (value: any, formData?: Record<string, any>) => string | null;
  message?: string;
}

export interface FieldConfig {
  name: string;
  type: 'text' | 'email' | 'textarea' | 'select' | 'date' | 'number';
  label?: string;
  placeholder?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  validation?: ValidationRule;
  dependencies?: string[]; // Fields this field depends on for validation
}

export interface FormConfig<T extends Record<string, any>> {
  fields: FieldConfig[];
  initialValues?: Partial<T>;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  onSubmit?: (data: T) => Promise<void> | void;
}

export function useForm<T extends Record<string, any>>(config: FormConfig<T>) {
  const {
    fields,
    initialValues = {},
    validateOnBlur = true,
    validateOnChange = false,
    onSubmit
  } = config;

  // Form state
  const data = ref<T>({ ...initialValues } as T);
  const errors = ref<Partial<Record<keyof T, string>>>({});
  const touched = ref<Partial<Record<keyof T, boolean>>>({});
  const isSubmitting = ref(false);
  const isSubmitted = ref(false);

  // Initialize form data with field defaults
  fields.forEach(field => {
    if (data.value[field.name as keyof T] === undefined) {
      data.value[field.name as keyof T] = field.defaultValue ?? '';
    }
  });

  // Computed properties
  const isValid: ComputedRef<boolean> = computed(() => {
    return Object.keys(errors.value).length === 0;
  });

  const isDirty: ComputedRef<boolean> = computed(() => {
    return Object.keys(touched.value).some(key => touched.value[key as keyof T]);
  });

  const fieldErrors = computed(() => errors.value);
  const hasErrors = computed(() => Object.keys(errors.value).length > 0);

  // Validation logic (unified from all three composables)
  const validateField = (fieldName: keyof T, formData?: Record<string, any>): string | null => {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return null;

    const value = data.value[fieldName];
    const ruleErrors: string[] = [];

    // Required validation
    if (field.validation?.required && (!value || value.toString().trim() === '')) {
      ruleErrors.push(field.validation.message || `${field.label || fieldName} is required`);
    }

    // Length validations
    if (typeof value === 'string' || typeof value === 'number') {
      const stringValue = value.toString();

      if (field.validation?.minLength && stringValue.length < field.validation.minLength) {
        ruleErrors.push(
          field.validation.message ||
          `Minimum ${field.validation.minLength} characters required`
        );
      }

      if (field.validation?.maxLength && stringValue.length > field.validation.maxLength) {
        ruleErrors.push(
          field.validation.message ||
          `Maximum ${field.validation.maxLength} characters allowed`
        );
      }
    }

    // Numeric validations
    if (typeof value === 'number') {
      if (field.validation?.min !== undefined && value < field.validation.min) {
        ruleErrors.push(
          field.validation.message ||
          `Minimum value is ${field.validation.min}`
        );
      }

      if (field.validation?.max !== undefined && value > field.validation.max) {
        ruleErrors.push(
          field.validation.message ||
          `Maximum value is ${field.validation.max}`
        );
      }
    }

    // Pattern validation
    if (field.validation?.pattern && value) {
      const pattern = typeof field.validation.pattern === 'string'
        ? new RegExp(field.validation.pattern)
        : field.validation.pattern;

      if (!pattern.test(value.toString())) {
        ruleErrors.push(
          field.validation.message ||
          'Invalid format'
        );
      }
    }

    // Custom validation
    if (field.validation?.custom) {
      const customError = field.validation.custom(
        value,
        formData || data.value
      );
      if (customError) ruleErrors.push(customError);
    }

    // Date validation (specific to date fields)
    if (field.type === 'date' && value) {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        ruleErrors.push('Invalid date format');
      }
    }

    // Email validation (specific to email fields)
    if (field.type === 'email' && value) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value.toString())) {
        ruleErrors.push('Invalid email address');
      }
    }

    const error = ruleErrors.length > 0 ? ruleErrors[0] : null;

    if (error) {
      errors.value[fieldName] = error;
    } else {
      delete errors.value[fieldName];
    }

    return error;
  };

  const validateAll = (): boolean => {
    let isValid = true;
    fields.forEach(field => {
      const error = validateField(field.name as keyof T);
      if (error) isValid = false;
    });
    return isValid;
  };

  // Field manipulation
  const setFieldValue = (fieldName: keyof T, value: any) => {
    data.value[fieldName] = value;
    touched.value[fieldName] = true;

    if (validateOnChange) {
      validateField(fieldName);
    }

    // Validate dependent fields
    const dependentFields = fields.filter(f =>
      f.dependencies?.includes(fieldName as string)
    );
    dependentFields.forEach(field => {
      if (touched.value[field.name as keyof T]) {
        validateField(field.name as keyof T);
      }
    });
  };

  const setFieldError = (fieldName: keyof T, error: string | null) => {
    if (error) {
      errors.value[fieldName] = error;
    } else {
      delete errors.value[fieldName];
    }
  };

  const clearFieldError = (fieldName: keyof T) => {
    delete errors.value[fieldName];
  };

  const touchField = (fieldName: keyof T) => {
    touched.value[fieldName] = true;
    if (validateOnBlur) {
      validateField(fieldName);
    }
  };

  // Form manipulation
  const setData = (newData: Partial<T>) => {
    Object.assign(data.value, newData);
  };

  const reset = () => {
    data.value = { ...initialValues } as T;
    errors.value = {};
    touched.value = {};
    isSubmitted.value = false;
  };

  const clearValidation = () => {
    errors.value = {};
    touched.value = {};
  };

  // Form submission
  const submit = async (): Promise<boolean> => {
    isSubmitted.value = true;

    if (!validateAll()) {
      return false;
    }

    if (onSubmit) {
      isSubmitting.value = true;
      try {
        await onSubmit(data.value);
        return true;
      } catch (error) {
        console.error('Form submission failed:', error);
        return false;
      } finally {
        isSubmitting.value = false;
      }
    }

    return true;
  };

  // Field helper methods
  const getFieldValue = (fieldName: keyof T) => data.value[fieldName];
  const getError = (fieldName: keyof T) => errors.value[fieldName];
  const hasError = (fieldName: keyof T) => !!errors.value[fieldName];
  const isTouched = (fieldName: keyof T) => !!touched.value[fieldName];

  // Auto-validate dependencies
  fields.forEach(field => {
    if (field.dependencies && field.dependencies.length > 0) {
      watch(
        () => field.dependencies!.map(dep => data.value[dep as keyof T]),
        () => {
          if (touched.value[field.name as keyof T]) {
            validateField(field.name as keyof T);
          }
        }
      );
    }
  });

  return {
    // State
    data: data as Ref<T>,
    errors: fieldErrors as ComputedRef<Partial<Record<keyof T, string>>>,
    isSubmitting,
    isSubmitted,
    isValid,
    isDirty,
    hasErrors,

    // Methods
    validateField,
    validateAll,
    setFieldValue,
    setFieldError,
    clearFieldError,
    touchField,
    setData,
    reset,
    clearValidation,
    submit,

    // Field helpers
    getFieldValue,
    getError,
    hasError,
    isTouched
  };
}

// Specialized form composables using the base form
export function useTaskForm(initialTask?: Partial<Task>) {
  const fieldConfigs: FieldConfig[] = [
    {
      name: 'title',
      type: 'text',
      label: 'Task Title',
      placeholder: 'Enter task title...',
      validation: {
        required: true,
        minLength: 3,
        maxLength: 100,
        message: 'Task title must be between 3 and 100 characters'
      }
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      placeholder: 'Enter task description...',
      validation: {
        maxLength: 1000,
        message: 'Description must be less than 1000 characters'
      }
    },
    {
      name: 'priority',
      type: 'select',
      label: 'Priority',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
      ],
      validation: {
        required: true
      }
    },
    {
      name: 'dueDate',
      type: 'date',
      label: 'Due Date',
      validation: {
        custom: (value: string) => {
          if (value && new Date(value) < new Date()) {
            return 'Due date cannot be in the past';
          }
          return null;
        }
      }
    },
    {
      name: 'category',
      type: 'text',
      label: 'Category',
      validation: {
        pattern: '^[a-zA-Z0-9\\s-_]+$',
        message: 'Category can only contain letters, numbers, spaces, hyphens, and underscores'
      }
    }
  ];

  return useForm<Task>({
    fields: fieldConfigs,
    initialValues: initialTask,
    validateOnBlur: true,
    validateOnChange: false
  });
}
```

**Usage Examples:**

```typescript
// General form usage
const userForm = useForm({
  fields: [
    {
      name: 'email',
      type: 'email',
      validation: { required: true }
    },
    {
      name: 'password',
      type: 'text',
      validation: { required: true, minLength: 8 }
    }
  ],
  onSubmit: async (data) => {
    await authService.login(data);
  }
});

// Task form usage
const taskForm = useTaskForm(initialTask);
const { data, errors, isValid, submit } = taskForm;
```

### Conflict Report

**COMPETING SYSTEM DETECTED**
- **Category**: Composables & Hooks
- **Severity**: HIGH

**Conflict Type**: Multiple Form Handling Composables
- **Scope**: Form validation and state management
- **Pattern Match**: 80% code similarity in validation logic

**Files Involved**:
- `src/composables/useFormValidation.ts` (generic validation)
- `src/composables/useTaskForm.ts` (task-specific)
- `src/composables/useSmartForm.ts` (configurable forms)

**Issues Identified**:
1. **Duplicate validation logic**: 80% overlap in validation patterns
2. **Redundant error handling**: Similar error state management in all three
3. **Inconsistent APIs**: Different method names and patterns
4. **Type duplication**: Similar interfaces scattered across files
5. **Maintenance burden**: Validation fixes require updates in multiple places
6. **Learning curve**: Team must understand three different form patterns

**Recommendation**: Consolidate into unified useForm composable
1. **Create base useForm** with comprehensive validation
2. **Add specialized wrappers** like useTaskForm
3. **Support flexible field configuration**
4. **Update all existing form implementations**
5. **Remove duplicate composables**

**Estimated Effort**: 4-6 hours
- **Base implementation**: 2-3 hours
- **Migration of existing forms**: 1-2 hours
- **Testing and validation**: 1 hour

**Risk**: Medium
- **Breaking changes**: Requires updating all form usage
- **Testing scope**: All forms in the application
- **Rollback difficulty**: Medium (can keep old composables during transition)

**Migration Path**:
1. Implement unified useForm with all features from three composables
2. Create specialized wrappers for common use cases (useTaskForm, useUserForm, etc.)
3. Update forms one component at a time
4. Test each migrated form thoroughly
5. Remove old composables after complete migration
6. Update team documentation and guidelines

**Benefits**:
- **Single source of truth** for form validation
- **Consistent API** across all forms
- **Reduced code duplication** by 70%
- **Better type safety** with unified interfaces
- **Flexible field configuration** for any form type
- **Easier maintenance** and feature additions
- **Improved developer experience** with predictable patterns