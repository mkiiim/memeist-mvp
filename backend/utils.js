// utils.js - Extract utility functions to a separate file

/**
 * Count the number of checkbox patterns in a text.
 * Used to detect if markdown already contains properly formatted checkboxes.
 * 
 * @param {string} text - The text to analyze for checkbox patterns
 * @returns {number} Number of checkbox patterns found
 * 
 * @example
 * // Returns 2
 * countCheckboxes("- [ ] Task one\n- [ ] Task two");
 * 
 * // Returns 0
 * countCheckboxes("- Task one\n- Task two");
 */
function countCheckboxes(text) {
  return (text.match(/- \[ \]/g) || []).length;
}

/**
 * Format markdown text to ensure proper checkbox formatting in specific sections.
 * Converts bullet points to checkboxes in To-Do List and Follow-Ups sections.
 * Preserves existing checkboxes and other formatting.
 * 
 * @param {string} text - The markdown text to format
 * @param {string} modelUsed - Which AI model was used (affects formatting expectations)
 * @returns {string} Properly formatted markdown with checkboxes in appropriate sections
 * 
 * @example
 * // Converts bullet points to checkboxes in To-Do List section
 * formatMarkdownCheckboxes("**To-Do List:**\n- Task one\n- Task two", "openai");
 */
function formatMarkdownCheckboxes(text, modelUsed) {
  // Simpler approach: process line by line
  const lines = text.split("\n");
  let inTodoSection = false;
  let inFollowupSection = false;

  const processedLines = lines.map((line) => {
    // Check for section headers
    if (
      line.includes("**To-Do List**") ||
      line === "**To-Do List:**" ||
      line.trim() === "To-Do List:"
    ) {
      inTodoSection = true;
      inFollowupSection = false;
    } else if (
      line.includes("**Follow-Ups**") ||
      line === "**Follow-Ups:**" ||
      line.trim() === "Follow-Ups:"
    ) {
      inFollowupSection = true;
      inTodoSection = false;
    } else if (
      line.includes("**") &&
      !line.includes("**To-Do List**") &&
      !line.includes("**Follow-Ups**")
    ) {
      // Another section header
      inTodoSection = false;
      inFollowupSection = false;
    }

    // Convert bullet points to checkboxes in appropriate sections
    if (
      (inTodoSection || inFollowupSection) &&
      line.trim().startsWith("- ") &&
      !line.trim().startsWith("- [ ]")
    ) {
      return line.replace(/^(\s*)-\s+/, "$1- [ ] ");
    }

    return line;
  });

  return processedLines.join("\n");
}

/**
 * Main post-processing function for AI-generated insights.
 * Checks if insights already have properly formatted checkboxes,
 * and applies formatting if needed.
 * 
 * @param {string} insights - Raw insights from AI model
 * @param {string} modelUsed - Which AI model was used (e.g., "openai", "claude")
 * @returns {string} Properly formatted insights with checkboxes in appropriate sections
 * 
 * @example
 * // Process insights from OpenAI
 * const formattedInsights = postProcessInsights(rawInsights, "openai");
 */
function postProcessInsights(insights, modelUsed) {
  // Check if we already have properly formatted checkboxes
  const checkboxCount = countCheckboxes(insights);

  // If we have checkboxes, no need for further processing
  if (checkboxCount > 0) {
    return insights;
  }

  // Apply formatting to convert bullet points to checkboxes in specific sections
  const processedInsights = formatMarkdownCheckboxes(insights, modelUsed);

  return processedInsights;
}

// Export all functions so they can be imported and tested
module.exports = {
  countCheckboxes,
  formatMarkdownCheckboxes,
  postProcessInsights,
};