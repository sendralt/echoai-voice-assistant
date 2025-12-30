# Gemini 3 Flash Preview - API Endpoint Reference

**Date:** December 30, 2025

## API Endpoint

### Base URL
```
https://generativelanguage.googleapis.com/v1beta
```

### Generate Content Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent
```

## Authentication

The API key can be passed in two ways:

### 1. Query Parameter (Recommended for cURL/REST)
```
?key=YOUR_API_KEY
```

### 2. Header (Used by SDK)
```
x-goog-api-key: YOUR_API_KEY
```

## Example Requests

### cURL Example
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "contents": [{
      "parts": [{"text": "Hello, how are you?"}]
    }]
  }'
```

### PowerShell Example
```powershell
Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=YOUR_API_KEY" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

### JavaScript SDK Example (@google/genai)
```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "YOUR_API_KEY" });

const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: "Hello, how are you?",
});

console.log(response.text);
```

## Model Information

| Property | Value |
|----------|-------|
| Model ID | `gemini-3-flash-preview` |
| Context Window (Input) | 1M tokens |
| Context Window (Output) | 64k tokens |
| Knowledge Cutoff | January 2025 |
| Pricing (Input) | $0.50 per 1M tokens |
| Pricing (Output) | $3.00 per 1M tokens |
| Free Tier | ✅ Available |

## Available Endpoints

| Endpoint | Purpose |
|----------|---------|
| `:generateContent` | Standard text/multimodal generation |
| `:streamGenerateContent` | Streaming responses |
| `:countTokens` | Count tokens in a request |

### Streaming Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent
```

### Token Counting Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:countTokens
```

## Configuration Options

### Thinking Level (Gemini 3 Feature)
```json
{
  "generationConfig": {
    "thinkingConfig": {
      "thinkingLevel": "low"  // Options: "minimal", "low", "medium", "high"
    }
  }
}
```

### With Google Search Grounding
```json
{
  "contents": [{"parts": [{"text": "What's the weather today?"}]}],
  "tools": [{"googleSearch": {}}]
}
```

## API Version Notes

- **v1beta**: Current recommended version for Gemini 3 models
- **v1alpha**: Required for some advanced features like `mediaResolution`

## Related Models

| Model | Use Case |
|-------|----------|
| `gemini-3-flash-preview` | Fast, cost-effective responses |
| `gemini-3-pro-preview` | Complex reasoning (no free tier) |
| `gemini-3-pro-image-preview` | Image generation |

## Official Documentation

- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Get API Key](https://aistudio.google.com/apikey)

