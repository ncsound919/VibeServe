import { ExtensionManifest } from "./types";

export interface SecurityScanResult {
  isSafe: boolean;
  warnings: string[];
  errors: string[];
}

export class ExtensionSecurityScanner {
  // Disallowed global variables and functions that could be exploited
  private static readonly DISALLOWED_PATTERNS = [
    /eval\s*\(/i,
    /Function\s*\(/i,
    /setTimeout\s*\(\s*['"]/i, // String literal in setTimeout
    /setInterval\s*\(\s*['"]/i, // String literal in setInterval
    /document\.cookie/i,
    /window\.localStorage/i,
    /window\.sessionStorage/i,
    /require\s*\(/i, 
    /process\.env/i,
    /child_process/i,
    /fs\.read/i,
    /fs\.write/i,
  ];

  public static scan(extensionCode: string, manifest: ExtensionManifest): SecurityScanResult {
    const result: SecurityScanResult = {
      isSafe: true,
      warnings: [],
      errors: [],
    };

    // 1. Scan for malicious code patterns
    for (const pattern of this.DISALLOWED_PATTERNS) {
      if (pattern.test(extensionCode)) {
        result.errors.push(`Disallowed code pattern found: ${pattern.toString()}`);
        result.isSafe = false;
      }
    }

    // 2. Validate manifest permissions
    const declaredPermissions = manifest.permissions || [];
    if (declaredPermissions.includes('fs') && !extensionCode.includes('fs')) {
      result.warnings.push('Manifest requests "fs" permission but it is not used.');
    }

    // 3. Scan for potential network exfiltration if no network permission
    if (!declaredPermissions.includes('network') && /fetch\s*\(|XMLHttpRequest|WebSocket/i.test(extensionCode)) {
      result.errors.push('Extension contains network calls but lacks "network" permission in manifest.');
      result.isSafe = false;
    }

    return result;
  }
}
