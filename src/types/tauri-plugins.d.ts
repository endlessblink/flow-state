declare module '@tauri-apps/plugin-dialog' {
  export function save(options?: Record<string, unknown>): Promise<string | null>
}

declare module '@tauri-apps/plugin-fs' {
  export function mkdir(path: string, options?: Record<string, unknown>): Promise<void>
  export function exists(path: string, options?: Record<string, unknown>): Promise<boolean>
  export function writeTextFile(path: string, contents: string, options?: Record<string, unknown>): Promise<void>
}

declare module '@tauri-apps/plugin-store' {
  export function load(path: string, options?: Record<string, unknown>): Promise<{
    get<T = unknown>(key: string): Promise<T | null>
    set(key: string, value: unknown): Promise<void>
    save(): Promise<void>
  }>
}

declare module '@tauri-apps/plugin-shell' {
  export function open(path: string): Promise<void>
  export class Command {
    static create(program: string, args?: string[] | Record<string, unknown>, options?: Record<string, unknown>): Command
    execute(): Promise<{ code: number; stdout: string; stderr: string }>
  }
}

declare module '@tauri-apps/plugin-updater' {
  export function check(): Promise<{
    version: string
    currentVersion: string
    date?: string
    body?: string
    downloadAndInstall(onProgress?: (event: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void): Promise<void>
  } | null>
}

declare module '@tauri-apps/plugin-process' {
  export function relaunch(): Promise<void>
}

declare module '@tauri-apps/plugin-http' {
  export const fetch: typeof globalThis.fetch
}

declare module '@tauri-apps/plugin-log' {
  export function attachConsole(): Promise<() => void>
}
