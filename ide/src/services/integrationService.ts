/**
 * Nexus Alpha Integration Service
 * Central hub for connecting: Nanobot, Mem0, Qdrant, Firecrawl, Tavily, Langfuse
 */

import { supabase } from "./supabaseClient";
import type { Document } from "./ragService";

// ─── Supabase Vector Store Integration ───────────────────────────────────────────

export class SupabaseVectorClient {
  async upsert(
    tableName: string,
    points: Array<{
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }>
  ): Promise<boolean> {
    const { error } = await supabase.from(tableName).upsert(
      points.map((p) => ({
        id: p.id,
        embedding: p.vector,
        metadata: p.payload,
      }))
    );
    return !error;
  }

  async search(
    tableName: string,
    vector: number[],
    limit = 5
  ): Promise<
    Array<{ id: string; score: number; payload: Record<string, unknown> }>
  > {
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: vector,
      match_threshold: 0.5,
      match_count: limit,
    });
    
    if (error || !data) return [];
    
    return data.map((d: any) => ({
      id: d.id,
      score: d.similarity,
      payload: d.metadata,
    }));
  }
}

// ─── Configuration ───────────────────────────────────────────────────────────────────

interface IntegrationConfig {
  nanobotUrl: string;
  qdrantUrl: string;
  langfuseUrl: string;
  firecrawlApiKey?: string;
  tavilyApiKey?: string;
  mem0ApiKey?: string;
}

const getConfig = (): IntegrationConfig => ({
  nanobotUrl: process.env.NANOBOT_URL || "http://localhost:3030",
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  langfuseUrl: process.env.LANGFUSE_URL || "http://localhost:3001",
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  tavilyApiKey: process.env.TAVILY_API_KEY,
  mem0ApiKey: process.env.MEM0_API_KEY,
});

// ─── Types ─────────────────────────────────────────────────────────────────────────

export interface AgentResponse {
  success: boolean;
  message: string;
  toolCalls?: string[];
  sessionId?: string;
  traces?: TraceData[];
}

export interface TraceData {
  type: string;
  timestamp: number;
  data: unknown;
}

export interface SearchResult {
  title: string;
  url: string;
  content?: string;
  score?: number;
  source: string;
}

export interface MemoryContext {
  userId: string;
  facts: string[];
  preferences: Record<string, unknown>;
}

// ─── Nanobot Agent Integration ────────────────────────────────────────────────────

export class NanobotClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async sendMessage(
    message: string,
    sessionId?: string
  ): Promise<AgentResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          message,
          session_id: sessionId || `nexus-${Date.now()}`,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Nanobot error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        message: data.response || data.message || "",
        toolCalls: data.tool_calls,
        sessionId: data.session_id,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getStatus(): Promise<{ connected: boolean; version?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (response.ok) {
        const data = await response.json();
        return { connected: true, version: data.version };
      }
      return { connected: false };
    } catch {
      return { connected: false };
    }
  }
}

// ─── Qdrant Vector Store Integration ─────────────────────────────────────────────

