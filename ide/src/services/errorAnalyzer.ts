/**
 * ErrorAnalyzer — Gemini-powered error diagnosis for intelligent auto-fix
 *
 * Takes a pipeline error (message + context) and uses Gemini to:
 * 1. Classify the error type with high precision
 * 2. Identify the root cause (file, line, dependency, configuration)
 * 3. Generate a concrete fix strategy with code changes
 *
 * Falls back to pattern-matching + errorTrackingService when Gemini is unavailable.
 */

import { callGeminiProxy } from "./apiClient";
import { categorizeError } from "./errorTrackingService";
import { logger } from "../lib/logger";

export interface ErrorDiagnosis {
  errorType: string;
  severity: "low" | "medium" | "high" | "critical";
  rootCause: string;
  affectedFile?: string;
  affectedLine?: number;
  fixStrategy: "replace" | "patch" | "command" | "config" | "dependency" | "manual";
  fixCode?: string;
  fixDescription: string;
  confidence: number;
  alternativeFixes: string[];
}

interface GeminiErrorAnalysisResponse {
  errorType: string;
  rootCause: string;
  affectedFile?: string;
  affectedLine?: number;
  fixStrategy: string;
  fixCode?: string;
  explanation: string;
  alternatives: string[];
  confidence: number;
}

