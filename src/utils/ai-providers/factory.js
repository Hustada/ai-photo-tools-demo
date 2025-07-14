"use strict";
// © 2025 Mark Hustad — MIT License
// AI Provider Factory
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiProviderFactory = exports.AIProviderFactoryImpl = void 0;
const openai_provider_js_1 = require("./openai-provider.js");
const gemini_provider_js_1 = require("./gemini-provider.js");
class AIProviderFactoryImpl {
    create(type, config) {
        switch (type) {
            case 'openai':
                return new openai_provider_js_1.OpenAIProvider(config);
            case 'gemini':
                return new gemini_provider_js_1.GeminiProvider(config);
            default:
                throw new Error(`Unsupported AI provider type: ${type}`);
        }
    }
}
exports.AIProviderFactoryImpl = AIProviderFactoryImpl;
// Singleton instance
exports.aiProviderFactory = new AIProviderFactoryImpl();
