import { retrieve, createRAGPrompt } from '../services/langchain/rag';
import type { DashboardData, RepoTrend, NewsItem, PredictionData, VideoItem } from '../types';
import { logger } from '../lib/logger';
import { DashboardDataSchema } from '../lib/schemas';
import { callGeminiProxy } from './apiClient';
import { searchTrendingRepos } from './githubService';

// ─── Constants ──────────────────────────────────────────────────────────────
const MODEL = "gemini-2.0-flash";
const CACHE_TTL_MARKET = 5 * 60 * 1000;
const CACHE_TTL_REPOS = 60 * 60 * 1000;

let _isUsingMockData = false;
export function isUsingMockData(): boolean {
  return _isUsingMockData;
}

// ─── Cache ───────────────────────────────────────────────────────────────────
interface CacheEntry<T> { data: T; ts: number; }
const cache: Map<string, CacheEntry<unknown>> = new Map();

function getCache<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return null;
}
function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
const mockMarketData = {
  growthRate: 23.5,
  activeDevelopers: 12847,
  totalModels: 342,
  sentimentScore: 0.78,
  predictions: [
    { category: "Multi-modal models", currentValue: 342, predictedValue: 520, growth: 52, impact: "High" },
    { category: "Edge deployment", currentValue: 128, predictedValue: 210, growth: 64, impact: "Medium" },
  ],
  growthHistory: [
    { month: "Jan", value: 45 }, { month: "Feb", value: 52 }, { month: "Mar", value: 61 },
    { month: "Apr", value: 58 }, { month: "May", value: 73 }, { month: "Jun", value: 85 },
  ],
  signals: [
    { type: "trend", source: "GitHub Trending", message: "Agent frameworks +45% this week" },
    { type: "breakthrough", source: "ArXiv", message: "New reasoning model achieves SOTA" },
  ],
  synergyInsights: [
    "LangChain + Temporal = powerful agent orchestration",
    "Browser automation + RAG = context-aware testing",
  ],
};

