// sessionManager.js - API ONLY VERSION
const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require("body-parser");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { fetchCowData } = require('../db/dbOperations');
const { body, validationResult } = require('express-validator');

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
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow cookies
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
    secure: false,           // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600000          // 1 hour
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

// Serve static images
app.use('/images', express.static(path.join(__dirname, '../images')));

// ------------- AUTH ROUTES ------------- //

// Login endpoint
app.post('/api/login',
  loginLimiter,
  [
    body('username').isString().trim().notEmpty(),
    body('password').isString().notEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // TODO: Replace with real authentication against database
    if (username === 'testUser' && password === 'testPass') {
      req.session.user = { username };
      req.session.save(() => {
        return res.json({ success: true, user: { username } });
      });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
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
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// ------------- API MIDDLEWARE ------------- //

// API authentication middleware
const apiAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// ------------- DATA ROUTES ------------- //

// Observation validation
const addObservationValidation = [
  body('cowTag').isString().trim().notEmpty().matches(/^[A-Za-z0-9-]+$/),
  body('note').isString().trim().notEmpty(),
  body('dateOfEntry').optional().isISO8601().toDate(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Add observation
app.post('/api/add-observation', apiAuth, addObservationValidation, async (req, res) => {
  const { note, dateOfEntry, cowTag } = req.body;
  try {
    const { pool, sql } = require('../db/db');
    await pool.connect();
    const request = pool.request();
    request.input('note', sql.NVarChar, note);
    request.input('dateOfEntry', sql.DateTime, dateOfEntry || new Date());
    request.input('cowTag', sql.NVarChar, cowTag);

    const query = `INSERT INTO Notes (Note, DateOfEntry, CowTag)
                   VALUES (@note, @dateOfEntry, @cowTag)`;
    await request.query(query);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error inserting observation:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get cow data
app.get('/api/cow/:tag',
  apiAuth,
  (req, res, next) => {
    if (!/^[A-Za-z0-9-]+$/.test(req.params.tag)) {
      return res.status(400).json({ error: 'Invalid cow tag format' });
    }
    next();
  },
  async (req, res) => {
    try {
      const data = await fetchCowData(req.params.tag);
      res.json(data);
    } catch (err) {
      console.error('Error fetching cow data:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Frontend can be accessed at one of these URLs:');
  console.log('  • http://localhost        (if using port 80)');
  console.log('  • http://localhost:8080   (if using port 8080)');
  console.log('  • https://localhost       (if using port 443 with SSL)');
  console.log('  • http://localhost:5173   (default Vite port)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});