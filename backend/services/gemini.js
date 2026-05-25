import { logUsage } from "../utils/usageLogger.js";

/**
 * Interface with the Google Gemini API using native JSON output configuration
 * @param {string} prompt - Prompt string
 * @param {string} [apiKeyOverride] - Optional client override key
 * @param {string} [action] - Optional description of action (e.g. /api/generate)
 * @returns {Promise<string>} - LLM text output
 */
export async function callGemini(prompt, apiKeyOverride, action = 'Gemini Call') {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Add it to .env or the Settings tab.');
  }

  // Use gemini-1.5-flash which supports structured JSON response mime type.
  // Using gemini-pro (Gemini 1.0) with response_mime_type will throw a 400 error.
  const model = 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json' // Official camelCase parameter for Gemini REST API
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data.error?.message || `API error (${response.status})`;
    throw new Error(`Gemini API Call Failed: ${errMsg}`);
  }

  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Empty response received from Gemini.');
  }

  // Log usage stats
  const usage = data.usageMetadata || {};
  logUsage({
    action,
    model,
    promptTokens: usage.promptTokenCount || 0,
    completionTokens: usage.candidatesTokenCount || 0,
    serperQueries: action === '/api/generate' ? 1 : 0
  });

  return textOutput;
}

