import { vi } from 'vitest';

export const open = vi.fn().mockResolvedValue('/mock/path');
export const save = vi.fn().mockResolvedValue('/mock/path');
export const message = vi.fn().mockResolvedValue(undefined);
export const ask = vi.fn().mockResolvedValue(true);
