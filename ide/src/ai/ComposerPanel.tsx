import { useState, useRef, useEffect, useCallback } from 'react';
import { useAIStore } from '../stores/useAIStore';
import { useIDEStore } from '../stores/useIDEStore';
import { Send, StopCircle, Check, X, FileCode, AtSign, BookOpen, Loader } from 'lucide-react';

interface Mention {
  type: 'file' | 'symbol' | 'docs';
  value: string;
  label: string;
}

export function ComposerPanel() {
  const { messages, addMessage, clearMessages, streamingContent, appendStreamingContent, clearStreamingContent, pendingDiff, setPendingDiff, applyPendingDiff } = useAIStore();
  const { autonomyMode, setAutonomyMode, openFile } = useIDEStore();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Parse @mentions from input
  useEffect(() => {
    const atMatches = input.match(/@(\w+)/g);
    if (atMatches) {
      const parsed = atMatches.map(m => m.slice(1));
      const newMentions: Mention[] = parsed.map(v => ({ type: 'file' as const, value: v, label: v }));
      setMentions(newMentions);
    } else {
      setMentions([]);
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const userMsg = input.trim();
    addMessage({ role: 'user', content: userMsg });
    setInput('');
    clearStreamingContent();
    setIsProcessing(true);

    // Connect to WebSocket for streaming
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/ai`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'prompt', content: userMsg, mode: autonomyMode, context: mentions }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'chunk') {
          appendStreamingContent(msg.content);
        } else if (msg.type === 'done') {
          const fullContent = useAIStore.getState().streamingContent;
          addMessage({ role: 'assistant', content: fullContent });
          clearStreamingContent();
          ws.close();
        } else if (msg.type === 'diff') {
          setPendingDiff({ path: msg.path, content: msg.content });
        }
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    ws.onerror = () => {
      addMessage({ role: 'assistant', content: 'Connection error. Using fallback API.' });
      callFallbackAPI(userMsg);
    };

    ws.onclose = () => {
      setIsProcessing(false);
    };
  };

  const callFallbackAPI = async (msg: string) => {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, mode: autonomyMode }),
      });
      if (res.ok) {
        const data = await res.json();
        addMessage({ role: 'assistant', content: data.response || 'Done.' });
      }
    } catch {
      addMessage({ role: 'assistant', content: 'AI backend unavailable.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStop = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsProcessing(false);
    clearStreamingContent();
  };

  const handleApply = async () => {
    const success = await applyPendingDiff();
    if (success) {
      const diff = useAIStore.getState().pendingDiff;
      if (diff) {
        addMessage({ role: 'assistant', content: `✅ Applied: ${diff.path}` });
        const ext = diff.path.split('.').pop() || 'txt';
        openFile(diff.path, diff.path.split('/').pop() || 'file', ext);
      }
    }
  };

  const handleReject = () => {
    setPendingDiff(null);
    addMessage({ role: 'assistant', content: '❌ Diff rejected.' });
  };

  const insertMention = (mention: Mention) => {
    const atIndex = input.lastIndexOf('@');
    if (atIndex >= 0) {
      setInput(input.slice(0, atIndex) + `@${mention.value} `);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    } else if (showMentions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setMentionIndex(i => (e.key === 'ArrowDown' ? Math.min(i + 1, mentions.length - 1) : Math.max(i - 1, 0)));
    } else if (showMentions && e.key === 'Enter' && mentions[mentionIndex]) {
      e.preventDefault();
      insertMention(mentions[mentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Composer</span>
        <div className="flex gap-2">
          <button onClick={clearMessages} className="text-[11px] px-2 py-0.5 rounded hover:opacity-80" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>Clear</button>
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && streamingContent === '' && (
          <div className="text-xs mt-8 text-center" style={{ color: 'var(--text-muted)' }}>
            <div className="mb-3">Describe what you want to build</div>
            <div className="flex gap-3 justify-center text-[11px]">
              <span className="flex items-center gap-1" style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><AtSign className="w-3 h-3" style={{ color: 'var(--accent)' }} />Files</span>
              <span className="flex items-center gap-1" style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><FileCode className="w-3 h-3" style={{ color: 'var(--accent)' }} />Symbols</span>
              <span className="flex items-center gap-1" style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}><BookOpen className="w-3 h-3" style={{ color: 'var(--accent)' }} />Docs</span>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`text-xs ${m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
            <div className="inline-block max-w-[85%] px-3 py-2 rounded-lg" style={{
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: m.role === 'user' ? 'var(--text-on-accent)' : 'var(--text-primary)',
              borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
            }}>
              <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="text-xs flex justify-start">
            <div className="inline-block max-w-[85%] px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '12px 12px 12px 2px' }}>
              <pre className="whitespace-pre-wrap font-sans">{streamingContent}<span className="animate-pulse">▋</span></pre>
            </div>
          </div>
        )}

        {/* Pending diff apply/reject */}
        {pendingDiff && (
          <div className="flex gap-2 p-2 rounded-lg" style={{ background: 'var(--accent)', opacity: 0.1, border: '1px dashed var(--accent)' }}>
            <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>Pending: {pendingDiff.path}</span>
            <button onClick={handleApply} className="p-1 rounded bg-green-600 text-white" title="Apply"><Check className="w-4 h-4" /></button>
            <button onClick={handleReject} className="p-1 rounded bg-red-600 text-white" title="Reject"><X className="w-4 h-4" /></button>
          </div>
        )}

        {isProcessing && (
          <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Loader className="w-3 h-3 animate-spin" />
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Mentions dropdown */}
      {showMentions && mentions.length > 0 && (
        <div className="mx-3 mb-1 p-2 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {mentions.map((m, i) => (
            <button key={i} onClick={() => insertMention(m)} className={`block w-full text-left px-2 py-1 text-xs rounded ${i === mentionIndex ? 'bg-[var(--accent)]/20' : ''}`} style={{ color: 'var(--text-primary)' }}>
              {m.type === 'file' && <FileCode className="w-3 h-3 inline mr-1" />}
              {m.type === 'symbol' && <AtSign className="w-3 h-3 inline mr-1" />}
              {m.type === 'docs' && <BookOpen className="w-3 h-3 inline mr-1" />}
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowMentions(e.target.value.includes('@')); }}
          onKeyDown={handleKeyDown}
          placeholder="@ file.ts — describe what to build"
          rows={3}
          className="w-full p-2 rounded resize-none text-sm"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', outlineColor: 'var(--accent)', fontFamily: 'var(--font-sans)' }}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>@ files · @ symbols · @ docs</span>
          <div className="flex gap-2">
            {isProcessing && (
              <button onClick={handleStop} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                <StopCircle className="w-3 h-3" />Stop
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--text-on-accent)' }}
            >
              {isProcessing ? <Loader className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {isProcessing ? 'Running' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}