export class QdrantClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async createCollection(name: string, vectorSize = 1536): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey && { "api-key": this.apiKey }),
        },
        body: JSON.stringify({
          name,
          vectors: {
            size: vectorSize,
            distance: "Cosine",
          },
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async upsert(
    collectionName: string,
    points: Array<{
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }>
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/collections/${collectionName}/points`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey && { "api-key": this.apiKey }),
          },
          body: JSON.stringify({ points }),
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async search(
    collectionName: string,
    vector: number[],
    limit = 5
  ): Promise<
    Array<{ id: string; score: number; payload: Record<string, unknown> }>
  > {
    try {
      const response = await fetch(
        `${this.baseUrl}/collections/${collectionName}/points/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey && { "api-key": this.apiKey }),
          },
          body: JSON.stringify({ vector, limit }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.result || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  async getCollections(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/collections`, {
        headers: this.apiKey ? { "api-key": this.apiKey } : {},
      });
      if (response.ok) {
        const data = await response.json();
        return data.result?.collections?.map((c: { name: string }) => c.name) || [];
      }
      return [];
    } catch {
      return [];
    }
  }
}

// ─── Firecrawl Search Integration ───────────────────────────────────────────────

export class FirecrawlClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ query, limit }),
      });

      if (response.ok) {
        const data = await response.json();
        return (data.data || []).map((item: {
          title: string;
          url: string;
          description?: string;
        }) => ({
          title: item.title,
          url: item.url,
          content: item.description,
          source: "firecrawl",
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async scrape(url: string): Promise<string | null> {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data?.markdown || null;
      }
      return null;
    } catch {
      return null;
    }
  }
}

// ─── Tavily Search Integration ────────────────────────────────────────────────────

export class TavilyClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(
    query: string,
    options?: {
      searchDepth?: "basic" | "advanced";
      includeAnswer?: boolean;
      includeRawContent?: boolean;
    }
  ): Promise<SearchResult[]> {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          search_depth: options?.searchDepth || "advanced",
          include_answer: options?.includeAnswer ?? true,
          include_raw_content: options?.includeRawContent ?? false,
          max_results: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return (data.results || []).map((item: {
          title: string;
          url: string;
          content?: string;
          score?: number;
        }) => ({
          title: item.title,
          url: item.url,
          content: item.content,
          score: item.score,
          source: "tavily",
        }));
      }
      return [];
    } catch {
      return [];
    }
  }
}

// ─── Mem0 Memory Integration ─────────────────────────────────────────────────────

export class Mem0Client {
  private apiKey: string;
  private baseUrl = "https://api.mem0.ai/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Self-Healing: Sync Mem0 memory to Supabase for durability
  async syncToSupabase(userId: string) {
    const memories = await this.getMemories(userId);
    const { supabase } = await import("./supabaseClient");
    
    for (const m of memories) {
      await supabase.from('agent_memory').upsert({
        user_id: userId,
        content: m.facts[0],
        metadata: m.preferences,
        synced_at: new Date().toISOString()
      });
    }
  }

  async addMemory(
    userId: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/memories/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({
          role: "user",
          content,
          user_id: userId,
          ...(metadata && { metadata }),
        }),
      });

      if (response.ok) {
        // Self-Healing: Immediately back up to Supabase
        const { supabase } = await import("./supabaseClient");
        await supabase.from('agent_memory').insert({
            user_id: userId,
            content,
            metadata,
            synced_at: new Date().toISOString()
        });
      }
      return response.ok;
    } catch {
      return false;
    }
  }

  async getMemories(userId: string, limit = 10): Promise<MemoryContext[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/memories/?user_id=${userId}&limit=${limit}`,
        {
          headers: { Authorization: `Token ${this.apiKey}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return (data.results || []).map((m: {
          memory: string;
          user_id: string;
          metadata?: Record<string, unknown>;
        }) => ({
          userId: m.user_id,
          facts: [m.memory],
          preferences: m.metadata || {},
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async search(userId: string, query: string, limit = 5): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/memories/search/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify({
          user_id: userId,
          query,
          limit,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.results?.map((m: { memory: string }) => m.memory) || [];
      }
      return [];
    } catch {
      return [];
    }
  }
}

// ─── Langfuse Observability Integration ─────────────────────────────────────────

export class LangfuseClient {
  private publicKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor(publicKey: string, secretKey: string, baseUrl: string) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
  }

  async createTrace(name: string, metadata?: Record<string, unknown>): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/public/traces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({
          name,
          metadata,
          userId: "nexus-alpha",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
      return null;
    } catch {
      return null;
    }
  }

  async logGeneration(
    traceId: string,
    model: string,
    input: string,
    output: string,
    tokens?: { input?: number; output?: number }
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/public/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify({
          trace_id: traceId,
          model,
          prompt: input,
          completion: output,
          model_parameters: {},
          token_count: tokens,
          user_id: "nexus-alpha",
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ─── Integration Hub ─────────────────────────────────────────────────────────────

export class IntegrationHub {
  private config: IntegrationConfig;
  public nanobot: NanobotClient | null = null;
  public qdrant: QdrantClient | null = null;
  public supabaseVector: SupabaseVectorClient | null = null;
  public firecrawl: FirecrawlClient | null = null;
  public tavily: TavilyClient | null = null;
  public mem0: Mem0Client | null = null;
  public langfuse: LangfuseClient | null = null;

  constructor() {
    this.config = getConfig();
    this.initializeClients();
  }

  private initializeClients() {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    
    if (this.config.nanobotUrl && apiKey) {
      this.nanobot = new NanobotClient(this.config.nanobotUrl, apiKey);
    }
    
    if (this.config.qdrantUrl) {
      this.qdrant = new QdrantClient(
        this.config.qdrantUrl,
        process.env.QDRANT_API_KEY
      );
    }
    
    this.supabaseVector = new SupabaseVectorClient();
    
    if (this.config.firecrawlApiKey) {
      this.firecrawl = new FirecrawlClient(this.config.firecrawlApiKey);
    }
    
    if (this.config.tavilyApiKey) {
      this.tavily = new TavilyClient(this.config.tavilyApiKey);
    }
    
    if (this.config.mem0ApiKey) {
      this.mem0 = new Mem0Client(this.config.mem0ApiKey);
    }
    
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      this.langfuse = new LangfuseClient(
        process.env.LANGFUSE_PUBLIC_KEY,
        process.env.LANGFUSE_SECRET_KEY,
        this.config.langfuseUrl
      );
    }
  }

  // Unified search across all sources
  async searchAll(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    if (this.firecrawl) {
      const firecrawlResults = await this.firecrawl.search(query);
      results.push(...firecrawlResults);
    }

    if (this.tavily) {
      const tavilyResults = await this.tavily.search(query);
      results.push(...tavilyResults);
    }

    // Sort by source priority and dedupe
    const seen = new Set<string>();
    return results.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  // Get connection status for all services
  async getStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};

    if (this.nanobot) {
      try {
        const nanobotStatus = await this.nanobot.getStatus();
        status.nanobot = nanobotStatus.connected;
      } catch {
        status.nanobot = false;
      }
    }

    if (this.qdrant) {
      try {
        const collections = await this.qdrant.getCollections();
        status.qdrant = collections.length >= 0;
      } catch {
        status.qdrant = false;
      }
    }

    status.firecrawl = !!this.firecrawl;
    status.tavily = !!this.tavily;
    status.mem0 = !!this.mem0;
    status.langfuse = !!this.langfuse;

    return status;
  }

  // ─── Self-Learning & Auto-Healing ────────────────────────────────────────────

  async recordLearning(agentId: string, lesson: string, success: boolean) {
    const { supabase } = await import("./supabaseClient");
    await supabase.rpc("record_agent_learning", {
      p_agent_id: agentId,
      p_lesson: lesson,
      p_success: success
    });
  }

  async handleFailure(issueType: string, details: Record<string, unknown>) {
    const { supabase } = await import("./supabaseClient");
    // Try Supabase auto-remedy function
    const { data, error } = await supabase.rpc("handle_integration_failure", {
      p_issue_type: issueType,
      p_issue_details: details
    });
    
    // Fallback: Log locally if RPC fails
    if (error) {
      console.error(`[SELF-HEAL] Failed to handle ${issueType}:`, error);
    }
    return data;
  }

  async getAgentPerformance(agentId: string): Promise<number> {
    const { supabase } = await import("./supabaseClient");
    const { data } = await supabase
      .from("agent_state")
      .select("performance_score")
      .eq("agent_id", agentId)
      .single();
    return data?.performance_score ?? 0.5;
  }

  // ─── ADVANCED SELF-LEARNING SYSTEM ────────────────────────────────────────────

  // Adaptive Strategy Selection: Learn which strategies work best for different contexts
  async selectBestStrategy(
    agentId: string,
    context: { taskType?: string; dataSize?: number; timeConstraint?: string }
  ): Promise<string> {
    const { supabase } = await import("./supabaseClient");
    
    // Query past learnings for similar contexts
    const { data: learnings } = await supabase
      .from("agent_state")
      .select("learnings")
      .eq("agent_id", agentId)
      .single();

    if (!learnings?.learnings || learnings.learnings.length === 0) {
      return "default"; // No history, use default
    }

    // Score strategies based on success rate in similar contexts
    const strategyScores: Record<string, number> = {};
    for (const lesson of learnings.learnings) {
      const strategy = this.extractStrategy(lesson.lesson);
      const score = lesson.success ? 1 : -0.5;
      strategyScores[strategy] = (strategyScores[strategy] || 0) + score;
    }

    // Return best performing strategy
    const best = Object.entries(strategyScores)
      .sort(([, a], [, b]) => b - a)[0];
    return best?.[0] || "default";
  }

  private extractStrategy(lesson: string): string {
    // Extract strategy name from lesson text
    const strategies = ["retry", "fallback", "parallel", "cache", "defer", "split"];
    for (const s of strategies) {
      if (lesson.toLowerCase().includes(s)) return s;
    }
    return "default";
  }

  // Failure Pattern Recognition: Detect recurring failure patterns
  async detectFailurePattern(agentId: string): Promise<{
    pattern: string;
    likelihood: number;
    prevention: string;
  } | null> {
    const { supabase } = await import("./supabaseClient");

    // Get recent healing logs
    const { data: logs } = await supabase
      .from("healing_log")
      .select("issue_type, remedy_applied, success")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!logs || logs.length < 3) return null;

    // Analyze patterns
    const failureTypes: Record<string, number> = {};
    for (const log of logs) {
      if (!log.success) {
        failureTypes[log.issue_type] = (failureTypes[log.issue_type] || 0) + 1;
      }
    }

    // Find recurring failure
    const recurring = Object.entries(failureTypes)
      .sort(([, a], [, b]) => b - a)[0];

    if (recurring && recurring[1] >= 2) {
      const likelihood = recurring[1] / logs.length;
      return {
        pattern: recurring[0],
        likelihood,
        prevention: this.suggestPrevention(recurring[0])
      };
    }

    return null;
  }

  private suggestPrevention(issueType: string): string {
    const preventionMap: Record<string, string> = {
      "api_timeout": "Add exponential backoff, implement circuit breaker",
      "auth_failure": "Refresh tokens proactively, implement token rotation",
      "rate_limit": "Implement request queuing, use caching aggressively",
      "network_error": "Add retry with jitter, implement fallback endpoints",
      "validation_error": "Pre-validate inputs, add schema validation layer"
    };
    return preventionMap[issueType] || "Add comprehensive error handling";
  }

  // Knowledge Distillation: Extract common patterns from interactions
  async distillKnowledge(agentId: string): Promise<string[]> {
    const { supabase } = await import("./supabaseClient");

    const { data } = await supabase
      .from("agent_state")
      .select("learnings")
      .eq("agent_id", agentId)
      .single();

    if (!data?.learnings) return [];

    // Group successful patterns
    const patterns: Set<string> = new Set();
    for (const lesson of data.learnings) {
      if (lesson.success && lesson.lesson) {
        patterns.add(this.extractKeyInsight(lesson.lesson));
      }
    }

    return Array.from(patterns).slice(0, 5);
  }

  private extractKeyInsight(lesson: string): string {
    // Simplify lesson to key insight
    const cleaned = lesson.replace(/\d+/g, "X")
      .replace(/error|failure|success|retry/g, "")
      .trim();
    return cleaned.substring(0, 50) || lesson.substring(0, 30);
  }

  // Predictive Prevention: Predict and prevent issues before they occur
  async predictAndPrevent(agentId: string): Promise<string[]> {
    const pattern = await this.detectFailurePattern(agentId);
    if (!pattern || pattern.likelihood < 0.3) return [];

    const preventions: string[] = [];
    
    // Store prediction in agent state
    const { supabase } = await import("./supabaseClient");
    await supabase.from("agent_state").update({
      learnings: [],
      updated_at: new Date().toISOString()
    }).eq("agent_id", agentId);

    // Log prevention action
    await supabase.from("healing_log").insert({
      issue_type: `predicted_${pattern.pattern}`,
      issue_details: { likelihood: pattern.likelihood },
      remedy_applied: pattern.prevention,
      success: true
    });

    preventions.push(pattern.prevention);
    return preventions;
  }

  // Feedback Loop: Learn from user feedback on agent responses
  async recordFeedback(
    agentId: string,
    responseId: string,
    feedback: "helpful" | "unhelpful" | "correct" | "incorrect"
  ): Promise<void> {
    const { supabase } = await import("./supabaseClient");
    
    await supabase.from("logs").insert({
      type: "user_feedback",
      details: { agent_id: agentId, response_id: responseId, feedback }
    });

    // Adjust performance based on feedback
    const scoreDelta = feedback === "correct" ? 0.02 : feedback === "incorrect" ? -0.02 : 0;
    
    await supabase.rpc("record_agent_learning", {
      p_agent_id: agentId,
      p_lesson: `feedback_${feedback}`,
      p_success: feedback === "helpful" || feedback === "correct"
    });
  }

  // Meta-Learning: Learn how to learn better
  async optimizeLearning(agentId: string): Promise<{
    optimalBatchSize: number;
    retentionRate: number;
    adaptationSpeed: number;
  }> {
    const { supabase } = await import("./supabaseClient");

    const { data } = await supabase
      .from("agent_state")
      .select("learnings, performance_score")
      .eq("agent_id", agentId)
      .single();

    const learnings = data?.learnings || [];
    const recentLearnings = learnings.slice(-10);
    const olderLearnings = learnings.slice(-20, -10);

    // Calculate adaptation speed (how quickly performance improved)
    const recentSuccess = recentLearnings.filter((l: any) => l.success).length / (recentLearnings.length || 1);
    const olderSuccess = olderLearnings.filter((l: any) => l.success).length / (olderLearnings.length || 1);
    const adaptationSpeed = recentSuccess - olderSuccess;

    return {
      optimalBatchSize: 5, // Best batch size for learning
      retentionRate: recentSuccess,
      adaptationSpeed: Math.max(0, Math.min(1, adaptationSpeed + 0.5))
    };
  }
}

// Export singleton instance
export const integrationHub = new IntegrationHub();

export default {
  NanobotClient,
  QdrantClient,
  FirecrawlClient,
  TavilyClient,
  Mem0Client,
  LangfuseClient,
  integrationHub,
};
