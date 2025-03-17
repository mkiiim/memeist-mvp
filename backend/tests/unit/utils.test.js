// tests/unit/utils.test.js
const { countCheckboxes, formatMarkdownCheckboxes, postProcessInsights } = require('../../utils');

describe('countCheckboxes', () => {
  test('counts checkboxes correctly in text', () => {
    const textWithCheckboxes = `
      **To-Do List:**
      - [ ] Task one
      - [ ] Task two
      - [ ] Task three
    `;
    
    expect(countCheckboxes(textWithCheckboxes)).toBe(3);
  });
  
  test('returns 0 when no checkboxes exist', () => {
    const textWithNoCheckboxes = `
      **To-Do List:**
      - Task one
      - Task two
    `;
    
    expect(countCheckboxes(textWithNoCheckboxes)).toBe(0);
  });
});

describe('formatMarkdownCheckboxes', () => {
  test('converts bullet points to checkboxes in To-Do List section', () => {
    const input = `
**Transcript Summary:** 
- Here's a sample summary point
- Another summary point

**To-Do List:**
- Task one that needs to be done
- Task two that needs to be done
    `;
    
    const output = formatMarkdownCheckboxes(input, 'openai');
    
    // Check if To-Do List items were converted to checkboxes
    expect(output).toContain('- [ ] Task one');
    expect(output).toContain('- [ ] Task two');
    
    // Make sure summary items weren't converted
    expect(output).not.toContain('- [ ] Here\'s a sample summary point');
  });
});

describe('postProcessInsights', () => {
  test('does nothing if checkboxes already exist', () => {
    const input = `
**To-Do List:**
- [ ] Task one
- [ ] Task two
    `;
    
    const output = postProcessInsights(input, 'openai');
    
    // Input and output should be the same
    expect(output).toBe(input);
  });
  
  test('formats text without checkboxes', () => {
    const input = `
**To-Do List:**
- Task one
- Task two
    `;
    
    const output = postProcessInsights(input, 'openai');
    
    // Check if checkboxes were added
    expect(output).toContain('- [ ] Task one');
    expect(output).toContain('- [ ] Task two');
  });
});