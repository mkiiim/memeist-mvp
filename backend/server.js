const { postProcessInsights, countCheckboxes } = require('./utils');
const express = require('express');
const multer = require('multer');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
// Import the debug module
const debug = require('./debug');
const { createStore } = require('./dataStore');
require('dotenv').config();

// Load prompts from JSON or YAML file
const prompts = yaml.load(fs.readFileSync(path.join(__dirname, 'prompts.yaml'), 'utf8'));

// Initialize data store for memos
const memos = createStore();

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Helper function to generate unique IDs
const generateId = (prefix) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
};

// Transcription API (OpenAI Whisper)
const transcribeAudio = async (filePath) => {
  debug(`Transcribing audio file: ${filePath}`);
  const fileData = fs.createReadStream(filePath);
  try {
    debug('Sending request to OpenAI Whisper API');
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', 
      { file: fileData, model: 'whisper-1' }, 
      { headers: { 'Authorization': `Bearer ${process.env.APIKEY_OPENAI}`, 'Content-Type': 'multipart/form-data' } }
    );
    debug('Received response from Whisper API', { status: response.status });
    return response.data.text;
  } catch (error) {
    debug('Error transcribing audio:', { 
      message: error.message, 
      response: error.response ? error.response.data : null 
    });
    return '';
  }
};

// Analyze text with OpenAI's GPT models
const analyzeWithOpenAI = async (text) => {
  debug('Analyzing text with OpenAI GPT-4');
  
  try {
    const payload = {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: prompts.transcriptAnalysis },
        { role: 'user', content: text }
      ]
    };
    debug('Sending request to OpenAI API');
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: { 'Authorization': `Bearer ${process.env.APIKEY_OPENAI}` }
    });

    debug('Received response from OpenAI', { 
      status: response.status,
      model: response.data.model,
      usage: response.data.usage
    });
    
    // Log a sample of the content for debugging
    const content = response.data.choices[0].message.content;
    debug('Content sample (first 200 chars):', content.substring(0, 200));
    
    // Check for acknowledgment
    const hasAcknowledgment = content.includes("I understand the instructions");
    debug(`Response contains acknowledgment: ${hasAcknowledgment}`);
    
    // Verify if checkboxes are present
    const checkboxCount = countCheckboxes(content);
    debug(`Number of checkbox patterns found in OpenAI response: ${checkboxCount}`);
    
    // Remove the acknowledgment line before returning
    let processedContent = content;
    if (hasAcknowledgment) {
      processedContent = content.replace(/I understand the instructions[^]*?(?=\*\*Transcript Summary)/s, '');
    }
    
    return processedContent;
  } catch (error) {
    debug('Error analyzing text with OpenAI:', { 
      message: error.message, 
      response: error.response ? error.response.data : null 
    });
    return '';
  }
};

// Analyze text with Anthropic's Claude
const analyzeWithClaude = async (text) => {
  debug('Analyzing text with Anthropic Claude');
  
  try {
    const payload = {
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: `${prompts.transcriptAnalysis}\n\nTranscript to analyze:\n${text}` }
      ]
    };
    debug('Sending request to Anthropic API');
    debug('Using Claude model: claude-3-7-sonnet-20250219');
    
    // Check for API key
    debug('Checking API key:', process.env.APIKEY_ANTHROPIC_MEMEIST ? 'API key exists' : 'API key missing');

    const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
      headers: { 
        'x-api-key': process.env.APIKEY_ANTHROPIC_MEMEIST,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });

    debug('Received response from Claude', { 
      status: response.status,
      model: response.data.model,
      usage: response.data.usage
    });
    
    // Log a sample of the content for debugging
    const content = response.data.content[0].text;
    debug('Content sample (first 200 chars):', content.substring(0, 200));
    
    // Check for acknowledgment
    const hasAcknowledgment = content.includes("I understand the instructions");
    debug(`Response contains acknowledgment: ${hasAcknowledgment}`);
    
    // Verify if checkboxes are present
    const checkboxCount = countCheckboxes(content);
    debug(`Number of checkbox patterns found in Claude response: ${checkboxCount}`);
    
    // Remove the acknowledgment line before returning
    let processedContent = content;
    if (hasAcknowledgment) {
      processedContent = content.replace(/I understand the instructions[^]*?(?=\*\*Transcript Summary)/s, '');
    }
    
    return processedContent;
  } catch (error) {
    debug('Error analyzing text with Claude:', { 
      message: error.message, 
      response: error.response ? error.response.data : null 
    });
    
    // Handle authentication errors specifically
    if (error.response && error.response.status === 401) {
      debug('Authentication error with Claude API. Please check your APIKEY_ANTHROPIC_MEMEIST in .env file');
    }
    
    return 'Error connecting to Claude API. Please check server logs.';
  }
};

