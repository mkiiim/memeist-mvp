// backend/tests/setup-test-memos.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const readline = require('readline');

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Base URL for API requests
const API_BASE_URL = 'http://localhost:3000';

/**
 * Find a test audio file to use for memo creation
 */
function findTestAudioFile() {
  // First check in the test resources directory
  const resourcesDir = path.join(__dirname, 'resources');
  if (fs.existsSync(resourcesDir)) {
    const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
    for (const ext of audioExtensions) {
      const testPath = path.join(resourcesDir, `test-audio${ext}`);
      if (fs.existsSync(testPath)) {
        return testPath;
      }
    }
  }
  
  // If not found in resources, check uploads directory
  const uploadsDir = path.join(__dirname, '../uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      if (fs.statSync(filePath).isFile() && 
          ['.mp3', '.m4a', '.wav', '.ogg', '.aac'].some(ext => file.endsWith(ext))) {
        return filePath;
      }
    }
  }
  
  return null;
}

/**
 * Create a completed memo by uploading an audio file
 */
async function createCompletedMemo(audioPath) {
  if (!audioPath || !fs.existsSync(audioPath)) {
    console.error('No valid audio file provided');
    return null;
  }
  
  console.log(`Creating test memo from ${audioPath}...`);
  
  try {
    // Create form data with the audio file
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioPath));
    formData.append('model', 'openai');
    formData.append('title', 'Test Memo for Export Tests');
    
    // Upload the file to create a memo
    const response = await axios.post(`${API_BASE_URL}/v1/memos`, formData, {
      headers: formData.getHeaders()
    });
    
    const memoId = response.data.id;
    console.log(`Created memo with ID: ${memoId}`);
    console.log('Waiting for processing to complete...');
    
    // Wait for processing to complete
    let memo = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await axios.get(`${API_BASE_URL}/v1/memos/${memoId}`);
      memo = statusResponse.data;
      
      console.log(`Attempt ${attempts}/${MAX_ATTEMPTS}: Memo status is ${memo.status}`);
      
      if (memo.status === 'completed') {
        console.log(`✅ Memo processing completed successfully!`);
        return memoId;
      } else if (memo.status === 'failed') {
        console.error(`❌ Memo processing failed`);
        return null;
      }
    }
    
    console.warn(`⚠️ Timed out waiting for memo to complete processing`);
    return null;
  } catch (error) {
    console.error('Error creating memo:', error.message);
    return null;
  }
}

/**
 * Create a memo that will remain in processing state for testing
 */
async function createProcessingMemo() {
  try {
    console.log('Creating a test memo in "processing" state...');
    
    // For this, we'll create a special endpoint request that mocks a processing memo
    const response = await axios.post(`${API_BASE_URL}/test/create-processing-memo`, {
      title: 'Test Processing Memo'
    });
    
    if (response.data && response.data.id) {
      console.log(`✅ Created processing memo with ID: ${response.data.id}`);
      return response.data.id;
    } else {
      console.warn('⚠️ Received unexpected response format');
      return null;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`❌ Error: The test endpoint (/test/create-processing-memo) is not available.`);
      console.log(`Please add the test helper route to your server.js file first.`);
    } else {
      console.error('Error creating processing memo:', error.message);
    }
    return null;
  }
}

/**
 * Main function to set up test memos
 */
async function setupTestMemos() {
  console.log('======= Test Memo Setup =======');
  
  // Check if server is running
  try {
    await axios.get(`${API_BASE_URL}/health`);
  } catch (error) {
    console.error('❌ Error: Cannot connect to server. Please make sure the server is running at', API_BASE_URL);
    rl.close();
    return;
  }
  
  rl.question('Do you want to create test memos? (y/n): ', async (answer) => {
    if (answer.toLowerCase() !== 'y') {
      console.log('Setup aborted.');
      rl.close();
      return;
    }
    
    // Find audio file
    const audioPath = findTestAudioFile();
    if (!audioPath) {
      console.log('No test audio file found. Please run setup-test-audio.js first to set up a test audio file.');
      rl.close();
      return;
    }
    
    // Ask which type of memo to create
    rl.question('What type of test memo do you want to create?\n1. Completed memo\n2. Processing memo\n3. Both\nEnter choice (1-3): ', async (choice) => {
      let completedMemoId = null;
      let processingMemoId = null;
      
      // Create completed memo if requested
      if (['1', '3'].includes(choice)) {
        completedMemoId = await createCompletedMemo(audioPath);
      }
      
      // Create processing memo if requested
      if (['2', '3'].includes(choice)) {
        processingMemoId = await createProcessingMemo();
      }
      
      console.log('\n======= Setup Results =======');
      if (completedMemoId) {
        console.log(`Completed Memo ID: ${completedMemoId}`);
      }
      if (processingMemoId) {
        console.log(`Processing Memo ID: ${processingMemoId}`);
      }
      
      if (completedMemoId || processingMemoId) {
        console.log('\nYou can now run your tests with these memo IDs.');
        console.log('To use these IDs in your tests automatically, set these environment variables:');
        
        if (completedMemoId) {
          console.log(`TEST_COMPLETED_MEMO_ID=${completedMemoId}`);
        }
        if (processingMemoId) {
          console.log(`TEST_PROCESSING_MEMO_ID=${processingMemoId}`);
        }
      } else {
        console.log('No test memos were created. Please try again.');
      }
      
      rl.close();
    });
  });
}

// Note for the processing memo endpoint
console.log('Note: To create a processing memo, you need to add this endpoint to your server.js:');
console.log(`
// Add test helper routes (only in development/test environments)
if (process.env.NODE_ENV !== 'production') {
  app.post('/test/create-processing-memo', express.json(), (req, res) => {
    const memoId = \`test_processing_memo_\${Date.now()}\`;
    
    memos.set(memoId, {
      id: memoId,
      status: 'processing',
      created_at: new Date().toISOString(),
      title: req.body.title || 'Test Processing Memo'
    });
    
    debug(\`Created test processing memo with ID: \${memoId}\`);
    res.json({ id: memoId, message: 'Processing memo created for testing' });
  });
}
`);

// Run the main function
setupTestMemos();