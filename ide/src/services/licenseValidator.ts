const LICENSE_FORMAT_REGEX = /^NEXUS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isValidLicenseFormat(key: string): boolean {
  const trimmed = key.trim().toUpperCase();
  return LICENSE_FORMAT_REGEX.test(trimmed);
}

export function generateMachineFingerprint(): string {
  let parts: string[] = [];

  try {
    if (typeof window !== 'undefined') {
      parts.push(navigator.platform || 'browser');
      parts.push(window.location.hostname || 'localhost');
    } else {
      const os = require('node:os');
      parts.push(os.platform());
      parts.push(os.hostname());
      try {
        parts.push(process.cwd());
      } catch {
        parts.push('unknown-cwd');
      }
    }
  } catch {
    parts.push('unknown');
    parts.push('unknown-host');
    parts.push('unknown-cwd');
  }

  const raw = parts.join(':');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `FP-${hex.toUpperCase()}`;
}
