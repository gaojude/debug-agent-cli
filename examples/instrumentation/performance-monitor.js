/**
 * Example instrumentation: Monitors page performance metrics during replay
 * 
 * Usage: debug-agent replay recording.json --instrument examples/instrumentation/performance-monitor.js
 */

module.exports = (page) => {
  const metrics = [];
  let startTime;

  return {
    setup: async ({ page }) => {
      startTime = Date.now();
      console.log('⏱️  Performance monitoring started');
      
      // Enable performance metrics collection
      const client = await page.context().newCDPSession(page);
      await client.send('Performance.enable');
    },

    onAfterEvent: async (event, { page, eventIndex }) => {
      // Collect metrics after navigation events
      if (event.type === 'navigation' || event.type === 'spa_navigation') {
        try {
          const performanceMetrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            return {
              domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
              loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
              firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
              firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
            };
          });

          metrics.push({
            eventIndex,
            eventType: event.type,
            url: event.data?.url,
            timestamp: Date.now() - startTime,
            metrics: performanceMetrics
          });

          console.log(`  ⏱️  Metrics collected for ${event.data?.url}`);
        } catch (e) {
          // Page might not be ready for metrics collection
        }
      }
    },

    onComplete: async ({ page }) => {
      const endTime = Date.now();
      
      // Collect final metrics
      const finalMetrics = await page.evaluate(() => {
        return {
          totalJSHeapSize: performance.memory?.totalJSHeapSize,
          usedJSHeapSize: performance.memory?.usedJSHeapSize,
          resourceCount: performance.getEntriesByType('resource').length,
        };
      });

      return {
        duration: endTime - startTime,
        navigationMetrics: metrics,
        finalMetrics,
        summary: {
          totalNavigations: metrics.length,
          averageLoadTime: metrics.reduce((acc, m) => acc + (m.metrics?.loadComplete || 0), 0) / metrics.length,
        }
      };
    }
  };
};