// Quick WebSocket monitor — watches pipeline progress
import WebSocket from 'ws';
import http from 'http';

const WS_URL = 'ws://localhost:3002/ws';
const PIPE_URL = 'http://localhost:3002/api/pipeline/run';

console.log('╔══════════════════════════════════════════════╗');
console.log('║     NEXUS ALPHA - FULL PIPELINE LEGEND     ║');
console.log('╠══════════════════════════════════════════════╣');
console.log('║  1  Environment Setup                      ║');
console.log('║  2  Dependency Resolution                  ║');
console.log('║  3  RAG Context Sync                       ║');
console.log('║  4  MCP Context Resolution                 ║');
console.log('║  5  Static Analysis                        ║');
console.log('║  6  Build & Compile                        ║');
console.log('║  7  Security Audit                         ║');
console.log('║  8  E2E Testing                            ║');
console.log('║  9  Optimization                           ║');
console.log('║ 10  Finalizing                             ║');
console.log('╚══════════════════════════════════════════════╝\n');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('[WS] Connected. Triggering pipeline...\n');

  const body = JSON.stringify({
    repos: ['facebook/react', 'n8n-io/n8n', 'langchain-ai/langchain'],
    agentId: 'nexus-prime-' + Date.now(),
  });

  const req = http.request(PIPE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });
  req.write(body);
  req.end();
});

const shownPhases = new Set();
let phaseNum = 0;
let currentPhase = null;
let lastLogCount = 0;

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type !== 'pipeline:update') return;

  const exec = msg.execution;
  if (!exec) return;

  // Find the currently running phase
  let activeStep = null;
  for (const step of exec.steps) {
    if (step.status === 'running') { activeStep = step; break; }
  }

  // New phase started
  if (activeStep && activeStep.phase !== currentPhase) {
    currentPhase = activeStep.phase;
    phaseNum++;
    console.log(`\n── Phase ${phaseNum} ── ${activeStep.phase} ──`);
  }

  // Print new logs since last message
  if (exec.logs.length > lastLogCount) {
    const newLogs = exec.logs.slice(lastLogCount);
    for (const log of newLogs) {
      if (log.startsWith('[BRAIN]') || log.startsWith('[MCP]') || log.startsWith('[BROWSER]') || log.startsWith('[RAG]') || log.startsWith('[FATAL]')) {
        console.log(`  \x1b[1m${log}\x1b[0m`);
      } else {
        console.log(`  ${log}`);
      }
    }
    lastLogCount = exec.logs.length;
  }

  // Phase completed
  if (activeStep && !shownPhases.has(activeStep.phase) && activeStep.status === 'running') {
    // Wait for completion
  }
  for (const step of exec.steps) {
    if (step.status === 'completed' && !shownPhases.has(step.phase)) {
      shownPhases.add(step.phase);
      console.log(`  \x1b[32m[✓] ${step.phase} COMPLETE\x1b[0m`);
    }
  }

  // Check final status
  if (exec.status === 'success' || exec.status === 'failed') {
    const statusColor = exec.status === 'success' ? '\x1b[32m' : '\x1b[31m';
    console.log(`\n${statusColor}╔══════════════════════════════════════════════╗`);
    console.log(`║  PIPELINE ${exec.status.toUpperCase().padEnd(31)}║`);
    console.log(`║  Progress: ${Math.round(exec.progress)}%. Phases: ${shownPhases.size}/10. Logs: ${exec.logs.length}║`);
    console.log(`╚══════════════════════════════════════════════╝\x1b[0m`);

    if (exec.e2eResults && exec.e2eResults.length > 0) {
      console.log(`\n\x1b[1m  E2E Test Results:\x1b[0m`);
      for (const r of exec.e2eResults) {
        const icon = r.status === 'passed' ? '\x1b[32m✓' : '\x1b[31m✗';
        console.log(`  ${icon}\x1b[0m ${r.testName} (${r.duration}ms) - ${r.logs[0]}`);
      }
    }

    if (exec.rag) {
      console.log(`\n\x1b[1m  RAG Context:\x1b[0m`);
      console.log(`  Indexed docs: ${exec.rag.indexedDocs}`);
      console.log(`  Snippets: ${exec.rag.relevantSnippets.length}`);
      console.log(`  Last sync: ${exec.rag.lastSync}`);
    }

    console.log('');

    if (exec.status === 'failed') {
      const failed = exec.e2eResults?.find(r => r.status === 'failed');
      if (failed) console.log(`\x1b[31m  Pipeline failed at: ${failed.testName}\x1b[0m`);
    }

    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('[WS] Error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log(`\n[WS] Timed out after 90s. Shown phases: ${shownPhases.size}/10`);
  process.exit(1);
}, 90000);
