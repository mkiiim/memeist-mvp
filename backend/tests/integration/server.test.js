// tests/integration/server.test.js
const request = require('supertest');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Mock axios before importing server
jest.mock('axios');

// Mock fs.createReadStream to handle file uploads in tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn().mockImplementation(() => 'mock-file-stream'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn()
}));

// Mock environment variables
process.env.APIKEY_OPENAI = 'mock-openai-key';
process.env.APIKEY_ANTHROPIC_MEMEIST = 'mock-anthropic-key';

// Import the app after setting up mocks
const app = require('../../server');

describe('API Endpoints', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('GET /health returns status ok', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('POST /upload returns 400 when no file provided', async () => {
    const response = await request(app)
      .post('/upload')
      .field('model', 'openai');
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'No file uploaded');
  });

  test('POST /upload with OpenAI model processes file correctly', async () => {
    // Mock the Whisper API response (audio transcription)
    axios.post.mockImplementation((url, data, config) => {
      if (url.includes('audio/transcriptions')) {
        expect(config.headers).toHaveProperty('Authorization', 'Bearer mock-openai-key');
        return Promise.resolve({
          status: 200,
          data: { text: 'This is a mocked transcript from Whisper API.' }
        });
      } else if (url.includes('chat/completions')) {
        // Mock the GPT API response (content analysis)
        expect(config.headers).toHaveProperty('Authorization', 'Bearer mock-openai-key');
        return Promise.resolve({
          status: 200,
          data: {
            model: 'gpt-4',
            usage: { total_tokens: 100 },
            choices: [{
              message: {
                content: '**Transcript Summary:**\n- Meeting notes\n\n**To-Do List:**\n- Task one\n- Task two\n\n**Follow-Ups:**\n- Follow up one'
              }
            }]
          }
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Create a mock request with a "file"
    const response = await request(app)
      .post('/upload')
      .field('model', 'openai')
      .attach('audio', Buffer.from('fake audio content'), 'test-audio.mp3');
    
    // Verify the response
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('transcript', 'This is a mocked transcript from Whisper API.');
    expect(response.body).toHaveProperty('insights');
    expect(response.body.insights).toContain('**Transcript Summary:**');
    expect(response.body.insights).toContain('- [ ] Task one');
    expect(response.body.insights).toContain('- [ ] Task two');
    
    // Verify that axios was called with expected parameters
    expect(axios.post).toHaveBeenCalledTimes(2);
    
    // Verify the file cleanup was attempted
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  test('POST /upload with Claude model processes file correctly', async () => {
    // Mock the Whisper API response for transcription
    axios.post.mockImplementationOnce((url) => {
      if (url.includes('audio/transcriptions')) {
        return Promise.resolve({
          status: 200,
          data: { text: 'This is a mocked transcript for Claude processing.' }
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Mock the Claude API response
    axios.post.mockImplementationOnce((url, data, config) => {
      if (url.includes('anthropic.com/v1/messages')) {
        expect(config.headers).toHaveProperty('x-api-key', 'mock-anthropic-key');
        return Promise.resolve({
          status: 200,
          data: {
            model: 'claude-3-7-sonnet-20250219',
            usage: { input_tokens: 100, output_tokens: 200 },
            content: [{ 
              type: 'text',
              text: '**Transcript Summary:**\n- Claude summary\n\n**To-Do List:**\n- Claude task one\n- Claude task two\n\n**Follow-Ups:**\n- Claude follow-up'
            }]
          }
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Create a mock request with a "file" and specify Claude model
    const response = await request(app)
      .post('/upload')
      .field('model', 'claude')
      .attach('audio', Buffer.from('fake audio content'), 'test-audio.mp3');
    
    // Verify the response
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('transcript', 'This is a mocked transcript for Claude processing.');
    expect(response.body).toHaveProperty('insights');
    expect(response.body.insights).toContain('**Transcript Summary:**');
    expect(response.body.insights).toContain('- [ ] Claude task one');
    expect(response.body.insights).toContain('- [ ] Claude task two');
    
    // Verify that axios was called with expected parameters
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('POST /upload handles transcription API error', async () => {
    // Mock a failed transcription API call
    axios.post.mockImplementationOnce(() => {
      return Promise.reject(new Error('Transcription API error'));
    });

    const response = await request(app)
      .post('/upload')
      .field('model', 'openai')
      .attach('audio', Buffer.from('fake audio content'), 'test-audio.mp3');
    
    // Verify the response handles the error
    expect(response.body).toHaveProperty('transcript', '');
  });
});