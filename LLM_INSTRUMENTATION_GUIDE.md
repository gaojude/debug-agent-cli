# LLM Guide for Generating Browser Replay Instrumentation

## Overview
This guide helps LLMs generate appropriate instrumentation code for the debug-agent CLI's replay feature. Instrumentation allows you to hook into browser replay events and interact with the page using Playwright's API.

## Workflow for LLMs

### Step 1: Inspect the Recording
Always start by inspecting the recording to understand its structure:

```bash
debug-agent inspect ./recording.json --schema --sample 3
```

This will show you:
- What event types are present in the recording
- Sample events with their data structure
- The schema for writing instrumentation

### Step 2: Understand the Task
Based on the user's requirements, determine what needs to be monitored or extracted:
- Screenshots at specific points?
- Performance metrics?
- Console logs and errors?
- Network requests?
- Form data?
- Page content extraction?

### Step 3: Generate Instrumentation Code

## Instrumentation Structure

```javascript
module.exports = (page) => ({
  // Called once when replay starts
  setup: async ({ page }) => {
    // Initialize monitoring, set up listeners, create directories
  },
  
  // Called before each event is replayed
  onBeforeEvent: async (event, { page, eventIndex }) => {
    // Pre-event logic, state tracking
  },
  
  // Called after each event is replayed
  onAfterEvent: async (event, { page, eventIndex }) => {
    // Post-event logic, data collection
  },
  
  // Called when replay completes
  onComplete: async ({ page }) => {
    // Cleanup and return analysis results
    return { /* results object */ };
  }
});
```

## Available Event Types and Their Data

### Navigation Events
```javascript
if (event.type === 'navigation') {
  // event.data = { url, navigationType, previousUrl }
  // Good for: tracking page flow, performance metrics
}
```

### User Interaction Events
```javascript
if (event.type === 'click') {
  // event.data = { x, y, button, target: { tag, id, class, text, href } }
  // Good for: screenshots, interaction tracking
}

if (event.type === 'input') {
  // event.data = { value, type, name, id, tag }
  // Good for: form data collection, validation testing
}

if (event.type === 'keydown') {
  // event.data = { key, code, ctrlKey, shiftKey, altKey, metaKey }
  // Good for: keyboard shortcut tracking
}
```

### Page State Events
```javascript
if (event.type === 'scroll') {
  // event.data = { x, y, width, height, viewportWidth, viewportHeight }
  // Good for: scroll behavior analysis
}

if (event.type === 'focus') {
  // event.data = { tag, id, name, type }
  // Good for: form interaction tracking
}

if (event.type === 'submit') {
  // event.data = { action, method, data }
  // Good for: form submission monitoring
}
```

### Tab Management Events
```javascript
if (event.type === 'newtab') {
  // event.data = { pageId, url, index }
  // Good for: multi-tab flow tracking
}

if (event.type === 'closetab') {
  // event.data = { pageId }
  // Good for: session end detection
}
```

## Playwright Page API Access

In instrumentation, you have full access to Playwright's Page API:

### Screenshots
```javascript
await page.screenshot({ path: 'screenshot.png' });
await page.screenshot({ fullPage: true });
```

### Content Extraction
```javascript
const title = await page.title();
const url = page.url();
const html = await page.content();
const text = await page.textContent('selector');
```

### JavaScript Evaluation
```javascript
const result = await page.evaluate(() => {
  return {
    localStorage: { ...localStorage },
    cookies: document.cookie,
    performance: performance.timing
  };
});
```

### Waiting and Assertions
```javascript
await page.waitForSelector('.loaded');
await page.waitForLoadState('networkidle');
const element = await page.$('.selector');
```

### Network Monitoring
```javascript
page.on('request', request => { /* ... */ });
page.on('response', response => { /* ... */ });
page.on('requestfailed', request => { /* ... */ });
```

### Console and Errors
```javascript
page.on('console', msg => { /* ... */ });
page.on('pageerror', error => { /* ... */ });
```

## Common Instrumentation Patterns

### Pattern 1: Screenshot Critical Actions
```javascript
module.exports = (page) => ({
  onAfterEvent: async (event, { page, eventIndex }) => {
    if (['click', 'submit', 'navigation'].includes(event.type)) {
      await page.screenshot({ 
        path: `screenshots/${event.type}-${eventIndex}.png` 
      });
    }
  }
});
```

### Pattern 2: Extract Data After Navigation
```javascript
module.exports = (page) => {
  const pageData = [];
  
  return {
    onAfterEvent: async (event, { page }) => {
      if (event.type === 'navigation') {
        pageData.push({
          url: page.url(),
          title: await page.title(),
          timestamp: Date.now()
        });
      }
    },
    onComplete: async () => ({ pageData })
  };
};
```

