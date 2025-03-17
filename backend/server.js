const { postProcessInsights, countCheckboxes } = require('./utils');const express = require('express');
const multer = require('multer');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

// Load prompts from JSON or YAML file
// const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf8'));
const prompts = yaml.load(fs.readFileSync(path.join(__dirname, 'prompts.yaml'), 'utf8'));

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

// Debugging function
const debug = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
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
  
  // Check for uploads directory
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
    debug('Created uploads directory');
  }
  
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
    insights = postProcessInsights(insights, model);
    
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