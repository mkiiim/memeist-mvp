// debug.js
const { formatMarkdownCheckboxes } = require('./utils');

// Test case from our tests
const input = `
**Transcript Summary:** 
- Here's a sample summary point
- Another summary point

**To-Do List:**
- Task one that needs to be done
- Task two that needs to be done
`;

console.log("Input:\n", input);

// Debug how line detection works
const lines = input.split('\n');
lines.forEach((line, i) => {
  console.log(`Line ${i}: '${line}'`);
  console.log(`  starts with '- '? ${line.trim().startsWith('- ')}`);
  console.log(`  includes To-Do? ${line.includes('**To-Do List**')}`);
});

// Run the function
const output = formatMarkdownCheckboxes(input, 'openai');
console.log("\nOutput:\n", output);