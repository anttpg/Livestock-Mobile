const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require("body-parser");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const apiWrapper = require('../api/api');
const { createValidationMiddleware } = require('./inputValidation');
const { authenticate } = require('./accessControl');
const localFileOps = require('../api/local');

require('dotenv').config();

const app = express();
const fs = require('fs');
const https = require('https');

// CORS configuration for development
const allowedOrigins = [
  'http://localhost:8080',
  'http://192.168.1.242:8080',
  'http://192.168.1.87:8080'
];

// Add host domain to allowed origins
if (process.env.TUNNEL_HOST) {
  allowedOrigins.push(`http://${process.env.TUNNEL_HOST}`);
  allowedOrigins.push(`https://${process.env.TUNNEL_HOST}`);
}

console.log('Allowed origins:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn('Connection attempted from unauthorized origin. CORS blocked origin:', origin);
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
  rolling: true, // extend the session on each request
  cookie: {
    secure: !!(process.env.HOST_KEY && process.env.HOST_PEM),  // true if using HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000 // 1 hour
  }
}));

// extend session on any API call
app.use('/api/*', (req, res, next) => {
  // Skip session extension for time remaining checks
  if (req.path === '/api/session-time-remaining') {
    return next();
  }
  
  // Only extend session if user is logged in
  if (req.session && req.session.user) {
    req.session.touch();
  }
  next();
});

// Trust proxy specifically for Cloudflare
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Rate limiters
const loginLimiter = rateLimit({
 windowMs: 60 * 1000, // 1 minute
 max: 5,
 message: "Too many login attempts, please try again later.",
 keyGenerator: (req) => {
   // Use CF-Connecting-IP header from Cloudflare, fallback to remote address
   return req.get('CF-Connecting-IP') || req.ip || req.connection.remoteAddress;
 }
});

// const apiLimiter = rateLimit({
//  windowMs: 15 * 60 * 1000, // 15 minutes
//  max: 1500,
//  keyGenerator: (req) => {
//    // Use CF-Connecting-IP header from Cloudflare, fallback to remote address
//    return req.get('CF-Connecting-IP') || req.ip || req.connection.remoteAddress;
//  }
// });

// // Apply rate limiter to all API routes
// app.use('/api/', apiLimiter);

// Serve static files from existing structure
app.use('/cow-photos', express.static(path.join(__dirname, '../files/Cow Photos')));
app.use('/maps', express.static(path.join(__dirname, '../files/MapData')));

// Configure multer for file uploads
const upload = localFileOps.configureMulter();

// Login endpoint
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
        console.warn('Invalid login attempt from origin:', req.get('origin'), ' to user ', username);
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

// Get cow data
app.get('/api/cow/:tag', 
  createValidationMiddleware('getCowData'),
  async (req, res) => {
    return apiWrapper.getCowData(req, res);
  }
);

// Add observation
app.post('/api/add-observation',
  createValidationMiddleware('addObservation'),
  async (req, res) => {
    return apiWrapper.addObservation(req, res);
  }
);



// Get all medical data for a cow
app.get('/api/cow/:tag/medical',
  createValidationMiddleware('getCowData'),
  async (req, res) => {
    return apiWrapper.getCowMedicalRecords(req, res);
  }
);



// MEDICAL ROUTES
app.post('/api/medical/add-record',
  createValidationMiddleware('createMedicalRecord'),
  async (req, res) => {
    return apiWrapper.createMedicalRecord(req, res);
  }
);

app.get('/api/medical/get-record/:recordId',
  createValidationMiddleware('getMedicalRecord'),
  async (req, res) => {
    return apiWrapper.getMedicalRecordDetails(req, res);
  }
);

app.put('/api/medical/update-record/:recordId',
  createValidationMiddleware('updateMedicalRecord'),
  async (req, res) => {
    return apiWrapper.updateMedicalRecord(req, res);
  }
);

app.post('/api/medical/resolve-record/:recordId',
  createValidationMiddleware('resolveIssue'),
  async (req, res) => {
    return apiWrapper.resolveIssue(req, res);
  }
);

app.get('/api/medical/medicines',
  createValidationMiddleware('getMedicines'),
  async (req, res) => {
    return apiWrapper.getMedicines(req, res);
  }
);

app.post('/api/medical/medicines',
  createValidationMiddleware('addMedicine'),
  async (req, res) => {
    return apiWrapper.addMedicine(req, res);
  }
);