// Helper to ensure the 'uploads' directory exists
function ensureUploadsDirectory() {
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
    debug('Created uploads directory');
  }
}

// Parse insights to extract structured data (todo items, follow-ups, etc.)
const parseInsights = (insightsText) => {
  // This is a simplified version - in production, this would be more robust
  const sections = {
    summary: [],
    todo_items: [],
    follow_ups: [],
    references: []
  };
  
  try {
    // Extract summary points
    const summaryMatch = insightsText.match(/\*\*Transcript Summary:\*\*\s*\n((?:- [^\n]*\n?)+)/);
    if (summaryMatch && summaryMatch[1]) {
      sections.summary = summaryMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('- '))
        .map(line => line.replace(/^- /, '').trim());
    }
    
    // Extract todo items
    const todoMatch = insightsText.match(/\*\*To-Do List:\*\*\s*\n((?:- \[ \][^\n]*\n?)+)/);
    if (todoMatch && todoMatch[1]) {
      sections.todo_items = todoMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('- [ ]'))
        .map(line => {
          const text = line.replace(/^- \[ \]/, '').trim();
          return {
            id: generateId('todo'),
            text,
            completed: false
          };
        });
    }
    
    // Extract follow-ups
    const followUpMatch = insightsText.match(/\*\*Follow-Ups:\*\*\s*\n((?:- \[ \][^\n]*\n?)+)/);
    if (followUpMatch && followUpMatch[1]) {
      sections.follow_ups = followUpMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('- [ ]'))
        .map(line => {
          const text = line.replace(/^- \[ \]/, '').trim();
          return {
            id: generateId('followup'),
            text,
            completed: false
          };
        });
    }
    
    // Extract references
    const referencesMatch = insightsText.match(/\*\*References & Links:\*\*\s*\n((?:- [^\n]*\n?)+)/);
    if (referencesMatch && referencesMatch[1]) {
      sections.references = referencesMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('- '))
        .map(line => {
          const text = line.replace(/^- /, '').trim();
          // Check if the line contains a markdown link
          const linkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (linkMatch) {
            return {
              text: linkMatch[1],
              url: linkMatch[2]
            };
          }
          return {
            text,
            url: null
          };
        });
    }
  } catch (error) {
    debug('Error parsing insights:', error);
  }
  
  return sections;
};

// ==============================
// API Routes for Memos
// ==============================

// For testing - clear the data store
if (process.env.NODE_ENV === 'test') {
  app.post('/test/clear-data', async (req, res) => {
    try {
      await memos.clear();
      debug('Data store cleared for testing');
      res.status(200).json({ message: 'Data store cleared' });
    } catch (error) {
      debug('Error clearing data store:', error);
      res.status(500).json({ error: 'Failed to clear data store' });
    }
  });
}

// 1. Upload Audio for Processing (Create a new memo)
app.post('/v1/memos', upload.single('audio'), async (req, res) => {
  debug('Received memo creation request', { 
    filename: req.file ? req.file.originalname : 'no file',
    model: req.body.model || 'openai'
  });
  
  if (!req.file) {
    debug('No file uploaded');
    return res.status(400).json({ 
      error: {
        code: 'invalid_request',
        message: 'No file uploaded'
      }
    });
  }
  
  try {
    // Generate a unique ID for the memo
    const memoId = generateId('memo');
    const now = new Date();
    
    // Create a new memo object with initial state
    const memo = {
      id: memoId,
      status: 'processing',
      created_at: now.toISOString(),
      estimated_completion_time: new Date(now.getTime() + 60000).toISOString(), // Estimate 1 minute
      title: req.body.title || req.file.originalname,
      model: req.body.model || 'openai',
      file_path: req.file.path,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
    };
    
    // Store the memo in our data store
    await memos.set(memoId, memo);
    
    // Return initial response immediately
    res.status(202).json({
      id: memo.id,
      status: memo.status,
      created_at: memo.created_at,
      estimated_completion_time: memo.estimated_completion_time
    });
    
    // Process the file asynchronously
    processAudioFile(memoId);
    
  } catch (error) {
    debug('Error creating memo:', error);
    res.status(500).json({ 
      error: {
        code: 'server_error',
        message: 'Error processing your request',
        details: error.message
      }
    });
  }
});

