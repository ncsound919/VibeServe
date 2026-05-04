import { useState, useEffect } from 'react';
import { isLicensed } from '../services/licenseService';

export function useNexusAuth() {
  const [appLicensed, setAppLicensed] = useState(true);

  useEffect(() => {
    try {
      setAppLicensed(isLicensed());
    } catch {
      setAppLicensed(false);
    }
  }, []);

  return { appLicensed };
}
