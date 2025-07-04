// © 2025 Mark Hustad — MIT License
// AI Provider Factory

import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import type { AIProvider, AIProviderType, AIProviderConfig, AIProviderFactory } from './types.js';

export class AIProviderFactoryImpl implements AIProviderFactory {
  create(type: AIProviderType, config: AIProviderConfig): AIProvider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      default:
        throw new Error(`Unsupported AI provider type: ${type}`);
    }
  }
}

// Singleton instance
export const aiProviderFactory = new AIProviderFactoryImpl();