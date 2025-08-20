// Popup script for quick network control

// Update status
function updateStatus() {
  chrome.runtime.sendMessage({ type: 'getNetworkConditions' }, (response) => {
    if (response) {
      document.getElementById('currentPreset').textContent = response.preset;
      
      // Update button states
      document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === response.preset);
      });
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

// Open DevTools panel
document.getElementById('openDevTools').addEventListener('click', () => {
  // Tell user to open DevTools
  alert('Please open Chrome DevTools (F12) and navigate to the "Debug Agent" panel for more options.');
  window.close();
});

// Initial update
updateStatus();