// Asynchronous function to process the audio file
const processAudioFile = async (memoId) => {
  const memo = await memos.get(memoId);
  if (!memo) return;
  
  try {
    // Step 1: Transcribe the audio
    const transcript = await transcribeAudio(memo.file_path);
    debug(`Transcription completed for memo ${memoId}`, { transcriptLength: transcript.length });
    
    // Update memo with transcript
    memo.transcript = transcript;
    await memos.set(memoId, memo);
    
    // Step 2: Analyze the transcript
    let insights;
    if (memo.model === 'claude') {
      insights = await analyzeWithClaude(transcript);
    } else {
      insights = await analyzeWithOpenAI(transcript);
    }
    
    // Apply post-processing to ensure proper formatting
    insights = postProcessInsights ? postProcessInsights(insights, memo.model) : insights;
    
    // Parse the insights to extract structured data
    const parsedInsights = parseInsights(insights);
    
    // Step 3: Update memo with analysis results
    memo.status = 'completed';
    memo.completed_at = new Date().toISOString();
    memo.raw_insights = insights;
    memo.raw_format = 'markdown';
    memo.insights = parsedInsights;
    memo.audio_duration = null; // This would require audio processing
    
    // Step 4: Clean up the file
    try {
      fs.unlinkSync(memo.file_path);
      debug(`Cleaned up file for memo ${memoId}`);
    } catch (fileError) {
      debug(`Warning: Could not delete file for memo ${memoId}:`, fileError.message);
    }
    
    // Update stored memo
    await memos.set(memoId, memo);
    debug(`Memo ${memoId} processing completed successfully`);
    
  } catch (error) {
    debug(`Error processing memo ${memoId}:`, error);
    
    // Update memo with error status
    memo.status = 'failed';
    memo.error = {
      code: 'processing_error',
      message: 'Failed to process the audio file',
      details: error.message
    };
    
    // Update stored memo
    await memos.set(memoId, memo);
  }
};

// 2. Get Memo by ID
app.get('/v1/memos/:memoId', async (req, res) => {
  const { memoId } = req.params;
  debug(`Request for memo ${memoId}`);
  
  const memo = await memos.get(memoId);
  if (!memo) {
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'Memo not found'
      }
    });
  }
  
  // Return the memo data
  res.json(memo);
});

// 3. List All Memos
app.get('/v1/memos', async (req, res) => {
  const { limit = 20, offset = 0, status, sort = 'created_at', order = 'desc' } = req.query;
  debug('Request for memo list', { limit, offset, status, sort, order });
  
  try {
    const result = await memos.list({
      limit,
      offset,
      status,
      sort,
      order
    });
    
    // Return the paginated list
    res.json(result);
  } catch (error) {
    debug('Error listing memos:', error);
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Error listing memos',
        details: error.message
      }
    });
  }
});

// 4. Delete a Memo
app.delete('/v1/memos/:memoId', async (req, res) => {
  const { memoId } = req.params;
  debug(`Request to delete memo ${memoId}`);
  
  const memo = await memos.get(memoId);
  if (!memo) {
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'Memo not found'
      }
    });
  }
  
  // Delete the memo
  await memos.delete(memoId);
  
  // Return success response
  res.status(204).end();
});

// 5. Export a Memo as Markdown
app.get('/v1/memos/:memoId/export/markdown', async (req, res) => {
  const { memoId } = req.params;
  debug(`Request to export memo ${memoId} as Markdown`);
  
  const memo = await memos.get(memoId);
  if (!memo) {
    return res.status(404).json({
      error: {
        code: 'not_found',
        message: 'Memo not found'
      }
    });
  }
  
  // Check that the memo is completed
  if (memo.status !== 'completed') {
    return res.status(400).json({
      error: {
        code: 'invalid_state',
        message: 'Memo is not yet processed'
      }
    });
  }
  
  // Format date for the filename
  const date = new Date(memo.created_at);
  const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Create the filename
  const sanitizedTitle = memo.title.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-');
  const filename = `${sanitizedTitle}-${formattedDate}.md`;
  
  // Generate markdown content
  let markdownContent = `# ${memo.title}\n\n`;
  markdownContent += `_Created: ${new Date(memo.created_at).toLocaleString()}_\n\n`;
  
  // Add transcript section
  markdownContent += `## Transcript\n\n${memo.transcript}\n\n`;
  
  // Add insights section (use raw_insights if available, otherwise format structured insights)
  markdownContent += `## Insights\n\n`;
  
  if (memo.raw_insights) {
    // Use the raw markdown insights if available
    markdownContent += memo.raw_insights;
  } else if (memo.insights) {
    // Format the structured insights to markdown
    
    // Add summary section
    markdownContent += '**Transcript Summary:**\n';
    if (memo.insights.summary && memo.insights.summary.length > 0) {
      memo.insights.summary.forEach(item => {
        markdownContent += `- ${item}\n`;
      });
    } else {
      markdownContent += '- No summary available\n';
    }
    markdownContent += '\n';
    
    // Add to-do section
    markdownContent += '**To-Do List:**\n';
    if (memo.insights.todo_items && memo.insights.todo_items.length > 0) {
      memo.insights.todo_items.forEach(item => {
        markdownContent += `- [ ] ${item.text}\n`;
      });
    } else {
      markdownContent += '- [ ] No tasks identified\n';
    }
    markdownContent += '\n';
    
    // Add follow-ups section
    markdownContent += '**Follow-Ups:**\n';
    if (memo.insights.follow_ups && memo.insights.follow_ups.length > 0) {
      memo.insights.follow_ups.forEach(item => {
        markdownContent += `- [ ] ${item.text}\n`;
      });
    } else {
      markdownContent += '- [ ] No follow-ups identified\n';
    }
    markdownContent += '\n';
    
    // Add references section
    markdownContent += '**References & Links:**\n';
    if (memo.insights.references && memo.insights.references.length > 0) {
      memo.insights.references.forEach(item => {
        if (item.url) {
          markdownContent += `- [${item.text}](${item.url})\n`;
        } else {
          markdownContent += `- ${item.text}\n`;
        }
      });
    } else {
      markdownContent += '- No references available\n';
    }
  }
  
  // Set headers for file download
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  // Send the markdown content as the response
  res.send(markdownContent);
  
  debug(`Memo ${memoId} exported as Markdown successfully`);
});

