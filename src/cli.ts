#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { BrowserRecorder } from "./recorder.js";
import { Replay } from "./replay.js";
import * as path from "path";
import * as fs from "fs/promises";

const program = new Command();

program
  .name("debug-agent")
  .description("Browser automation CLI for LLM agents - Records and replays browser sessions for debugging and analysis")
  .version("1.0.0")
  .addHelpText('before', chalk.cyan('\n=== BROWSER AUTOMATION CLI FOR LLM AGENTS ===\n'))
  .addHelpText('after', chalk.gray(`
USAGE NOTES FOR LLM AGENTS:
  
  1. RECORDING:
     - Use 'record <filepath>' to start recording a browser session
     - The filepath should be a .json file path where the recording will be saved
     - The browser will open automatically when recording starts
     - Recording stops automatically when all browser tabs are closed
     - Recording also stops when pressing Ctrl+C
     - All user interactions (clicks, typing, navigation) are captured
  
  2. INSPECTING:
     - Use 'inspect <filepath>' to analyze a recording's structure
     - Use --schema flag to get detailed information for writing instrumentation
     - Use --sample N to see example events from the recording
     - This helps LLMs understand what events to handle in instrumentation
  
  3. REPLAYING:
     - Use 'replay <filepath>' to replay a recorded session
     - The filepath should point to a previously recorded .json file
     - Use --speed option to control playback speed (0.5 = half speed, 2 = double speed)
     - Use --headless to run without showing the browser window
     - Use --instrument <file.js> to inject custom instrumentation during replay
  
  4. INSTRUMENTATION:
     - Write JavaScript files that hook into replay events
     - Access the Playwright Page API to interact with the browser
     - Collect data, take screenshots, monitor performance, etc.
     - Return results from onComplete() hook for analysis
  
  5. FILE FORMAT:
     - Recordings are saved as JSON files containing all browser events
     - Each event includes timestamp, type, and relevant data
     - Use 'inspect' command to understand the structure before writing instrumentation

WORKFLOW FOR LLM INSTRUMENTATION GENERATION:
  1. First inspect the recording: debug-agent inspect ./recording.json --schema
  2. Understand what events are present and their structure
  3. Generate instrumentation code based on the task and available events
  4. Run replay with instrumentation: debug-agent replay ./recording.json --instrument ./generated.js

EXAMPLES:
  debug-agent record ./recordings/test-session.json
  debug-agent inspect ./recordings/test-session.json --schema --sample 3
  debug-agent replay ./recordings/test-session.json --instrument ./monitor.js
  debug-agent replay ./recordings/test-session.json --speed 1.5 --headless
  debug-agent replay ./recordings/test-session.json --url http://localhost:3000
  `));

