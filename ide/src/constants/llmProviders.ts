import type { LLMProvider } from "../stores/useAIStore";

export interface LLMProviderInfo {
	id: LLMProvider;
	name: string;
	envKey: string;
	defaultModel: string;
	models: string[];
}

export const LLM_PROVIDERS: LLMProviderInfo[] = [
	{
		id: "gemini",
		name: "Gemini",
		envKey: "GEMINI_API_KEY",
		defaultModel: "gemini-2.0-flash",
		models: [
			"gemini-2.0-flash",
			"gemini-2.0-flash-exp",
			"gemini-1.5-pro",
			"gemini-1.5-flash",
		],
	},
	{
		id: "openai",
		name: "OpenAI",
		envKey: "OPENAI_API_KEY",
		defaultModel: "gpt-4o",
		models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview", "o1-mini"],
	},
	{
		id: "deepseek",
		name: "DeepSeek",
		envKey: "DEEPSEEK_API_KEY",
		defaultModel: "deepseek-chat",
		models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
	},
	{
		id: "openrouter",
		name: "OpenRouter",
		envKey: "OPENROUTER_API_KEY",
		defaultModel: "anthropic/claude-3.5-sonnet",
		models: [
			"anthropic/claude-3.5-sonnet",
			"anthropic/claude-3-opus",
			"openai/gpt-4o",
			"meta-llama/llama-3.1-405b-instruct",
		],
	},
	{
		id: "local",
		name: "Local (Ollama)",
		envKey: "OLLAMA_HOST",
		defaultModel: "llama3.2",
		models: [
			"llama3.2",
			"llama3.1",
			"codellama",
			"qwen2.5-coder",
			"deepseek-coder-v2",
		],
	},
];

export function getProviderInfo(id: LLMProvider): LLMProviderInfo {
	return LLM_PROVIDERS.find((p) => p.id === id) ?? LLM_PROVIDERS[0];
}

export function getModelsForProvider(id: LLMProvider): string[] {
	return getProviderInfo(id).models;
}
