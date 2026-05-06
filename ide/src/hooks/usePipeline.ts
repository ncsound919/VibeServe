import { useEffect } from 'react';
import { useAIStore } from '../stores/useAIStore';
import { useToastStore } from '../stores/useToastStore';

const PIPELINE_STEP_IDS = ['architect', 'code', 'review', 'verify', 'iterate', 'test', 'deploy'];

export function usePipeline() {
  const { updatePipelineStep, setPipelineRunning, setTrustReport } = useAIStore();
  const { addToast } = useToastStore();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = window.location.port || '5173';
        ws = new WebSocket(`${protocol}//localhost:${port}/ws/pipeline`);

        ws.onopen = () => {
          console.log('[Pipeline] WebSocket connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'step_update':
                updatePipelineStep(data.stepId, {
                  status: data.status,
                  detail: data.detail,
                });
                break;

              case 'pipeline_start':
                setPipelineRunning(true);
                addToast({ type: 'info', message: 'Pipeline started' });
                break;

              case 'pipeline_complete':
                setPipelineRunning(false);
                addToast({ type: 'success', message: 'Pipeline completed' });
                break;

              case 'pipeline_error':
                setPipelineRunning(false);
                if (data.stepId) {
                  updatePipelineStep(data.stepId, { status: 'error', detail: data.error });
                }
                addToast({ type: 'error', message: `Pipeline error: ${data.error || 'Unknown error'}` });
                break;

              case 'trust_report':
                setTrustReport(data.report);
                addToast({ type: 'success', message: 'Trust report available' });
                break;

              case 'file_created':
                addToast({ type: 'info', message: `Generated: ${data.path}` });
                break;

              default:
                console.log('[Pipeline] Unknown message type:', data.type);
            }
          } catch (err) {
            console.warn('[Pipeline] Failed to parse message:', err);
          }
        };

        ws.onclose = () => {
          console.log('[Pipeline] WebSocket disconnected, reconnecting in 5s...');
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          // Silently handle — reconnect will try again
        };
      } catch {
        // WebSocket not supported or server not running
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [updatePipelineStep, setPipelineRunning, setTrustReport, addToast]);

  return null;
}
