// Panel script for network control
let currentPreset = 'No throttling';

// Update UI with current network conditions
function updateStatus() {
  chrome.runtime.sendMessage({ type: 'getNetworkConditions' }, (response) => {
    if (response) {
      currentPreset = response.preset;
      document.getElementById('currentPreset').textContent = currentPreset;
      
      // Update button states
      document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === currentPreset);
      });
      
      // Update custom controls
      const conditions = response.conditions;
      document.getElementById('offline').checked = conditions.offline;
      document.getElementById('download').value = 
        conditions.downloadThroughput === -1 ? -1 : Math.round(conditions.downloadThroughput / 1024);
      document.getElementById('upload').value = 
        conditions.uploadThroughput === -1 ? -1 : Math.round(conditions.uploadThroughput / 1024);
      document.getElementById('latency').value = conditions.latency;
      
      // Update status color
      document.getElementById('status').classList.toggle('offline', conditions.offline);
    }
  });
}

// Handle preset button clicks
document.querySelectorAll('[data-preset]').forEach(button => {
  button.addEventListener('click', () => {
    const preset = button.dataset.preset;
    chrome.runtime.sendMessage({ 
      type: 'setNetworkConditions',
      preset: preset
    }, () => {
      updateStatus();
    });
  });
});

// Handle custom settings
document.getElementById('applyCustom').addEventListener('click', () => {
  const offline = document.getElementById('offline').checked;
  const download = parseInt(document.getElementById('download').value);
  const upload = parseInt(document.getElementById('upload').value);
  const latency = parseInt(document.getElementById('latency').value);
  
  const conditions = {
    offline: offline,
    downloadThroughput: download === -1 ? -1 : download * 1024,
    uploadThroughput: upload === -1 ? -1 : upload * 1024,
    latency: latency || 0
  };
  
  chrome.runtime.sendMessage({ 
    type: 'setNetworkConditions',
    conditions: conditions
  }, () => {
    updateStatus();
  });
});

// Initial status update
updateStatus();

// Update status every second
setInterval(updateStatus, 1000);