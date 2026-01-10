# Common TypeScript Errors Reference

## TS2322: Type 'X' is not assignable to type 'Y'

The most common TypeScript error. Occurs when assigning a value of incompatible type.

### Scenarios & Solutions

#### String vs Number
```typescript
// Error
const age: number = "25"

// Fix: Parse the string
const age: number = parseInt("25", 10)

// Or change the type
const age: string = "25"
```

#### Missing Properties
```typescript
interface User { id: string; name: string; email: string }

// Error: Property 'email' is missing
const user: User = { id: "1", name: "John" }

// Fix 1: Add missing property
const user: User = { id: "1", name: "John", email: "john@example.com" }

// Fix 2: Make property optional in interface
interface User { id: string; name: string; email?: string }
```

#### Incompatible Object Types
```typescript
interface Cat { meow(): void }
interface Dog { bark(): void }

// Error: Cat is not assignable to Dog
const pet: Dog = { meow: () => console.log('meow') }

// Fix: Use correct type or union
const pet: Cat | Dog = { meow: () => console.log('meow') }
```

---

## TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'

Occurs when function argument type doesn't match expected parameter type.

### Scenarios & Solutions

#### Undefined Arguments
```typescript
function greet(name: string) { return `Hello, ${name}` }

// Error: undefined is not assignable to string
greet(undefined)

// Fix 1: Allow undefined
function greet(name: string | undefined) {
  return `Hello, ${name ?? 'Guest'}`
}

// Fix 2: Use optional parameter
function greet(name?: string) {
  return `Hello, ${name ?? 'Guest'}`
}
```

#### Array Element Types
```typescript
function sum(numbers: number[]) {
  return numbers.reduce((a, b) => a + b, 0)
}

// Error: string[] is not assignable to number[]
sum(["1", "2", "3"])

// Fix: Convert to numbers
sum(["1", "2", "3"].map(Number))
```

#### Callback Types
```typescript
function processItems(
  items: string[],
  callback: (item: string, index: number) => void
) { /* ... */ }

// Error: Callback signature mismatch
processItems(items, (item) => item.toUpperCase())  // Returns string, not void

// Fix: Ignore return value explicitly
processItems(items, (item) => { item.toUpperCase() })
```

---

## TS7006: Parameter 'x' implicitly has an 'any' type

Occurs when TypeScript can't infer a parameter type and strict mode is enabled.

### Scenarios & Solutions

#### Event Handlers
```typescript
// Error
const handleClick = (event) => { /* ... */ }

// Fix: Add type annotation
const handleClick = (event: MouseEvent) => {
  console.log(event.clientX, event.clientY)
}

// Common event types
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  console.log(target.value)
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') { /* ... */ }
}
```

#### Callback Parameters
```typescript
// Error
array.forEach((item) => { /* ... */ })

// Fix: Add type annotation
array.forEach((item: string) => { /* ... */ })

// Or let TypeScript infer from typed array
const items: string[] = ['a', 'b', 'c']
items.forEach((item) => { /* item is string */ })
```

#### Destructured Parameters
```typescript
// Error
function update({ id, name }) { /* ... */ }

// Fix: Type the parameter object
function update({ id, name }: { id: string; name: string }) { /* ... */ }

// Or use an interface
interface UpdateParams { id: string; name: string }
function update({ id, name }: UpdateParams) { /* ... */ }
```

---

## TS2532: Object is possibly 'undefined'

Occurs when accessing properties on values that might be undefined.

### Scenarios & Solutions

#### Optional Properties
```typescript
interface User { profile?: { name: string } }

// Error
const name = user.profile.name

// Fix 1: Optional chaining
const name = user.profile?.name

// Fix 2: Null check
if (user.profile) {
  const name = user.profile.name
}

// Fix 3: Default value
const name = user.profile?.name ?? 'Anonymous'
```

#### Array Access
```typescript
const items = ['a', 'b', 'c']

// Error (with noUncheckedIndexedAccess)
const first = items[0].toUpperCase()

// Fix: Check for undefined
const first = items[0]
if (first) {
  console.log(first.toUpperCase())
}

// Or use optional chaining
const upper = items[0]?.toUpperCase()
```

#### Function Returns
```typescript
function find(id: string): User | undefined { /* ... */ }

// Error
const userName = find('123').name

// Fix
const user = find('123')
if (user) {
  const userName = user.name
}

// Or with optional chaining
const userName = find('123')?.name
```

---

## TS2339: Property 'X' does not exist on type 'Y'

Occurs when accessing a property that isn't declared in the type.

### Scenarios & Solutions

#### Extending Objects
```typescript
interface User { name: string }

// Error: Property 'age' does not exist
const user: User = { name: 'John', age: 30 }

// Fix: Extend the interface
interface User {
  name: string
  age?: number
}
```

#### DOM Elements
```typescript
const input = document.querySelector('input')

// Error: value doesn't exist on Element
console.log(input.value)

// Fix: Type assertion
const input = document.querySelector('input') as HTMLInputElement
console.log(input.value)

// Or use generic
const input = document.querySelector<HTMLInputElement>('input')
if (input) {
  console.log(input.value)
}
```

#### Dynamic Properties
```typescript
interface Config { apiUrl: string }

// Error: Dynamic key access
const key = 'apiUrl'
const config: Config = { apiUrl: 'https://...' }
console.log(config[key])

// Fix: Index signature
interface Config {
  apiUrl: string
  [key: string]: string
}

// Or use keyof
function getConfigValue<K extends keyof Config>(config: Config, key: K) {
  return config[key]
}
```

---

## TS2554: Expected X arguments, but got Y

Occurs when calling a function with wrong number of arguments.

### Scenarios & Solutions

```typescript
function greet(name: string, greeting: string) {
  return `${greeting}, ${name}!`
}

// Error: Expected 2 arguments, but got 1
greet('John')

// Fix 1: Provide all arguments
greet('John', 'Hello')

// Fix 2: Make parameter optional
function greet(name: string, greeting: string = 'Hello') {
  return `${greeting}, ${name}!`
}

// Fix 3: Use optional parameter
function greet(name: string, greeting?: string) {
  return `${greeting ?? 'Hello'}, ${name}!`
}
```

---

## TS2741: Property 'X' is missing in type 'Y' but required in type 'Z'

Similar to TS2322, but specifically for missing required properties.

### Scenarios & Solutions

```typescript
interface Task {
  id: string
  title: string
  completed: boolean
}

// Error: 'completed' is missing
const task: Task = { id: '1', title: 'Test' }

// Fix 1: Add missing property
const task: Task = { id: '1', title: 'Test', completed: false }

// Fix 2: Use Partial for optional fields
const partialTask: Partial<Task> = { id: '1', title: 'Test' }

// Fix 3: Create with defaults
function createTask(data: Pick<Task, 'title'>): Task {
  return {
    id: crypto.randomUUID(),
    completed: false,
    ...data
  }
}
```
