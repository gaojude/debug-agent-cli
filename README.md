# Debug Agent CLI

A command-line tool for recording, replaying, and analyzing browser sessions with AI-powered debugging capabilities.

## Features

- 🎥 **Record Browser Sessions**: Capture all user interactions including clicks, inputs, navigation, and more
- ▶️ **Replay Recordings**: Replay recorded sessions at different speeds with visual feedback
- 🔍 **AI-Powered Analysis**: Analyze recordings with natural language questions to understand user behavior
- 💬 **Interactive Chat**: Chat interface for exploring recordings and debugging issues
- 📊 **Session Management**: List, delete, and manage recorded sessions

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### Interactive Mode

Simply run the command without arguments to enter interactive mode:

```bash
pnpm start
```

### Record a Browser Session

```bash
pnpm start record --name my-session
```

This will:
1. Open a Chromium browser window
2. Track all interactions (clicks, inputs, navigation, etc.)
3. Save the recording when you press Ctrl+C

### Replay a Recording

```bash
pnpm start replay my-session --speed 2
```

Options:
- `--speed <speed>`: Playback speed (0.5 to 3, default: 1)
- `--headless`: Run in headless mode
- `--url <url>`: Override base URL for navigation events (useful for testing recordings against different environments)

Example with URL override:
```bash
# Original recording was made on https://production.example.com
# Replay it against staging environment
pnpm start replay my-session --url https://staging.example.com

# Or replay against local development server
pnpm start replay my-session --url http://localhost:3000
```

### List Recordings

```bash
pnpm start list
```

### Analyze a Recording

Ask questions about what happened during a recorded session:

```bash
pnpm start analyze my-session "How many times did the user click?"
```

Example questions:
- "How many clicks were made?"
- "What API calls were made?"
- "Did any errors occur?"
- "What forms were submitted?"
- "How many page navigations happened?"

### Chat Interface

Start an interactive chat to explore recordings:

```bash
pnpm start chat --recording my-session
```

Chat commands:
- `/record` - Start a new recording
- `/stop` - Stop current recording
- `/replay [name]` - Replay a recording
- `/list` - List all recordings
- `/analyze [name] "question"` - Analyze a recording
- `/delete [name]` - Delete a recording
- `/use [name]` - Set current recording for analysis

### Delete a Recording

```bash
pnpm start delete my-session
```

## Environment Variables

Set these in your `.env` file:

```bash
# AI Model configuration (optional)
AI_MODEL=gpt-4o  # or claude-3, etc.

# API keys for AI services
OPENAI_API_KEY=your-key-here
# or
ANTHROPIC_API_KEY=your-key-here
```

## How It Works

1. **Recording**: Uses Playwright to capture browser interactions and page events
2. **Storage**: Saves recordings as JSON files with all event data
3. **Replay**: Reconstructs the session by replaying events in sequence
4. **Analysis**: Generates custom instrumentation code to answer specific questions about the recording
5. **AI Integration**: Uses LLMs to understand questions and generate analysis code

## Architecture

- `recorder.ts` - Browser recording functionality
- `replay.ts` - Session replay engine with instrumentation support
- `analyzer.ts` - AI-powered analysis with dynamic instrumentation
- `storage.ts` - Recording file management
- `chat.ts` - Interactive chat interface
- `cli.ts` - Command-line interface

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

# Run built version
pnpm start
```

## Install to Global
This is for debugging only.

```bash
pnpm build
pnpm link --global
```
