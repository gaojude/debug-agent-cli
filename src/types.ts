export interface InteractionEvent {
  timestamp: number;
  type: string;
  data: any;
  pageId?: string;
  pageUrl?: string;
  viewport?: { width: number; height: number };
}

export interface Recording {
  startTime: number;
  endTime?: number;
  events: InteractionEvent[];
  metadata: {
    browser: string;
    platform: string;
    recordedAt: string;
    duration?: number;
    name?: string;
  };
}

export interface PageInfo {
  id: string;
  url: string;
  title: string;
  index: number;
}

export interface RecordingInfo {
  name: string;
  path: string;
  size?: number;
  modifiedTime?: Date;
  eventCount?: number;
  duration?: number;
}

export interface ReplayOptions {
  speed: number;
  headless: boolean;
  devtools: boolean;
  urlOverride?: string;
}

export interface ReplayContext {
  logs: string[];
  consoleLogs: Array<{
    type: string;
    text: string;
    timestamp: number;
    location?: any;
  }>;
  instrumentationEvents: Array<{ timestamp: number; data: any }>;
  network: {
    requests: Array<{
      url: string;
      method: string;
      headers?: any;
      timestamp: number;
    }>;
    responses: Array<{
      url: string;
      status: number;
      ok: boolean;
      timestamp: number;
    }>;
    failures: Array<{ url: string; errorText?: string; timestamp: number }>;
  };
  finalResults: any;
  meta: { startedAt: number; endedAt: number; durationMs: number };
}

export interface NetworkConditions {
  offline: boolean;
  downloadThroughput: number;
  uploadThroughput: number;
  latency: number;
}

export interface NetworkConditionsPreset {
  name: string;
  conditions: NetworkConditions;
}

export interface DebugAnalysisResult {
  success: boolean;
  answer?: string;
  analysis?: string;
  error?: string;
}