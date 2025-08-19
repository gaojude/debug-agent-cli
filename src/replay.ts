import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import chalk from "chalk";
import { ReplayOptions, ReplayContext, Recording } from "./types.js";

export type InstrumentationHooks = {
  setup?: (ctx: { page: Page }) => Promise<void> | void;
  onBeforeEvent?: (
    event: any,
    ctx: { page: Page; eventIndex: number }
  ) => Promise<void> | void;
  onAfterEvent?: (
    event: any,
    ctx: { page: Page; eventIndex: number }
  ) => Promise<void> | void;
  onComplete?: (ctx: { page: Page }) => Promise<any> | any;
};

export function sanitizeInstrumentationCode(raw: string): string {
  let code = raw
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();
  code = code
    .replace(/^export\s+default\s+/i, "")
    .replace(/^export\s+/i, "")
    .replace(/^module\.exports\s*=\s*/i, "")
    .replace(/^[;\s]+/, "")
    .replace(/[;\s]+$/, "");
  return code;
}

export function tryCompileInstrumentation(code: string): {
  ok: boolean;
  error?: any;
  value?: any;
} {
  try {
    const value = new Function("", `return (${code})`)();

    if (typeof value === "function") {
      try {
        const testResult = value.length >= 1 ? value({ mock: true }) : value();
        if (testResult && typeof testResult === "object") {
          const hasHook = [
            "setup",
            "onBeforeEvent",
            "onAfterEvent",
            "onComplete",
          ].some((hook) => typeof testResult[hook] === "function");
          if (hasHook) {
            return { ok: true, value };
          }
        }
      } catch {
        return { ok: true, value };
      }
    }

    if (value && typeof value === "object") {
      const hasHook = [
        "setup",
        "onBeforeEvent",
        "onAfterEvent",
        "onComplete",
      ].some((hook) => typeof value[hook] === "function");
      if (hasHook) {
        return { ok: true, value };
      }
    }

    return {
      ok: false,
      error: new Error(
        "Must be a function returning hooks or an object with hook functions"
      ),
    };
  } catch (error) {
    return { ok: false, error };
  }
}

function isWSL(): boolean {
  if (process.platform !== "linux") return false;
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  const release = os.release().toLowerCase();
  return release.includes("microsoft") || release.includes("wsl");
}

function normalizeToHooks(value: any, page: Page | any): InstrumentationHooks {
  if (typeof value === "function") {
    try {
      const pageArg = page && page.mock ? page : page;
      const hooks = value(pageArg);
      if (hooks && typeof hooks === "object") {
        return normalizeToHooks(hooks, page);
      }
    } catch (e) {
      console.error(chalk.red("Failed to call instrumentation function:"), e);
    }
  }

  if (value && typeof value === "object") {
    const candidate: InstrumentationHooks = {
      setup: typeof value.setup === "function" ? value.setup : undefined,
      onBeforeEvent:
        typeof value.onBeforeEvent === "function"
          ? value.onBeforeEvent
          : undefined,
      onAfterEvent:
        typeof value.onAfterEvent === "function"
          ? value.onAfterEvent
          : undefined,
      onComplete:
        typeof value.onComplete === "function" ? value.onComplete : undefined,
    };

    return candidate;
  }

  return {};
}

export class Replay {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private stopped = false;
  private logs: string[] = [];
  private consoleLogs: ReplayContext["consoleLogs"] = [];
  private instrumentationEvents: ReplayContext["instrumentationEvents"] = [];
  private network: ReplayContext["network"] = {
    requests: [],
    responses: [],
    failures: [],
  };
  private finalResults: any = {};
  private options: ReplayOptions;
  private instrumentationCode?: string;
  private pendingHooks?: InstrumentationHooks;
  private pendingHooksValue?: any;

  constructor(options?: Partial<ReplayOptions>) {
    this.options = {
      speed: 1,
      headless: false,
      devtools: false,
      urlOverride: undefined,
      ...options,
    } as ReplayOptions;
  }

  setInstrumentationCode(code: string) {
    this.instrumentationCode = sanitizeInstrumentationCode(code);
  }

  async stop() {
    this.stopped = true;
    try {
      if (this.context) await this.context.close();
    } catch {}
    try {
      if (this.browser) await this.browser.close();
    } catch {}
    this.context = null;
    this.browser = null;
  }

