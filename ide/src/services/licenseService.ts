const TRIAL_KEY = 'NEXUS-TRIAL-0000-0000-0000-0000';
const TRIAL_LIMIT = 50;
const LICENSE_PATTERN = /^NEXUS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const getStorage = () => {
  try {
    return JSON.parse(localStorage.getItem('nexus_license') || '{}');
  } catch {
    return {};
  }
};

const setStorage = (data: any) => {
  localStorage.setItem('nexus_license', JSON.stringify(data));
};

export const validateLicense = (key: string) => {
  const isTrial = key === TRIAL_KEY;
  const isValid = LICENSE_PATTERN.test(key) || isTrial;

  return {
    valid: isValid,
    plan: isTrial ? 'trial' : isValid ? 'pro' : 'invalid',
  };
};

export const saveLicense = (key: string) => {
  const storage = getStorage();
  storage.licenseKey = key;
  storage.savedAt = Date.now();
  setStorage(storage);
};

export const getTrialInfo = () => {
  const storage = getStorage();
  const used = storage.trialUses || 0;
  const remaining = Math.max(0, TRIAL_LIMIT - used);

  return {
    remaining,
    total: TRIAL_LIMIT,
    used,
  };
};

export const recordTrialUse = () => {
  const storage = getStorage();
  storage.trialUses = (storage.trialUses || 0) + 1;
  setStorage(storage);
};

export const isLicensed = () => {
  const storage = getStorage();
  const key = storage.licenseKey;
  if (!key) return false;
  const { valid } = validateLicense(key);
  return valid;
};

export const licenseService = {
  validateLicense,
  saveLicense,
  getTrialInfo,
  recordTrialUse,
  isLicensed,
};