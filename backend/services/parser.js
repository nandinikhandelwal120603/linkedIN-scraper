import { cleanJSON } from "../utils/cleanJSON.js";

/**
 * Robust JSON parser with multiple levels of cleaning fallbacks
 * @param {string} text - Raw string output from LLM
 * @returns {any} - Parsed JSON object/array
 */
export function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    // Fallback 1: Simple regex replacement of markdown indicators
    const cleaned = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Fallback 2: Advanced index-based substring extraction
      try {
        const advancedCleaned = cleanJSON(text);
        return JSON.parse(advancedCleaned);
      } catch {
        throw new Error("Invalid AI JSON");
      }
    }
  }
}