const mockRepoData = {
  repos: [
    { name: "anthropic/claude-code", stars: 15420, forks: 1240, growth: 12.5, tags: ["ai", "agents"], stack: "TypeScript + Python", utility: "Developer Tools", buildType: "CLI + SDK", aiAnalysis: "Next-gen AI coding assistant with autonomous agent capabilities. Strong adoption in enterprise." },
    { name: "openai/swarm", stars: 8930, forks: 650, growth: 28.3, tags: ["agents", "multi-agent"], stack: "Python", utility: "Agent Framework", buildType: "Library", aiAnalysis: "Multi-agent orchestration framework. Excellent for coordinating multiple specialized agents." },
    { name: "anthropic/claude-python", stars: 12400, forks: 980, growth: 18.7, tags: ["python", "sdk"], stack: "Python + Rust", utility: "SDK", buildType: "Library", aiAnalysis: "Python SDK for Claude. Growing rapidly among data science teams." },
    { name: "microsoft/guidance", stars: 7890, forks: 420, growth: 8.2, tags: ["llm", "control"], stack: "Python", utility: "Prompt Engineering", buildType: "Library", aiAnalysis: "Structured output generation for LLMs. Great for constrained generation tasks." },
    { name: "anthropic/anthropic-sdk-js", stars: 21500, forks: 1890, growth: 15.3, tags: ["sdk", "typescript"], stack: "TypeScript", utility: "SDK", buildType: "Library", aiAnalysis: "Official JS SDK. Very well maintained with excellent TypeScript support." },
    { name: "deepseek-ai/deepseek-chat", stars: 9870, forks: 730, growth: 45.2, tags: ["api", "open-source"], stack: "Python", utility: "API Client", buildType: "API Service", aiAnalysis: "Open API alternative to OpenAI. Impressive performance at lower cost." },
    { name: "langchain-ai/langchain", stars: 102400, forks: 16200, growth: 9.8, tags: ["llm", "framework"], stack: "Python + TypeScript", utility: "Framework", buildType: "Library", aiAnalysis: "The most popular LLM application framework. Powers thousands of production AI applications." },
    { name: "langchain-ai/langgraph", stars: 12500, forks: 1850, growth: 35.6, tags: ["agents", "graph"], stack: "Python + TypeScript", utility: "Agent Framework", buildType: "Library", aiAnalysis: "Stateful agent orchestration built on LangChain. Graph-based execution model for complex agent workflows." },
    { name: "microsoft/autogen", stars: 38200, forks: 5200, growth: 22.1, tags: ["agents", "multi-agent"], stack: "Python", utility: "Agent Framework", buildType: "Framework", aiAnalysis: "Microsoft's multi-agent conversation framework. Enables complex agent teams with code generation." },
    { name: "crewai/crewai", stars: 28500, forks: 3600, growth: 41.3, tags: ["agents", "orchestration"], stack: "Python", utility: "Agent Framework", buildType: "Framework", aiAnalysis: "Multi-agent orchestration platform. Crews of AI agents collaborate on complex tasks." },
    { name: "meta-llama/llama-models", stars: 42500, forks: 6400, growth: 18.5, tags: ["llm", "open-source"], stack: "Python", utility: "Model SDK", buildType: "SDK", aiAnalysis: "Meta's open-source LLM family. Industry standard for self-hosted AI models." },
    { name: "ollama/ollama", stars: 132000, forks: 10800, growth: 32.4, tags: ["llm", "local"], stack: "Go", utility: "Developer Tools", buildType: "CLI + SDK", aiAnalysis: "Local LLM runner. Run any open-source model on your machine with a simple CLI." },
    { name: "comfyanonymous/ComfyUI", stars: 68200, forks: 7200, growth: 25.7, tags: ["ai", "image"], stack: "Python", utility: "Platform", buildType: "Application", aiAnalysis: "Powerful diffusion model UI. Node-based workflow for AI image generation." },
    { name: "run-llama/llama_index", stars: 39400, forks: 5200, growth: 14.2, tags: ["rag", "data"], stack: "Python", utility: "Framework", buildType: "Library", aiAnalysis: "Data framework for LLM applications. Best-in-class RAG and data ingestion." },
    { name: "chatchat-space/Langchain-Chatchat", stars: 33500, forks: 5600, growth: 11.8, tags: ["rag", "chinese"], stack: "Python", utility: "Platform", buildType: "Application", aiAnalysis: "Knowledge base QA platform. Combines LangChain with local LLM inference." },
    { name: "danny-avila/LibreChat", stars: 21400, forks: 3800, growth: 19.4, tags: ["chat", "multi-model"], stack: "TypeScript + React", utility: "Platform", buildType: "Application", aiAnalysis: "Open-source ChatGPT alternative. Supports multiple AI providers in one UI." },
    { name: "n8n-io/n8n", stars: 56500, forks: 9200, growth: 23.1, tags: ["automation", "workflow"], stack: "TypeScript", utility: "Developer Tools", buildType: "Application", aiAnalysis: "Technical workflow automation. Fair-code alternative to Zapier with AI integrations." },
    { name: "neovim/neovim", stars: 87500, forks: 6200, growth: 7.2, tags: ["editor", "vim"], stack: "C + Lua", utility: "Developer Tools", buildType: "CLI + SDK", aiAnalysis: "Modern Vim fork. Extensible editor with thriving plugin ecosystem." },
    { name: "tabby/tabby", stars: 24600, forks: 1100, growth: 31.5, tags: ["coding", "ai"], stack: "Rust + TypeScript", utility: "Developer Tools", buildType: "Application", aiAnalysis: "Self-hosted AI coding assistant. Open-source alternative to GitHub Copilot." },
    { name: "continuedev/continue", stars: 24800, forks: 2100, growth: 27.8, tags: ["coding", "ide"], stack: "TypeScript", utility: "Developer Tools", buildType: "Application", aiAnalysis: "Open-source AI code assistant. Integrates with VS Code and JetBrains IDEs." },
    { name: "openai/openai-cookbook", stars: 62500, forks: 9900, growth: 8.5, tags: ["examples", "tutorials"], stack: "Python", utility: "Learning", buildType: "Library", aiAnalysis: "Official OpenAI API examples and guides. Essential reference for LLM application development." },
    { name: "pytorch/pytorch", stars: 87500, forks: 22100, growth: 6.8, tags: ["ml", "framework"], stack: "Python + C++", utility: "Framework", buildType: "Library", aiAnalysis: "Industry standard deep learning framework. Powers most AI research and production systems." },
    { name: "ggerganov/llama.cpp", stars: 78500, forks: 11300, growth: 15.3, tags: ["llm", "cpp"], stack: "C++", utility: "Developer Tools", buildType: "CLI + SDK", aiAnalysis: "CPU-optimized LLM inference. Made local AI possible for millions of developers." },
    { name: "mckaywrigley/chatbot-ui", stars: 30300, forks: 8400, growth: 12.1, tags: ["chat", "ui"], stack: "TypeScript + React", utility: "Platform", buildType: "Application", aiAnalysis: "Open-source ChatGPT UI clone. Clean interface with support for multiple AI models." },
  ] as RepoTrend[],
  trendingTools: [
    { name: "Bolt.new", description: "AI-powered full-stack coding", category: "ide", stars: 45200 },
    { name: "Cursor", description: "AI-first code editor", category: "editor", stars: 38900 },
    { name: "Devin", description: "Autonomous software engineer", category: "agent", stars: 28400 },
  ],
  openSourceStats: [
    { label: "Active Repos", value: 12847, change: 12.5 },
    { label: "New This Week", value: 342, change: 8.3 },
    { label: "Contributors", value: 8934, change: 15.7 },
  ],
  harvestSources: [
    { name: "ManuAGI", url: "https://manuagi.com", lastUpdate: new Date().toISOString() },
    { name: "GitHub Awesome", url: "https://github.com/sindresorhus/awesome", lastUpdate: new Date().toISOString() },
  ],
};

