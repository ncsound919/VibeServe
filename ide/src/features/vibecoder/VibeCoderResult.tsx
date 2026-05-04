import { motion } from 'motion/react';
import { CheckCircle, XCircle, Copy, Clock, FolderOpen, Rocket, Package, Globe, ArrowDown } from 'lucide-react';
import { useState } from 'react';

interface VibeCoderResultProps {
  success: boolean;
  appPath: string;
  summary: string;
  duration: number;
  buildResult?: Record<string, unknown>;
}

type DeployStatus = 'idle' | 'deploying' | 'done' | 'error';

export const VibeCoderResult = ({ success, appPath, summary, duration }: VibeCoderResultProps) => {
  const [copied, setCopied] = useState(false);
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
  const [deployTarget, setDeployTarget] = useState('');
  const [deployMessage, setDeployMessage] = useState('');

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDeploy = async (target: string) => {
    setDeployStatus('deploying');
    setDeployTarget(target);

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appDir: appPath, target, appName: appPath.split('/').pop() || 'app' }),
      });
      const data = await res.json();
      if (data.success || data.configPath) {
        setDeployStatus('done');
        setDeployMessage(data.logs?.slice(-1)[0] || `Config generated for ${target}`);
      } else {
        setDeployStatus('done');
        setDeployMessage(data.logs?.slice(-1)[0] || 'Config files generated. Run manually to deploy.');
      }
    } catch (err) {
      setDeployStatus('error');
      setDeployMessage(err instanceof Error ? err.message : 'Deploy failed');
    }

    setTimeout(() => {
      setDeployStatus('idle');
      setDeployMessage('');
    }, 5000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto bg-[#151619] border border-[#2d2e32] rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        {success ? (
          <CheckCircle size={24} className="text-emerald-500" />
        ) : (
          <XCircle size={24} className="text-amber-500" />
        )}
        <h3 className="text-lg font-bold text-white font-mono">
          {success ? 'Your app is ready!' : 'Build had issues'}
        </h3>
      </div>

      {summary && (
        <p className="text-xs font-mono text-[#9CA3AF] mb-4 leading-relaxed">{summary}</p>
      )}

      <div className="space-y-3">
        <div className="bg-[#0a0a0c] border border-[#1a1b1e] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#6B7280] font-mono uppercase tracking-widest">App Location</span>
            <button
              aria-label="Copy app path"
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors"
            >
              <Copy size={10} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs font-mono text-emerald-400 mt-1 break-all">{appPath}</p>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7280]">
          <Clock size={12} aria-hidden="true" />
          <span>Generated in {formatDuration(duration)}</span>
        </div>

        {deployStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3"
          >
            <p className="text-[10px] font-mono text-emerald-400">
              {deployStatus === 'deploying'
                ? `Deploying to ${deployTarget}...`
                : `[${deployTarget.toUpperCase()}] ${deployMessage}`}
            </p>
          </motion.div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-[#1a1b1e]">
        <p className="text-[10px] text-[#6B7280] font-mono uppercase tracking-widest mb-3">Deploy</p>
        <div className="flex flex-wrap gap-2">
          <button
            aria-label="Deploy to Docker"
            onClick={() => handleDeploy('docker')}
            className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0c] border border-[#2d2e32] rounded-lg text-xs font-mono text-[#9CA3AF] hover:border-emerald-500/30 hover:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors"
          >
            <Package size={14} aria-hidden="true" />
            Docker
          </button>

          <button
            aria-label="Deploy to Vercel"
            onClick={() => handleDeploy('vercel')}
            className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0c] border border-[#2d2e32] rounded-lg text-xs font-mono text-[#9CA3AF] hover:border-emerald-500/30 hover:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors"
          >
            <Globe size={14} aria-hidden="true" />
            Vercel
          </button>

          <button
            aria-label="Deploy to Netlify"
            onClick={() => handleDeploy('netlify')}
            className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0c] border border-[#2d2e32] rounded-lg text-xs font-mono text-[#9CA3AF] hover:border-emerald-500/30 hover:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors"
          >
            <Globe size={14} aria-hidden="true" />
            Netlify
          </button>

          <button
            aria-label="Download ZIP"
            onClick={() => handleDeploy('zip')}
            className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0c] border border-[#2d2e32] rounded-lg text-xs font-mono text-[#9CA3AF] hover:border-emerald-500/30 hover:text-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors"
          >
            <ArrowDown size={14} aria-hidden="true" />
            Download ZIP
          </button>

          <button
            aria-label="Open folder"
            onClick={() => window.open(`file://${appPath}`, '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-400 hover:bg-emerald-500/20 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-colors"
          >
            <FolderOpen size={14} />
            Open Folder
          </button>
        </div>
      </div>
    </motion.div>
  );
};
