import { vi } from 'vitest';

export const appDataDir = vi.fn().mockResolvedValue('/mock/app/data/dir');
export const join = vi.fn().mockImplementation((...args) => args.join('/'));
export const homeDir = vi.fn().mockResolvedValue('/mock/home/dir');
export const resolve = vi.fn().mockImplementation((...args) => args.join('/'));