const mockNewsAndVideos = {
  news: [
    { title: "OpenAI Announces GPT-5", source: "OpenAI Blog", timestamp: new Date().toISOString(), url: "https://openai.com" },
    { title: "Anthropic Releases Claude 4", source: "Anthropic", timestamp: new Date().toISOString(), url: "https://anthropic.com" },
    { title: "DeepSeek R1 Sets New Benchmark", source: "DeepSeek", timestamp: new Date().toISOString(), url: "https://deepseek.com" },
    { title: "Meta Releases Llama 4", source: "Meta AI", timestamp: new Date().toISOString(), url: "https://ai.meta.com" },
    { title: "Google Gemini 2.5 Pro Goes GA", source: "Google AI", timestamp: new Date().toISOString(), url: "https://ai.google" },
  ],
  videos: generateAIVideoCards(),
};

function generateAIVideoCards(): VideoItem[] {
  const now = Date.now();
  const seed = Math.floor(now / 300000);
  const bases = [
    { title: "Nexus Alpha", channel: "AI Pipeline", views: 142000 },
    { title: "Build with AI Agents", channel: "VibeCoding", views: 89000 },
    { title: "Full-Stack Pipeline", channel: "DevOps AI", views: 234000 },
    { title: "MCP Integration", channel: "Agent Protocol", views: 67000 },
    { title: "Self-Learning Systems", channel: "AI Engineering", views: 198000 },
    { title: "Zero to Deploy", channel: "BuildFast", views: 312000 },
    { title: "Graphify Explained", channel: "CodeGraph", views: 45000 },
    { title: "TOON Token Savings", channel: "Cost Optimize", views: 56000 },
    { title: "Biome vs ESLint", channel: "ToolBench", views: 78000 },
    { title: "Temporal Workflows", channel: "Durable Code", views: 89000 },
    { title: "Qdrant Vector Search", channel: "VectorDB", views: 123000 },
    { title: "Playwright E2E", channel: "TestAutomation", views: 167000 },
  ];

  const videos: VideoItem[] = [];
  for (let i = 0; i < 24; i++) {
    const base = bases[(seed + i) % bases.length];
    const noiseId = (seed * 31 + i * 7) % 1000;
    const viewNoise = Math.floor((seed * 137 + i * 73) % 50000);
    const thumbVariants = ['maxresdefault', 'hqdefault', 'sddefault', 'mqdefault', 'default'];

    videos.push({
      id: `ai-gen-${noiseId}-${i}`,
      title: `${base.title}: Part ${(i % 5) + 1} \u2014 ${new Date(now + i * 86400000).toLocaleDateString('en-US', {month:'short', day:'numeric'})}`,
      url: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
      thumbnail: `https://img.youtube.com/vi/dQw4w9WgXcQ/${thumbVariants[i % thumbVariants.length]}.jpg`,
      channel: base.channel,
      views: String(base.views + viewNoise),
    });
  }
  return videos;
}

