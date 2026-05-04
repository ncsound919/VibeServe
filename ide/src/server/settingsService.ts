/**
 * Settings Service
 * Manages server-side application settings like privacy mode (local/cloud).
 */

export type PrivacyMode = 'local' | 'cloud';

interface Settings {
  privacyMode: PrivacyMode;
}

let currentSettings: Settings = {
  privacyMode: 'cloud',
};

export const settingsService = {
  getSettings(): Settings {
    return { ...currentSettings };
  },

  setPrivacyMode(mode: PrivacyMode): void {
    currentSettings.privacyMode = mode;
  },

  isLocalMode(): boolean {
    return currentSettings.privacyMode === 'local';
  }
};
