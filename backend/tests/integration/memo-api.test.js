// backend/tests/integration/memo-api.test.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3000';

// Helper function to wait for a specific amount of time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to find a test audio file
const findTestAudioFile = () => {
  const resourcesDir = path.join(__dirname, '../resources');
  
  // Create resources directory if it doesn't exist
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
    console.log(`Created resources directory at ${resourcesDir}`);
  }
  
  // Check for audio files with common extensions
  const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
  for (const ext of audioExtensions) {
    const filePath = path.join(resourcesDir, `test-audio${ext}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  // Also check the uploads directory as a fallback
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (audioExtensions.some(ext => file.endsWith(ext))) {
        return path.join(uploadsDir, file);
      }
    }
  }
  
  return null;
};

describe('Memo API Endpoints', () => {
  let memoId;
  let audioPath;

  beforeAll(() => {
    // Find a test audio file
    audioPath = findTestAudioFile();
    
    if (!audioPath) {
      console.warn(`No test audio file found. 
      Please place an audio file named test-audio.mp3 or test-audio.m4a 
      in backend/tests/resources directory before running the tests.`);
    } else {
      console.log(`Using test audio file: ${audioPath}`);
    }
  });

  // Test health endpoint
  test('GET /health should return status ok', async () => {
    const response = await axios.get(`${API_BASE_URL}/health`);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'ok');
    expect(response.data).toHaveProperty('timestamp');
  });

  // Test memo creation
  test('POST /v1/memos should create a new memo', async () => {
    if (!fs.existsSync(audioPath)) {
      console.warn('Skipping test: Test audio file not found');
      return;
    }
    
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioPath));
    formData.append('model', 'openai');
    formData.append('title', 'Jest Test Memo');
    
    const response = await axios.post(`${API_BASE_URL}/v1/memos`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    
    expect(response.status).toBe(202);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('status', 'processing');
    expect(response.data).toHaveProperty('created_at');
    expect(response.data).toHaveProperty('estimated_completion_time');
    
    // Store the memo ID for subsequent tests
    memoId = response.data.id;
  });

  // Test memo retrieval and processing
  test('GET /v1/memos/{memoId} should retrieve the memo and eventually complete processing', async () => {
    if (!memoId) {
      console.warn('Skipping test: No memo ID from previous test');
      return;
    }
    
    let memo = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 15; // 15 attempts * 2 seconds = 30 seconds max wait time
    
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      
      // Wait for 2 seconds between attempts
      await wait(2000);
      
      // Check memo status
      console.log(`Poll attempt ${attempts}...`);
      const response = await axios.get(`${API_BASE_URL}/v1/memos/${memoId}`);
      memo = response.data;
      
      // If processing completed or failed, break the loop
      if (memo.status === 'completed' || memo.status === 'failed') {
        break;
      }
    }
    
    expect(memo).not.toBeNull();
    expect(memo.status).toBe('completed');
    expect(memo).toHaveProperty('transcript');
    expect(memo).toHaveProperty('insights');
    expect(memo).toHaveProperty('raw_insights');
  }, 60000); // Increase timeout to 60 seconds for processing

  // Test memo listing
  test('GET /v1/memos should list all memos', async () => {
    const response = await axios.get(`${API_BASE_URL}/v1/memos`);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('count');
    expect(response.data).toHaveProperty('results');
    expect(Array.isArray(response.data.results)).toBe(true);
    
    // The list should include our test memo
    if (memoId) {
      const foundMemo = response.data.results.find(memo => memo.id === memoId);
      expect(foundMemo).toBeDefined();
    }
  });

  // Test memo deletion
  test('DELETE /v1/memos/{memoId} should delete the memo', async () => {
    if (!memoId) {
      console.warn('Skipping test: No memo ID from previous test');
      return;
    }
    
    // Delete the memo
    const deleteResponse = await axios.delete(`${API_BASE_URL}/v1/memos/${memoId}`);
    expect(deleteResponse.status).toBe(204);
    
    // Verify it's no longer accessible
    try {
      await axios.get(`${API_BASE_URL}/v1/memos/${memoId}`);
      // If we reach this line, the request didn't fail as expected
      throw new Error('Memo still exists after deletion');
    } catch (error) {
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(404);
    }
  });

  // Test error handling when uploading without a file
  test('POST /v1/memos should return 400 when no file is provided', async () => {
    const formData = new FormData();
    formData.append('model', 'openai');
    
    try {
      await axios.post(`${API_BASE_URL}/v1/memos`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      // If we reach this line, the request didn't fail as expected
      throw new Error('Request should have failed with status 400');
    } catch (error) {
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(400);
      expect(error.response.data.error.code).toBe('invalid_request');
    }
  });
});

// Note: This test suite requires:
// 1. The server to be running on http://localhost:3000
// 2. A test audio file at ../resources/test-audio.mp3