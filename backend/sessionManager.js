const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require("body-parser");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');


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
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.resetUserPassword(req, res);
    }
);

// Update user permissions
app.post('/api/users/update-permissions',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.updateUserPermissions(req, res);
    }
);

// Block user account
app.post('/api/users/block',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.blockUser(req, res);
    }
);

// Unblock user account
app.post('/api/users/unblock',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.unblockUser(req, res);
    }
);

// Pre-register user
app.post('/api/users/pre-register',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.preRegisterUser(req, res);
    }
);

// Delete user account
app.delete('/api/users/delete',
    requireAuth(),
    requireAdmin(),
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.deleteUser(req, res);
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

// Latency ping
app.get('/api/dev/network/ping',
    requireAuth(), requireDev(),
    (req, res) => res.json({ pong: true, ts: Date.now() })
);

// Download speed test, serves N bytes of dummy data
app.get('/api/dev/network/download-test',
    requireAuth(), requireDev(),
    (req, res) => {
        const size = Math.min(parseInt(req.query.size) || 5242880, 20971520); // cap at 20MB
        const buf = Buffer.alloc(size, 0x41);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', size);
        res.setHeader('Cache-Control', 'no-store');
        res.send(buf);
    }
);

// Upload speed test — just accepts the body and acks
app.post('/api/dev/network/upload-test',
    requireAuth(), requireDev(),
    (req, res) => {
        req.resume(); // drain the body without storing it
        req.on('end', () => res.json({ received: req.headers['content-length'], ts: Date.now() }));
    }
);



















// START CHANGES cow data
app.get('/api/cows/invalid-tag-chars',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.getInvalidCowTagCharacters(req, res);
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
app.post('/api/medical/record',
  createValidationMiddleware('createMedicalRecord'),
  async (req, res) => {
    return apiWrapper.createMedicalRecord(req, res);
  }
);

app.get('/api/medical/record/:recordId',
  createValidationMiddleware('getMedicalRecord'),
  async (req, res) => {
    return apiWrapper.getMedicalRecord(req, res);
  }
);

app.put('/api/medical/record/:recordId',
  createValidationMiddleware('updateMedicalRecord'),
  async (req, res) => {
    return apiWrapper.updateMedicalRecord(req, res);
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






// Get all medical data for a cow
app.get('/api/medical/*',
  createValidationMiddleware('', true),
  async (req, res) => {
    req.params.tag = req.params[0];
    return apiWrapper.getCowMedicalRecords(req, res);
  }
);






// CUSTOMERS
app.get('/api/customers',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.getCustomers(req, res);
  }
);

app.post('/api/customers',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.addCustomer(req, res);
  }
);

app.put('/api/customers/:NameFirstLast',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.updateCustomer(req, res);
  }
);



// SALES / PURCHASE ROUTES
app.get('/api/sales',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.getAllSales(req, res);
  }
);

app.get('/api/sales/:ID',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.getSaleRecord(req, res);
  }
);

app.post('/api/sales',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.createSaleRecord(req, res);
  }
);

app.put('/api/sales/:ID',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.updateSaleRecord(req, res);
  }
);



app.get('/api/purchases',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.getAllPurchases(req, res);
  }
);

app.get('/api/purchases/:ID',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.getPurchaseRecord(req, res);
  }
);

app.post('/api/purchases',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.createPurchaseRecord(req, res);
  }
);

app.put('/api/purchases/:ID',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.updatePurchaseRecord(req, res);
  }
);























// Update cow weight
app.post('/api/cow/weight',
  createValidationMiddleware('updateWeightRecord'),
  async (req, res) => {
    return apiWrapper.updateWeightRecord(req, res);
  }
);

// Create new cow weight record
app.put('/api/cow/weight',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.createWeightRecord(req, res);
  }
);


// Record batch weights
// app.post('/api/batch-weigh-in',
//   createValidationMiddleware('createWeightRecordBatch'),
//   async (req, res) => {
//     return apiWrapper.createWeightRecordBatch(req, res);
//   }
// );


