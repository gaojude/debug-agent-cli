import { chromium, Browser, BrowserContext, Page } from "playwright";
import * as fs from "fs/promises";
import * as path from "path";
import { Recording, PageInfo, InteractionEvent } from "./types.js";
import chalk from "chalk";

export class BrowserRecorder {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private recording: Recording;
  private isRecording: boolean = false;
  private pages: Map<string, PageInfo> = new Map();
  private currentPageId: string | null = null;
  private lastEventTime: number = 0;
  private recordingPath: string;
  private eventCounter: number = 0;
  private browserClosedCallback?: () => void;
  private trackedPages: Set<Page> = new Set();

  constructor(recordingPath?: string) {
    this.recording = this.initRecording();
    this.recordingPath = recordingPath || path.join(process.cwd(), "recordings");
  }

  private initRecording(): Recording {
    return {
      startTime: Date.now(),
      events: [],
      metadata: {
        browser: "chromium",
        platform: process.platform,
        recordedAt: new Date().toISOString(),
      },
    };
  }

  private addEvent(event: Partial<InteractionEvent>) {
    const now = Date.now();
    const completeEvent: InteractionEvent = {
      timestamp: now,
      pageId: this.currentPageId || undefined,
      pageUrl: this.currentPageId
        ? this.pages.get(this.currentPageId)?.url
        : undefined,
      ...event,
    } as InteractionEvent;

    this.recording.events.push(completeEvent);
    this.eventCounter++;

    const timeDelta = this.lastEventTime ? now - this.lastEventTime : 0;
    this.lastEventTime = now;

    let logMessage = chalk.cyan(`[+${timeDelta}ms] #${this.eventCounter}`) + " " + chalk.yellow(event.type);
    if (event.type === "click") {
      logMessage += chalk.gray(` at (${event.data?.x}, ${event.data?.y})`);
    } else if (event.type === "input" || event.type === "keypress") {
      logMessage += chalk.gray(`: "${String(
        event.data?.value || event.data?.key || ""
      ).substring(0, 30)}"`);
    } else if (event.type === "navigation") {
      logMessage += chalk.gray(`: ${event.data?.url}`);
    }

    console.log(logMessage);
  }

  async startRecording(): Promise<{ success: boolean; sessionId: string }> {
    if (this.isRecording) {
      console.log(chalk.yellow("Stopping existing recording..."));
      await this.stopRecording("_auto_stopped_" + Date.now());
    }

    if (this.browser) {
      await this.cleanup();
    }

    console.log(chalk.red.bold("\n🔴 Starting recording mode...\n"));

    await fs.mkdir(this.recordingPath, { recursive: true });

    this.browser = await chromium.launch({
      headless: false,
      args: [
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-dev-shm-usage",
        "--no-sandbox",
      ],
    });

    this.context = await this.browser.newContext();
    this.isRecording = true;
    this.recording = this.initRecording();
    this.eventCounter = 0;

    // Listen for browser disconnection
    this.browser.on("disconnected", () => {
      console.log(chalk.yellow("\n\nBrowser closed. Stopping recording..."));
      if (this.browserClosedCallback) {
        this.browserClosedCallback();
      }
    });

    this.context.on("page", async (page) => {
      if (!this.trackedPages.has(page)) {
        await this.setupPageTracking(page);
      }
    });

    const page = await this.context.newPage();
    if (!this.trackedPages.has(page)) {
      await this.setupPageTracking(page);
    }

    console.log(chalk.green.bold("✅ Recording started! Browser is ready.\n"));
    console.log(chalk.gray("Interact with the browser. Press Ctrl+C to stop recording.\n"));

    const sessionId = Date.now().toString();
    return { success: true, sessionId };
  }