  async run(
    recordingOrFile: any | string,
    speed?: number
  ): Promise<ReplayContext> {
    const startedAt = Date.now();
    if (typeof speed === "number") {
      this.options.speed = speed;
    }

    const recording = await this.resolveRecording(recordingOrFile);

    console.log(chalk.blue("🎬 Starting replay...\n"));

    let pageMap = new Map<string, Page>();
    let page: Page | null = null;

    try {
      const wsl = isWSL();
      const canShowUI = Boolean(
        process.env.DISPLAY || process.env.WAYLAND_DISPLAY
      );
      const effectiveHeadless = this.options.headless;
      const effectiveDevtools = this.options.devtools;

      if (wsl && !canShowUI && this.options.headless === false) {
        console.log(
          chalk.yellow(
            "⚠️  WSL detected with no GUI. Forcing headless mode."
          )
        );
      }

      this.browser = await chromium.launch({
        headless: effectiveHeadless,
        devtools: effectiveDevtools,
        args: [
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-dev-shm-usage",
          "--no-sandbox",
        ],
      });
      this.context = await this.browser.newContext();

      // Attach page listeners
      const attachPageListeners = (p: Page) => {
        p.on("console", (msg) => {
          const text = msg.text();
          const type = msg.type();
          const timestamp = Date.now();
          this.consoleLogs.push({
            type,
            text,
            timestamp,
            location: msg.location(),
          });

          if (text.startsWith("INSTRUMENT:")) {
            try {
              const data = JSON.parse(text.substring(11));
              this.instrumentationEvents.push({ timestamp, data });
            } catch (e) {
              // Ignore
            }
          }
        });
      };

      // Build instrumentation hooks if provided
      let hooksValue: any = {};
      if (this.instrumentationCode) {
        try {
          hooksValue = new Function(
            "",
            `return (${this.instrumentationCode})`
          )();
        } catch (e) {
          const errorMsg = chalk.red(`❌ Failed to compile instrumentation: ${String(e)}`);
          console.log(errorMsg);
        }
      }

      this.pendingHooksValue = hooksValue;

      // Pre-normalize hooks
      if (hooksValue) {
        try {
          const mockPage = { mock: true };
          this.pendingHooks = normalizeToHooks(hooksValue, mockPage as any);
        } catch (e) {
          console.error(chalk.red("Failed to pre-normalize hooks:"), e);
        }
      }

      // Replay events
      for (let i = 0; i < recording.events.length; i++) {
        if (this.stopped) {
          console.log(chalk.yellow("\n⏹️  Replay terminated"));
          break;
        }

        const event = recording.events[i];
        const nextEvent = recording.events[i + 1];

        const delayRaw = nextEvent ? nextEvent.timestamp - event.timestamp : 0;
        const delay = Math.round(delayRaw / Math.max(0.1, this.options.speed));

        try {
          // Run onBeforeEvent hook if available
          if (page && this.pendingHooks?.onBeforeEvent) {
            const eventPage = event.pageId ? pageMap.get(event.pageId) : page;
            if (eventPage) {
              try {
                await this.pendingHooks.onBeforeEvent(event, {
                  page: eventPage,
                  eventIndex: i,
                });
              } catch (e) {
                console.error(chalk.red(`onBeforeEvent error for event ${i}:`), e);
              }
            }
          }

          // Replay the event
          const result = await this.replayEvent(event, pageMap, attachPageListeners);
          if (result && !page) {
            page = result;
            
            // Re-normalize hooks with real page
            if (this.pendingHooksValue) {
              try {
                this.pendingHooks = normalizeToHooks(this.pendingHooksValue, page);
              } catch (e) {
                console.error(chalk.red("Failed to normalize hooks:"), e);
              }
            }

            // Call setup hook
            if (this.pendingHooks?.setup) {
              try {
                await this.pendingHooks.setup({ page });
              } catch (e) {
                console.error(chalk.red("Setup error:"), e);
              }
            }
          }

          // Run onAfterEvent hook if available
          const eventPageAfter = event.pageId ? pageMap.get(event.pageId) : page;
          if (eventPageAfter && this.pendingHooks?.onAfterEvent) {
            try {
              await this.pendingHooks.onAfterEvent(event, {
                page: eventPageAfter,
                eventIndex: i,
              });
            } catch (e) {
              console.error(chalk.red(`onAfterEvent error for event ${i}:`), e);
            }
          }
        } catch (e) {
          console.log(chalk.red(`❌ Error replaying event ${i + 1}: ${String(e)}`));
        }

        if (delay > 0 && i < recording.events.length - 1) {
          const actualDelay = Math.min(delay, 3000);
          await new Promise((resolve) => setTimeout(resolve, actualDelay));
        }
      }

      // Call onComplete hook
      if (this.pendingHooks?.onComplete) {
        const activePages = Array.from(pageMap.values()).filter(
          (p) => !p.isClosed()
        );
        const pageForComplete =
          activePages.length > 0 ? activePages[activePages.length - 1] : page;

        if (pageForComplete) {
          try {
            this.finalResults = await this.pendingHooks.onComplete({
              page: pageForComplete,
            });
          } catch (e) {
            console.error(chalk.red("onComplete error:"), e);
          }
        }
      }

      console.log(chalk.green("\n✅ Replay completed!"));
    } finally {
      try {
        if (this.context) await this.context.close();
      } catch {}
      try {
        if (this.browser) await this.browser.close();
      } catch {}
      this.context = null;
      this.browser = null;
    }

    const endedAt = Date.now();

    return {
      logs: this.logs,
      consoleLogs: this.consoleLogs,
      instrumentationEvents: this.instrumentationEvents,
      network: this.network,
      finalResults: this.finalResults,
      meta: { startedAt, endedAt, durationMs: endedAt - startedAt },
    };
  }

