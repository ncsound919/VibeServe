import { callGeminiProxy } from "../../services/apiClient";
import { logger } from "../../lib/logger";
import { wikiGenService } from "../../services/wikiGenService";
import type { MultiFilePlan, PlanStep } from "./types";

export class PlannerAgent {
  /**
   * Generates a multi-file execution plan for a given prompt.
   * This agent acts as the "Architect" that decomposes the request.
   */
  async createPlan(prompt: string, context: { existingFiles: string[] }): Promise<MultiFilePlan> {
    logger.info('PlannerAgent', `Generating plan for: ${prompt}`);

    const wikiContext = wikiGenService.getWikiContext();
    const systemPrompt = `You are the Nexus Alpha Architect Agent. 
Your goal is to decompose a user request into a precise multi-file execution plan.

--- PROJECT WIKI (ARCHITECTURAL KNOWLEDGE) ---
${wikiContext}
--- END PROJECT WIKI ---

CONTEXT:
Existing Files: ${context.existingFiles.join(', ')}

TASK:
${prompt}

Respond ONLY with a JSON object in this format:
{
  "title": "Short descriptive title",
  "summary": "High-level strategy summary",
  "steps": [
    {
      "id": "step-1",
      "file": "path/to/file.ts",
      "action": "create | modify | delete",
      "purpose": "What this change achieves in this specific file"
    }
  ]
}`;

    try {
      const response = await callGeminiProxy(systemPrompt, 'gemini-2.0-flash');
      
      // Extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON plan found in LLM response");
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        id: `plan_${Date.now()}`,
        title: parsed.title || "Implementation Plan",
        summary: parsed.summary || "No summary provided",
        steps: (parsed.steps || []).map((s: any) => ({
          ...s,
          status: 'pending'
        }))
      };
    } catch (err) {
      logger.error('PlannerAgent', `Planning failed: ${err}`);
      throw err;
    }
  }
}

export const plannerAgent = new PlannerAgent();
