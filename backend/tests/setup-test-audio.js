// backend/tests/setup-test-audio.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to create test resources directory if it doesn't exist
function createResourcesDir() {
  const resourcesDir = path.join(__dirname, 'resources');
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
    console.log(`Created resources directory at ${resourcesDir}`);
  }
  return resourcesDir;
}

// Function to find an audio file in the uploads directory
function findAudioInUploads() {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    return null;
  }
  
  const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
  const files = fs.readdirSync(uploadsDir);
  
  for (const file of files) {
    if (audioExtensions.some(ext => file.endsWith(ext))) {
      return {
        path: path.join(uploadsDir, file),
        extension: path.extname(file)
      };
    }
  }
  
  return null;
}

// Function to copy an audio file to the test resources directory
function copyAudioFile(sourcePath, extension) {
  const resourcesDir = createResourcesDir();
  const destPath = path.join(resourcesDir, `test-audio${extension}`);
  
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied audio file to ${destPath}`);
  
  return destPath;
}

// Main function
async function setupTestAudio() {
  try {
    console.log('Setting up test audio file...');
    
    // First, check if we already have a test audio file
    const resourcesDir = createResourcesDir();
    const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.aac'];
    let testAudioExists = false;
    
    for (const ext of audioExtensions) {
      const testPath = path.join(resourcesDir, `test-audio${ext}`);
      if (fs.existsSync(testPath)) {
        console.log(`Test audio file already exists at ${testPath}`);
        testAudioExists = true;
        break;
      }
    }
    
    if (testAudioExists) {
      rl.question('Test audio file already exists. Do you want to replace it? (y/n): ', (answer) => {
        if (answer.toLowerCase() !== 'y') {
          console.log('Setup aborted. Using existing test audio file.');
          rl.close();
          return;
        }
        continueSetup();
      });
    } else {
      continueSetup();
    }
    
    function continueSetup() {
      // Look for an audio file in the uploads directory
      const audioFile = findAudioInUploads();
      
      if (audioFile) {
        rl.question(`Found audio file at ${audioFile.path}. Use this file? (y/n): `, (answer) => {
          if (answer.toLowerCase() === 'y') {
            copyAudioFile(audioFile.path, audioFile.extension);
            console.log('Test audio file setup complete!');
            rl.close();
          } else {
            askForCustomPath();
          }
        });
      } else {
        askForCustomPath();
      }
    }
    
    function askForCustomPath() {
      rl.question('Please enter the full path to an audio file: ', (filePath) => {
        if (!filePath) {
          console.log('No path provided. Setup aborted.');
          rl.close();
          return;
        }
        
        if (!fs.existsSync(filePath)) {
          console.log(`File does not exist at ${filePath}. Setup aborted.`);
          rl.close();
          return;
        }
        
        const extension = path.extname(filePath);
        if (!audioExtensions.includes(extension)) {
          console.log(`File extension ${extension} is not recognized as an audio file. Setup aborted.`);
          rl.close();
          return;
        }
        
        copyAudioFile(filePath, extension);
        console.log('Test audio file setup complete!');
        rl.close();
      });
    }
  } catch (error) {
    console.error('Error setting up test audio file:', error);
    rl.close();
  }
}

setupTestAudio();