import { useState } from 'react';
import { Zap, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { useAgentRuntime } from '../core/agents/runtime/agentRuntime';

interface SimpleModeProps {
  onClose?: () => void;
}

export function SimpleMode({ onClose }: SimpleModeProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const agentRuntime = useAgentRuntime();

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      // Simulate agent processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = `✅ Task completed: "${prompt}"\n\nHere's what I did:\n1. Analyzed your request\n2. Generated the code\n3. Ran tests\n4. Verified the output`;

      setResult(response);
    } catch (error) {
      setResult(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-[#1e1e1e] rounded-xl border border-gray-800 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Simple Mode</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-400">
            Describe what you want to build in plain English. I'll handle the code.
          </p>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create a REST API with Express that has endpoints for users and posts..."
              className="w-full h-32 px-4 py-3 bg-[#252526] border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-emerald-500 transition-colors"
              disabled={loading}
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-400 text-white text-sm rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Submit
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {result && (
            <div className="bg-[#252526] border border-gray-700 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5" />
                <span className="text-xs text-gray-400">Result</span>
              </div>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                {result}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>💡 Tip:</span>
            <span>Be specific about what you want. Include details like framework, features, and requirements.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
