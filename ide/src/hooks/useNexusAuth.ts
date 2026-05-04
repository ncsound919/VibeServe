import { useState, useEffect } from 'react';
import { isLicensed, saveLicense } from '../services/licenseService';

// In dev mode, auto-apply the trial key so the app always loads
const DEV_AUTO_LICENSE = import.meta.env.DEV;

function getInitialLicensed(): boolean {
  if (DEV_AUTO_LICENSE) {
    saveLicense('NEXUS-TRIAL-0000-0000-0000-0000');
    return true;
  }
  try {
    return isLicensed();
  } catch {
    return false;
  }
}

export function useNexusAuth() {
  // Initialize synchronously to avoid the flicker/white-screen from useEffect delay
  const [appLicensed, setAppLicensed] = useState<boolean>(getInitialLicensed);

  useEffect(() => {
    if (DEV_AUTO_LICENSE) return; // already handled above
    try {
      setAppLicensed(isLicensed());
    } catch {
      setAppLicensed(false);
    }
  }, []);

  return { appLicensed };
}