app.post('/api/medical/:recordId/upload-image',
    upload.single('image'), // Your existing multer middleware
    createValidationMiddleware('uploadMedicalImage'),
    async (req, res) => {
        return apiWrapper.uploadMedicalImage(req, res);
    }
);

app.get('/api/medical/:recordId/image/:imageType/:n?',
    createValidationMiddleware('getMedicalImage'),
    async (req, res) => {
        return apiWrapper.getMedicalImage(req, res);
    }
);

app.get('/api/medical/:recordId/image-count',
    createValidationMiddleware('getMedicalImageCount'),
    async (req, res) => {
        return apiWrapper.getMedicalImageCount(req, res);
    }
);


// Update cow weight
app.post('/api/update-weight',
  createValidationMiddleware('updateCowWeight'),
  async (req, res) => {
    return apiWrapper.updateCowWeight(req, res);
  }
);

// Record batch weights
app.post('/api/batch-weigh-in',
  createValidationMiddleware('recordBatchWeights'),
  async (req, res) => {
    return apiWrapper.recordBatchWeights(req, res);
  }
);

// BREEDING ROUTES

// Get all breeding plans
app.get('/api/breeding-plans', async (req, res) => {
  return apiWrapper.getBreedingPlans(req, res);
});

// Get breeding plan overview
app.get('/api/breeding-plan/:planId/overview',
  createValidationMiddleware('getBreedingPlanOverview'),
  async (req, res) => {
    return apiWrapper.getBreedingPlanOverview(req, res);
  }
);

// Get breeding candidates for pregnancy check
app.get('/api/breeding-candidates/:herdName',
  createValidationMiddleware('getHerdBreedingCandidates'),
  async (req, res) => {
    return apiWrapper.getHerdBreedingCandidates(req, res);
  }
);

// Submit pregnancy check results
app.post('/api/pregnancy-check',
  createValidationMiddleware('submitPregancyCheck'),
  async (req, res) => {
    return apiWrapper.submitPregancyCheck(req, res);
  }
);

// Get calving status for herd
app.get('/api/calving-status/:herdName',
  createValidationMiddleware('getCalvingStatus'),
  async (req, res) => {
    return apiWrapper.getCalvingStatus(req, res);
  }
);

// Add calving record
app.post('/api/calving-record',
  createValidationMiddleware('addCalvingRecord'),
  async (req, res) => {
    return apiWrapper.addCalvingRecord(req, res);
  }
);

// Get weaning candidates
app.get('/api/weaning-candidates/:herdName',
  createValidationMiddleware('getWeaningCandidates'),
  async (req, res) => {
    return apiWrapper.getWeaningCandidates(req, res);
  }
);

// Record weaning
app.post('/api/weaning-record',
  createValidationMiddleware('recordWeaning'),
  async (req, res) => {
    return apiWrapper.recordWeaning(req, res);
  }
);

// Generate tag suggestions
app.get('/api/tag-suggestions/:tag',
  createValidationMiddleware('generateTagSuggestions'),
  async (req, res) => {
    return apiWrapper.generateTagSuggestions(req, res);
  }
);





// Add new cow
app.post('/api/add-cow',
  createValidationMiddleware('addCow'),
  async (req, res) => {
    return apiWrapper.addCow(req, res);
  }
);

// Get all cows
app.get('/api/cows', async (req, res) => {
  return apiWrapper.getAllCows(req, res);
});


app.post('/api/set-herd',
  createValidationMiddleware('setHerd'), 
  async (req, res) => {
    return apiWrapper.setHerd(req, res);
  }
);


// Get all herds with details
app.get('/api/herds', async (req, res) => {
  return apiWrapper.getHerdsWithDetails(req, res);
});

// Get list of herds... is unessicary..? TODO look at.
app.get('/api/herds/list', async (req, res) => {
  return apiWrapper.getHerdsList(req, res);
});


// Get feed status for a specific herd
app.get('/api/herd/:herdName/feed-status', 
  createValidationMiddleware('getHerdFeedStatus'),
  async (req, res) => {
    return apiWrapper.getHerdFeedStatus(req, res);
  }
);

// Get all available feed types
app.get('/api/feed-types', async (req, res) => {
  return apiWrapper.getAllFeedTypes(req, res);
});

// Add a new feed type
app.post('/api/feed-types', 
  createValidationMiddleware('addFeedType'),
  async (req, res) => {
    return apiWrapper.addFeedType(req, res);
  }
);