### Pattern 3: Monitor Specific Elements
```javascript
module.exports = (page) => ({
  onAfterEvent: async (event, { page }) => {
    if (event.type === 'click' && event.data?.target?.id === 'submit-button') {
      // Check for success message
      const success = await page.$('.success-message');
      if (success) {
        const message = await success.textContent();
        console.log('Success:', message);
      }
    }
  }
});
```

### Pattern 4: Performance Monitoring
```javascript
module.exports = (page) => {
  const metrics = [];
  
  return {
    onAfterEvent: async (event, { page }) => {
      if (event.type === 'navigation') {
        const timing = await page.evaluate(() => performance.timing);
        metrics.push({
          url: event.data.url,
          loadTime: timing.loadEventEnd - timing.navigationStart
        });
      }
    },
    onComplete: async () => ({ performanceMetrics: metrics })
  };
};
```

### Pattern 5: Form Data Collection
```javascript
module.exports = (page) => {
  const formData = {};
  
  return {
    onAfterEvent: async (event, { page }) => {
      if (event.type === 'input') {
        formData[event.data.name || event.data.id] = event.data.value;
      }
      if (event.type === 'submit') {
        console.log('Form submitted with:', formData);
      }
    },
    onComplete: async () => ({ collectedFormData: formData })
  };
};
```

## Tips for LLM Code Generation

1. **Always check event types first**: Use the inspect command to see what events are available
2. **Handle errors gracefully**: Wrap risky operations in try-catch blocks
3. **Use meaningful file names**: When saving screenshots or data, use descriptive names
4. **Return structured data**: From onComplete(), return JSON-serializable objects
5. **Consider performance**: Don't take screenshots on every mousemove event
6. **Create directories**: Use fs.mkdir with recursive:true before saving files
7. **Log progress**: Use console.log to show what's happening during replay

## Example: Complete Instrumentation for Bug Investigation

```javascript
const fs = require('fs').promises;
const path = require('path');

module.exports = (page) => {
  const errors = [];
  const screenshots = [];
  const networkFailures = [];
  let screenshotDir;

  return {
    setup: async ({ page }) => {
      // Create output directory
      screenshotDir = `./debug-${Date.now()}`;
      await fs.mkdir(screenshotDir, { recursive: true });
      
      // Set up error monitoring
      page.on('pageerror', error => {
        errors.push({
          message: error.message,
          stack: error.stack,
          timestamp: Date.now()
        });
      });
      
      page.on('requestfailed', request => {
        networkFailures.push({
          url: request.url(),
          failure: request.failure(),
          timestamp: Date.now()
        });
      });
      
      console.log(`Debug output will be saved to ${screenshotDir}`);
    },
    
    onAfterEvent: async (event, { page, eventIndex }) => {
      // Screenshot after user actions and errors
      if (event.type === 'click' || event.type === 'submit' || errors.length > screenshots.length) {
        const screenshotPath = path.join(screenshotDir, `${eventIndex}-${event.type}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        screenshots.push({
          path: screenshotPath,
          event: event.type,
          timestamp: Date.now()
        });
      }
      
      // Log navigation
      if (event.type === 'navigation') {
        console.log(`Navigated to: ${event.data.url}`);
      }
      
      // Check for error indicators on the page
      if (event.type === 'navigation' || event.type === 'click') {
        const errorElements = await page.$$('.error, .alert-danger, [class*="error"]');
        if (errorElements.length > 0) {
          console.log(`Found ${errorElements.length} error elements on page`);
          const screenshotPath = path.join(screenshotDir, `${eventIndex}-error-found.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }
      }
    },
    
    onComplete: async ({ page }) => {
      // Final page state
      const finalUrl = page.url();
      const finalTitle = await page.title();
      
      // Save debug report
      const report = {
        finalUrl,
        finalTitle,
        errorsFound: errors.length,
        networkFailures: networkFailures.length,
        screenshotsTaken: screenshots.length,
        errors,
        networkFailures,
        screenshots,
        outputDirectory: screenshotDir
      };
      
      await fs.writeFile(
        path.join(screenshotDir, 'debug-report.json'),
        JSON.stringify(report, null, 2)
      );
      
      return report;
    }
  };
};
```

## Running the Instrumentation

After generating the instrumentation code, run it with:

```bash
debug-agent replay ./recording.json --instrument ./instrumentation.js
```

Add `--headless` for faster execution without UI:

```bash
debug-agent replay ./recording.json --instrument ./instrumentation.js --headless
```

The results from `onComplete()` will be printed to the console as JSON.