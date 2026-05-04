import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Key, Rocket } from 'lucide-react';
import { validateLicense, saveLicense, getTrialInfo } from '../services/licenseService';

interface LicenseGateProps {
  onActivate: () => void;
}

export const LicenseGate = ({ onActivate }: LicenseGateProps) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [trialStarted, setTrialStarted] = useState(false);

  const handleActivate = () => {
    setError(null);

    if (!key.trim()) {
      setError('Enter a license key');
      return;
    }

    setSubmitting(true);

    try {
      const { valid, plan } = validateLicense(key);

      if (!valid) {
        setError('Invalid license key. Use format: NEXUS-XXXX-XXXX-XXXX-XXXX');
        setSubmitting(false);
        return;
      }

      saveLicense(key);
      setSubmitting(false);
      onActivate();
    } catch (err) {
      setError('Activation failed. Please try again.');
      setSubmitting(false);
    }
  };

  const handleTryFree = () => {
    const { remaining } = getTrialInfo();
    setTrialStarted(true);

    if (remaining <= 0) {
      return;
    }

    setTimeout(() => onActivate(), 1200);
  };

  const trialInfo = getTrialInfo();

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Branding */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <Sparkles size={28} className="text-emerald-500" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-3xl font-bold text-white font-mono tracking-tighter mb-2"
          >
            Nexus Alpha
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-[#9CA3AF] font-mono"
          >
            The Last Coding Tool You'll Ever Pay For
          </motion.p>
        </div>

        {/* License card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#151619] border border-[#2d2e32] rounded-xl p-6 space-y-5"
        >
          <div className="text-center">
            <Rocket size={24} className="text-emerald-500 mx-auto mb-2" aria-hidden="true" />
            <h2 className="text-lg font-bold text-white font-mono">
              Unlock Unlimited Generations
            </h2>
            <p className="text-xs text-[#9CA3AF] font-mono mt-1">
              Enter your license key or start a free trial.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <input
                type="text"
                aria-label="License key"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleActivate();
                }}
                placeholder="NEXUS-XXXX-XXXX-XXXX-XXXX"
                maxLength={29}
                className="w-full bg-[#0a0a0c] border border-[#2d2e32] rounded-lg px-4 py-2.5 text-white font-mono text-sm placeholder:text-[#4a4b50] focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all uppercase"
              />
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-red-400 font-mono mt-1.5"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <motion.button
              aria-label="Activate license"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleActivate}
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-[#2d2e32] disabled:text-[#6B7280] text-black font-bold font-mono text-sm rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
            >
              <Key size={16} />
              {submitting ? 'Activating...' : 'Activate'}
            </motion.button>
          </div>

          <div className="flex gap-3">
            <motion.button
              aria-label={trialInfo.remaining <= 0 ? "Trial expired" : "Start free trial"}
              whileHover={{ scale: trialInfo.remaining <= 0 ? 1 : 1.02 }}
              whileTap={{ scale: trialInfo.remaining <= 0 ? 1 : 0.98 }}
              onClick={handleTryFree}
              disabled={trialInfo.remaining <= 0}
              className="flex-1 px-4 py-2 border border-emerald-500/30 rounded-lg text-emerald-400 font-mono text-xs hover:bg-emerald-500/5 disabled:border-[#2d2e32] disabled:text-[#6B7280] disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
            >
              {trialInfo.remaining <= 0 ? 'Trial Expired' : 'Try Free'}
            </motion.button>

            <motion.a
              aria-label="Buy license"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              href="/sales/index.html"
              className="flex-1 px-4 py-2 border border-[#2d2e32] rounded-lg text-[#9CA3AF] font-mono text-xs hover:text-white hover:border-[#424348] text-center focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all"
            >
              Buy Now
            </motion.a>
          </div>
        </motion.div>

        {/* Trial info */}
        {trialStarted && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-center text-xs font-mono mt-4 ${trialInfo.remaining <= 0 ? 'text-red-400' : 'text-emerald-400'}`}
          >
            {trialInfo.remaining <= 0
              ? 'Trial expired. Activate a license to continue.'
              : `${trialInfo.remaining} generation${trialInfo.remaining !== 1 ? 's' : ''} remaining in trial`}
          </motion.p>
        )}

        {!trialStarted && (
          <p className="text-center text-[10px] text-[#6B7280] font-mono mt-4">
            Your code never leaves your machine. Zero telemetry.
          </p>
        )}
      </motion.div>
    </div>
  );
};