// Record feed activity
app.post('/api/record-feed-activity',
  createValidationMiddleware('recordFeedActivity'),
  async (req, res) => {
    return apiWrapper.recordFeedActivity(req, res);
  }
);

// Get animals in a specific herd
app.get('/api/herd/:herdName/animals',
  createValidationMiddleware('getHerdAnimals'),
  async (req, res) => {
    return apiWrapper.getHerdAnimals(req, res);
  }
);

// Move herd to new pasture
app.post('/api/move-herd',
  createValidationMiddleware('moveHerd'),
  async (req, res) => {
    return apiWrapper.moveHerd(req, res);
  }
);

// Get all available pastures
app.get('/api/pastures', async (req, res) => {
  return apiWrapper.getAllPastures(req, res);
});

// Herd event management
app.get('/api/herds/:herdName/events', 
  createValidationMiddleware('getHerdEvents'),
  async (req, res) => {
    return apiWrapper.getHerdEvents(req, res);
  }
);

app.post('/api/herds/:herdName/events',
  createValidationMiddleware('addHerdEvent'), 
  async (req, res) => {
    return apiWrapper.addHerdEvent(req, res);
  }
);

// Pasture maintenance
app.get('/api/pastures/:pastureName/maintenance',
  createValidationMiddleware('getPastureMaintenanceEvents'),
  async (req, res) => {
    return apiWrapper.getPastureMaintenanceEvents(req, res);
  }
);

app.post('/api/pastures/maintenance',
  createValidationMiddleware('addPastureMaintenanceEvent'),
  async (req, res) => {
    return apiWrapper.addPastureMaintenanceEvent(req, res);
  }
);

// Herd splitting/creation
app.post('/api/herds/create',
  createValidationMiddleware('createHerd'),
  async (req, res) => {
    return apiWrapper.createHerd(req, res);
  }
);

app.post('/api/herds/batch-move',
  createValidationMiddleware('batchMoveCows'),
  async (req, res) => {
    return apiWrapper.batchMoveCows(req, res);
  }
);

// Cows organized by herd
app.get('/api/cows/by-herd', 
  async (req, res) => {
    return apiWrapper.getCowsByHerd(req, res);
  }
);

// User preferences
app.get('/api/users/:username/preferences',
  createValidationMiddleware('getUserPreferences'),
  async (req, res) => {
    return apiWrapper.getUserPreferences(req, res);
  }
);

app.put('/api/users/:username/preferences',
  createValidationMiddleware('updateUserPreferences'),
  async (req, res) => {
    return apiWrapper.updateUserPreferences(req, res);
  }
);

// Get form dropdown data
app.get('/api/form-dropdown-data', async (req, res) => {
  return apiWrapper.getFormDropdownData(req, res);
});

// Get nth cow image (headshot or body) - returns specific image by position
app.get('/api/cow/:tag/image/:imageType/:n',
  createValidationMiddleware('getNthCowImage'),
  async (req, res) => {
    return apiWrapper.getNthCowImage(req, res);
  }
);

// Get cow image count
app.get('/api/cow/:tag/image-count',
  createValidationMiddleware('getCowImageCount'),
  async (req, res) => {
    return apiWrapper.getCowImageCount(req, res);
  }
);

// Upload cow image (headshot or body only)
app.post('/api/cow/:tag/upload-image',
  upload.single('image'),
  createValidationMiddleware('uploadCowImage'),
  async (req, res) => {
    return apiWrapper.saveCowImage(req, res);
  }
);

// Get cow image (headshot or body) - returns most recent
app.get('/api/cow/:tag/image/:imageType',
  createValidationMiddleware('getCowImage'),
  async (req, res) => {
    return apiWrapper.getCowImage(req, res);
  }
);

// Get all cow images (list all headshots and bodyshots)
app.get('/api/cow/:tag/images',
  createValidationMiddleware('getCowImages'),
  async (req, res) => {
    return apiWrapper.getAllCowImages(req, res);
  }
);

// Get all of a cows' epds
app.get('/api/cow/:tag/epds',
  createValidationMiddleware('getCowEpds'),
  async (req, res) => {
    return apiWrapper.getCowEpds(req, res);
  }
);

// Get available bulls for breeding assignment
app.get('/api/breeding-animal-status', async (req, res) => {
    return apiWrapper.getBreedingAnimalStatus(req, res);
});

