// backend/tests/integration/export-api.test.js
const request = require('supertest');

// Mock environment variables for API keys if needed for tests
process.env.APIKEY_OPENAI = process.env.APIKEY_OPENAI || 'mock-openai-key';
process.env.APIKEY_ANTHROPIC_MEMEIST = process.env.APIKEY_ANTHROPIC_MEMEIST || 'mock-anthropic-key';

// Import the app
const app = require('../../server');

describe('Export API Endpoints', () => {
  // Test markdown export endpoint with an invalid memo ID (should return 404)
  test('GET /v1/memos/{invalidId}/export/markdown should return 404 for non-existent memo', async () => {
    const response = await request(app)
      .get('/v1/memos/invalid_memo_id/export/markdown')
      .expect(404);
    
    expect(response.body.error.code).toBe('not_found');
    console.log('Successfully tested 404 error for non-existent memo');
  });

  // The following tests use a custom condition to run or mark as pending
  describe('Tests requiring existing memos', () => {
    let completedMemoId = null;
    let processingMemoId = null;
    
    // Setup to find necessary memos
    beforeAll(async () => {
      console.log('Starting memo discovery for export tests...');

      // First check for environment variables (set by setup-test-memos.js)
      if (process.env.TEST_COMPLETED_MEMO_ID) {
        completedMemoId = process.env.TEST_COMPLETED_MEMO_ID;
        console.log(`Using completed memo from environment variable: ${completedMemoId}`);
      }
      
      if (process.env.TEST_PROCESSING_MEMO_ID) {
        processingMemoId = process.env.TEST_PROCESSING_MEMO_ID;
        console.log(`Using processing memo from environment variable: ${processingMemoId}`);
      }
      
      // If not found in environment variables, try to find in the system
      if (!completedMemoId || !processingMemoId) {
        try {
          // Get list of memos
          const listResponse = await request(app).get('/v1/memos');
          
          if (listResponse.body.results && listResponse.body.results.length > 0) {
            // Find a completed memo if needed
            if (!completedMemoId) {
              const completedMemo = listResponse.body.results.find(memo => memo.status === 'completed');
              if (completedMemo) {
                completedMemoId = completedMemo.id;
                console.log(`Found completed memo with ID: ${completedMemoId}`);
              } else {
                console.warn('No completed memos found in the system');
              }
            }
            
            // Find a processing memo if needed
            if (!processingMemoId) {
              const processingMemo = listResponse.body.results.find(memo => memo.status === 'processing');
              if (processingMemo) {
                processingMemoId = processingMemo.id;
                console.log(`Found processing memo with ID: ${processingMemoId}`);
              } else {
                console.warn('No processing memos found in the system');
              }
            }
          } else {
            console.warn('No memos found in the system at all');
          }
        } catch (error) {
          console.error('Error finding memos:', error.message);
        }
      }

      // Log final state
      console.log(`Memo Discovery Results:
- Completed Memo ID: ${completedMemoId || 'Not Found'}
- Processing Memo ID: ${processingMemoId || 'Not Found'}`);
    });
    
    // Test successful export (conditional)
    test('GET /v1/memos/{memoId}/export/markdown with existing memo', async () => {
      // Skip this test if no completed memo is available
      if (!completedMemoId) {
        console.log('No completed memos available, marking test as pending');
        return pending('This test requires a completed memo to run');
      }

      const response = await request(app)
        .get(`/v1/memos/${completedMemoId}/export/markdown`);
      
      // Log full response for debugging
      console.log('Full Response Headers:', response.headers);
      console.log('Response Body:', response.text);

      // Check status code first
      expect(response.status).toBe(200);
      
      // Check Content-Type (more flexible match)
      expect(response.headers['content-type']).toMatch(/text\/markdown|application\/octet-stream/);
      
      // Verify content disposition header (attachment)
      expect(response.headers['content-disposition']).toMatch(/attachment; filename=/);
      
      // Check markdown content includes expected sections
      const markdownContent = response.text;
      expect(markdownContent).toContain('# ');  // Title
      expect(markdownContent).toContain('## Transcript');
      expect(markdownContent).toContain('## Insights');
      
      console.log('Successfully tested markdown export with real memo');
    });

    // Test invalid state error (conditional)
    test('GET /v1/memos/{processingMemoId}/export/markdown should return 400 for unprocessed memo', async () => {
      // Skip this test if no processing memo is available
      if (!processingMemoId) {
        console.log('No processing memos available, marking test as pending');
        return pending('This test requires a processing memo to run');
      }
      
      // Verify the memo is still processing
      const memoCheck = await request(app).get(`/v1/memos/${processingMemoId}`);
      if (memoCheck.body.status !== 'processing') {
        console.log(`Memo ${processingMemoId} is no longer in 'processing' state (current state: ${memoCheck.body.status}), marking test as pending`);
        return pending('This test requires a memo that is still in processing status');
      }
      
      // Test the export endpoint with a processing memo
      const response = await request(app)
        .get(`/v1/memos/${processingMemoId}/export/markdown`)
        .expect(400);
      
      expect(response.body.error.code).toBe('invalid_state');
      console.log('Successfully tested 400 error for unprocessed memo');
    });
  });
});

// Helper function to mark a test as pending
function pending(message) {
  // In Jest, we can't dynamically skip a test once it's already running
  // So we throw a special error that the test runner will recognize
  const error = new Error(message);
  error.name = 'SkippedTest';
  throw error;
}