/**
 * Example instrumentation: Monitors network requests during replay
 * 
 * Usage: debug-agent replay recording.json --instrument examples/instrumentation/network-monitor.js
 */

module.exports = (page) => {
  const requests = [];
  const responses = [];
  let requestCounter = 0;

  return {
    setup: async ({ page }) => {
      console.log('🌐 Network monitoring enabled');

      // Monitor requests
      page.on('request', (request) => {
        const reqInfo = {
          id: ++requestCounter,
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          timestamp: Date.now(),
          headers: request.headers()
        };
        requests.push(reqInfo);
        
        // Log API calls
        if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
          console.log(`  🌐 API ${request.method()}: ${request.url()}`);
        }
      });

      // Monitor responses
      page.on('response', (response) => {
        const respInfo = {
          requestId: requestCounter,
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: Date.now(),
          headers: response.headers()
        };
        responses.push(respInfo);
        
        // Log errors
        if (response.status() >= 400) {
          console.log(`  ❌ HTTP ${response.status()}: ${response.url()}`);
        }
      });

      // Monitor failed requests
      page.on('requestfailed', (request) => {
        console.log(`  ❌ Request failed: ${request.url()} - ${request.failure()?.errorText}`);
      });
    },

    onAfterEvent: async (event, { page, eventIndex }) => {
      // Log network activity after form submissions
      if (event.type === 'submit') {
        console.log(`  📊 Network activity after form submit: ${requests.length} requests made`);
      }
    },

    onComplete: async ({ page }) => {
      // Analyze network activity
      const apiCalls = requests.filter(r => 
        r.resourceType === 'fetch' || r.resourceType === 'xhr'
      );
      
      const failedResponses = responses.filter(r => r.status >= 400);
      
      const resourceTypes = {};
      requests.forEach(r => {
        resourceTypes[r.resourceType] = (resourceTypes[r.resourceType] || 0) + 1;
      });

      // Calculate response times
      const responseTimes = responses.map(resp => {
        const req = requests.find(r => r.id === resp.requestId);
        return req ? resp.timestamp - req.timestamp : null;
      }).filter(t => t !== null);

      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      return {
        summary: {
          totalRequests: requests.length,
          totalResponses: responses.length,
          apiCallsCount: apiCalls.length,
          failedRequests: failedResponses.length,
          averageResponseTime: Math.round(avgResponseTime) + 'ms',
          resourceTypes
        },
        apiCalls: apiCalls.map(r => ({
          method: r.method,
          url: r.url,
          response: responses.find(resp => resp.requestId === r.id)?.status
        })),
        errors: failedResponses.map(r => ({
          url: r.url,
          status: r.status,
          statusText: r.statusText
        }))
      };
    }
  };
};