// BREEDING ROUTES

// Generic animal-by-type getter
app.get('/api/bulls',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getBulls(req, res)
);

app.get('/api/unweaned-calves',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getUnweanedCalves(req, res)
);

// Breeding Plans
app.get('/api/breeding-plans',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getBreedingPlans(req, res)
);

app.post('/api/breeding-plans',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.createBreedingPlan(req, res)
);

app.get('/api/breeding-plans/:planId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getBreedingPlan(req, res)
);

app.put('/api/breeding-plans/:planId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.updateBreedingPlan(req, res)
);

app.delete('/api/breeding-plans/:planId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteBreedingPlan(req, res)
);

app.get('/api/breeding-plans/:planId/overview',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getBreedingOverview(req, res)
);


// Breeding Records

app.get('/api/breeding-records',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getBreedingRecords(req, res)
);

app.post('/api/breeding-records',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.createBreedingRecord(req, res)
);

app.post('/api/breeding-records/refresh-status',
    // requireAuth(),
    // requireDev(),
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.refreshBreedingStatuses(req, res)
);

app.get('/api/breeding-records/:recordId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getBreedingRecord(req, res)
);

app.put('/api/breeding-records/:recordId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.updateBreedingRecord(req, res)
);

app.delete('/api/breeding-records/:recordId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteBreedingRecord(req, res)
);







// Pregnancy Checks

app.get('/api/pregnancy-checks',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getPregancyChecks(req, res)
);

app.post('/api/pregnancy-checks',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.createPregancyCheck(req, res)
);

app.get('/api/pregnancy-checks/unlinked',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getUnlinkedPregancyChecks(req, res)
);


app.get('/api/pregnancy-checks/:recordId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getPregancyCheck(req, res)
);

app.put('/api/pregnancy-checks/:recordId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.updatePregancyCheck(req, res)
);

app.delete('/api/pregnancy-checks/:recordId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deletePregancyCheck(req, res)
);


// Calving Records

app.get('/api/calving-records',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getCalvingRecords(req, res)
);

app.post('/api/calving-records',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.createCalvingRecord(req, res)
);

app.get('/api/calving-records/unlinked',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getUnlinkedCalvingRecords(req, res)
);


app.get('/api/calving-records/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getCalvingRecord(req, res)
);

app.put('/api/calving-records/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.updateCalvingRecord(req, res)
);

app.delete('/api/calving-records/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteCalvingRecord(req, res)
);





// Weaning

app.get('/api/weaning-records',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getWeaningRecords(req, res)
);

app.get('/api/weaning-records/unlinked',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getUnlinkedWeaningRecords(req, res)
);

app.post('/api/weaning-records',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.createWeaningRecord(req, res)
);

app.get('/api/weaning-records/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getWeaningRecord(req, res)
);

app.put('/api/weaning-records/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.updateWeaningRecord(req, res)
);

app.delete('/api/weaning-records/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteWeaningRecord(req, res)
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







// All animals (including inactive)
app.get('/api/animals', async (req, res) => {
    return apiWrapper.getAllAnimals(req, res, { activeOnly: false });
});

// Active animals only
app.get('/api/animals/active', async (req, res) => {
    return apiWrapper.getAllAnimals(req, res, { activeOnly: true });
});

// Add new cow
app.post('/api/cows',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.addCow(req, res);
  }
);






// All active herds
app.get('/api/herds', async (req, res) => {
    return apiWrapper.getHerds(req, res);
});

// Get a specific herd animal
app.get('/api/herds/:herdName/animals', 
    createValidationMiddleware('', true),
    async (req, res) => {
      return apiWrapper.getHerdAnimals(req, res);
    }
);

// Move herd to new pasture
app.post('/api/herds/pasture',
  createValidationMiddleware('moveHerd'),
  async (req, res) => {
    return apiWrapper.moveHerd(req, res);
  }
);

