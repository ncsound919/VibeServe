/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import type { E2EResultData } from '../../types';

interface E2EResultsPanelProps {
  results: E2EResultData[];
}

export const E2EResultsPanel = ({ results }: E2EResultsPanelProps) => (
  <div className="space-y-3 mt-4">
    <h5 className="text-[10px] font-mono uppercase text-[#4a4b50] tracking-widest border-b border-[#2d2e32] pb-1">
      Automated Test Suite
    </h5>
    {results.map((res, i) => (
      <div key={i} className="flex flex-col gap-1 p-2 bg-[#0a0a0c] rounded border border-[#1a1b1e]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {res.status === 'passed'
              ? <CheckCircle2 size={12} className="text-emerald-500" />
              : res.status === 'skipped'
              ? <MinusCircle size={12} className="text-amber-500" />
              : <XCircle size={12} className="text-rose-500" />}
            <span className="text-[11px] font-medium text-[#8E9299]">{res.testName}</span>
          </div>
          <span className="text-[9px] font-mono text-[#4a4b50]">{res.duration}ms</span>
        </div>
        {res.logs.length > 0 && (
          <div className="text-[9px] font-mono text-[#4a4b50] pl-5">
            {res.logs.join(' • ')}
          </div>
        )}
      </div>
    ))}
  </div>
);