// Record command
program
  .command("record <filepath>")
  .description("Start recording a browser session to the specified file path")
  .addHelpText('after', chalk.gray(`
  Details:
    - filepath: Path where the recording JSON file will be saved (e.g., ./recording.json)
    - Creates parent directories if they don't exist
    - Overwrites existing file if it exists
    - Browser opens automatically when recording starts
    - Recording stops when browser is closed or Ctrl+C is pressed
  `))
  .action(async (filepath) => {
    // Validate and prepare filepath
    const absolutePath = path.resolve(filepath);
    const dir = path.dirname(absolutePath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Ensure .json extension
    const finalPath = absolutePath.endsWith('.json') ? absolutePath : `${absolutePath}.json`;
    
    const recorder = new BrowserRecorder(dir);
    
    console.log(chalk.blue.bold("🎥 Starting browser recording..."));
    console.log(chalk.gray(`Recording will be saved to: ${finalPath}`));
    console.log(chalk.gray("Close the browser or press Ctrl+C to stop recording\n"));

    const result = await recorder.startRecording();
    
    if (result.success) {
      // Create a promise that will resolve when browser is closed
      const browserClosedPromise = new Promise<void>((resolve) => {
        recorder.onBrowserClosed(() => {
          resolve();
        });
      });

      // Handle Ctrl+C gracefully
      const sigintHandler = async () => {
        console.log(chalk.yellow("\n\nStopping recording..."));
        
        const name = path.basename(finalPath, '.json');
        const savedPath = await recorder.stopRecording(name);
        
        // Check if recording was actually saved (returns empty string if not recording)
        if (!savedPath) {
          console.log(chalk.yellow("No active recording to save."));
          process.exit(0);
        }
        
        // Move file to the requested location if different
        if (savedPath !== finalPath) {
          await fs.rename(savedPath, finalPath);
        }
        
        console.log(chalk.green(`✅ Recording saved: ${finalPath}`));
        process.exit(0);
      };
      
      process.on("SIGINT", sigintHandler);

      // Wait for browser to be closed
      await browserClosedPromise;
      
      // If we get here, browser was closed manually
      console.log(chalk.yellow("\n\nBrowser was closed. Saving recording..."));
      
      const name = path.basename(finalPath, '.json');
      const savedPath = await recorder.stopRecording(name);
      
      // Check if recording was actually saved (returns empty string if not recording)
      if (!savedPath) {
        console.log(chalk.yellow("No active recording to save."));
        process.exit(0);
      }
      
      // Move file to the requested location if different
      if (savedPath !== finalPath) {
        await fs.rename(savedPath, finalPath);
      }
      
      console.log(chalk.green(`✅ Recording saved: ${finalPath}`));
      process.exit(0);
    } else {
      console.error(chalk.red("Failed to start recording"));
      process.exit(1);
    }
  });

// Inspect command
program
  .command("inspect <filepath>")
  .description("Inspect a recording file to understand its structure and events")
  .option("--events", "List all event types and counts")
  .option("--schema", "Output the full event schema for instrumentation development")
  .option("--sample <n>", "Show sample events of each type (max n per type)", "2")
  .addHelpText('after', chalk.gray(`
  Details:
    - filepath: Path to the recording JSON file to inspect
    - events: Shows summary of all event types in the recording
    - schema: Outputs detailed schema information for writing instrumentation
    - sample: Number of sample events to show per type
    
  This command helps LLMs understand the recording structure to generate appropriate instrumentation.
  
  Example usage:
    debug-agent inspect ./recording.json --events
    debug-agent inspect ./recording.json --schema --sample 3
  `))
  .action(async (filepath, options) => {
    const absolutePath = path.resolve(filepath);
    
    try {
      await fs.access(absolutePath);
    } catch {
      console.error(chalk.red(`Error: Recording file not found: ${absolutePath}`));
      process.exit(1);
    }

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const recording = JSON.parse(content);
      
      console.log(chalk.blue.bold("\n📊 Recording Analysis\n"));
      
      // Basic info
      console.log(chalk.cyan("Recording Info:"));
      console.log(`  Duration: ${recording.metadata?.duration ? (recording.metadata.duration / 1000).toFixed(2) + 's' : 'unknown'}`);
      console.log(`  Total Events: ${recording.events?.length || 0}`);
      console.log(`  Browser: ${recording.metadata?.browser || 'unknown'}`);
      console.log(`  Recorded At: ${recording.metadata?.recordedAt || 'unknown'}`);
      
      if (recording.events && recording.events.length > 0) {
        // Event type analysis
        const eventTypes: Record<string, any[]> = {};
        recording.events.forEach((event: any) => {
          if (!eventTypes[event.type]) {
            eventTypes[event.type] = [];
          }
          eventTypes[event.type].push(event);
        });
        
        console.log(chalk.cyan("\nEvent Types:"));
        Object.entries(eventTypes).forEach(([type, events]) => {
          console.log(`  ${type}: ${events.length} events`);
        });
        
        // Show sample events if requested
        if (options.sample) {
          const sampleCount = parseInt(options.sample) || 2;
          console.log(chalk.cyan("\nSample Events:"));
          
          Object.entries(eventTypes).forEach(([type, events]) => {
            console.log(chalk.yellow(`\n  ${type} events (showing up to ${sampleCount}):`));
            events.slice(0, sampleCount).forEach((event, index) => {
              console.log(`    Sample ${index + 1}:`);
              console.log(JSON.stringify(event, null, 4).split('\n').map(line => '      ' + line).join('\n'));
            });
          });
        }
        
        // Output schema if requested
        if (options.schema) {
          console.log(chalk.cyan("\nEvent Schema for Instrumentation:"));
          console.log(chalk.gray(`
The recording contains events with the following structure:

interface Event {
  type: string;          // Event type (e.g., 'click', 'navigation', 'input')
  timestamp: number;     // Unix timestamp of the event
  pageId?: string;       // ID of the page where event occurred
  pageUrl?: string;      // URL of the page
  data?: any;           // Event-specific data
  viewport?: {          // Viewport dimensions
    width: number;
    height: number;
  };
}

Common event types and their data structures:

1. NAVIGATION:
   data: { url: string, navigationType?: string, previousUrl?: string }

2. CLICK:
   data: { x: number, y: number, button: number, target: {...} }

3. INPUT:
   data: { value: string, type: string, name?: string, id?: string }

4. KEYDOWN:
   data: { key: string, code: string, ctrlKey: boolean, shiftKey: boolean, ... }

5. SCROLL:
   data: { x: number, y: number, width: number, height: number }

6. NEWTAB/CLOSETAB:
   data: { pageId: string, url?: string }

INSTRUMENTATION CONTEXT:

When writing instrumentation, you have access to:

1. The Playwright Page object with full API:
   - page.screenshot()
   - page.evaluate()
   - page.content()
   - page.title()
   - page.url()
   - page.waitForSelector()
   - etc.

2. Event information:
   - event: The current event being replayed
   - eventIndex: The index of the current event

3. Hooks you can implement:
   - setup({ page }): Initialize your instrumentation
   - onBeforeEvent(event, { page, eventIndex }): Before each event
   - onAfterEvent(event, { page, eventIndex }): After each event
   - onComplete({ page }): Cleanup and return results

Example instrumentation template:

module.exports = (page) => ({
  setup: async ({ page }) => {
    // Initialize tracking
    console.log('Starting instrumentation...');
  },
  
  onBeforeEvent: async (event, { page, eventIndex }) => {
    // Pre-event logic
    if (event.type === 'navigation') {
      console.log(\`Navigating to: \${event.data.url}\`);
    }
  },
  
  onAfterEvent: async (event, { page, eventIndex }) => {
    // Post-event logic
    if (event.type === 'click') {
      // Take screenshot after clicks
      await page.screenshot({ path: \`click-\${eventIndex}.png\` });
    }
  },
  
  onComplete: async ({ page }) => {
    // Return analysis results
    return {
      finalUrl: page.url(),
      title: await page.title()
    };
  }
});
          `));
          
          // Show detected event types for this specific recording
          console.log(chalk.cyan("\nDetected Event Types in This Recording:"));
          Object.keys(eventTypes).forEach(type => {
            console.log(`  - ${type}`);
          });
        }
      } else {
        console.log(chalk.yellow("\nNo events found in recording"));
      }
      
    } catch (error) {
      console.error(chalk.red(`Error reading recording: ${error}`));
      process.exit(1);
    }
  });