// Herd splitting/creation
app.post('/api/herds/create',
  createValidationMiddleware('createHerd'),
  async (req, res) => {
    return apiWrapper.createHerd(req, res);
  }
);


// Herd note routes
app.post('/api/herds/notes',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.addHerdNote(req, res);
  }
);

app.get('/api/herds/notes/:noteId',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.getHerdNote(req, res);
  }
);

app.put('/api/herds/notes/:noteId',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.updateHerdNote(req, res);
  }
);

app.delete('/api/herds/notes/:noteId',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.deleteHerdNote(req, res);
  }
);




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

// Get all available pastures
app.get('/api/pastures', async (req, res) => {
  return apiWrapper.getAllPastures(req, res);
});






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











// Equipment
app.get('/api/equipment',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getEquipmentRecords(req, res)
);
app.post('/api/equipment',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.createEquipment(req, res)
);
app.get('/api/equipment/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getEquipmentRecord(req, res)
);
app.put('/api/equipment/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.updateEquipment(req, res)
);
app.delete('/api/equipment/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteEquipment(req, res)
);

// Equipment Maintenance
app.get('/api/equipment-maintenance',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getEquipmentMaintenanceRecords(req, res)
);
app.post('/api/equipment-maintenance',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.createEquipmentMaintenanceRecord(req, res)
);
app.get('/api/equipment-maintenance/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getEquipmentMaintenanceRecord(req, res)
);
app.put('/api/equipment-maintenance/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.updateEquipmentMaintenanceRecord(req, res)
);
app.delete('/api/equipment-maintenance/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteEquipmentMaintenanceRecord(req, res)
);

// Equipment Parts
app.get('/api/equipment-parts',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getEquipmentParts(req, res)
);
app.post('/api/equipment-parts',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.createEquipmentPart(req, res)
);
app.get('/api/equipment-parts/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getEquipmentPart(req, res)
);
app.put('/api/equipment-parts/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.updateEquipmentPart(req, res)
);
app.delete('/api/equipment-parts/:id',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteEquipmentPart(req, res)
);































// User preferences
app.get('/api/users/:username/preferences',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.getUserPreferences(req, res);
  }
);

app.put('/api/users/:username/preferences',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.updateUserPreferences(req, res);
  }
);



// Get form dropdown data
app.get('/api/form-dropdown-data', async (req, res) => {
  return apiWrapper.getFormDropdownData(req, res);
});

app.post('/api/form-dropdown-data',
  createValidationMiddleware('', true),
  async (req, res) => {
    return apiWrapper.addFormDropdownData(req, res);
  }
);




// Move one or more cows to a different herd
app.patch('/api/cows/herd',
  createValidationMiddleware('setCowsHerd'),
  async (req, res) => {
    return apiWrapper.setCowsHerd(req, res);
  }
);

// Move one or more goat to a different herd
app.patch('/api/goats/herd',
  createValidationMiddleware('setGoatsHerd'),
  async (req, res) => {
    return apiWrapper.setGoatsHerd(req, res);
  }
);






// Get all of a cows' epds
app.get('/api/cow/*/epds',
  createValidationMiddleware('', true),
  async (req, res) => {
    req.params.tag = req.params[0];
    return apiWrapper.getCowEpds(req, res);
  }
);

app.get('/api/cow/accounting/*',
  createValidationMiddleware('', true),
  async (req, res) => {
    req.params.cowTag = req.params[0];
    return apiWrapper.getCowAccounting(req, res);
  }
);

app.get('/api/cow/*', 
    requireAuth(),
    createValidationMiddleware('', true),
    async (req, res) => {
        req.params.tag = req.params[0];
        return apiWrapper.getCowData(req, res);
    }
);

app.put('/api/cow/*',
    requireAuth(),
    createValidationMiddleware('', true),
    async (req, res) => {
        req.params.cowTag = req.params[0];
        return apiWrapper.updateCow(req, res);
    }
);