// ==============================
// Legacy API Route (for backward compatibility)
// ==============================

// API Route to Handle File Upload, Transcription & LLM Analysis
app.post('/upload', upload.single('audio'), async (req, res) => {
  debug('Received upload request', { 
    filename: req.file ? req.file.originalname : 'no file',
    model: req.body.model || 'openai'
  });
  
  if (!req.file) {
    debug('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Ensure uploads directory exists
  ensureUploadsDirectory();
  
  // Get model choice from the request, default to OpenAI
  const model = req.body.model || 'openai';
  debug(`Using model: ${model}`);
  
  try {
    const transcript = await transcribeAudio(req.file.path);
    debug('Transcript length:', transcript.length);
    debug('Transcript sample:', transcript.substring(0, 100) + '...');
    
    let insights;
    if (model === 'claude') {
      insights = await analyzeWithClaude(transcript);
    } else {
      insights = await analyzeWithOpenAI(transcript);
    }
    
    debug('Raw insights length:', insights.length);
    
    // Apply post-processing to ensure proper formatting
    insights = postProcessInsights ? postProcessInsights(insights, model) : insights;
    
    // Send response back to client
    res.json({ transcript, insights });
    debug('Response sent successfully');
    
    // Clean up the uploaded file to save space
    try {
      fs.unlinkSync(req.file.path);
      debug(`Cleaned up temporary file: ${req.file.path}`);
    } catch (cleanupError) {
      debug(`Warning: Could not delete temporary file: ${cleanupError.message}`);
    }
    
  } catch (error) {
    debug('Error processing request:', error);
    res.status(500).json({ 
      error: 'Error processing your audio file', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  debug('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add test helper routes (only in development/test environments)
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  app.post('/test/create-processing-memo', express.json(), async (req, res) => {
    const memoId = `test_processing_memo_${Date.now()}`;
    
    const memo = {
      id: memoId,
      status: 'processing',
      created_at: new Date().toISOString(),
      title: req.body.title || 'Test Processing Memo'
    };
    
    await memos.set(memoId, memo);
    
    debug(`Created test processing memo with ID: ${memoId}`);
    res.json({ id: memoId, message: 'Processing memo created for testing' });
  });
}

// Only start the server if this file is being run directly, not when imported in tests
if (require.main === module) {
  app.listen(PORT, () => {
    debug(`Server running on http://localhost:${PORT}`);
    debug('Environment variables loaded:', {
      OPENAI_API_KEY_SET: !!process.env.APIKEY_OPENAI,
      ANTHROPIC_API_KEY_SET: !!process.env.APIKEY_ANTHROPIC_MEMEIST
    });
    
    // Check if any required API keys are missing
    if (!process.env.APIKEY_OPENAI) {
      debug('WARNING: OpenAI API key (APIKEY_OPENAI) is missing in .env file');
    }
    
    if (!process.env.APIKEY_ANTHROPIC_MEMEIST) {
      debug('WARNING: Anthropic API key (APIKEY_ANTHROPIC_MEMEIST) is missing in .env file');
    }
  });
}

// Export for testing
module.exports = app;