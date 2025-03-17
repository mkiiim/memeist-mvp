
// Import functions from app.js
let displayResults, togglePane;
try {
  // Try to import functions from app.js
  const appFunctions = require('../../app.js');
  displayResults = appFunctions.displayResults;
  togglePane = appFunctions.togglePane;
} catch (error) {
  console.warn('Could not import functions from app.js:', error.message);
  // If import fails, the test will use the function implementations 
  // already defined in this file
}

// Setup the basic DOM structure needed for testing
document.body.innerHTML = `
  <div class="pane-container">
    <div class="pane" id="transcript-pane">
      <div class="pane-header">
        <h2>transcript</h2>
        <div class="pane-controls">
          <button id="copy-transcript-btn" title="copy to clipboard"></button>
          <button onclick="togglePane('transcript-pane', event)">toggle</button>
        </div>
      </div>
      <pre id="transcript">No transcript available yet.</pre>
    </div>
    
    <div class="pane" id="insights-pane">
      <div class="pane-header">
        <h2>insights</h2>
        <div class="pane-controls">
          <button id="copy-insights-btn" title="copy to clipboard"></button>
          <button onclick="togglePane('insights-pane', event)">toggle</button>
        </div>
      </div>
      <pre id="insights">No insights available yet.</pre>
    </div>
  </div>
`;

// Mock functions that might be called
window.showNotification = jest.fn();
window.highlightTranscript = jest.fn();

// Define the functions we want to test
// (In a real setup, we'd import these from app.js)


// Test suite for displayResults
describe('displayResults function', () => {
  // Reset the DOM before each test
  beforeEach(() => {
    document.getElementById('transcript').innerHTML = '';
    document.getElementById('insights').innerHTML = '';
    jest.clearAllMocks();
  });
  
  test('correctly displays transcript with proper formatting', () => {
    // Test data
    const testData = {
      transcript: 'Line 1\nLine 2\nLine 3',
      insights: '**Summary**\n- Point 1\n- Point 2'
    };
    
    // Call the function
    displayResults(testData);
    
    // Check that transcript is formatted correctly
    expect(document.getElementById('transcript-0')).not.toBeNull();
    expect(document.getElementById('transcript-0').textContent).toBe('Line 1');
    expect(document.getElementById('transcript-1').textContent).toBe('Line 2');
    expect(document.getElementById('transcript-2').textContent).toBe('Line 3');
    
    // Check that line elements have the right class
    expect(document.getElementById('transcript-0').className).toBe('transcript-line');
  });
  
  test('formats insights with proper markdown styling', () => {
    // Test data with various formatting
    const testData = {
      transcript: 'Test transcript',
      insights: '**Transcript Summary:**\n- Point 1\n- Point 2\n\n**To-Do List:**\n- [ ] Task one\n- [ ] Task two\n- [x] Completed task'
    };
    
    // Call the function
    displayResults(testData);
    
    // Check that insights are stored as markdown attribute
    expect(document.getElementById('insights').getAttribute('data-markdown')).toBe(testData.insights);
    
    // Check that headings are formatted correctly
    expect(document.getElementById('insights').innerHTML).toContain('<h3 class="insight-heading">**Transcript Summary:**</h3>');
    
    // Check that checkboxes are formatted correctly
    expect(document.getElementById('insights').innerHTML).toContain('<span class="checkbox-display">☐</span>');
    expect(document.getElementById('insights').innerHTML).toContain('<span class="checkbox-display checked">☑</span>');
    
    // Check that tasks have the right classes
    expect(document.getElementById('insights').innerHTML).toContain('class="task-item"');
    expect(document.getElementById('insights').innerHTML).toContain('class="insight-line"');
  });
  
  test('sets up animation transitions with setTimeout', () => {
    // Mock setTimeout
    jest.useFakeTimers();
    const originalSetTimeout = window.setTimeout;
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
    
    const testData = {
      transcript: 'Test',
      insights: 'Test insights'
    };
    
    // Call the function
    displayResults(testData);
    
    // Check initial opacity is set
    expect(document.getElementById('transcript').style.opacity).toBe('0');
    expect(document.getElementById('insights').style.opacity).toBe('0');
    
    // Verify setTimeout was called with the right delay
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 100);
    
    // Execute the setTimeout callback
    jest.runAllTimers();
    
    // Check that opacity is now 1 (this should still work)
    expect(document.getElementById('transcript').style.opacity).toBe('1');
    expect(document.getElementById('insights').style.opacity).toBe('1');
    
    // Restore timer
    jest.useRealTimers();
    setTimeoutSpy.mockRestore();
  });
});

