// Create a DevTools panel for network control
chrome.devtools.panels.create(
  "Debug Agent",
  null,
  "panel.html",
  function(panel) {
    // Panel created
  }
);

// Monitor network conditions changes in DevTools
// This allows us to detect when user changes network throttling in Chrome DevTools
chrome.devtools.network.onRequestFinished.addListener((request) => {
  // We can monitor network activity here if needed
});

// Listen for Network domain events via the Chrome DevTools Protocol
chrome.devtools.inspectedWindow.eval(
  "chrome.debugger.getTargets()",
  function(result, isException) {
    if (!isException) {
      // Successfully connected to the inspected window
      monitorNetworkConditions();
    }
  }
);

function monitorNetworkConditions() {
  // Send a message to background script to check network conditions
  setInterval(() => {
    chrome.runtime.sendMessage({ 
      type: 'checkNetworkConditions' 
    });
  }, 1000);
}