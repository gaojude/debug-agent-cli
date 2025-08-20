// Background script for Debug Agent Network Recorder
let wsConnection = null;
let networkConditions = {
  offline: false,
  downloadThroughput: -1,
  uploadThroughput: -1,
  latency: 0
};

// Network presets matching the CLI
const NETWORK_PRESETS = {
  "No throttling": {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0
  },
  "Offline": {
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0
  },
  "Slow 3G": {
    offline: false,
    downloadThroughput: 50 * 1024, // 400 Kbps
    uploadThroughput: 50 * 1024,
    latency: 400
  },
  "Fast 3G": {
    offline: false,
    downloadThroughput: 188 * 1024, // 1.5 Mbps
    uploadThroughput: 86 * 1024,    // 750 Kbps
    latency: 150
  },
  "Regular 4G": {
    offline: false,
    downloadThroughput: 500 * 1024, // 4 Mbps
    uploadThroughput: 375 * 1024,   // 3 Mbps
    latency: 50
  }
};

// Connect to local WebSocket server (we'll add this to the CLI)
function connectToRecorder() {
  try {
    wsConnection = new WebSocket('ws://localhost:9229/debug-agent');
    
    wsConnection.onopen = () => {
      console.log('Connected to Debug Agent recorder');
      sendNetworkConditions();
    };
    
    wsConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'networkConditionsUpdated') {
        // Just update our internal state, don't apply again
        if (data.preset && NETWORK_PRESETS[data.preset]) {
          networkConditions = NETWORK_PRESETS[data.preset];
        }
        console.log('Network conditions updated by CLI:', data.preset);
      } else if (data.type === 'setNetworkConditions') {
        // Initial sync from CLI - don't apply, just update state
        if (data.preset && NETWORK_PRESETS[data.preset]) {
          networkConditions = NETWORK_PRESETS[data.preset];
        }
        console.log('Initial network conditions from CLI:', data.preset);
      }
    };
    
    wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    wsConnection.onclose = () => {
      console.log('Disconnected from Debug Agent recorder');
      // Retry connection after 2 seconds
      setTimeout(connectToRecorder, 2000);
    };
  } catch (e) {
    console.error('Failed to connect to recorder:', e);
    setTimeout(connectToRecorder, 2000);
  }
}

// Send network conditions to the recorder
function sendNetworkConditions() {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify({
      type: 'networkConditionsChanged',
      conditions: networkConditions,
      preset: detectPreset(networkConditions)
    }));
  }
}

// Detect which preset matches current conditions
function detectPreset(conditions) {
  for (const [name, preset] of Object.entries(NETWORK_PRESETS)) {
    if (
      preset.offline === conditions.offline &&
      preset.downloadThroughput === conditions.downloadThroughput &&
      preset.uploadThroughput === conditions.uploadThroughput &&
      Math.abs(preset.latency - conditions.latency) < 10
    ) {
      return name;
    }
  }
  return 'Custom';
}

// Apply network conditions by sending to CLI via WebSocket
async function applyNetworkConditions(presetOrConditions) {
  let conditions;
  let presetName;
  
  if (typeof presetOrConditions === 'string') {
    presetName = presetOrConditions;
    conditions = NETWORK_PRESETS[presetOrConditions];
    if (!conditions) {
      console.error('Unknown preset:', presetOrConditions);
      return;
    }
  } else {
    conditions = presetOrConditions;
    presetName = detectPreset(conditions);
  }
  
  networkConditions = conditions;
  
  // Send to CLI to apply via CDP
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify({
      type: 'applyNetworkConditions',
      preset: presetName,
      conditions: conditions
    }));
    console.log('Requested network conditions change:', presetName);
  } else {
    console.error('WebSocket not connected, cannot apply network conditions');
  }
}

// Listen for messages from popup or devtools
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getNetworkConditions') {
    sendResponse({
      conditions: networkConditions,
      preset: detectPreset(networkConditions)
    });
  } else if (request.type === 'setNetworkConditions') {
    applyNetworkConditions(request.preset || request.conditions);
    sendResponse({ success: true });
  } else if (request.type === 'getPresets') {
    sendResponse(NETWORK_PRESETS);
  }
  return true;
});


// Start WebSocket connection
connectToRecorder();