/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { ShieldCheck } from 'lucide-react';

interface AuditCertificateProps {
  hash?: string;
  critical?: number;
  high?: number;
}

export const AuditCertificate = ({
  hash = 'sha256:0x2f3e...b9a2',
  critical = 0,
  high = 0
}: AuditCertificateProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-[#0a0a0c] border border-blue-500/30 p-6 rounded-xl mt-6 relative overflow-hidden group shadow-2xl"
  >
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
      <ShieldCheck size={40} className="text-blue-500" />
    </div>
    <div className="flex items-center gap-4 mb-4">
      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
        <ShieldCheck size={24} />
      </div>
      <div>
        <h4 className="text-sm font-bold text-white uppercase tracking-widest">Audit Certificate: NEXUS-AUDIT-G7</h4>
        <p className="text-[10px] font-mono text-[#4a4b50]">VERIFIED STATUS: COMPLIANT_LEVEL_3</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 border-t border-[#1a1b1e] pt-4">
      <div className="space-y-1">
        <div className="text-[9px] font-mono text-[#4a4b50] uppercase">Integrity Hash</div>
        <div className="text-[10px] font-mono text-blue-400 truncate">{hash}</div>
      </div>
      <div className="space-y-1">
        <div className="text-[9px] font-mono text-[#4a4b50] uppercase">Vulnerability Count</div>
        <div className="text-[10px] font-mono text-emerald-400">{critical} CRITICAL / {high} HIGH</div>
      </div>
    </div>
    <div className="mt-4 flex items-center gap-2 text-[9px] font-mono text-[#4a4b50]">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      DIGITALLY SIGNED VIA NEXUS IMMUTABLE LEDGER
    </div>
  </motion.div>
);
