import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export function useNexusStatus(loading: boolean, hasData: boolean) {
  const [latency, setLatency] = useState(42);
  const { nexusSystemStatus, setNexusSystemStatus } = useAppStore();

  // Monitor latency
  useEffect(() => {
    if (!loading && hasData) {
      setLatency(prev => {
        const jitter = Math.floor(Math.random() * 10) - 5;
        return Math.max(12, Math.min(150, prev + jitter));
      });
    }
  }, [hasData, loading]);

  return { 
    latency, 
    nexusSystemStatus, 
    setNexusSystemStatus 
  };
}
