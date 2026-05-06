import { useState, useRef, useEffect } from 'react';
import { useAIStore } from '../stores/useAIStore';
import { useIDEStore } from '../stores/useIDEStore';

export function ComposerPanel() {
  const { messages, addMessage, clearMessages } = useAIStore();
  const { autonomyMode, setAutonomyMode } = useIDEStore();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const userMsg = input.trim();
    addMessage({ role: 'user', content: userMsg });
    setInput('');
    setIsProcessing(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, mode: autonomyMode }),
      });
      if (res.ok) {
        const data = await res.json();
        addMessage({ role: 'assistant', content: data.response || 'Working on it...' });
      } else {
        addMessage({ role: 'assistant', content: `Received status ${res.status} from AI backend.` });
      }
    } catch {
      addMessage({ role: 'assistant', content: 'AI backend is not running. Start the orchestrator or connect a model.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Composer</span>
        <div className="flex gap-2">
          <button
            onClick={clearMessages}
            className="text-[11px] px-2 py-0.5 rounded hover:opacity-80"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
          >
            Clear
          </button>
          <button
            onClick={() => setAutonomyMode(autonomyMode === 'pipeline' ? 'copilot' : 'pipeline')}
            className="text-[11px] px-2 py-0.5 rounded font-medium"
            style={{
              background: autonomyMode === 'pipeline' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: autonomyMode === 'pipeline' ? 'var(--text-on-accent)' : 'var(--text-muted)',
            }}
          >
            {autonomyMode === 'pipeline' ? 'Pipeline ✓' : 'Pipeline'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs mt-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <div className="mb-3">Describe what you want to build</div>
            <div className="flex gap-3 justify-center text-[11px]">
              <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                <kbd style={{ color: 'var(--accent)' }}>/</kbd>
                <span style={{ color: 'var(--text-muted)' }}> Commands</span>
              </span>
              <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                <kbd style={{ color: 'var(--accent)' }}>@</kbd>
                <span style={{ color: 'var(--text-muted)' }}> Files</span>
              </span>
              <span style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>
                <kbd style={{ color: 'var(--accent)' }}>!</kbd>
                <span style={{ color: 'var(--text-muted)' }}> Shell</span>
              </span>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`text-xs ${m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
            <div
              className="inline-block max-w-[85%] px-3 py-2 rounded-lg"
              style={{
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: m.role === 'user' ? 'var(--text-on-accent)' : 'var(--text-primary)',
                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                wordBreak: 'break-word',
              }}
            >
              <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/ architect   @ file.ts   ! npm run build"
          rows={3}
          className="w-full p-2 rounded resize-none text-sm"
          style={{
            background: 'var(--bg-surface)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', outlineColor: 'var(--accent)',
            fontFamily: 'var(--font-sans)',
          }}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            / commands · @ files · ! shell
          </span>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="px-3 py-1 rounded text-xs font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
          >
            {isProcessing ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