  private async setupPageTracking(page: Page) {
    // Mark this page as tracked
    this.trackedPages.add(page);
    
    const pageId = `page_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.pages.set(pageId, {
      id: pageId,
      url: page.url(),
      title: await page.title(),
      index: this.pages.size,
    });

    this.currentPageId = pageId;

    this.addEvent({
      type: "newtab",
      data: { pageId, url: page.url(), index: this.pages.size - 1 },
    });

    let lastUrl = page.url();
    let isInitialNavigation = true;
    let lastNavigationTime = Date.now();
    let pendingClientNavigation = false;

    page.on("load", async () => {
      const currentUrl = page.url();

      if (currentUrl !== lastUrl && !pendingClientNavigation) {
        const pageInfo = this.pages.get(pageId);
        if (pageInfo) {
          pageInfo.url = currentUrl;
          pageInfo.title = await page.title();
        }

        this.addEvent({
          type: "navigation",
          data: {
            url: currentUrl,
            pageId,
            navigationType: isInitialNavigation ? "initial" : "hard",
            previousUrl: lastUrl,
          },
        });

        lastUrl = currentUrl;
        isInitialNavigation = false;
        lastNavigationTime = Date.now();
      }

      pendingClientNavigation = false;
    });

    page.on("framenavigated", async (frame) => {
      if (frame === page.mainFrame()) {
        const currentUrl = frame.url();
        const timeSinceLastNav = Date.now() - lastNavigationTime;

        const isSameDomain = (() => {
          try {
            const oldUrl = new URL(lastUrl);
            const newUrl = new URL(currentUrl);
            return oldUrl.origin === newUrl.origin;
          } catch {
            return false;
          }
        })();

        if (isSameDomain && timeSinceLastNav < 2000) {
          pendingClientNavigation = true;
        }

        const pageInfo = this.pages.get(pageId);
        if (pageInfo) {
          pageInfo.url = currentUrl;
          pageInfo.title = await page.title();
        }
      }
    });

    page.on("close", () => {
      this.addEvent({
        type: "closetab",
        data: { pageId },
      });
      this.pages.delete(pageId);
      this.trackedPages.delete(page);

      const remainingPages = Array.from(this.pages.values());
      if (remainingPages.length > 0) {
        this.currentPageId = remainingPages[0].id;
      } else {
        // No more pages open, trigger callback to stop recording
        console.log(chalk.yellow("\n\nAll browser tabs closed."));
        if (this.browserClosedCallback) {
          setTimeout(() => {
            this.browserClosedCallback!();
          }, 100); // Small delay to ensure all events are processed
        }
      }
    });

    page.on("console", (msg) => {
      const text = msg.text();

      if (text.startsWith("TRACK:")) {
        try {
          const jsonStr = text.substring(6);
          const eventData = JSON.parse(jsonStr);

          this.addEvent({
            type: eventData.type,
            data: eventData.data,
            viewport: {
              width: page.viewportSize()?.width || 1280,
              height: page.viewportSize()?.height || 720,
            },
          });
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });

    await page.addInitScript(() => {
      const track = (type: string, data: any) => {
        console.log(`TRACK:${JSON.stringify({ type, data })}`);
      };

      let currentUrl = window.location.href;

      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function (...args) {
        const result = originalPushState.apply(history, args);
        const newUrl = window.location.href;
        if (newUrl !== currentUrl) {
          track("spa_navigation", {
            url: newUrl,
            previousUrl: currentUrl,
            method: "pushState",
            title: document.title,
          });
          currentUrl = newUrl;
        }
        return result;
      };

      history.replaceState = function (...args) {
        const result = originalReplaceState.apply(history, args);
        const newUrl = window.location.href;
        if (newUrl !== currentUrl) {
          track("spa_navigation", {
            url: newUrl,
            previousUrl: currentUrl,
            method: "replaceState",
            title: document.title,
          });
          currentUrl = newUrl;
        }
        return result;
      };

      window.addEventListener("popstate", () => {
        setTimeout(() => {
          const newUrl = window.location.href;
          if (newUrl !== currentUrl) {
            track("spa_navigation", {
              url: newUrl,
              previousUrl: currentUrl,
              method: "popstate",
              title: document.title,
            });
            currentUrl = newUrl;
          }
        }, 10);
      });

      window.addEventListener("hashchange", () => {
        const newUrl = window.location.href;
        track("spa_navigation", {
          url: newUrl,
          previousUrl: currentUrl,
          method: "hashchange",
          title: document.title,
        });
        currentUrl = newUrl;
      });

      let lastMouseMove = 0;
      document.addEventListener(
        "mousemove",
        (e) => {
          const now = Date.now();
          if (now - lastMouseMove > 50) {
            lastMouseMove = now;
            track("mousemove", {
              x: e.pageX,
              y: e.pageY,
              clientX: e.clientX,
              clientY: e.clientY,
            });
          }
        },
        true
      );

      document.addEventListener(
        "click",
        (e) => {
          const target = e.target as HTMLElement;
          const rect = target.getBoundingClientRect();

          track("click", {
            x: e.pageX,
            y: e.pageY,
            clientX: e.clientX,
            clientY: e.clientY,
            button: e.button,
            target: {
              tag: target.tagName,
              id: target.id,
              class: target.className,
              text: target.textContent?.trim().substring(0, 50),
              href: (target as HTMLAnchorElement).href,
              value: (target as HTMLInputElement).value,
              rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              },
            },
          });
        },
        true
      );

      document.addEventListener(
        "keydown",
        (e) => {
          track("keydown", {
            key: e.key,
            code: e.code,
            keyCode: e.keyCode,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
            target: {
              tag: (e.target as HTMLElement).tagName,
              id: (e.target as HTMLElement).id,
              name: (e.target as HTMLInputElement).name,
            },
          });
        },
        true
      );

      document.addEventListener(
        "input",
        (e) => {
          const target = e.target as HTMLInputElement;
          track("input", {
            value: target.value,
            type: target.type,
            name: target.name,
            id: target.id,
            tag: target.tagName,
          });
        },
        true
      );

      let scrollTimeout: any;
      document.addEventListener(
        "scroll",
        () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            track("scroll", {
              x: window.scrollX,
              y: window.scrollY,
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
              viewportWidth: window.innerWidth,
              viewportHeight: window.innerHeight,
            });
          }, 100);
        },
        true
      );

      document.addEventListener(
        "focus",
        (e) => {
          const target = e.target as HTMLElement;
          track("focus", {
            tag: target.tagName,
            id: target.id,
            name: (target as HTMLInputElement).name,
            type: (target as HTMLInputElement).type,
          });
        },
        true
      );

      document.addEventListener(
        "submit",
        (e) => {
          const form = e.target as HTMLFormElement;
          const formData: any = {};

          const inputs = form.querySelectorAll("input, select, textarea");
          inputs.forEach((input: any) => {
            if (input.name) {
              formData[input.name] = input.value;
            }
          });

          track("submit", {
            action: form.action,
            method: form.method,
            data: formData,
          });
        },
        true
      );

      console.log(
        "TRACK:" +
          JSON.stringify({
            type: "tracking_initialized",
            data: { url: window.location.href },
          })
      );
    });
  }

  async stopRecording(name?: string): Promise<string> {
    if (!this.isRecording) return "";

    this.isRecording = false;
    this.recording.endTime = Date.now();
    this.recording.metadata.duration =
      this.recording.endTime - this.recording.startTime;

    if (name) {
      this.recording.metadata.name = name;
    }

    const filename = name
      ? `${name.replace(/[^a-zA-Z0-9-_]/g, "_")}.json`
      : `recording_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const filepath = path.join(this.recordingPath, filename);

    await fs.writeFile(filepath, JSON.stringify(this.recording, null, 2));

    if (!name?.startsWith("_auto_stopped_")) {
      console.log(chalk.green(`\n💾 Recording saved to: ${filepath}`));
      console.log(
        chalk.gray(
          `📊 Stats: ${this.recording.events.length} events, ${Math.round(
            this.recording.metadata.duration / 1000
          )}s duration\n`
        )
      );
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {}
      this.browser = null;
      this.context = null;
    }

    return filepath;
  }

  async cleanup() {
    this.isRecording = false;
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
      } finally {
        this.browser = null;
        this.context = null;
      }
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  onBrowserClosed(callback: () => void) {
    this.browserClosedCallback = callback;
  }
}