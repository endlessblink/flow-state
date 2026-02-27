import { vi } from 'vitest';

export const readTextFile = vi.fn().mockResolvedValue('');
export const writeTextFile = vi.fn().mockResolvedValue(undefined);
export const exists = vi.fn().mockResolvedValue(true);
export const createDir = vi.fn().mockResolvedValue(undefined);
export const removeFile = vi.fn().mockResolvedValue(undefined);
export const readDir = vi.fn().mockResolvedValue([]);