  private async resolveRecording(recordingOrFile: any | string): Promise<Recording> {
    if (typeof recordingOrFile === "string") {
      const filePath = recordingOrFile.endsWith(".json")
        ? recordingOrFile
        : path.join(process.cwd(), "recordings", `${recordingOrFile}.json`);
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw);
    }
    return recordingOrFile;
  }

  private replaceBaseUrl(originalUrl: string, newBaseUrl: string): string {
    if (!originalUrl || originalUrl === "about:blank") {
      return originalUrl;
    }

    try {
      const original = new URL(originalUrl);
      const newBase = new URL(newBaseUrl);
      
      // Replace protocol, host, and port, but keep the path, search, and hash
      return newBase.origin + original.pathname + original.search + original.hash;
    } catch (error) {
      // If URL parsing fails, return the original URL
      console.log(chalk.yellow(`⚠️  Failed to parse URL for replacement: ${originalUrl}`));
      return originalUrl;
    }
  }

  private async replayEvent(
    event: any,
    pageMap: Map<string, Page>,
    attachPageListeners: (p: Page) => void
  ): Promise<Page | null> {
    let page: Page | null = null;

    switch (event.type) {
      case "newtab": {
        const newPage = await this.context!.newPage();
        if (event.pageId) {
          pageMap.set(event.pageId, newPage);
        }
        attachPageListeners(newPage);
        console.log(chalk.cyan(`📑 New tab opened`));
        return newPage;
      }
      case "closetab": {
        const p = event.pageId ? pageMap.get(event.pageId) : null;
        if (p) {
          try {
            await p.close();
          } catch {}
          if (event.pageId) pageMap.delete(event.pageId);
        }
        console.log(chalk.cyan("📑 Tab closed"));
        break;
      }
      case "navigation": {
        const p = event.pageId ? pageMap.get(event.pageId) : Array.from(pageMap.values())[0];
        let url = event.data?.url;
        
        // Apply URL override if specified
        if (url && url !== "about:blank" && this.options.urlOverride) {
          const originalUrl = url;
          url = this.replaceBaseUrl(url, this.options.urlOverride);
          if (originalUrl !== url) {
            console.log(chalk.cyan(`🔄 URL override: ${originalUrl} → ${url}`));
          }
        }
        
        if (p && url && url !== "about:blank") {
          const current = p.url();
          if (current !== url) {
            try {
              await p.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
              });
              console.log(chalk.cyan(`🔗 Navigate to ${url}`));
            } catch (e: any) {
              console.log(chalk.red(`❌ Navigation error: ${e.message || String(e)}`));
            }
          }
        }
        break;
      }
      case "click": {
        const p = event.pageId ? pageMap.get(event.pageId) : Array.from(pageMap.values())[0];
        const x = event.data?.x;
        const y = event.data?.y;
        if (p && typeof x === "number" && typeof y === "number") {
          await p.mouse.move(x, y);
          await p.mouse.click(x, y);
          console.log(chalk.cyan(`🖱️  Click at (${x}, ${y})`));
        }
        break;
      }
      case "input": {
        const p = event.pageId ? pageMap.get(event.pageId) : Array.from(pageMap.values())[0];
        const value = event.data?.value;
        if (p && typeof value === "string") {
          if (event.data?.id) {
            try {
              await p.fill(`#${event.data.id}`, value);
            } catch {}
          } else if (event.data?.name) {
            try {
              await p.fill(`[name="${event.data.name}"]`, value);
            } catch {}
          }
          console.log(chalk.cyan(`⌨️  Input: "${value.substring(0, 30)}..."`));
        }
        break;
      }
      case "keydown": {
        const p = event.pageId ? pageMap.get(event.pageId) : Array.from(pageMap.values())[0];
        const key = event.data?.key;
        if (p && typeof key === "string") {
          await p.keyboard.press(key);
          console.log(chalk.cyan(`⌨️  Keydown: ${key}`));
        }
        break;
      }
      case "scroll": {
        const p = event.pageId ? pageMap.get(event.pageId) : Array.from(pageMap.values())[0];
        const y = event.data?.y;
        if (p && typeof y === "number") {
          await p.evaluate((scrollY) => {
            window.scrollTo(0, scrollY as any);
          }, y);
          console.log(chalk.cyan(`📜 Scroll to Y: ${y}`));
        }
        break;
      }
      case "viewport_resize": {
        const p = event.pageId ? pageMap.get(event.pageId) : Array.from(pageMap.values())[0];
        const width = event.data?.width;
        const height = event.data?.height;
        if (p && typeof width === "number" && typeof height === "number") {
          try {
            await p.setViewportSize({ width, height });
            console.log(chalk.cyan(`🖥️  Resize viewport to ${width}x${height}`));
          } catch (e: any) {
            console.log(chalk.red(`❌ Viewport resize error: ${e.message || String(e)}`));
          }
        }
        break;
      }
    }

    return null;
  }
}