// ─── Fallback Responses ───────────────────────────────────────────────────────
const fallbackResponses: Record<string, (query: string, docs: { content: string }[]) => string> = {
  coding: (query, docs) => {
    if (docs.length === 0) {
      return `I don't have specific documents about "${query}" in my knowledge base yet.\n\nFor coding help, I can help with:\n- React hooks (useState, useEffect)\n- TypeScript interfaces\n- API integrations`;
    }
    const context = docs.map(d => `- ${d.content}`).join('\n');
    return `Based on my knowledge base:\n\n${context}\n\nThis relates to your question about "${query}".`;
  },
  research: (query, docs) => {
    if (docs.length === 0) {
      return `I don't have specific information about "${query}" yet.\n\nI can help with research on:\n- AI tools and trends\n- GitHub repositories\n- Market intelligence`;
    }
    const context = docs.map(d => `- ${d.content}`).join('\n');
    return `Here's what I found:\n\n${context}`;
  },
  analysis: (query, docs) => {
    if (docs.length === 0) {
      return `I don't have analysis data for "${query}" yet.\n\nI track:\n- Repository trends\n- Market signals\n- Agent performance`;
    }
    const context = docs.map(d => `- ${d.content}`).join('\n');
    return `Analysis based on available data:\n\n${context}`;
  },
  general: (query, _docs) => {
    const q = query.toLowerCase();
    if (q.includes('hello') || q.includes('hi')) {
      return "Hello! I'm Nexus Alpha, your AI developer assistant.";
    }
    if (q.includes('who are you') || q.includes('what are you')) {
      return "I'm Nexus Alpha - an AI-powered assistant that combines Temporal, LangGraph, and LangChain.";
    }
    if (q.includes('help')) {
      return "I can help with research, coding, and analysis. Just ask!";
    }
    return "That's interesting! What would you like help with?";
  },
};

export async function callGeminiWithFallback<T>(prompt: string, intent: string = 'general'): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Try server-side proxy first (hides API key from browser)
  if (typeof window !== 'undefined') {
    try {
      const text = await callGeminiProxy(prompt);
      _isUsingMockData = false;
      try {
        return JSON.parse(text) as unknown as T;
      } catch (parseErr) {
        logger.error('geminiService', 'Failed to parse JSON from proxy', parseErr);
        throw new Error('Invalid JSON response from AI proxy');
      }
    } catch (e) {
      logger.warn('geminiService', 'Server proxy failed, falling back', e);
    }
  }
  
  if (!apiKey) {
    _isUsingMockData = true;
    if (intent === 'market' || prompt.toLowerCase().includes('market')) {
      return mockMarketData as unknown as T;
    }
    if (intent === 'repos' || prompt.toLowerCase().includes('repo')) {
      return mockRepoData as unknown as T;
    }
    if (intent === 'news' || prompt.toLowerCase().includes('video') || prompt.toLowerCase().includes('news')) {
      return mockNewsAndVideos as unknown as T;
    }
    const docs = intent !== 'general' ? await retrieve(intent, 3) : [];
    const fallbackFn = fallbackResponses[intent] || fallbackResponses.general;
    return fallbackFn(prompt, docs as { content: string }[]) as unknown as T;
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    _isUsingMockData = false;
    return result.text as unknown as T;
  } catch (e) {
    _isUsingMockData = true;
    logger.warn('geminiService', 'Gemini API error, using mock fallback', e);
    if (intent === 'market' || prompt.toLowerCase().includes('market')) {
      return mockMarketData as unknown as T;
    }
    if (intent === 'repos' || prompt.toLowerCase().includes('repo')) {
      return mockRepoData as unknown as T;
    }
    if (intent === 'news' || prompt.toLowerCase().includes('video') || prompt.toLowerCase().includes('news')) {
      return mockNewsAndVideos as unknown as T;
    }
    const docs = await retrieve(intent, 3);
    const fallbackFn = fallbackResponses[intent] || fallbackResponses.general;
    return fallbackFn(prompt, docs as { content: string }[]) as unknown as T;
  }
}

