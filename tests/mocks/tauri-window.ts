import { vi } from 'vitest';

export const getCurrentWindow = vi.fn().mockReturnValue({
  setTitle: vi.fn(),
  close: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
});

export const WebviewWindow = vi.fn().mockImplementation(() => ({
  setTitle: vi.fn(),
  close: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
}));
