/**
 * Tauri API Mocking Helpers for Playwright E2E Tests
 *
 * Copy this file to: src/tests/e2e/fixtures/mock-tauri.ts
 *
 * Usage in tests:
 *   import { mockTauriAPI, mockTauriFS, mockTauriDialog } from './fixtures/mock-tauri';
 *
 *   test('my test', async ({ page }) => {
 *     await mockTauriAPI(page, {
 *       'greet': (args) => `Hello, ${args.name}!`,
 *     });
 *     // ... test code
 *   });
 */
import { Page } from '@playwright/test';

// Type definitions for Tauri mocks
interface TauriCommandMocks {
  [command: string]: (args?: any) => any | Promise<any>;
}

interface TauriFileSystemMocks {
  readTextFile?: (path: string) => string | Promise<string>;
  writeTextFile?: (path: string, content: string) => void | Promise<void>;
  readDir?: (path: string) => any[] | Promise<any[]>;
  exists?: (path: string) => boolean | Promise<boolean>;
  createDir?: (path: string) => void | Promise<void>;
  removeFile?: (path: string) => void | Promise<void>;
  removeDir?: (path: string) => void | Promise<void>;
  copyFile?: (src: string, dest: string) => void | Promise<void>;
  renameFile?: (src: string, dest: string) => void | Promise<void>;
}

interface TauriDialogMocks {
  open?: (options?: any) => string | string[] | null | Promise<string | string[] | null>;
  save?: (options?: any) => string | null | Promise<string | null>;
  message?: (message: string, options?: any) => void | Promise<void>;
  ask?: (message: string, options?: any) => boolean | Promise<boolean>;
  confirm?: (message: string, options?: any) => boolean | Promise<boolean>;
}

interface TauriTrayMocks {
  getState?: () => any | Promise<any>;
  setTooltip?: (tooltip: string) => void | Promise<void>;
  setIcon?: (icon: string) => void | Promise<void>;
}

interface TauriWindowMocks {
  label?: string;
  show?: () => void | Promise<void>;
  hide?: () => void | Promise<void>;
  close?: () => void | Promise<void>;
  minimize?: () => void | Promise<void>;
  maximize?: () => void | Promise<void>;
  setTitle?: (title: string) => void | Promise<void>;
  setFullscreen?: (fullscreen: boolean) => void | Promise<void>;
}

/**
 * Mock Tauri IPC commands
 */
export async function mockTauriAPI(
  page: Page,
  commands: TauriCommandMocks = {}
): Promise<void> {
  const commandsStr = JSON.stringify(Object.keys(commands));

  await page.addInitScript(
    ({ commandKeys }) => {
      const mocks = (window as any).__MOCK_COMMANDS__ || {};

      (window as any).__TAURI_CORE__ = {
        invoke: async (cmd: string, args?: any) => {
          const handler = mocks[cmd];
          if (!handler) {
            console.warn(`[Tauri Mock] Unknown command: ${cmd}`);
            throw new Error(`Unknown Tauri command: ${cmd}`);
          }
          return handler(args);
        },
        convertFileSrc: (path: string) => `file://${path}`,
      };

      // Also set up legacy __TAURI__ namespace
      (window as any).__TAURI__ = (window as any).__TAURI_CORE__;
    },
    { commandKeys: commandsStr }
  );

  // Inject actual command handlers
  for (const [cmd, handler] of Object.entries(commands)) {
    await page.addInitScript(
      ({ command, handlerStr }) => {
        (window as any).__MOCK_COMMANDS__ = (window as any).__MOCK_COMMANDS__ || {};
        // eslint-disable-next-line no-eval
        (window as any).__MOCK_COMMANDS__[command] = eval(`(${handlerStr})`);
      },
      { command: cmd, handlerStr: handler.toString() }
    );
  }
}

/**
 * Mock Tauri File System plugin
 */
