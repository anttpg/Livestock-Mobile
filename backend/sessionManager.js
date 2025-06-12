// sessionManager.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require("body-parser");
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { fetchCowData } = require('../db/dbOperations');
const { body, validationResult } = require('express-validator');
// or your custom validators, plus csurf, sanitizeHtml, etc.

require('dotenv').config();

const app = express();

// Helmet for security headers
app.use(helmet());

// Body parser
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1mb' }));

// Session with 1-hour max age + secure + sameSite
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,           // or true if behind HTTPS proxy
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 3600000          // 1 hour
  }
}));

// Example specialized login rate limiter
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: "Too many login attempts, please try again later."
});

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/images', express.static(path.join(__dirname, '../images')));

// EJS setup
app.set('views', path.join(__dirname, '../frontend'));
app.set('view engine', 'ejs');

// ------------- LOGIN ROUTES ------------- //

// Show login page
app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/general');
  }
  res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Handle login
app.post('/login',
  loginLimiter,
  // Basic validation
  [
    body('username').isString().notEmpty(),
    body('password').isString().notEmpty()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Placeholder: Validate user in an "App" sense:
    // e.g., check if username/password is correct in a users table, etc.
    if (username === 'testUser' && password === 'testPass') {
      // Mark user as logged in (store only username in session)
      req.session.user = { username };
      req.session.save(() => {
        return res.json({ success: true, redirect: '/general' });
      });
    } else {
      return res.json({ success: false, message: 'Invalid username or password' });
    }
  }
);

// Log out route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).send('Error logging out.');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// ------------- AUTH CHECK MIDDLEWARE -------------
app.use((req, res, next) => {
  // Allow free access to root, /login, or any static resources
  if (
    req.path === '/' ||
    req.path === '/login' ||
    req.path.startsWith('/images') ||
    req.path.startsWith('/css')
  ) {
    return next();
  }

  // Check session
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
});

// ------------- ROUTES -------------
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/general');
  }
  res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

app.get('/general', (req, res) => {
  res.render('general'); // EJS view
});

// e.g. /medical route
app.get('/medical', (req, res) => {
  res.render('medical');
});

// New observation validations
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

app.post('/add-observation', addObservationValidation, async (req, res) => {
  const { note, dateOfEntry, cowTag } = req.body;
  try {
    // Insert into DB using your single pool approach
    const { pool, sql } = require('./db');
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

// Cow data route
app.get('/api/cow/:tag',
  // Validate the :tag param
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

app.get('/api/cow/:tag', (req, res) => {
    const child = fork(path.join(__dirname, 'sessionInstance.js'));

    child.send({ action: 'fetchCowData', dbConfig: req.session.dbConfig, cowTag: req.params.tag });

    child.on('message', (message) => {
        if (message.success) {
            res.json(message.data);
        } else {
            res.status(500).json({ error: message.error });
        }
    });
});

app.get('/medical', (req, res) => {
    res.render('medical');
});


// Start the server

// OPTIONAL: Prepare for HTTPS enforcement (commented out until you want it)
// function enforceHTTPS(req, res, next) {
//   if (!req.secure) {
//     return res.redirect('https://' + req.headers.host + req.url);
//   }
//   next();
// }
// app.use(enforceHTTPS); // Uncomment to force HTTPS

// Start server
app.listen(3000, () => {
  console.log('Session Manager running on port 3000');
});
