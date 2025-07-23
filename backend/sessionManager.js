// sessionManager.js - Updated to use centralized API wrapper
const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require("body-parser");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

// Import new centralized modules
const apiWrapper = require('../db/api');
const { authenticate } = require('../db/accessControl');
const { createValidationMiddleware, getValidationRules } = require('../db/inputValidation');
const localFileOps = require('../db/local');

require('dotenv').config();

const app = express();

// CORS configuration for development
const allowedOrigins = [
  'http://localhost',
  'http://localhost:80',
  'http://localhost:8080',
  'http://localhost:5173',
  'https://localhost',
  'https://localhost:443'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// Body parser
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600000 // 1 hour
  }
}));

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: "Too many login attempts, please try again later."
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});

// Apply rate limiter to all API routes
app.use('/api/', apiLimiter);

// Serve static images - now using local file operations
app.use('/images', express.static(path.join(__dirname, '../files/images')));
app.use('/documents', express.static(path.join(__dirname, '../files/documents')));

// Configure multer for file uploads
const upload = localFileOps.configureMulter();

// AUTH ROUTES //

// Login endpoint - now uses centralized authentication
app.post('/api/login',
  loginLimiter,
  createValidationMiddleware('login'),
  async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const authResult = await authenticate(username, password);
      
      if (authResult.success) {
        req.session.user = authResult.user;
        
        // Store database config if SQL authentication
        if (authResult.dbConfig) {
          req.session.dbUser = username;
          req.session.dbPassword = password;
          req.session.dbConfig = authResult.dbConfig;
        }
        
        req.session.save(() => {
          return res.json({ 
            success: true, 
            user: authResult.user,
            authMode: process.env.AUTH_MODE || 'temp'
          });
        });
      } else {
        return res.status(401).json({ 
          success: false, 
          message: authResult.message 
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Authentication service error' 
      });
    }
  }
);

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Error logging out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Auth check endpoint
app.get('/api/check-auth', (req, res) => {
  if (req.session.user) {
    res.json({ 
      authenticated: true, 
      user: req.session.user,
      authMode: process.env.AUTH_MODE || 'temp'
    });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// DATA ROUTES - Now using API wrapper with forced validation //

// Get cow data
app.get('/api/cow/:tag', 
  createValidationMiddleware('getCowData'),
  async (req, res) => {
    return apiWrapper.getCowData(req, res, getValidationRules('getCowData'));
  }
);

// Add observation
app.post('/api/add-observation',
  createValidationMiddleware('addObservation'),
  async (req, res) => {
    return apiWrapper.addObservation(req, res, getValidationRules('addObservation'));
  }
);

// Add medical record
app.post('/api/add-medical-record',
  createValidationMiddleware('addMedicalRecord'),
  async (req, res) => {
    return apiWrapper.addMedicalRecord(req, res, getValidationRules('addMedicalRecord'));
  }
);

// Update cow weight
app.post('/api/update-weight',
  createValidationMiddleware('updateCowWeight'),
  async (req, res) => {
    return apiWrapper.updateCowWeight(req, res, getValidationRules('updateCowWeight'));
  }
);

// Add new cow
app.post('/api/add-cow',
  createValidationMiddleware('addCow'),
  async (req, res) => {
    const { cowTag, dateOfBirth, description, dam, sire } = req.body;
    return apiWrapper.executeOperation(req, res, getValidationRules('addCow'), 'addCow', {
      cowTag, dateOfBirth, description, dam, sire
    });
  }
);

// Get all cows with pagination
app.get('/api/cows', async (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query;
  return apiWrapper.executeOperation(req, res, [], 'getAllCows', {
    page: parseInt(page),
    limit: parseInt(limit),
    search
  });
});

// Delete cow
app.delete('/api/cow/:tag',
  createValidationMiddleware('deleteCow'),
  async (req, res) => {
    const cowTag = req.params.tag;
    return apiWrapper.executeOperation(req, res, getValidationRules('deleteCow'), 'deleteCow', {
      cowTag
    });
  }
);

// FILE UPLOAD ROUTES //

// Upload cow image (headshot or body)
app.post('/api/cow/:tag/upload-image',
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      const { tag } = req.params;
      const { imageType } = req.body; // 'headshot' or 'body'

      const result = await localFileOps.saveCowImage({
        cowTag: tag,
        imageType: imageType,
        fileBuffer: req.file.buffer,
        originalFilename: req.file.originalname
      });

      res.json(result);
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Upload cow document
app.post('/api/cow/:tag/upload-document',
  upload.single('document'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No document file provided' });
      }

      const { tag } = req.params;
      const { documentType } = req.body;

      const result = await localFileOps.saveDocument({
        cowTag: tag,
        documentType: documentType || 'general',
        fileBuffer: req.file.buffer,
        originalFilename: req.file.originalname
      });

      res.json(result);
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Get cow files list
app.get('/api/cow/:tag/files', async (req, res) => {
  try {
    const { tag } = req.params;
    const result = await localFileOps.listCowFiles({ cowTag: tag });
    res.json(result);
  } catch (error) {
    console.error('File list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download cow image
app.get('/api/cow/:tag/image/:imageType', async (req, res) => {
  try {
    const { tag, imageType } = req.params;
    const result = await localFileOps.getCowImage({ cowTag: tag, imageType });
    
    if (result.success) {
      res.set({
        'Content-Type': result.mimeType,
        'Content-Length': result.size,
        'Content-Disposition': `inline; filename="${result.filename}"`
      });
      res.send(result.fileBuffer);
    } else {
      res.status(404).json({ error: result.message });
    }
  } catch (error) {
    console.error('Image download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// MAINTENANCE ROUTES //

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    authMode: process.env.AUTH_MODE || 'temp',
    version: '2.0.0'
  });
});

// System info (admin only - TODO: implement role-based access)
app.get('/api/system-info', async (req, res) => {
  try {
    res.json({
      environment: process.env.NODE_ENV || 'development',
      authMode: process.env.AUTH_MODE || 'temp',
      localPath: process.env.LOCAL_PATH || './files',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get system info' });
  }
});

// Cleanup old files (admin only)
app.post('/api/cleanup-files', async (req, res) => {
  try {
    const { daysOld = 365 } = req.body;
    const result = await localFileOps.cleanupOldFiles(daysOld);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
  console.log(`Authentication mode: ${process.env.AUTH_MODE || 'temp'}`);
  console.log(`Local file path: ${process.env.LOCAL_PATH || './files'}`);
  console.log('Available endpoints:');
  console.log('Auth: /api/login, /api/logout, /api/check-auth');
  console.log('Cows: /api/cows, /api/cow/:tag');
  console.log('Data: /api/add-observation, /api/add-medical-record');
  console.log('Files: /api/cow/:tag/upload-image, /api/cow/:tag/files');
  console.log('Health: /api/health');
});