export async function mockTauriFS(
  page: Page,
  mocks: TauriFileSystemMocks = {}
): Promise<void> {
  const defaultMocks: Required<TauriFileSystemMocks> = {
    readTextFile: () => '',
    writeTextFile: () => {},
    readDir: () => [],
    exists: () => true,
    createDir: () => {},
    removeFile: () => {},
    removeDir: () => {},
    copyFile: () => {},
    renameFile: () => {},
  };

  const finalMocks = { ...defaultMocks, ...mocks };

  await page.addInitScript(
    (mockFns) => {
      (window as any).__TAURI_FS__ = {
        readTextFile: async (path: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.readTextFile})`)(path);
        },
        writeTextFile: async (path: string, content: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.writeTextFile})`)(path, content);
        },
        readDir: async (path: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.readDir})`)(path);
        },
        exists: async (path: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.exists})`)(path);
        },
        createDir: async (path: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.createDir})`)(path);
        },
        removeFile: async (path: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.removeFile})`)(path);
        },
        removeDir: async (path: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.removeDir})`)(path);
        },
        copyFile: async (src: string, dest: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.copyFile})`)(src, dest);
        },
        renameFile: async (src: string, dest: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.renameFile})`)(src, dest);
        },
      };
    },
    {
      readTextFile: finalMocks.readTextFile.toString(),
      writeTextFile: finalMocks.writeTextFile.toString(),
      readDir: finalMocks.readDir.toString(),
      exists: finalMocks.exists.toString(),
      createDir: finalMocks.createDir.toString(),
      removeFile: finalMocks.removeFile.toString(),
      removeDir: finalMocks.removeDir.toString(),
      copyFile: finalMocks.copyFile.toString(),
      renameFile: finalMocks.renameFile.toString(),
    }
  );
}

/**
 * Mock Tauri Dialog plugin
 */
export async function mockTauriDialog(
  page: Page,
  mocks: TauriDialogMocks = {}
): Promise<void> {
  const defaultMocks: Required<TauriDialogMocks> = {
    open: () => '/mock/selected/file.txt',
    save: () => '/mock/save/location.txt',
    message: () => {},
    ask: () => true,
    confirm: () => true,
  };

  const finalMocks = { ...defaultMocks, ...mocks };

  await page.addInitScript(
    (mockFns) => {
      (window as any).__TAURI_DIALOG__ = {
        open: async (options?: any) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.open})`)(options);
        },
        save: async (options?: any) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.save})`)(options);
        },
        message: async (message: string, options?: any) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.message})`)(message, options);
        },
        ask: async (message: string, options?: any) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.ask})`)(message, options);
        },
        confirm: async (message: string, options?: any) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.confirm})`)(message, options);
        },
      };
    },
    {
      open: finalMocks.open.toString(),
      save: finalMocks.save.toString(),
      message: finalMocks.message.toString(),
      ask: finalMocks.ask.toString(),
      confirm: finalMocks.confirm.toString(),
    }
  );
}

/**
 * Mock Tauri System Tray
 */
export async function mockTauriTray(
  page: Page,
  mocks: TauriTrayMocks = {}
): Promise<void> {
  const defaultMocks: Required<TauriTrayMocks> = {
    getState: () => ({ isVisible: true, menuItems: ['Show', 'Settings', 'Quit'] }),
    setTooltip: () => {},
    setIcon: () => {},
  };

  const finalMocks = { ...defaultMocks, ...mocks };

  await page.addInitScript(
    (mockFns) => {
      (window as any).__TAURI_TRAY__ = {
        getState: async () => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.getState})`)();
        },
        setTooltip: async (tooltip: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.setTooltip})`)(tooltip);
        },
        setIcon: async (icon: string) => {
          // eslint-disable-next-line no-eval
          return eval(`(${mockFns.setIcon})`)(icon);
        },
      };
    },
    {
      getState: finalMocks.getState.toString(),
      setTooltip: finalMocks.setTooltip.toString(),
      setIcon: finalMocks.setIcon.toString(),
    }
  );
}