// Assign breeding records to a plan
app.post('/api/assign-breeding-records',
    createValidationMiddleware('assignBreedingRecords'),
    async (req, res) => {
        return apiWrapper.assignBreedingRecords(req, res);
    }
);


// Get main map
app.get('/api/map', async (req, res) => {
  // If requesting a specific image file
  if (req.query.image) {
    return apiWrapper.getMapImage(req, res);
  }
  
  // Otherwise return JSON metadata
  return apiWrapper.getMap(req, res);
});


// Get minimap for specific field
app.get('/api/minimap/:fieldName',
  createValidationMiddleware('getMinimap'),
  async (req, res) => {
    return apiWrapper.getMinimap(req, res);
  }
);

// Get list of available minimap fields
app.get('/api/minimaps', async (req, res) => {
  return apiWrapper.getAvailableMinimaps(req, res);
});



// SHEET ROUTES

// Get all sheets
app.get('/api/sheets/all-sheets', async (req, res) => {
  return apiWrapper.getAllSheets(req, res);
});

// Get available columns
app.get('/api/sheets/available-columns', async (req, res) => {
  return apiWrapper.getAvailableColumns(req, res);
});

// Load sheet data
app.post('/api/sheets/load',
  createValidationMiddleware('loadSheet'),
  async (req, res) => {
    return apiWrapper.loadSheet(req, res);
  }
);

// Update individual sheet cell
app.post('/api/sheets/update-cell',
  createValidationMiddleware('updateSheetCell'),
  async (req, res) => {
    return apiWrapper.updateSheetCell(req, res);
  }
);

// Update multiple cells at once
app.post('/api/sheets/batch-update',
  createValidationMiddleware('batchUpdateSheet'),
  async (req, res) => {
    return apiWrapper.batchUpdateSheetCells(req, res);
  }
)



// Sheet structure
app.get('/api/sheets/structure/:sheetId',
  createValidationMiddleware('getSheetStructure'),
  async (req, res) => {
    return apiWrapper.getSheetStructure(req, res);
  }
);

// Update existing sheet structure
app.put('/api/sheets/update-structure/:sheetId',
  createValidationMiddleware('updateSheet'),
  async (req, res) => {
    return apiWrapper.updateSheet(req, res);
  }
);

// Create new sheet
app.post('/api/sheets/create',
  createValidationMiddleware('createSheet'),
  async (req, res) => {
    return apiWrapper.createSheet(req, res);
  }
);

// Delete sheet
app.delete('/api/sheets/delete/:sheetId',
  createValidationMiddleware('deleteSheet'),
  async (req, res) => {
    return apiWrapper.deleteSheet(req, res);
  }
);


app.get('/api/extend-session', (req, res) => {
  if (req.session && req.session.user) {
    req.session.touch();
    res.json({ success: true, extended: true });
  } else {
    res.status(401).json({ success: false, message: 'No active session' });
  }
});

app.get('/api/session-time-remaining', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ authenticated: false });
  }
  let remaining = 0;
  
  if (req.session.cookie._expires) {
    // Calculate remaining time from expiration date
    remaining = Math.max(0, req.session.cookie._expires.getTime() - Date.now());
  } else if (req.session.cookie.maxAge) {
    // Fallback to maxAge if expires is not set
    remaining = req.session.cookie.maxAge;
  }
  
  res.json({ 
    authenticated: true,
    remainingMs: remaining,
    remainingMinutes: Math.floor(remaining / 60000)
  });
});

// 404 handler for unmatched API routes (keep this at the end)
app.use('/api/*', (req, res) => {
  console.error(`Unmatched API call: ${req.method} ${req.path}`);
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

// Check if SSL certificates are provided
if (process.env.HOST_KEY && process.env.HOST_PEM) {
  // HTTPS Server
  const httpsOptions = {
    key: fs.readFileSync(process.env.HOST_KEY),
    cert: fs.readFileSync(process.env.HOST_PEM)
  };
  
  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`SessionManager API running on HTTPS port ${PORT}`);
    console.log(`Local file path: ${process.env.LOCAL_PATH || './files'}`);
  });
} else {
  // HTTP Server (fallback)
  app.listen(PORT, () => {
    console.log(`SessionManager API running on HTTP port ${PORT}`);
    console.log(`WARNING: Running without SSL. Set HOST_KEY and HOST_PEM in .env for HTTPS.`);
  });
}