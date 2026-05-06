export interface PipelineEvent {
  phase: string;
  status: 'started' | 'streaming' | 'complete' | 'error';
  data?: any;
}

export type PipelineCallback = (event: PipelineEvent) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private callbacks: Set<PipelineCallback> = new Set();
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private maxReconnectDelay = 30000;
  private destroyed = false;

  constructor(url: string = 'ws://localhost:3002') {
    this.url = url;
  }

  connect() {
    this.destroyed = false;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect() {
    if (this.destroyed) return;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log('Connected to Orchestrator WebSocket');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'PIPELINE_EVENT') {
          this.notifyCallbacks({
            phase: data.phase,
            status: data.status,
            data: data.data
          });
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from Orchestrator WebSocket');
      if (this.destroyed) return;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn(`WebSocket reconnect limit reached (${this.maxReconnectAttempts}). Call connect() to retry.`);
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
      this.reconnectAttempts++;
      this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
    };
  }

  onEvent(callback: PipelineCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(event: PipelineEvent) {
    for (const callback of this.callbacks) {
      callback(event);
    }
  }

  runPipeline(spec: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'RUN_PIPELINE', spec }));
    } else {
      console.error('WebSocket not connected');
    }
  }

  disconnect() {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    this.callbacks.clear();
  }
}

export const wsClient = new WSClient();
