import { callGemini } from "../services/gemini.js";
import { safeParse } from "../services/parser.js";

/**
 * Builds the Sentiment & Next Action Analysis Prompt
 */
function buildAnalysisPrompt(replyText) {
  return `
You are an AI recruiter response analyzer.
Analyze the following email response received from a recruiter / hiring manager:

EMAIL REPLY:
"""
${replyText}
"""

STRICT RULES:
- Classify the intent into exactly one of: "positive", "negative", "neutral"
- Recommend a next action from exactly one of: "schedule_call", "follow_up", "ignore"
- State your confidence as a decimal number between 0.00 and 1.00
- Output ONLY valid JSON
- No markdown formatting (no \`\`\`json)
- No explanation text

OUTPUT FORMAT:
{
  "intent": "positive | negative | neutral",
  "next_action": "schedule_call | follow_up | ignore",
  "confidence": 0.85
}
`;
}

/**
 * Express Route Handler: POST /api/analyze-reply
 */
export default async function handler(req, res) {
  try {
    const { replyText, geminiKeyOverride } = req.body;

    if (!replyText) {
      return res.status(400).json({ error: "Reply text is required." });
    }

    const promptText = buildAnalysisPrompt(replyText);
    const raw = await callGemini(promptText, geminiKeyOverride);
    const parsed = safeParse(raw);

    if (!parsed || !parsed.intent || !parsed.next_action) {
      throw new Error("Invalid reply analysis structured JSON from AI.");
    }

    res.json(parsed);
  } catch (err) {
    console.error("Error in analyze-reply route:", err);
    res.status(500).json({ error: err.message || "Reply analysis failed." });
  }
}
