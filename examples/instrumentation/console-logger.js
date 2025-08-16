/**
 * Example instrumentation: Logs all console messages and errors during replay
 * 
 * Usage: debug-agent replay recording.json --instrument examples/instrumentation/console-logger.js
 */

module.exports = (page) => {
  const consoleLogs = [];
  const errors = [];

  return {
    setup: async ({ page }) => {
      console.log('🔍 Console logging enabled');

      // Listen for console messages
      page.on('console', (msg) => {
        const log = {
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString(),
          location: msg.location()
        };
        consoleLogs.push(log);
        
        // Also print to terminal with color coding
        const prefix = {
          'error': '❌',
          'warning': '⚠️ ',
          'info': 'ℹ️ ',
          'log': '📝',
          'debug': '🔍'
        }[msg.type()] || '📝';
        
        console.log(`  ${prefix} [${msg.type()}] ${msg.text()}`);
      });

      // Listen for page errors
      page.on('pageerror', (error) => {
        const errorInfo = {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        };
        errors.push(errorInfo);
        console.log(`  ❌ Page Error: ${error.message}`);
      });

      // Listen for request failures
      page.on('requestfailed', (request) => {
        const failure = {
          url: request.url(),
          method: request.method(),
          failure: request.failure(),
          timestamp: new Date().toISOString()
        };
        errors.push(failure);
        console.log(`  ❌ Request Failed: ${request.url()}`);
      });
    },

    onBeforeEvent: async (event, { page, eventIndex }) => {
      // Log significant events
      if (['navigation', 'click', 'input', 'submit'].includes(event.type)) {
        console.log(`  → Event #${eventIndex}: ${event.type} ${event.data?.url || event.data?.value || ''}`);
      }
    },

    onComplete: async ({ page }) => {
      // Analyze logs
      const errorCount = consoleLogs.filter(log => log.type === 'error').length;
      const warningCount = consoleLogs.filter(log => log.type === 'warning').length;
      
      return {
        summary: {
          totalLogs: consoleLogs.length,
          errorCount,
          warningCount,
          pageErrors: errors.length,
        },
        consoleLogs,
        errors,
        report: errorCount > 0 ? 
          `⚠️  Found ${errorCount} console errors and ${errors.length} page errors during replay` :
          '✅ No errors detected during replay'
      };
    }
  };
};