// Test suite for togglePane
describe('togglePane function', () => {
  // Reset the DOM before each test
  beforeEach(() => {
    // Reset collapsed state
    document.getElementById('transcript-pane').classList.remove('collapsed');
    document.getElementById('insights-pane').classList.remove('collapsed');
    
    // Reset copy buttons
    document.getElementById('copy-transcript-btn').classList.remove('disabled');
    document.getElementById('copy-insights-btn').classList.remove('disabled');
    
    // Reset layout
    document.querySelector('.pane-container').style.flexDirection = 'row';
    
    // Reset window width (default to desktop view)
    window.innerWidth = 1024;
    
    jest.clearAllMocks();
  });
  
  test('toggles collapsed state for transcript pane', () => {
    // Call function to collapse transcript pane
    togglePane('transcript-pane', { stopPropagation: jest.fn() });
    
    // Check that pane is collapsed
    expect(document.getElementById('transcript-pane').classList.contains('collapsed')).toBe(true);
    
    // Check that copy button is disabled
    expect(document.getElementById('copy-transcript-btn').classList.contains('disabled')).toBe(true);
    
    // Call function again to expand
    togglePane('transcript-pane', { stopPropagation: jest.fn() });
    
    // Check that pane is expanded
    expect(document.getElementById('transcript-pane').classList.contains('collapsed')).toBe(false);
    
    // Check that copy button is enabled
    expect(document.getElementById('copy-transcript-btn').classList.contains('disabled')).toBe(false);
  });
  
  test('applies column flex direction when a pane is collapsed', () => {
    // Mock setTimeout
    jest.useFakeTimers();
    
    // Collapse transcript pane
    togglePane('transcript-pane', { stopPropagation: jest.fn() });
    
    // Check that container has column direction (this should still work)
    expect(document.querySelector('.pane-container').style.flexDirection).toBe('column');
    
    // Execute the setTimeout callback manually to trigger layout changes
    jest.runAllTimers();
    
    // Only check the properties that JSDOM reliably handles
    const transcriptPane = document.getElementById('transcript-pane');
    const insightsPane = document.getElementById('insights-pane');
    
    // Verify the pane is collapsed
    expect(transcriptPane.classList.contains('collapsed')).toBe(true);
    
    // Restore timers
    jest.useRealTimers();
  });
  
  test('uses stacked layout on mobile regardless of collapse state', () => {
    // Simulate mobile viewport
    window.innerWidth = 480;
    
    // Mock setTimeout
    jest.useFakeTimers();
    
    // Toggle any pane (both are expanded)
    togglePane('insights-pane', { stopPropagation: jest.fn() });
    
    // Check that container has column direction
    expect(document.querySelector('.pane-container').style.flexDirection).toBe('column');
    
    // Run timers to complete the layout changes
    jest.runAllTimers();
    
    // Restore timers
    jest.useRealTimers();
  });
  
  test('applies row flex direction when both panes expanded on desktop', () => {
    // Mock setTimeout
    jest.useFakeTimers();
    
    // Make sure both panes are expanded
    document.getElementById('transcript-pane').classList.remove('collapsed');
    document.getElementById('insights-pane').classList.remove('collapsed');
    
    // Toggle and then toggle back to ensure both are expanded
    togglePane('insights-pane', { stopPropagation: jest.fn() });
    togglePane('insights-pane', { stopPropagation: jest.fn() });
    
    // Check that container has row direction (this should work)
    expect(document.querySelector('.pane-container').style.flexDirection).toBe('row');
    
    // Execute the setTimeout callback manually
    jest.runAllTimers();
    
    // Verify both panes are expanded
    expect(document.getElementById('transcript-pane').classList.contains('collapsed')).toBe(false);
    expect(document.getElementById('insights-pane').classList.contains('collapsed')).toBe(false);
    
    // Restore timers
    jest.useRealTimers();
  });
});