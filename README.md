Please join https://discord.gg/hQQkVpgn

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