export async function callGemini<T>(prompt: string, retries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await callGeminiWithFallback<T>(prompt);
    } catch (err) {
      lastError = err;
      logger.warn('geminiService', `Retry ${i + 1}/${retries} failed`, err);
    }
  }
  throw lastError || new Error('callGemini failed after all retries');
}

export async function callGeminiMultimodal(prompt: string, imageData: string, mimeType: string = "image/png"): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn('geminiService', 'No API key for multimodal, using fallback');
    return "Multimodal analysis requires a valid Gemini API key. [Mock: This looks like a UI design with a button and a list.]";
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  try {
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData,
          mimeType
        }
      }
    ]);
    return result.response.text();
  } catch (e) {
    logger.error('geminiService', 'Multimodal API error', e);
    return "Error processing image.";
  }
}

// ─── Parallel Sub-calls ───────────────────────────────────────────────────────

export async function fetchMarketData(): Promise<{
  growthRate: number; activeDevelopers: number; totalModels: number;
  sentimentScore: number; predictions: PredictionData[];
  growthHistory: { month: string; value: number }[];
  signals: { time: string; source: string; signal: string; value: string }[];
  synergyInsights: string[];
}> {
  const cacheKey = "market";
  const cached = getCache<ReturnType<typeof fetchMarketData>>(cacheKey, CACHE_TTL_MARKET);
  if (cached) return cached;

  const data = await callGeminiWithFallback<ReturnType<typeof fetchMarketData>>("Provide mock market data for dashboard");
  setCache(cacheKey, data);
  return data;
}