/**
 * Mock Tauri Window
 */
export async function mockTauriWindow(
  page: Page,
  mocks: TauriWindowMocks = {}
): Promise<void> {
  const defaultMocks: Required<TauriWindowMocks> = {
    label: 'main',
    show: () => {},
    hide: () => {},
    close: () => {},
    minimize: () => {},
    maximize: () => {},
    setTitle: () => {},
    setFullscreen: () => {},
  };

  const finalMocks = { ...defaultMocks, ...mocks };

  await page.addInitScript(
    (mockFns) => {
      (window as any).__TAURI_WINDOW__ = {
        getCurrent: () => ({
          label: mockFns.label,
          show: async () => {
            // eslint-disable-next-line no-eval
            return eval(`(${mockFns.show})`)();
          },
          hide: async () => {
            // eslint-disable-next-line no-eval
            return eval(`(${mockFns.hide})`)();
          },
          close: async () => {
            // eslint-disable-next-line no-eval
            return eval(`(${mockFns.close})`)();
          },
          minimize: async () => {
            // eslint-disable-next-line no-eval
            return eval(`(${mockFns.minimize})`)();
          },
          maximize: async () => {
            // eslint-disable-next-line no-eval
            return eval(`(${mockFns.maximize})`)();
          },
          setTitle: async (title: string) => {
            // eslint-disable-next-line no-eval
            return eval(`(${mockFns.setTitle})`)(title);
          },
          setFullscreen: async (fullscreen: boolean) => {
            // eslint-disable-next-line no-eval
            return eval(`(${mockFns.setFullscreen})`)(fullscreen);
          },
          listen: (event: string, handler: any) => {
            // Return unsubscribe function
            return () => {};
          },
          emit: (event: string, payload?: any) => {},
        }),
      };
    },
    {
      label: finalMocks.label,
      show: finalMocks.show.toString(),
      hide: finalMocks.hide.toString(),
      close: finalMocks.close.toString(),
      minimize: finalMocks.minimize.toString(),
      maximize: finalMocks.maximize.toString(),
      setTitle: finalMocks.setTitle.toString(),
      setFullscreen: finalMocks.setFullscreen.toString(),
    }
  );
}

/**
 * Mock all Tauri APIs at once
 */
export async function mockAllTauriAPIs(
  page: Page,
  options: {
    commands?: TauriCommandMocks;
    fs?: TauriFileSystemMocks;
    dialog?: TauriDialogMocks;
    tray?: TauriTrayMocks;
    window?: TauriWindowMocks;
  } = {}
): Promise<void> {
  await mockTauriAPI(page, options.commands || {});
  await mockTauriFS(page, options.fs || {});
  await mockTauriDialog(page, options.dialog || {});
  await mockTauriTray(page, options.tray || {});
  await mockTauriWindow(page, options.window || {});
}

/**
 * Debug utilities
 */
export async function debugPage(page: Page): Promise<void> {
  console.log('=== Debug Info ===');
  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  // Take screenshot
  await page.screenshot({ path: `debug-${Date.now()}.png` });

  // Log page state
  const pageState = await page.evaluate(() => ({
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    tauriAvailable: !!(window as any).__TAURI_CORE__,
  }));
  console.log('Page state:', JSON.stringify(pageState, null, 2));

  // Pause for manual inspection
  await page.pause();
}

/**
 * Wait for Tauri app to be fully loaded
 */
export async function waitForTauriApp(page: Page): Promise<void> {
  // Wait for Vue app to mount
  await page.waitForSelector('[data-v-app]', { timeout: 10000 });

  // Wait for network to be idle
  await page.waitForLoadState('networkidle');

  // Optional: wait for specific app-ready indicator
  // await page.waitForSelector('[data-app-ready="true"]');
}
