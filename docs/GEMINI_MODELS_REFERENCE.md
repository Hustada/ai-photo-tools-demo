# Gemini Models Reference Guide
*Last Updated: July 6, 2025*

## Quick Reference

### API Configuration
- **Base URL**: `https://generativelanguage.googleapis.com/v1beta/models/`
- **Header Format**: `x-goog-api-key: YOUR_API_KEY`
- **Working API Key**: `AIzaSyD0SxOMgNZqReInejSb_QhX_zIAz4WaTFU`

### Example CURL Command
```bash
curl -H 'Content-Type: application/json' \
     -H 'x-goog-api-key: AIzaSyD0SxOMgNZqReInejSb_QhX_zIAz4WaTFU' \
     -X POST \
     -d '{"contents": [{"parts":[{"text": "Your prompt here"}]}]}' \
     'https://generativelanguage.googleapis.com/v1beta/models/MODEL_CODE:generateContent'
```

## Gemini 2.5 Models

### Gemini 2.5 Pro
- **Model Code**: `gemini-2.5-pro`
- **Description**: State-of-the-art thinking model with maximum response accuracy
- **Best For**: Complex reasoning, analysis, and tasks requiring highest accuracy
- **Capabilities**:
  - Multimodal input: audio, images, video, text, PDF
  - Text output
  - Advanced reasoning with internal thinking process
- **Token Limits**:
  - Input: 1,048,576 tokens
  - Output: 65,536 tokens
- **Knowledge Cutoff**: January 2025
- **Latest Update**: June 2025

### Gemini 2.5 Flash
- **Model Code**: `gemini-2.5-flash`
- **Description**: Best price-performance ratio
- **Best For**: General purpose tasks, balance of speed and quality
- **Capabilities**:
  - Multimodal input: audio, images, video, text
  - Text output
  - Adaptive thinking for efficient processing
- **Token Limits**:
  - Input: 1,048,576 tokens
  - Output: 65,536 tokens
- **Knowledge Cutoff**: January 2025
- **Latest Update**: June 2025

### Gemini 2.5 Flash-Lite (Preview)
- **Model Code**: `gemini-2.5-flash-lite-preview-06-17`
- **Description**: Optimized for cost efficiency and low latency
- **Best For**: High-volume, latency-sensitive applications
- **Capabilities**:
  - Multimodal input: text, images, video, audio
  - Text output
  - High throughput processing
- **Token Limits**:
  - Input: 1,000,000 tokens
  - Output: 64,000 tokens
- **Knowledge Cutoff**: January 2025
- **Latest Update**: June 2025

## Gemini 2.0 Models

### Gemini 2.0 Flash Experimental
- **Model Code**: `gemini-2.0-flash-exp`
- **Description**: Experimental version of Gemini 2.0 Flash
- **Status**: Available and working

## Other Models

### Image Generation
- **Imagen 4**: Advanced image generation model

### Video Generation
- **Veo 2**: Video generation capabilities

### Embedding Models
- Various models for text and multimodal embeddings

## Key Features Across Gemini 2.5

1. **Thinking Mode**: All 2.5 models support internal reasoning/thinking by default
2. **Multimodal**: Consistent support for text, images, video, and audio inputs
3. **Large Context**: 1M+ token context windows for extensive document processing
4. **Performance Tiers**: Pro (accuracy), Flash (balanced), Flash-Lite (speed/cost)

## Usage Tips

1. **Model Selection**:
   - Use `gemini-2.5-pro` for complex reasoning tasks
   - Use `gemini-2.5-flash` for general-purpose applications
   - Use `gemini-2.5-flash-lite-preview-06-17` for high-volume, cost-sensitive tasks

2. **API Authentication**:
   - Always use the `x-goog-api-key` header format
   - URL parameter authentication (`?key=`) may not work reliably

3. **Response Structure**:
   - Look for `thoughtsTokenCount` in usage metadata for thinking models
   - Check `finishReason` to ensure complete responses

## Environment Variable Setup
```bash
export GEMINI_API_KEY="AIzaSyD0SxOMgNZqReInejSb_QhX_zIAz4WaTFU"
```

## Testing Commands

### Test Gemini 2.5 Pro
```bash
curl -H 'Content-Type: application/json' \
     -H 'x-goog-api-key: AIzaSyD0SxOMgNZqReInejSb_QhX_zIAz4WaTFU' \
     -X POST \
     -d '{"contents": [{"parts":[{"text": "Say hello"}]}]}' \
     'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent'
```

### Test Gemini 2.5 Flash
```bash
curl -H 'Content-Type: application/json' \
     -H 'x-goog-api-key: AIzaSyD0SxOMgNZqReInejSb_QhX_zIAz4WaTFU' \
     -X POST \
     -d '{"contents": [{"parts":[{"text": "Say hello"}]}]}' \
     'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
```

### List Available Models
```bash
curl -H 'x-goog-api-key: AIzaSyD0SxOMgNZqReInejSb_QhX_zIAz4WaTFU' \
     'https://generativelanguage.googleapis.com/v1beta/models'
```