export async function fetchRepoData(): Promise<{
  repos: RepoTrend[]; trendingTools: { name: string; description: string; category: string; stars?: number }[];
  openSourceStats: { label: string; value: number; change: number }[];
  harvestSources: { name: string; url: string; lastUpdate: string }[];
}> {
  try {
    const trending = await searchTrendingRepos('stars:>1000', 7);
    if (trending && trending.length > 0) {
      const repos = trending.map(r => ({
        name: r.full_name,
        stars: r.stargazers_count,
        forks: r.forks_count,
        growth: Math.round(Math.random() * 20 + 5),
        tags: r.topics || [],
        stack: r.language || 'Unknown',
        utility: 'Developer Tools',
        buildType: 'Repository',
        aiAnalysis: r.description || ''
      }));

      return {
        repos,
        trendingTools: generateTrendingTools(repos as RepoTrend[]),
        openSourceStats: [
          { label: 'Active Repos', value: repos.length, change: 12 },
          { label: 'Total Stars', value: repos.reduce((s, r) => s + r.stars, 0), change: 5 },
          { label: 'Contributors', value: 8934, change: 15 },
        ],
        harvestSources: [
          { name: 'GitHub API', url: 'https://api.github.com', lastUpdate: new Date().toISOString() },
        ],
      };
    }
  } catch (err) {
    console.error('Failed to fetch GitHub trending', err);
  }

  // Try real-time GitHub trending data first (DeepSeek enriched)
  try {
    const res = await fetch('/api/data/repos', { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const data = await res.json() as { repos: RepoTrend[]; ts: number };
      return {
        repos: data.repos,
        trendingTools: generateTrendingTools(data.repos),
        openSourceStats: [
          { label: 'Active Repos', value: data.repos.length, change: Math.round(Math.random() * 20 + 5) },
          { label: 'Total Stars', value: data.repos.reduce((s, r) => s + r.stars, 0), change: Math.round(Math.random() * 15 + 10) },
          { label: 'Contributors', value: Math.floor(Math.random() * 5000 + 5000), change: Math.round(Math.random() * 10 + 8) },
        ],
        harvestSources: [
          { name: 'GitHub API', url: 'https://api.github.com', lastUpdate: new Date(data.ts).toISOString() },
          { name: 'DeepSeek AI', url: 'https://deepseek.com', lastUpdate: new Date().toISOString() },
        ],
      };
    }
  } catch { /* fall through */ }

  const cacheKey = "repos";
  const cached = getCache<ReturnType<typeof fetchRepoData>>(cacheKey, CACHE_TTL_REPOS);
  if (cached) return cached;

  const data = await callGeminiWithFallback<ReturnType<typeof fetchRepoData>>("Provide mock repo data");
  setCache(cacheKey, data);
  return data;
}

function generateTrendingTools(repos: RepoTrend[]): { name: string; description: string; category: string; stars?: number }[] {
  return repos.slice(0, 8).map(r => ({
    name: r.name.split('/').pop() || r.name,
    description: r.aiAnalysis.slice(0, 80) || r.description.slice(0, 80),
    category: r.buildType || 'tool',
    stars: r.stars,
  }));
}

export async function fetchNewsAndVideos(): Promise<{
  news: NewsItem[]; videos: { id: string; title: string; thumbnail: string; channel: string; views: string; url: string }[];
}> {
  let newsArticles: NewsItem[] = [];
  try {
    const apiKey = process.env.GNEWS_API_KEY || '560ecca5e9e47a2b02bd4e85159b75ad';
    const res = await fetch(`https://gnews.io/api/v4/top-headlines?category=technology&lang=en&apikey=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      if (data.articles) {
        newsArticles = data.articles.slice(0, 5).map((a: any) => ({
          id: Math.random().toString(36).slice(2, 9),
          title: a.title,
          source: a.source.name,
          timestamp: new Date(a.publishedAt).toLocaleDateString(),
          url: a.url,
          sentiment: 'neutral',
          summary: a.description
        }));
      }
    }
  } catch (err) {
    console.error('Failed to fetch from GNews', err);
  }

  if (newsArticles.length === 0) {
     newsArticles = mockNewsAndVideos.news;
  }

  // Try real-time YouTube data first
  try {
    const res = await fetch('/api/data/videos', { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json() as { videos: Array<{ id: string; title: string; thumbnail: string; channel: string; views: string; url: string; published: string }>; ts: number };
      return {
        news: newsArticles,
        videos: data.videos.slice(0, 30),
      };
    }
  } catch { /* fall through */ }

  return {
    news: newsArticles,
    videos: mockNewsAndVideos.videos,
  };
}

// ─── Main Export ──────────────────────────────────────────────────────

export async function fetchDashboardData(
  existingAgents: DashboardData["customAgents"],
  existingCLI: DashboardData["cliState"],
  signal?: AbortSignal
): Promise<DashboardData> {
  const [market, repos, newsVideos] = await Promise.all([
    fetchMarketData(),
    fetchRepoData(),
    fetchNewsAndVideos(),
  ]);

  // Count actual configured integration hub services
  let activeServers = 0;
  let connections = 0;
  try {
    const { integrationHub } = await import("./integrationService");
    const hubStatus = await integrationHub.getStatus();
    activeServers = Object.values(hubStatus).filter(Boolean).length;
    connections = activeServers;
  } catch { /* IntegrationHub unavailable in browser — OK */ }

  // Count wiki pages as build pipeline history
  let buildCount = 0;
  try {
    const { getWikiStats } = await import("./llmWikiService");
    buildCount = getWikiStats().pageCount;
  } catch { /* Wiki unavailable — OK */ }

  const dashboard: DashboardData = {
    growthRate: market.growthRate,
    activeDevelopers: market.activeDevelopers,
    totalModels: market.totalModels,
    sentimentScore: market.sentimentScore,
    predictions: market.predictions,
    growthHistory: market.growthHistory,
    signals: market.signals,
    synergyInsights: market.synergyInsights,
    repos: repos.repos,
    trendingTools: repos.trendingTools,
    openSourceStats: repos.openSourceStats,
    harvestSources: repos.harvestSources,
    news: newsVideos.news,
    videos: newsVideos.videos,
    buildPipeline: Array.from({ length: buildCount }, (_, i) => ({
      id: `build-${i + 1}`,
      phase: "Pipeline Run",
      status: "completed" as const,
      details: `Wiki-compiled knowledge page #${i + 1}`,
    })),
    customAgents: existingAgents,
    cliState: existingCLI,
    mcpStatus: { activeServers, connections, lastPing: new Date().toISOString(), protocol: "MCP/1.0" },
    isMock: isUsingMockData(),
  };

  return dashboard;
}

export async function analyzeRepoSynergy(repos: RepoTrend[]): Promise<string[]> {
  const names = repos.map(r => r.name).join(", ");
  return callGemini<string[]>(`Given ${names}, provide synergy suggestions`);
}

export const analyzeAIData = (signal?: AbortSignal) => fetchDashboardData([], { activeProvider: "opencode" as const, output: [] }, signal);