// Get notes
app.get('/api/notes/*',
    requireAuth(),
    createValidationMiddleware('', true),
    async (req, res) => {
        const [entityType, ...rest] = req.params[0].split('/');
        req.params.entityType = entityType;
        req.params.entityId = rest.join('/');
        return apiWrapper.getNotes(req, res);
    }
);



// Generate tag suggestions
app.get('/api/tag-suggestions/*',
  createValidationMiddleware('generateTagSuggestions'),
  async (req, res) => {
    req.params.tag = req.params[0];
    return apiWrapper.generateTagSuggestions(req, res);
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





// Generic image operations, add new domains via IMAGE_DOMAIN_CONFIG in APIWrapper

// List filenames in a domain/record directory
app.get('/api/images/:domain/:recordId/files',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.listImages(req, res)
);

// Serve a specific file by name
app.get('/api/images/:domain/:recordId/file/:filename',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getImageByName(req, res)
);

app.post('/api/images/:domain/:recordId',
    upload.single('image'),
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.uploadImage(req, res)
);

app.get('/api/images/:domain/:recordId/count',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getImageCount(req, res)
);

app.get('/api/images/:domain/:recordId/photo/:n?',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getImage(req, res)
);

app.delete('/api/images/:domain/:recordId/:filename',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteImage(req, res)
);




// Generic file upload operations

const uploadAny = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 }
    // No fileFilter, accepts any file type
});

// Generic file operations
app.post('/api/files/:domain/:recordId',
    uploadAny.single('file'),
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.uploadFile(req, res)
);

app.get('/api/files/:domain/:recordId',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.listDomainFiles(req, res)
);

app.get('/api/files/:domain/:recordId/:filename',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.getFile(req, res)
);

app.delete('/api/files/:domain/:recordId/:filename',
    createValidationMiddleware('', true),
    async (req, res) => apiWrapper.deleteDomainFile(req, res)
);










// SHEET TEMPLATE ROUTES

app.get('/api/sheets/all-sheets', async (req, res) => {
    return apiWrapper.getAllSheets(req, res);
});

app.get('/api/sheets/structure/:sheetId',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.getSheet(req, res);
    }
);

app.get('/api/sheets/available-columns', async (req, res) => {
    return apiWrapper.getAvailableColumns(req, res);
});

app.get('/api/sheets/:templateId/preview-columns', async (req, res) => {
    return apiWrapper.getTemplatePreviewColumns(req, res);
});


app.post('/api/sheets/create',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.createSheet(req, res);
    }
);

app.put('/api/sheets/update-structure/:sheetId',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.updateSheet(req, res);
    }
);

app.delete('/api/sheets/delete/:sheetId',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.deleteSheetTemplate(req, res);
    }
);











// SHEET INSTANCE ROUTES


app.get('/api/sheets/instances/all', async (req, res) => {
    return apiWrapper.getAllSheetInstances(req, res);
});

app.get('/api/sheets/:templateId/instances',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.getTemplateInstances(req, res);
    }
);

app.get('/api/sheets/instances/:instanceId',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.getSheetInstance(req, res);
    }
);

app.get('/api/sheets/instances/:instanceId/load',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.loadSheetInstance(req, res);
    }
);

app.post('/api/sheets/:templateId/instances/create',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.createSheetInstance(req, res);
    }
);

app.post('/api/sheets/instances/try-load',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.tryLoadSheetInstance(req, res);
    }
);

app.put('/api/sheets/instances/:instanceId',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.updateSheetInstance(req, res);
    }
);

app.patch('/api/sheets/instances/:instanceId/cell',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.updateSheetCell(req, res);
    }
);

app.put('/api/sheets/instances/:instanceId/cells',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.bulkUpdateSheetRows(req, res);
    }
);

app.delete('/api/sheets/instances/:instanceId',
    createValidationMiddleware('', true),
    async (req, res) => {
        return apiWrapper.deleteSheetInstance(req, res);
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