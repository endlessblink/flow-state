# TypeScript Utility Types Reference

## Object Transformation Types

### Partial<T>
Makes all properties optional.

```typescript
interface User {
  id: string
  name: string
  email: string
}

type PartialUser = Partial<User>
// { id?: string; name?: string; email?: string }

// Use case: Update functions
function updateUser(id: string, updates: Partial<User>) {
  // Can pass any subset of User properties
}

updateUser('123', { name: 'New Name' })  // Valid
```

### Required<T>
Makes all properties required (opposite of Partial).

```typescript
interface Config {
  apiUrl?: string
  timeout?: number
}

type RequiredConfig = Required<Config>
// { apiUrl: string; timeout: number }

// Use case: Ensure all config values present
function initApp(config: Required<Config>) {
  // All properties guaranteed to exist
}
```

### Readonly<T>
Makes all properties readonly.

```typescript
interface State {
  count: number
  items: string[]
}

type ReadonlyState = Readonly<State>
// { readonly count: number; readonly items: string[] }

const state: ReadonlyState = { count: 0, items: [] }
state.count = 1  // Error: Cannot assign to 'count'

// Note: Readonly is shallow - arrays are still mutable
state.items.push('item')  // No error!

// For deep readonly, use:
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}
```

---

## Property Selection Types

### Pick<T, K>
Creates type with only specified properties.

```typescript
interface User {
  id: string
  name: string
  email: string
  password: string
  createdAt: Date
}

type UserPreview = Pick<User, 'id' | 'name'>
// { id: string; name: string }

// Use case: API responses with limited fields
function getPublicProfile(user: User): Pick<User, 'id' | 'name' | 'email'> {
  return { id: user.id, name: user.name, email: user.email }
}
```

### Omit<T, K>
Creates type without specified properties.

```typescript
type PublicUser = Omit<User, 'password'>
// { id: string; name: string; email: string; createdAt: Date }

// Use case: Exclude sensitive data
type UserInput = Omit<User, 'id' | 'createdAt'>
// User data for creation (without auto-generated fields)
```

---

## Record Types

### Record<K, T>
Creates object type with keys K and values T.

```typescript
// Simple flag object
type Flags = Record<'isActive' | 'isAdmin', boolean>
// { isActive: boolean; isAdmin: boolean }

// Dynamic key mapping
type UserRoles = Record<string, 'admin' | 'user' | 'guest'>
const roles: UserRoles = {
  'user-1': 'admin',
  'user-2': 'user'
}

// Status mapping
type StatusColors = Record<'success' | 'warning' | 'error', string>
const colors: StatusColors = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444'
}
```

---

## Function Types

### ReturnType<T>
Extracts the return type of a function.

```typescript
function fetchUser() {
  return { id: '1', name: 'John', isActive: true }
}

type User = ReturnType<typeof fetchUser>
// { id: string; name: string; isActive: boolean }

// With async functions
async function fetchUsers() {
  return [{ id: '1', name: 'John' }]
}

type Users = Awaited<ReturnType<typeof fetchUsers>>
// { id: string; name: string }[]
```

### Parameters<T>
Extracts parameter types as a tuple.

```typescript
function createUser(name: string, age: number, isAdmin: boolean) {
  // ...
}

type CreateUserParams = Parameters<typeof createUser>
// [string, number, boolean]

// Access individual parameter types
type NameParam = Parameters<typeof createUser>[0]  // string
type AgeParam = Parameters<typeof createUser>[1]   // number
```

### ConstructorParameters<T>
Extracts constructor parameter types.

```typescript
class User {
  constructor(public name: string, public age: number) {}
}

type UserConstructorParams = ConstructorParameters<typeof User>
// [string, number]
```

### InstanceType<T>
Extracts instance type from a constructor.

```typescript
class User {
  name: string
  constructor(name: string) { this.name = name }
}

type UserInstance = InstanceType<typeof User>
// User
```

---

## Union Manipulation Types

### Extract<T, U>
Extracts types from T that are assignable to U.

```typescript
type AllTypes = string | number | boolean | null | undefined

type Primitives = Extract<AllTypes, string | number>
// string | number

// With objects
type Events =
  | { type: 'click'; x: number; y: number }
  | { type: 'keydown'; key: string }
  | { type: 'scroll'; offset: number }

type MouseEvents = Extract<Events, { type: 'click' }>
// { type: 'click'; x: number; y: number }
```

### Exclude<T, U>
Removes types from T that are assignable to U.

```typescript
type AllTypes = string | number | boolean | null | undefined

type NonNullTypes = Exclude<AllTypes, null | undefined>
// string | number | boolean

// Filter out specific events
type NonMouseEvents = Exclude<Events, { type: 'click' }>
```

### NonNullable<T>
Removes null and undefined from T.

```typescript
type MaybeString = string | null | undefined

type DefiniteString = NonNullable<MaybeString>
// string

// Useful for function returns
function getValue(): string | null { /* ... */ }

const value = getValue()
if (value) {
  const definite: NonNullable<typeof value> = value
  // definite is string, not string | null
}
```

---

## String Manipulation Types

### Uppercase<T> / Lowercase<T>
```typescript
type Greeting = 'hello'
type ShoutingGreeting = Uppercase<Greeting>  // 'HELLO'
type WhisperGreeting = Lowercase<'HELLO'>    // 'hello'
```

### Capitalize<T> / Uncapitalize<T>
```typescript
type Event = 'click'
type EventHandler = `on${Capitalize<Event>}`  // 'onClick'

type Method = 'GetUser'
type ApiPath = Uncapitalize<Method>           // 'getUser'
```

---

## Custom Utility Types

### DeepPartial<T>
Recursively makes all properties optional.

```typescript
type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>
} : T

interface Config {
  api: {
    url: string
    timeout: number
    headers: {
      authorization: string
    }
  }
}

type PartialConfig = DeepPartial<Config>
// All nested properties are optional
```

### Nullable<T>
Add null to a type.

```typescript
type Nullable<T> = T | null

type MaybeUser = Nullable<User>
// User | null
```

### ValueOf<T>
Get union of all value types in an object.

```typescript
type ValueOf<T> = T[keyof T]

const STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DONE: 'done'
} as const

type StatusValue = ValueOf<typeof STATUS>
// 'pending' | 'active' | 'done'
```

### Mutable<T>
Remove readonly from all properties.

```typescript
type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

type ReadonlyUser = Readonly<User>
type MutableUser = Mutable<ReadonlyUser>
// Back to regular User with mutable properties
```

---

## Practical Combinations

```typescript
// API response handling
type ApiResponse<T> = {
  data: T
  status: number
  message: string
}

type UserResponse = ApiResponse<Omit<User, 'password'>>

// Form state
type FormState<T> = {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
}

type UserForm = FormState<Pick<User, 'name' | 'email'>>

// Event handlers
type EventHandlers<T extends string> = {
  [K in T as `on${Capitalize<K>}`]: (event: Event) => void
}

type ButtonHandlers = EventHandlers<'click' | 'focus' | 'blur'>
// { onClick: ...; onFocus: ...; onBlur: ... }
```
