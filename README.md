# Debug Agent CLI

A command-line tool for recording and replaying browser sessions designed for LLM agents and browser automation testing.

## Features

- 🎥 **Record Browser Sessions**: Capture all user interactions including clicks, inputs, navigation, and more
- ▶️ **Replay Recordings**: Replay recorded sessions at different speeds with custom instrumentation
- 🔍 **Session Inspection**: Analyze recording structure and events for instrumentation development
- 🛠️ **Custom Instrumentation**: Inject JavaScript during replay for monitoring and testing
- 🌐 **Chrome Extension**: Browser extension for enhanced recording capabilities

## Installation

```bash
pnpm install
pnpm build
```

## Usage

The CLI provides three main commands: `record`, `inspect`, and `replay`.

### Record a Browser Session

```bash
debug-agent record ./recordings/my-session.json
```

This will:
1. Open a Chromium browser window
2. Track all interactions (clicks, inputs, navigation, etc.)
3. Save the recording when you close the browser or press Ctrl+C
4. Create parent directories automatically if they don't exist

### Inspect a Recording

Analyze the structure and events in a recording file:

```bash
# Show basic info and event types
debug-agent inspect ./recordings/my-session.json --events

# Get detailed schema for instrumentation development
debug-agent inspect ./recordings/my-session.json --schema --sample 3
```

Options:
- `--events`: List all event types and counts
- `--schema`: Output detailed event schema for instrumentation development
- `--sample <n>`: Show sample events of each type (default: 2)

### Replay a Recording

```bash
debug-agent replay ./recordings/my-session.json
```

Options:
- `--speed <speed>`: Playback speed (0.5 to 3.0, default: 1.0)
- `--headless`: Run in headless mode
- `--url <url>`: Override base URL for navigation events (useful for testing recordings against different environments)
- `--instrument <file.js>`: Inject custom JavaScript instrumentation during replay

Example with URL override:
```bash
# Original recording was made on https://production.example.com
# Replay it against staging environment
debug-agent replay ./recordings/my-session.json --url https://staging.example.com

# Replay with custom instrumentation
debug-agent replay ./recordings/my-session.json --instrument ./monitor.js
```

### Custom Instrumentation

Create JavaScript files with instrumentation logic to run during replay:

```javascript
// monitor.js - Example instrumentation file
export async function setup(browser, context, page, pageMap) {
  // Full access to Playwright objects
  // Add listeners, inject scripts, monitor everything
  
  context.on('page', (page) => {
    page.on('response', (response) => {
      console.log('API Response:', response.url(), response.status());
    });
  });
}
```

## How It Works

1. **Recording**: Uses Playwright to capture all browser interactions and page events
2. **Storage**: Saves recordings as JSON files with complete event data and metadata
3. **Replay**: Reconstructs sessions by replaying events in sequence with timing
4. **Instrumentation**: Provides full Playwright API access during replay for custom monitoring

## Architecture

- `cli.ts` - Command-line interface with record, inspect, and replay commands
- `recorder.ts` - Browser recording functionality using Playwright
- `replay.ts` - Session replay engine with instrumentation support
- `types.ts` - TypeScript type definitions
- `chrome-extension/` - Browser extension for enhanced recording capabilities

## Development

```bash
# Run in development mode
pnpm dev

# Build the project
pnpm build

# Run built version (after global install)
debug-agent --help
```

## Install to Global

```bash
pnpm build
pnpm link --global
```

After global installation, the `debug-agent` command will be available system-wide.