// Replay command
program
  .command("replay <filepath>")
  .description("Replay a recorded browser session from the specified file")
  .option("-s, --speed <speed>", "Playback speed multiplier (0.5 to 3, default: 1)", "1")
  .option("--headless", "Run browser in headless mode (no visible window)")
  .option("--devtools", "Open Chrome DevTools automatically during replay")
  .option("-i, --instrument <filepath>", "Path to JavaScript instrumentation file with Playwright hooks")
  .option("--url <url>", "Override the base URL for all navigation events during replay")
  .addHelpText('after', chalk.gray(`
  Details:
    - filepath: Path to the recording JSON file to replay
    - speed: Controls playback speed (0.5 = slower, 2 = faster, max: 3)
    - headless: Runs without showing browser window (useful for automated testing)
    - devtools: Opens Chrome DevTools automatically during replay (useful for debugging)
    - instrument: Path to a JS file that exports instrumentation hooks
    - url: Override base URL for navigation events (e.g., replay on staging instead of production)
    
  Speed examples:
    - 0.5: Half speed (useful for debugging)
    - 1.0: Normal speed (default)
    - 2.0: Double speed
    - 3.0: Triple speed (maximum)
    
  URL Override examples:
    - Original: https://production.example.com/login
    - With --url https://staging.example.com: https://staging.example.com/login
    - With --url http://localhost:3000: http://localhost:3000/login
    
  Instrumentation:
    The instrumentation file should export a function or object with these optional hooks:
    - setup({ page }): Called once when replay starts
    - onBeforeEvent(event, { page, eventIndex }): Called before each event
    - onAfterEvent(event, { page, eventIndex }): Called after each event  
    - onComplete({ page }): Called when replay completes, return value is printed
    
  Example instrumentation file:
    module.exports = (page) => ({
      setup: async ({ page }) => {
        console.log('Replay starting...');
      },
      onAfterEvent: async (event, { page, eventIndex }) => {
        if (event.type === 'click') {
          await page.screenshot({ path: \`click-\${eventIndex}.png\` });
        }
      },
      onComplete: async ({ page }) => {
        const title = await page.title();
        return { finalTitle: title };
      }
    });
  `))
  .action(async (filepath, options) => {
    const speed = parseFloat(options.speed);
    if (isNaN(speed) || speed < 0.5 || speed > 3) {
      console.error(chalk.red("Error: Speed must be between 0.5 and 3"));
      process.exit(1);
    }

    // Check if recording file exists
    const absolutePath = path.resolve(filepath);
    try {
      await fs.access(absolutePath);
    } catch {
      console.error(chalk.red(`Error: Recording file not found: ${absolutePath}`));
      process.exit(1);
    }

    // Load instrumentation file if provided
    let instrumentationCode: string | undefined;
    if (options.instrument) {
      const instrumentPath = path.resolve(options.instrument);
      try {
        await fs.access(instrumentPath);
        instrumentationCode = await fs.readFile(instrumentPath, 'utf-8');
        console.log(chalk.cyan(`📝 Loaded instrumentation from: ${instrumentPath}`));
      } catch (error) {
        console.error(chalk.red(`Error: Could not load instrumentation file: ${instrumentPath}`));
        console.error(chalk.red(`  ${error}`));
        process.exit(1);
      }
    }

    const spinner = ora(`Loading recording from ${filepath}...`).start();

    try {
      const replay = new Replay({
        speed,
        headless: options.headless || false,
        devtools: !options.headless,
        urlOverride: options.url,
      });

      // Set instrumentation code if provided
      if (instrumentationCode) {
        replay.setInstrumentationCode(instrumentationCode);
      }

      spinner.text = `Replaying at ${speed}x speed...`;
      
      // Run the replay
      const result = await replay.run(absolutePath, speed);
      
      spinner.succeed(chalk.green("✅ Replay completed successfully"));
      
      // Print final results if instrumentation returned something
      if (result.finalResults !== undefined) {
        console.log(chalk.blue("\n📊 Instrumentation Results:"));
        console.log(JSON.stringify(result.finalResults, null, 2));
      }
      
      process.exit(0);
    } catch (error) {
      spinner.fail(chalk.red(`❌ Replay failed: ${error}`));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}