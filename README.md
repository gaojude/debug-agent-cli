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

## Using Debug Agent with Claude Code

Debug Agent is particularly powerful when used with Claude Code for prompt engineering and AI-driven browser automation. Here's how to leverage it effectively:

### Basic Workflow

1. **Record a session** to capture the browser interactions you want to analyze or reproduce
2. **Inspect the recording** to understand the event structure  
3. **Use Claude Code** to generate custom instrumentation based on your analysis needs
4. **Replay with instrumentation** to gather the data or perform automated testing

### Step 1: Recording Sessions

Record any browser workflow you want Claude Code to analyze later:

```bash
# Record a user workflow
pnpm start record ./recordings/user-checkout-flow.json

# Record a bug reproduction
pnpm start record ./recordings/bug-report-123.json
```

The recording captures all user interactions, page navigations, network requests, and browser events.

### Step 2: Analyze Recording Structure

Before asking Claude Code to generate instrumentation, inspect the recording:

```bash
# See what events were captured
pnpm start inspect ./recordings/user-checkout-flow.json --events

# Get detailed schema for instrumentation development  
pnpm start inspect ./recordings/user-checkout-flow.json --schema --sample 3
```

This shows Claude Code exactly what data is available to work with.

### Step 3: Generate Instrumentation with Claude Code

Now you can ask Claude Code to generate custom instrumentation. Here are effective prompts:

**For Performance Analysis:**
```
"Based on this recording schema, generate instrumentation that measures:
- Time to first meaningful paint
- JavaScript execution time during key interactions
- Memory usage throughout the session
- Network request timing and failures"
```

**For Error Detection:**
```
"Generate instrumentation that monitors this replay for:
- JavaScript errors and exceptions
- Failed network requests
- Console warnings and errors  
- Element interaction failures"
```

**For User Behavior Analysis:**
```
"Create instrumentation to analyze:
- Click patterns and heat maps
- Form interaction timing
- Navigation paths and exit points
- Time spent on different page sections"
```

**For Testing and Validation:**
```
"Generate instrumentation that validates:
- All form submissions succeed
- Expected elements are present and clickable
- Page load times are under 3 seconds
- No accessibility violations occur"
```

### Step 4: Run with Claude-Generated Instrumentation

Claude Code will generate a JavaScript file like this:

```javascript
// claude-generated-analysis.js
module.exports = () => ({
  setup: async ({ browser, context, page, pageMap }) => {
    const metrics = {
      errors: [],
      performance: {},
      interactions: []
    };
    
    // Monitor JavaScript errors
    page.on('pageerror', err => {
      metrics.errors.push({
        message: err.message,
        timestamp: Date.now()
      });
    });
    
    // Track performance metrics
    page.on('load', async () => {
      const perf = await page.evaluate(() => {
        return {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
        };
      });
      metrics.performance = perf;
    });
    
    // Return results when done
    return async () => metrics;
  }
});
```

Then run the replay with the instrumentation:

```bash
pnpm start replay ./recordings/user-checkout-flow.json --instrument claude-generated-analysis.js
```

### Advanced Claude Code Prompting Tips

**1. Be Specific About Your Goals**
Instead of "analyze this recording", try:
- "Generate instrumentation to measure checkout funnel conversion rates"
- "Create monitoring that detects when the payment form fails"
- "Build analytics for user interaction patterns during onboarding"

**2. Reference the Schema**
Always run `inspect --schema` first, then reference specific event types:
- "Using the CLICK events in this recording, measure average time between form interactions"
- "Based on the NAVIGATION events, create a user journey map"

**3. Ask for Iterative Analysis**
- "Generate basic error monitoring first, then I'll ask you to extend it"
- "Start with performance metrics, we'll add user behavior tracking next"

**4. Request Different Output Formats**
- "Output results as CSV for spreadsheet analysis"
- "Generate a JSON report compatible with our monitoring dashboard"
- "Create visual HTML reports with charts"

### Example: Complete Workflow

```bash
# 1. Record a user session
pnpm start record ./recordings/login-flow.json

# 2. Analyze the recording structure
pnpm start inspect ./recordings/login-flow.json --schema --sample 2

# 3. Ask Claude Code: "Generate instrumentation to validate this login flow works correctly and measure performance"

# 4. Run replay with Claude's generated instrumentation
pnpm start replay ./recordings/login-flow.json --instrument claude-login-validator.js

# 5. Review the results and iterate with Claude Code for improvements
```

This workflow makes Debug Agent incredibly powerful for AI-driven browser automation and analysis.

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
