// © 2025 Mark Hustad — MIT License
// Types and interfaces for AI provider abstraction

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIGenerationOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  name: string;
  generateContent(options: AIGenerationOptions): Promise<string>;
}

export type AIProviderType = 'openai' | 'gemini';

export interface AIProviderFactory {
  create(type: AIProviderType, config: AIProviderConfig): AIProvider;
}