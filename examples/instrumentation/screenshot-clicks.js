/**
 * Example instrumentation: Takes screenshots after every click event
 * 
 * Usage: debug-agent replay recording.json --instrument examples/instrumentation/screenshot-clicks.js
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = (page) => ({
  setup: async ({ page }) => {
    // Create screenshots directory
    const dir = './replay-screenshots';
    await fs.mkdir(dir, { recursive: true });
    console.log(`📸 Screenshots will be saved to ${dir}`);
  },

  onAfterEvent: async (event, { page, eventIndex }) => {
    // Take screenshot after click events
    if (event.type === 'click') {
      const filename = `./replay-screenshots/click-${eventIndex}-at-${event.data?.x},${event.data?.y}.png`;
      await page.screenshot({ path: filename });
      console.log(`  📸 Screenshot saved: ${filename}`);
    }
  },

  onComplete: async ({ page }) => {
    // Take final screenshot
    const finalPath = './replay-screenshots/final.png';
    await page.screenshot({ path: finalPath, fullPage: true });
    
    // Get page metrics
    const title = await page.title();
    const url = page.url();
    
    return {
      finalTitle: title,
      finalUrl: url,
      screenshotPath: finalPath,
      message: 'Replay completed with screenshots captured'
    };
  }
});