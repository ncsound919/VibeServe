import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { logger } from '../../lib/logger';
import type { BuildError } from './types';
import { generateText } from './llmClient';

const CTX = 'ErrorDiagnoser';

export interface DiagnosisResult {
  rootCause: string;
  fixStrategy: 'replace' | 'add_import' | 'add_dep' | 'fix_config' | 'retry' | 'unknown';
  fixCode: string;
  affectedFile: string;
  fixDescription: string;
  llmUsed: boolean;
}

interface TsErrorParts {
  file: string;
  line: number;
  col: number;
  code: string;
  message: string;
  fullLine: string;
}

function parseTsError(stderrLine: string): TsErrorParts | null {
  const match = stderrLine.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/);
  if (match) {
    return {
      file: match[1].trim(),
      line: parseInt(match[2], 10),
      col: parseInt(match[3], 10),
      code: match[4].trim(),
      message: match[5].trim(),
      fullLine: stderrLine.trim(),
    };
  }
  return null;
}

function extractFileFromError(stderr: string): string {
  const match = stderr.match(/(?:^|\s)((?:src\/|lib\/|app\/|pages\/|components\/)?[\w\-\/]+\.(?:tsx?|jsx?|vue|svelte|css|scss))(?:\(|:|\s|$)/m);
  return match ? match[1] : '';
}

const TS_ERROR_STRATEGIES: Record<string, { strategy: DiagnosisResult['fixStrategy']; template: (parts: TsErrorParts) => string }> = {
  TS2304: {
    strategy: 'add_import',
    template: (p) => {
      const nameMatch = p.message.match(/Cannot find name '(\w+)'/);
      const name = nameMatch ? nameMatch[1] : 'unknown';
      return `import { ${name} } from '${guessModule(name)}';`;
    },
  },
  TS2307: {
    strategy: 'add_dep',
    template: (p) => {
      const modMatch = p.message.match(/Cannot find module '([^']+)'/);
      const mod = modMatch ? modMatch[1] : '';
      if (mod.startsWith('.') || mod.startsWith('/')) return '';
      return mod;
    },
  },
  TS2322: {
    strategy: 'replace',
    template: (p) => `Fix type mismatch: ${p.message}`,
  },
  TS2339: {
    strategy: 'replace',
    template: (p) => `Fix missing property: ${p.message}`,
  },
  TS2552: {
    strategy: 'replace',
    template: (p) => `Fix undefined value: ${p.message}`,
  },
  TS2345: {
    strategy: 'replace',
    template: (p) => `Fix argument type: ${p.message}`,
  },
  TS2769: {
    strategy: 'replace',
    template: (p) => `Fix type mismatch: ${p.message}`,
  },
  TS1005: {
    strategy: 'replace',
    template: () => 'Fix syntax error',
  },
  TS1128: {
    strategy: 'replace',
    template: () => 'Fix declaration/statement error',
  },
};

function guessModule(exportName: string): string {
  const common: Record<string, string> = {
    useState: 'react',
    useEffect: 'react',
    useContext: 'react',
    useRef: 'react',
    useMemo: 'react',
    useCallback: 'react',
    useReducer: 'react',
    Link: 'react-router-dom',
    BrowserRouter: 'react-router-dom',
    Route: 'react-router-dom',
    Routes: 'react-router-dom',
    useNavigate: 'react-router-dom',
    useParams: 'react-router-dom',
    styled: 'styled-components',
    axios: 'axios',
    express: 'express',
    Router: 'express',
    Request: 'express',
    Response: 'express',
    NextFunction: 'express',
    PrismaClient: '@prisma/client',
    z: 'zod',
    Button: '@mui/material',
    TextField: '@mui/material',
    Container: '@mui/material',
  };
  return common[exportName] || exportName.toLowerCase();
}

