import { ModelProvider, ModelRoutingDecision } from '../types/pipeline-extensions';

export interface ModelRouteConfig {
  phase: string;
  providerId: string;
}

export class ModelRouterService {
  private routes: ModelRouteConfig[] = [];
  private providers: ModelProvider[] = [
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', modelId: 'gemini-1.5-pro', enabled: true, priority: 1, maxComplexity: 10 },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', modelId: 'gemini-1.5-flash', enabled: true, priority: 2, maxComplexity: 5 },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', modelId: 'deepseek-coder', enabled: true, priority: 1, maxComplexity: 8 },
    { id: 'gpt-4o', name: 'GPT-4o', modelId: 'gpt-4o', enabled: true, priority: 2, maxComplexity: 9 },
  ];

  constructor(initialRoutes: ModelRouteConfig[] = []) {
    this.routes = initialRoutes;
  }

  getRoute(phase: string, complexity: number = 5): ModelRoutingDecision {
    const specificRoute = this.routes.find(r => r.phase === phase);
    
    if (specificRoute) {
      return {
        providerId: specificRoute.providerId,
        complexity,
        reasoning: `Explicit route configured for phase: ${phase}`
      };
    }

    // Dynamic routing based on complexity
    const suitableProviders = this.providers
      .filter(p => p.enabled && p.maxComplexity >= complexity)
      .sort((a, b) => a.priority - b.priority);

    const bestProvider = suitableProviders[0] || this.providers[0];

    return {
      providerId: bestProvider.id,
      complexity,
      reasoning: `Dynamic routing based on complexity (${complexity}). Best fit: ${bestProvider.name}`
    };
  }

  setRoutes(routes: ModelRouteConfig[]) {
    this.routes = routes;
  }
}

export const modelRouter = new ModelRouterService([
  { phase: 'RAG Context Sync', providerId: 'gemini-1.5-flash' },
  { phase: 'Build & Compile', providerId: 'deepseek-coder' },
  { phase: 'Security Audit', providerId: 'gemini-1.5-pro' },
]);
