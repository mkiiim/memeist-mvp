// tests/setup.js
// This file sets up the test environment with any global mocks or configurations

// Mock fetch API to prevent actual network requests
global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({})
    })
  );
  
  // Mock other browser APIs that might be needed
  global.navigator = {
    clipboard: {
      writeText: jest.fn().mockImplementation(() => Promise.resolve())
    }
  };