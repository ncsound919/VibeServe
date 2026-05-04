/**
 * BroadcastService — Centralized event broadcasting for WebSocket clients
 */

type BroadcastMessage = {
  type: string;
  [key: string]: any;
};

type BroadcastHandler = (data: BroadcastMessage) => void;

class BroadcastService {
  private handler: BroadcastHandler | null = null;

  setHandler(handler: BroadcastHandler) {
    this.handler = handler;
  }

  broadcast(data: BroadcastMessage) {
    if (this.handler) {
      this.handler(data);
    }
  }
}

export const broadcastService = new BroadcastService();
