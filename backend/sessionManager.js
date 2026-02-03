const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require("body-parser");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const apiWrapper = require('../api/api');
const { createValidationMiddleware } = require('./inputValidation');
const { 
    initialize, 
    authenticate, 
    login, 
    register, 
    setPassword,
    requireAuth,
    requireAdmin,
    requireDev
} = require('../backend/accessControl');
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
  // allowedOrigins.push(`http://${process.env.TUNNEL_HOST_ALT}`); // If these exist, use them
  // allowedOrigins.push(`https://${process.env.TUNNEL_HOST_ALT}`);
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




// Initialize user system on server start
(async () => {
    try {
        await initialize();
    } catch (error) {
        console.error('Failed to initialize user system:', error);
        process.exit(1);
    }
})();

// Serve static files from existing structure
app.use('/cow-photos', express.static(path.join(__dirname, '../files/Cow Photos')));
app.use('/maps', express.static(path.join(__dirname, '../files/MapData')));

// Configure multer for file uploads
const upload = localFileOps.configureMulter();

// Get authenticated user's email and determine auth state (registration/password setup/login needed)
app.get('/api/auth/check', async (req, res) => {
    return authenticate(req, res);
});

// Get the user's email from Cloudflare Access header (for auto-filling forms)
app.get('/api/auth/email', async (req, res) => {
    return apiWrapper.getUserEmail(req, res);
});

// Register new user account
app.post('/api/auth/register',
    createValidationMiddleware('register'),
    async (req, res) => {
        return register(req, res);
    }
);

// Set or reset password for existing user
app.post('/api/auth/set-password',
    createValidationMiddleware('setPassword'),
    async (req, res) => {
        return setPassword(req, res);
    }
);

// Login with email and password
app.post('/api/login',
    loginLimiter,
    createValidationMiddleware('login'),
    async (req, res) => {
        return login(req, res);
    }
);

// Logout and destroy session
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ 
                success: false,
                error: 'Error logging out' 
            });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// Check if user has active session
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ 
            authenticated: true, 
            user: {
                id: req.session.user.id,
                username: req.session.user.username,
                email: req.session.user.email,
                permissions: req.session.user.permissions
            }
        });
    } else {
        res.status(401).json({ authenticated: false });
    }
});


// ADMIN ONLY
// Get all users
app.get('/api/users',
    requireAuth(),
    requireAdmin(),
    async (req, res) => {
        return apiWrapper.getAllUsers(req, res);
    }
);

// Reset user password
app.post('/api/users/reset-password',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('resetPassword'),
    async (req, res) => {
        return apiWrapper.resetUserPassword(req, res);
    }
);

// Update user permissions
app.post('/api/users/update-permissions',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('updatePermissions'),
    async (req, res) => {
        return apiWrapper.updateUserPermissions(req, res);
    }
);

// Block user account
app.post('/api/users/block',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('blockUser'),
    async (req, res) => {
        return apiWrapper.blockUser(req, res);
    }
);

// Unblock user account
app.post('/api/users/unblock',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('unblockUser'),
    async (req, res) => {
        return apiWrapper.unblockUser(req, res);
    }
);

// Pre-register user
app.post('/api/users/pre-register',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('preRegisterUser'),
    async (req, res) => {
        return apiWrapper.preRegisterUser(req, res);
    }
);





// DEV ONLY

// Get backend log file
app.get('/api/dev/logs/backend',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.getBackendLog(req, res);
    }
);

// Get frontend log file
app.get('/api/dev/logs/frontend',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.getFrontendLog(req, res);
    }
);

// Clear backend log
app.post('/api/dev/logs/backend/clear',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.clearBackendLog(req, res);
    }
);

// Clear frontend log
app.post('/api/dev/logs/frontend/clear',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.clearFrontendLog(req, res);
    }
);


// Because these functions are sensitive, perform validation in the function itself. 
// Ensures we cant possibly call it with improper permissions.
// Execute console command
app.post('/api/dev/console',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.executeConsoleCommand(req, res);
    }
);

// Connect to SQL Server
app.post('/api/dev/sql/connect',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.connectSqlServer(req, res);
    }
);

// Execute SQL query
app.post('/api/dev/sql/execute',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.executeSqlQuery(req, res);
    }
);

// Backup SQL database (creates backup on server)
app.post('/api/dev/sql/backup',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.backupSqlDatabase(req, res);
    }
);

// Backup and download SQL database
app.get('/api/dev/sql/download',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.getSqlDatabase(req, res);
    }
);

// Close dev SQL connection
app.post('/api/dev/sql/disconnect',
    requireAuth(),
    requireDev(),
    async (req, res) => {
        return apiWrapper.closeDevSqlConnection(req, res);
    }
);







// cow data
app.get('/api/cow/:tag', 
    requireAuth(),
    createValidationMiddleware('getCowData'),
    async (req, res) => {
        return apiWrapper.getCowData(req, res);
    }
);

app.put('/api/cow/:cowTag',
    requireAuth(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.updateCow(req, res);
    }
);


// Add observation
app.post('/api/add-note',
    requireAuth(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.addNote(req, res);
    }
);

// Update note
app.post('/api/update-note',
    requireAuth(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.updateNote(req, res);
    }
);

// Delete note
app.post('/api/delete-note',
    requireAuth(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.deleteNote(req, res);
    }
);






// MEDICAL ROUTES
app.post('/api/medical/add-record',
  createValidationMiddleware('createMedicalRecord'),
  async (req, res) => {
    return apiWrapper.createMedicalRecord(req, res);
  }
);

// Get all medical data for a cow
app.get('/api/cow/:tag/medical',
  createValidationMiddleware('getCowData'),
  async (req, res) => {
    return apiWrapper.getCowMedicalRecords(req, res);
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
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.addMedicine(req, res);
  }
);

app.put('/api/medical/medicines/:ID',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.updateMedicine(req, res);
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

app.post('/api/form-dropdown-data',
  createValidationMiddleware('', useGenericValidation=true),
  async (req, res) => {
    return apiWrapper.addFormDropdownData(req, res);
  }
);



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


// Get all instances across all sheets
app.get('/api/sheets/instances/all', async (req, res) => {
  return apiWrapper.getAllInstances(req, res);
});

// Get all instances for a specific sheet
app.get('/api/sheets/:sheetId/instances', async (req, res) => {
  return apiWrapper.getSheetInstances(req, res);
});

// Load a specific instance with all data
app.get('/api/sheets/instances/:instanceId', async (req, res) => {
  return apiWrapper.loadSheetInstance(req, res);
});

// Create a new instance
app.post('/api/sheets/:sheetId/instances/create',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.createSheetInstance(req, res);
  }
);

// Try to load instance by ID, or create new one if not found
app.post('/api/sheets/instances/try-load',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.tryLoadSheetInstance(req, res);
  }
);

// Update a single cell in an instance
app.put('/api/sheets/instances/:instanceId/cell',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.updateSheetInstanceCell(req, res);
  }
);

// Batch update multiple cells in an instance
app.put('/api/sheets/instances/:instanceId/cells',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.batchUpdateSheetInstanceCells(req, res);
  }
);

// Delete an instance
app.delete('/api/sheets/instances/:instanceId', async (req, res) => {
  return apiWrapper.deleteSheetInstance(req, res);
});







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