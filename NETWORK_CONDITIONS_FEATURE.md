# Network Conditions Recording & Replay

This feature allows you to record Chrome DevTools network state changes during browser sessions and replay them with the same timing during replay.

## How It Works

### During Recording

The recorder automatically:
- Monitors network conditions every second while recording
- Detects when users change network throttling in Chrome DevTools
- Records network state changes with timestamps
- Supports common presets: Fast 3G, Slow 3G, Fast 4G, Offline, No throttling
- Also captures custom network configurations

### During Replay

The replay engine:
- Applies recorded network conditions at the exact timestamps they were changed
- Uses Chrome DevTools Protocol to set network throttling
- Maintains timing synchronization with other user interactions

## Usage Example

### Recording with Network Changes

1. Start recording:
   ```bash
   pnpm start record --name network-test
   ```

2. In the opened browser:
   - Open Chrome DevTools (F12)
   - Go to Network tab
   - Change throttling from "No throttling" to "Fast 3G"
   - Interact with the page (click buttons, navigate, etc.)
   - Change to "Offline" to test offline behavior
   - Change back to "No throttling"

3. Stop recording with Ctrl+C

### Replaying with Network Changes

```bash
pnpm start replay network-test
```

The replay will automatically apply the same network conditions at the same timing as during recording.

## Supported Network Presets

- **No throttling**: Full speed (default)
- **Fast 4G**: 400kb/s down/up, 20ms latency
- **Fast 3G**: 150kb/s down, 75kb/s up, 562.5ms latency  
- **Slow 3G**: 50kb/s down/up, 2000ms latency
- **Offline**: No network access
- **Custom**: Any user-defined network conditions

## Technical Implementation

### New Event Types

- `network_conditions_initial`: Captures initial network state
- `network_conditions_change`: Records network state changes

### Network Conditions Data Structure

```typescript
interface NetworkConditions {
  offline: boolean;
  downloadThroughput: number; // bytes per second
  uploadThroughput: number;   // bytes per second  
  latency: number;            // milliseconds
}
```

### Example Recording Data

```json
{
  "timestamp": 1734635005000,
  "type": "network_conditions_change",
  "data": {
    "presetName": "Fast 3G",
    "conditions": {
      "offline": false,
      "downloadThroughput": 153600,
      "uploadThroughput": 76800,
      "latency": 562.5
    },
    "pageId": "page_123"
  }
}
```

## Use Cases

This feature is particularly useful for:

1. **Performance Testing**: Test how your application behaves under different network conditions
2. **Mobile Testing**: Simulate mobile network speeds on desktop
3. **Offline Behavior**: Test offline functionality and connectivity changes
4. **Progressive Web Apps**: Validate PWA behavior across network conditions
5. **User Experience Testing**: Understand how network affects user interactions

## Example Workflow

Record a complete user journey that tests performance under varying network conditions:

1. Start with fast connection - measure initial load times
2. Switch to 3G - test navigation and form submissions  
3. Go offline - verify offline functionality
4. Return online - test sync and reconnection behavior

The replay will recreate the exact same network environment, allowing consistent performance testing and debugging.