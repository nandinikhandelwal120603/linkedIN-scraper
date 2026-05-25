/**
 * Cleans markdown code blocks (like ```json ... ```) and extra characters from the text
 * @param {string} text - Raw output string from LLM
 * @returns {string} - Cleaned JSON string
 */
export function cleanJSON(text) {
  if (!text) return '';
  
  // Remove markdown JSON formatting blocks if present
  let cleaned = text.replace(/```json/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  
  // Find the first index of { or [ and the last index of } or ]
  const startIdxArray = cleaned.indexOf('[');
  const startIdxObj = cleaned.indexOf('{');
  
  let startIdx = -1;
  let endIdx = -1;
  
  if (startIdxArray !== -1 && (startIdxObj === -1 || startIdxArray < startIdxObj)) {
    startIdx = startIdxArray;
    endIdx = cleaned.lastIndexOf(']');
  } else if (startIdxObj !== -1) {
    startIdx = startIdxObj;
    endIdx = cleaned.lastIndexOf('}');
  }
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }
  
  return cleaned.trim();
}
