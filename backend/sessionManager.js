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

// CORS configuration for development
const allowedOrigins = [
  'http://localhost:8080',
  'http://192.168.1.242:8080'
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
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600000 // 1 hour
  }
}));


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

// Add medical record
app.post('/api/add-medical-record',
  createValidationMiddleware('addMedicalRecord'),
  async (req, res) => {
    return apiWrapper.addMedicalRecord(req, res);
  }
);

// Update cow weight
app.post('/api/update-weight',
  createValidationMiddleware('updateCowWeight'),
  async (req, res) => {
    return apiWrapper.updateCowWeight(req, res);
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

// Get all available sheets
app.get('/api/sheets/all-sheets', async (req, res) => {
  return apiWrapper.getAllSheets(req, res);
});

// Get available columns for sheet editor
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

// Get list of herds for dropdown
app.get('/api/herds/list', async (req, res) => {
  return apiWrapper.getHerdsList(req, res);
});

// Sheet structure management (for editor - placeholder)
app.get('/api/sheets/structure/:sheetId',
  createValidationMiddleware('getSheetStructure'),
  async (req, res) => {
    return apiWrapper.getSheetStructure(req, res);
  }
);

// Create new sheet (placeholder)
app.post('/api/sheets/create',
  createValidationMiddleware('createSheet'),
  async (req, res) => {
    return apiWrapper.createSheet(req, res);
  }
);

// Update existing sheet (placeholder)
app.put('/api/sheets/update/:sheetId',
  createValidationMiddleware('updateSheet'),
  async (req, res) => {
    return apiWrapper.updateSheet(req, res);
  }
);

// Delete sheet (placeholder)
app.delete('/api/sheets/delete/:sheetId',
  createValidationMiddleware('deleteSheet'),
  async (req, res) => {
    return apiWrapper.deleteSheet(req, res);
  }
);

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  console.error(`Unmatched API call`)
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
  console.log(`Cattle Management API Server v3.0 running on port ${PORT}`);
  console.log(`Local file path: ${process.env.LOCAL_PATH || './files'}`);
  console.log('Available endpoints:');
  console.log('Auth: /api/login, /api/logout, /api/check-auth');
  console.log('Cows: /api/cows, /api/cow/:tag');
  console.log('Data: /api/add-observation, /api/add-medical-record');
  console.log('Images: /api/cow/:tag/upload-image, /api/cow/:tag/image/:type, /api/cow/:tag/images');
  console.log('Maps: /api/map, /api/minimap/:fieldName, /api/minimaps');

});