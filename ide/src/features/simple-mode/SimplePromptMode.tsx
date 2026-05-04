import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, FileCode, Zap, MessageSquare, Bot, Loader } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestions?: string[];
}

interface SimplePromptModeProps {
  onExecuteCode?: (code: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'Create a button component', icon: '🎨' },
  { label: 'Fix this error', icon: '🐛' },
  { label: 'Add user authentication', icon: '🔐' },
  { label: 'Create API endpoint', icon: '📡' },
  { name: 'Write tests', icon: '🧪' },
  { label: 'Optimize this code', icon: '⚡' },
  { label: 'Add documentation', icon: '📝' },
];

const TASK_TEMPLATES = [
  { category: 'Frontend', tasks: ['Create a button', 'Build a form', 'Add a modal', 'Style a component'] },
  { category: 'Backend', tasks: ['Create API route', 'Add database query', 'Set up auth', 'Write middleware'] },
  { category: 'Debug', tasks: ['Fix bug', 'Explain error', 'Review code', 'Find performance issue'] },
  { category: 'Automation', tasks: ['Write tests', 'Generate docs', 'Refactor code', 'Add comments'] },
];

export function SimplePromptMode({ onExecuteCode }: SimplePromptModeProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm Nexus AI. Describe what you want to build, and I'll help you create it. Try using one of the suggestions below or describe your idea in plain language.",
      timestamp: Date.now(),
      suggestions: QUICK_ACTIONS.slice(0, 4).map(a => a.label),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `I'll help you with "${input}". Let me analyze your request and create a plan.\n\n**What I'll do:**\n1. Understand your requirements\n2. Generate the necessary code\n3. Show you the changes before applying\n\nWould you like me to proceed?`,
        timestamp: Date.now(),
        suggestions: ['Yes, proceed', 'Show me the code first', 'Do something else'],
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsProcessing(false);
    }, 1500);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-gray-800">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-white">Simple Mode</span>
        <span className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded">
          For everyone
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-2' : 'order-1'}`}>
              <div className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-emerald-900' : 'bg-purple-900'
                }`}>
                  {msg.role === 'user' ? (
                    <MessageSquare className="w-3 h-3 text-emerald-300" />
                  ) : (
                    <Bot className="w-3 h-3 text-purple-300" />
                  )}
                </div>
                <div className={`rounded-lg px-3 py-2 ${
                  msg.role === 'user' ? 'bg-emerald-900/30 text-emerald-100' : 'bg-[#252526] text-gray-100'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.suggestions && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestion(s)}
                          className="px-2 py-1 text-xs bg-purple-900/50 text-purple-300 rounded hover:bg-purple-800/50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader className="w-4 h-4 animate-spin" />
            <span className="text-sm">Processing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-gray-800">
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {QUICK_ACTIONS.map((action, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(action.label)}
              className="flex items-center gap-1 px-2 py-1 bg-[#252526] hover:bg-[#2d2d2d] rounded text-xs text-gray-300 whitespace-nowrap"
            >
              <span>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-[#252526] rounded-lg px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Describe what you want to build..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="p-1.5 bg-purple-900 text-purple-300 rounded hover:bg-purple-800 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function useSimpleModeStore() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [mode, setMode] = useState<'simple' | 'advanced'>('advanced');

  const toggleMode = () => {
    setMode(prev => prev === 'simple' ? 'advanced' : 'simple');
    setIsEnabled(prev => !prev);
  };

  return { isEnabled, mode, toggleMode, setMode };
}