async function llmDiagnosis(
  buildError: BuildError,
  fileContent: string,
  tsParts: TsErrorParts | null,
): Promise<DiagnosisResult | null> {
  try {
    const tsContext = tsParts
      ? `\nTypeScript Error: ${tsParts.code} at ${tsParts.file}:${tsParts.line}:${tsParts.col}\nMessage: ${tsParts.message}`
      : '';

    const fileContext = fileContent
      ? `\n\nAFFECTED FILE CONTENT (relevant lines):\n\`\`\`\n${extractRelevantLines(fileContent, tsParts?.line ?? 0)}\n\`\`\``
      : '';

    const prompt = `You are a TypeScript build error fixer. Diagnose the following build error and provide a JSON fix.

BUILD COMMAND: ${buildError.command}
STDERR: ${buildError.stderr.slice(0, 1000)}${tsContext}${fileContext}

Respond ONLY with a JSON object:
{
  "rootCause": "concise root cause explanation",
  "fixStrategy": "replace" | "add_import" | "add_dep" | "fix_config" | "retry" | "unknown",
  "fixCode": "the corrected code, import statement, or package name",
  "fixDescription": "what this fix does and why",
  "affectedFile": "path/to/file"
}

For fixStrategy:
- "replace": the fixCode is the corrected code (full file or line replacement snippet)
- "add_import": the fixCode is the import statement to add (e.g. "import { useState } from 'react';")
- "add_dep": the fixCode is the npm package name to install (e.g. "lodash")
- "fix_config": the fixCode is updated config content
- "retry": the build should be retried (e.g. network issue)
- "unknown": cannot determine fix`;

    const result = await generateText(prompt, { temperature: 0.1, maxTokens: 4096 });

    const cleaned = result
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        rootCause: parsed.rootCause || 'Unknown build error',
        fixStrategy: validateStrategy(parsed.fixStrategy),
        fixCode: parsed.fixCode || '',
        affectedFile: parsed.affectedFile || tsParts?.file || '',
        fixDescription: parsed.fixDescription || 'Fix build error',
        llmUsed: true,
      };
    } catch {
      const braceStart = cleaned.indexOf('{');
      const braceEnd = cleaned.lastIndexOf('}');
      if (braceStart >= 0 && braceEnd > braceStart) {
        try {
          const parsed = JSON.parse(cleaned.slice(braceStart, braceEnd + 1));
          return {
            rootCause: parsed.rootCause || 'Unknown build error',
            fixStrategy: validateStrategy(parsed.fixStrategy),
            fixCode: parsed.fixCode || '',
            affectedFile: parsed.affectedFile || tsParts?.file || '',
            fixDescription: parsed.fixDescription || 'Fix build error',
            llmUsed: true,
          };
        } catch {}
      }
    }

    logger.warn(CTX, 'LLM response unparseable as JSON');
    return null;
  } catch (err) {
    logger.warn(CTX, `LLM diagnosis failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function extractRelevantLines(fileContent: string, errorLine: number): string {
  if (!errorLine) return fileContent.slice(0, 2000);
  const lines = fileContent.split('\n');
  const start = Math.max(0, errorLine - 5);
  const end = Math.min(lines.length, errorLine + 5);
  return lines.slice(start, end)
    .map((l, i) => `${start + i + 1}: ${l}`)
    .join('\n');
}

function validateStrategy(s: string): DiagnosisResult['fixStrategy'] {
  const valid: DiagnosisResult['fixStrategy'][] = ['replace', 'add_import', 'add_dep', 'fix_config', 'retry', 'unknown'];
  return valid.includes(s as any) ? (s as DiagnosisResult['fixStrategy']) : 'unknown';
}

function regexFallbackDiagnosis(
  buildError: BuildError,
  projectDir: string,
  fileContent: string,
): DiagnosisResult {
  const tsErrors = buildError.stderr
    .split('\n')
    .map(l => parseTsError(l))
    .filter((e): e is TsErrorParts => e !== null);

  if (tsErrors.length > 0) {
    const primary = tsErrors[0];
    const errorConfig = TS_ERROR_STRATEGIES[primary.code];

    if (errorConfig) {
      const fixCode = errorConfig.template(primary);

      const affectedFile = primary.file;
      const fullPath = path.resolve(projectDir, affectedFile);
      const actualContent = existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : fileContent;

      if (errorConfig.strategy === 'add_import' && fixCode) {
        return {
          rootCause: `TS Error ${primary.code}: ${primary.message}`,
          fixStrategy: 'add_import',
          fixCode,
          affectedFile,
          fixDescription: `Add missing import for '${primary.code}' at ${affectedFile}:${primary.line}`,
          llmUsed: false,
        };
      }

      if (errorConfig.strategy === 'add_dep' && fixCode) {
        return {
          rootCause: `TS Error ${primary.code}: ${primary.message}`,
          fixStrategy: 'add_dep',
          fixCode,
          affectedFile,
          fixDescription: `Install missing dependency: ${fixCode}`,
          llmUsed: false,
        };
      }

      if (errorConfig.strategy === 'replace') {
        let snippet = '';
        if (actualContent) {
          const lines = actualContent.split('\n');
          const errLineIdx = primary.line - 1;
          const start = Math.max(0, errLineIdx - 2);
          const end = Math.min(lines.length, errLineIdx + 3);
          snippet = lines.slice(start, end).join('\n');
        }

        return {
          rootCause: `TS Error ${primary.code}: ${primary.message}`,
          fixStrategy: 'replace',
          fixCode: snippet,
          affectedFile,
          fixDescription: `${errorConfig.template(primary)} at ${affectedFile}:${primary.line}`,
          llmUsed: false,
        };
      }

      return {
        rootCause: `TS Error ${primary.code}: ${primary.message}`,
        fixStrategy: 'replace',
        fixCode: actualContent || '',
        affectedFile,
        fixDescription: `Fix ${primary.code} at ${affectedFile}:${primary.line}`,
        llmUsed: false,
      };
    }

    const affectedFile = primary.file;
    const fullPath = path.resolve(projectDir, affectedFile);
    const actualContent = existsSync(fullPath) ? readFileSync(fullPath, 'utf-8') : fileContent;

    return {
      rootCause: `TS Error ${primary.code}: ${primary.message}`,
      fixStrategy: 'replace',
      fixCode: actualContent || '',
      affectedFile,
      fixDescription: `Fix TypeScript error ${primary.code} at ${affectedFile}:${primary.line}`,
      llmUsed: false,
    };
  }

  const extractedFile = extractFileFromError(buildError.stderr);
  const lower = buildError.stderr.toLowerCase();

  if (lower.includes('module') && lower.includes('not found')) {
    const modMatch = buildError.stderr.match(/module\s+['"]([^'"]+)['"]/i);
    const modName = modMatch ? modMatch[1] : '';
    if (modName && !modName.startsWith('.') && !modName.startsWith('/')) {
      return {
        rootCause: `Missing module: ${modName}`,
        fixStrategy: 'add_dep',
        fixCode: modName,
        affectedFile: extractedFile || 'package.json',
        fixDescription: `Install missing package: ${modName}`,
        llmUsed: false,
      };
    }
  }

  if (lower.includes('cannot find name')) {
    const nameMatch = buildError.stderr.match(/Cannot find name '(\w+)'/i);
    const name = nameMatch ? nameMatch[1] : '';
    if (name) {
      return {
        rootCause: `Missing import for '${name}'`,
        fixStrategy: 'add_import',
        fixCode: `import { ${name} } from '${guessModule(name)}';`,
        affectedFile: extractedFile || '',
        fixDescription: `Add missing import for '${name}'`,
        llmUsed: false,
      };
    }
  }

  return {
    rootCause: `Build failed: ${buildError.stderr.slice(0, 200)}`,
    fixStrategy: 'unknown',
    fixCode: '',
    affectedFile: extractedFile,
    fixDescription: 'Unable to diagnose build error automatically',
    llmUsed: false,
  };
}

export async function diagnoseError(
  buildError: BuildError,
  projectDir: string,
): Promise<DiagnosisResult> {
  logger.info(CTX, `Diagnosing build error: ${buildError.stderr.slice(0, 120)}`);

  const tsParts = buildError.stderr
    .split('\n')
    .map(l => parseTsError(l))
    .find((e): e is TsErrorParts => e !== null) ?? null;

  let fileContent = '';
  if (tsParts?.file) {
    const fullPath = path.resolve(projectDir, tsParts.file);
    if (existsSync(fullPath)) {
      fileContent = readFileSync(fullPath, 'utf-8');
    }
  }

  const llmResult = await llmDiagnosis(buildError, fileContent, tsParts);
  if (llmResult) {
    logger.info(CTX, `LLM diagnosis: ${llmResult.fixStrategy} — ${llmResult.fixDescription}`);
    return llmResult;
  }

  logger.info(CTX, 'LLM unavailable, using regex fallback diagnosis');
  const fallback = regexFallbackDiagnosis(buildError, projectDir, fileContent);
  logger.info(CTX, `Fallback diagnosis: ${fallback.fixStrategy} — ${fallback.fixDescription}`);
  return fallback;
}