function parseGeminiResponse(text: string): GeminiErrorAnalysisResponse | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Not JSON
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: GeminiErrorAnalysisResponse = {
    errorType: "",
    rootCause: "",
    explanation: "",
    alternatives: [],
    confidence: 0.5,
    fixStrategy: "manual",
  };

  for (const line of lines) {
    const l = line.replace(/^[-*#]+\s*/, "");
    if (/error\s*type/i.test(l)) result.errorType = l.split(/:\s*/)[1]?.trim() || "";
    else if (/root\s*cause/i.test(l)) result.rootCause = l.split(/:\s*/)[1]?.trim() || "";
    else if (/file/i.test(l) && !result.affectedFile) result.affectedFile = l.match(/[^\s]+\.[a-z]+/i)?.[0];
    else if (/line/i.test(l) && !result.affectedLine) result.affectedLine = parseInt(l.match(/\d+/)?.[0] || "0") || undefined;
    else if (/fix|strategy/i.test(l)) result.fixStrategy = l.split(/:\s*/)[1]?.trim().toLowerCase() || "manual";
    else if (/code|patch/i.test(l) && l.includes("```")) result.fixCode = l;
    else if (/alternative/i.test(l)) result.alternatives.push(l.split(/:\s*/)[1]?.trim() || l);
    else if (/confidence/i.test(l)) result.confidence = parseFloat(l.match(/[\d.]+/)?.[0] || "0.5");
  }

  return result;
}

export async function analyzeError(
  errorMessage: string,
  errorStack?: string,
  phase?: string,
  sourceRepos?: string[],
  codebaseContext?: string
): Promise<ErrorDiagnosis> {
  const { category, severity } = categorizeError(new Error(errorMessage));

  try {
    const prompt = `You are a build pipeline error analyzer. Analyze the following error and provide a JSON response with fix instructions.

ERROR:
- Phase: ${phase || "unknown"}
- Message: ${errorMessage}
${errorStack ? `- Stack Trace: ${errorStack.substring(0, 500)}` : ""}
${sourceRepos ? `- Source Repos: ${sourceRepos.join(", ")}` : ""}
${codebaseContext ? `- Codebase Context: ${codebaseContext}` : ""}

Respond ONLY with a JSON object:
{
  "errorType": "compilation|lint|test|runtime|network|dependency|security|unknown",
  "rootCause": "concise root cause explanation",
  "affectedFile": "path/to/file.ts" or null,
  "affectedLine": number or null,
  "fixStrategy": "replace|patch|command|config|dependency|manual",
  "fixCode": "the actual code fix or command to run" or null,
  "explanation": "why this fix works",
  "alternatives": ["alternative fix 1", "alternative fix 2"],
  "confidence": 0.0 to 1.0
}`;

    const response = await callGeminiProxy(prompt, "gemini-2.0-flash");
    const parsed = parseGeminiResponse(response);

    if (parsed) {
      return {
        errorType: parsed.errorType || category,
        severity,
        rootCause: parsed.rootCause || parsed.explanation || errorMessage,
        affectedFile: parsed.affectedFile,
        affectedLine: parsed.affectedLine,
        fixStrategy: mapFixStrategy(parsed.fixStrategy || "manual"),
        fixCode: parsed.fixCode,
        fixDescription: parsed.explanation || `Fix ${category} error in ${phase || "pipeline"}`,
        confidence: parsed.confidence || 0.5,
        alternativeFixes: parsed.alternatives || [],
      };
    }

    logger.warn("ErrorAnalyzer", "Gemini response unparseable, using fallback");
  } catch (err) {
    logger.warn("ErrorAnalyzer", `Gemini analysis failed: ${err instanceof Error ? err.message : String(err)}, using fallback`);
  }

  // Fallback: pattern-based diagnosis
  return fallbackDiagnosis(errorMessage, category, severity, phase);
}

function mapFixStrategy(strategy: string): ErrorDiagnosis["fixStrategy"] {
  const s = strategy.toLowerCase();
  if (s.includes("replace") || s.includes("edit")) return "replace";
  if (s.includes("patch")) return "patch";
  if (s.includes("command") || s.includes("run") || s.includes("exec")) return "command";
  if (s.includes("config") || s.includes("setup")) return "config";
  if (s.includes("depend") || s.includes("install") || s.includes("package")) return "dependency";
  return "manual";
}

function fallbackDiagnosis(
  message: string,
  category: string,
  severity: "low" | "medium" | "high" | "critical",
  phase?: string
): ErrorDiagnosis {
  const lower = message.toLowerCase();

  if (lower.includes("econnrefused") || lower.includes("etimedout")) {
    return {
      errorType: "network",
      severity: "medium",
      rootCause: "Network connection refused or timed out",
      fixStrategy: "command",
      fixDescription: "Retry with increased timeout and exponential backoff",
      fixCode: "sleep 5 && retry",
      confidence: 0.9,
      alternativeFixes: ["Check VPN/proxy settings", "Verify service is running", "Add retry logic with exponential backoff"],
    };
  }

  if (lower.includes("module_not_found") || lower.includes("cannot find module")) {
    const modMatch = message.match(/['"]([^'"]+)['"]/);
    const modName = modMatch?.[1] || "unknown";
    return {
      errorType: "dependency",
      severity: "high",
      rootCause: `Missing module: ${modName}`,
      fixStrategy: "dependency",
      fixDescription: `Install missing dependency: ${modName}`,
      fixCode: `npm install ${modName}`,
      confidence: 0.95,
      alternativeFixes: ["Run npm install", "Check package.json for typos", "Clear node_modules and reinstall"],
    };
  }

  if (lower.includes("type") && (lower.includes("error") || lower.includes("tsc"))) {
    return {
      errorType: "compilation",
      severity: "high",
      rootCause: "TypeScript compilation error",
      fixStrategy: "replace",
      fixDescription: "Fix type error per TSC output",
      confidence: 0.4,
      alternativeFixes: ["Run tsc --noEmit to see full errors", "Check type definitions", "Update @types packages"],
    };
  }

  if (lower.includes("build") && lower.includes("fail")) {
    return {
      errorType: "compilation",
      severity: "high",
      rootCause: "Build failed",
      fixStrategy: "command",
      fixDescription: "Run build with verbose output to diagnose",
      fixCode: "npm run build -- --debug 2>&1",
      confidence: 0.3,
      alternativeFixes: ["Check build configuration", "Clear build cache", "Check for incompatible dependencies"],
    };
  }

  return {
    errorType: category,
    severity,
    rootCause: message.substring(0, 200),
    fixStrategy: "manual",
    fixDescription: `Manual intervention required for ${category} error`,
    confidence: 0.1,
    alternativeFixes: [],
  };
}

export async function generateFixCode(
  errorMessage: string,
  fileContent: string,
  filePath: string,
  phase?: string
): Promise<string | null> {
  try {
    const prompt = `You are a code fixer. Given the following error and file content, generate the exact code fix needed.

ERROR: ${errorMessage}
${phase ? `PHASE: ${phase}` : ""}
FILE: ${filePath}

CURRENT FILE CONTENT:
\`\`\`
${fileContent.substring(0, 3000)}
\`\`\`

Respond ONLY with the corrected file content or the specific lines to change. 
Format as:
\`\`\`
<PATCH>
<exact replacement code>
</PATCH>
\`\`\``;

    const response = await callGeminiProxy(prompt, "gemini-2.0-flash");
    const patchMatch = response.match(/<PATCH>\s*([\s\S]*?)\s*<\/PATCH>/i);
    return patchMatch ? patchMatch[1].trim() : response.trim();
  } catch {
    return null;
  }
}
