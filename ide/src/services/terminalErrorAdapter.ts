/**
 * terminalErrorAdapter
 *
 * Thin adapter between xterm.js (or any terminal component) and
 * ErrorContextService. Drop this into whatever file manages your
 * xterm Terminal instance.
 *
 * Example (in your terminal panel component):
 *
 *   import { attachTerminalErrorAdapter } from './terminalErrorAdapter';
 *
 *   useEffect(() => {
 *     const cleanup = attachTerminalErrorAdapter(termRef.current);
 *     return cleanup;
 *   }, [termRef.current]);
 *
 * The adapter is fully passive — it never writes to the terminal,
 * never intercepts input, and has zero effect on rendering.
 */

import { ErrorContextService } from './errorContextService';

/**
 * Attach to an xterm.js Terminal instance.
 * Returns a cleanup function — call it in your useEffect return.
 *
 * @param terminal  The xterm Terminal object (ITerminal or Terminal)
 */
export function attachTerminalErrorAdapter(
  terminal: { onData: (cb: (data: string) => void) => { dispose: () => void } },
): () => void {
  const svc = ErrorContextService.getInstance();
  const { dispose } = terminal.onData((chunk) => svc.ingestChunk(chunk));
  return () => dispose();
}

/**
 * Manual ingestion — call this directly when you receive terminal output
 * as a string (e.g. from a WebSocket or subprocess pipe) without xterm.
 *
 * @param output  Raw terminal output string (ANSI codes are stripped internally)
 */
export function ingestTerminalOutput(output: string): void {
  ErrorContextService.getInstance().ingestChunk(output);
}

/**
 * Wire up a WebSocket that streams terminal output.
 * Returns a cleanup function.
 *
 * @param ws  An open WebSocket instance
 */
export function attachWebSocketErrorAdapter(ws: WebSocket): () => void {
  const svc = ErrorContextService.getInstance();

  function onMessage(event: MessageEvent) {
    const data = typeof event.data === 'string'
      ? event.data
      : new TextDecoder().decode(event.data as ArrayBuffer);
    svc.ingestChunk(data);
  }

  ws.addEventListener('message', onMessage);
  return () => ws.removeEventListener('message', onMessage);
}
