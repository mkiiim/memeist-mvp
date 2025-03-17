// dataStore.js - A simple data persistence layer for memos
const fs = require('fs');
const path = require('path');

// Import debug or create a fallback
let debugModule;
try {
  debugModule = require('./debug');
} catch (err) {
  // Fallback debug function if the module isn't available
  debugModule = (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  };
}

class FileSystemStore {
  constructor(options = {}) {
    // Set up storage directory - default to 'data' folder in project root
    this.dataDir = options.dataDir || path.join(__dirname, 'data');
    this.memosDir = path.join(this.dataDir, 'memos');
    
    // Create directories if they don't exist
    this._ensureDirectoriesExist();
    
    // Optional in-memory cache for faster lookups
    this.useCache = options.useCache !== false;
    this.cache = new Map();
    
    // Load existing data into cache if using cache
    if (this.useCache) {
      this._loadExistingData();
    }
  }
  
  // Create required directories
  _ensureDirectoriesExist() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      debugModule(`Created data directory at ${this.dataDir}`);
    }
    
    if (!fs.existsSync(this.memosDir)) {
      fs.mkdirSync(this.memosDir, { recursive: true });
      debugModule(`Created memos directory at ${this.memosDir}`);
    }
  }
  
  // Load all existing memo files into memory cache
  _loadExistingData() {
    try {
      if (!fs.existsSync(this.memosDir)) return;
      
      const files = fs.readdirSync(this.memosDir);
      debugModule(`Loading ${files.length} existing memos into cache...`);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.memosDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Only add to cache if it has an id
            if (data && data.id) {
              this.cache.set(data.id, data);
            }
          } catch (err) {
            debugModule(`Warning: Could not load memo file ${file}: ${err.message}`);
          }
        }
      }
      
      debugModule(`Loaded ${this.cache.size} memos into cache`);
    } catch (err) {
      debugModule(`Error loading existing data: ${err.message}`);
    }
  }
  
  // Get file path for a memo ID
  _getFilePath(id) {
    return path.join(this.memosDir, `${id}.json`);
  }
  
  // Save memo to both file system and cache
  async set(id, data) {
    try {
      const filePath = this._getFilePath(id);
      
      // Ensure the data object has the correct ID
      const memoData = { ...data, id };
      
      // Write to file system
      await fs.promises.writeFile(
        filePath, 
        JSON.stringify(memoData, null, 2), 
        'utf8'
      );
      
      // Update cache if using it
      if (this.useCache) {
        this.cache.set(id, memoData);
      }
      
      return true;
    } catch (err) {
      debugModule(`Error saving memo ${id}: ${err.message}`);
      throw err;
    }
  }
  
  // Get memo by ID
  async get(id) {
    // Try cache first if enabled
    if (this.useCache && this.cache.has(id)) {
      return this.cache.get(id);
    }
    
    // Fall back to file system
    try {
      const filePath = this._getFilePath(id);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
      
      // Update cache if using it
      if (this.useCache) {
        this.cache.set(id, data);
      }
      
      return data;
    } catch (err) {
      debugModule(`Error getting memo ${id}: ${err.message}`);
      return null;
    }
  }
  
  // Delete memo by ID
  async delete(id) {
    try {
      const filePath = this._getFilePath(id);
      
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      
      // Remove from cache if using it
      if (this.useCache) {
        this.cache.delete(id);
      }
      
      return true;
    } catch (err) {
      debugModule(`Error deleting memo ${id}: ${err.message}`);
      throw err;
    }
  }
  
  // List all memos with optional filtering and pagination
  async list(options = {}) {
    const { limit = 20, offset = 0, status, sort = 'created_at', order = 'desc' } = options;
    
    try {
      let memos = [];
      
      // Use cache if available, otherwise read from file system
      if (this.useCache) {
        memos = Array.from(this.cache.values());
      } else {
        const files = fs.readdirSync(this.memosDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(this.memosDir, file);
              const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              memos.push(data);
            } catch (err) {
              debugModule(`Warning: Could not read memo file ${file}: ${err.message}`);
            }
          }
        }
      }
      
      // Apply filters
      if (status) {
        memos = memos.filter(memo => memo.status === status);
      }
      
      // Apply sorting
      memos.sort((a, b) => {
        if (order.toLowerCase() === 'asc') {
          return a[sort] > b[sort] ? 1 : -1;
        } else {
          return a[sort] < b[sort] ? 1 : -1;
        }
      });
      
      // Get total count before pagination
      const count = memos.length;
      
      // Apply pagination
      memos = memos.slice(offset, offset + parseInt(limit));
      
      return {
        count,
        results: memos
      };
    } catch (err) {
      debugModule(`Error listing memos: ${err.message}`);
      return { count: 0, results: [] };
    }
  }
  
  // Clear all data (useful for testing)
  async clear() {
    try {
      if (fs.existsSync(this.memosDir)) {
        const files = fs.readdirSync(this.memosDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.promises.unlink(path.join(this.memosDir, file));
          }
        }
      }
      
      // Clear cache if using it
      if (this.useCache) {
        this.cache.clear();
      }
      
      return true;
    } catch (err) {
      debugModule(`Error clearing data store: ${err.message}`);
      throw err;
    }
  }
}

// Create an instance of the store
const createStore = (options) => {
  return new FileSystemStore(options);
};

module.exports = {
  createStore
};