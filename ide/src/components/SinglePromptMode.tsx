import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Zap, Send, Sparkles, FileCode, Wand2, MessageSquare,
  Briefcase, Layout, Database, Terminal
} from 'lucide-react';

interface PromptPreset {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

const presets: PromptPreset[] = [
  { id: 'fix-bug', label: 'Fix Bug', icon: '🐛', prompt: 'Find and fix the bug in my code. Analyze the issue and provide a corrected implementation.' },
  { id: 'refactor', label: 'Refactor', icon: '🔄', prompt: 'Refactor this code for better readability, performance, and maintainability.' },
  { id: 'write-test', label: 'Write Tests', icon: '🧪', prompt: 'Write comprehensive unit tests for the provided code.' },
  { id: 'explain', label: 'Explain', icon: '💡', prompt: 'Explain what this code does in simple terms.' },
  { id: 'add-feature', label: 'Add Feature', icon: '✨', prompt: 'Implement a new feature based on the requirements.' },
  { id: 'review', label: 'Review', icon: '👀', prompt: 'Review this code and provide feedback on quality, security, and best practices.' },
];

export function SinglePromptMode() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const handlePresetClick = (preset: PromptPreset) => {
    setSelectedPreset(preset.id);
    setInput(preset.prompt);
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsProcessing(false);
  };

  const quickActions = [
    { icon: FileCode, label: 'Write Code', color: 'text-blue-400' },
    { icon: Layout, label: 'Design UI', color: 'text-purple-400' },
    { icon: Database, label: 'Query Data', color: 'text-emerald-400' },
    { icon: Terminal, label: 'Run Command', color: 'text-amber-400' },
    { icon: Wand2, label: 'Generate', color: 'text-pink-400' },
    { icon: Briefcase, label: 'Business Logic', color: 'text-cyan-400' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/20 rounded-2xl mb-4">
          <Zap className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Quick Action Mode</h2>
        <p className="text-gray-400 mt-2">Describe what you need in plain language</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-3">
        {presets.map((preset, index) => (
          <motion.button
            key={preset.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handlePresetClick(preset)}
            className={`p-3 rounded-xl border transition-all ${
              selectedPreset === preset.id
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <div className="text-2xl mb-1">{preset.icon}</div>
            <div className="text-sm font-medium">{preset.label}</div>
          </motion.button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[#111113] border border-gray-800 rounded-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400">Describe your task</span>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g., Create a login form with email and password fields..."
          className="w-full h-32 p-4 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 bg-[#0f0f11]">
          <div className="flex items-center gap-2">
            {quickActions.map((action, i) => (
              <button
                key={i}
                className={`p-2 rounded-lg hover:bg-gray-800 transition-colors ${action.color}`}
                title={action.label}
              >
                <action.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isProcessing ? (
              <Sparkles className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isProcessing ? 'Processing...' : 'Generate'}
          </button>
        </div>
      </motion.div>

      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 bg-gray-900/50 rounded-xl border border-gray-800"
        >
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span className="text-sm text-white">Generating solution...</span>
          </div>
          <div className="space-y-2">
            {['Analyzing requirements', 'Writing code', 'Running tests', 'Reviewing output'].map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.5 }}
                className="flex items-center gap-2 text-sm text-gray-400"
              >
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                {step}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
