
const { fork } = require('child_process');
const express = require('express');
const path = require('path');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { setupInputValidation } = require('./inputValidation');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if you are using HTTPS
        httpOnly: true,
    }
});

app.use(sessionMiddleware);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Serve static files from the 'frontend' and 'images' directory
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/images', express.static(path.join(__dirname, '../images')));

const dbConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10),
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
};

app.set('views', path.join(__dirname, '../frontend'));
app.set('view engine', 'ejs');

app.post('/login', setupInputValidation(), (req, res) => {
    const { username, password } = req.body;

    // Add user-specific credentials to dbConfig
    const userDbConfig = { ...dbConfig, user: username, password: password };

    // Spawn a new child process for the session
    const child = fork(path.join(__dirname, 'sessionInstance.js'));

    console.log('Attempting to login user:', username);

    // Send credentials to the child process
    child.send({ action: 'login', dbConfig: userDbConfig });

    // Handle messages from the child process
    child.on('message', (message) => {
        if (message.success) {
            console.log('Login successful for user:', username);

            // Store the user's dbConfig and process ID in the session
            req.session.childPid = child.pid;
            req.session.dbConfig = userDbConfig;
            req.session.user = { username };
            req.session.save(() => {
                res.json({ success: true, redirect: '/general' });
            });
        } else {
            console.log('Login failed for user:', username);
            res.json({ success: false, message: 'Invalid username or password' });
        }
    });

    child.on('error', (error) => {
        console.error('Error in child process:', error);
    });
});

app.use((req, res, next) => {
    console.log('Checking session for request to:', req.path);
    console.log('Session data:', req.session);

    if (!req.session.user) {
        if (req.path !== '/' && req.path !== '/login') {
            return res.redirect('/');
        }
    }
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

app.get('/general', (req, res) => {
    res.render('general');
});

app.use('/api', (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
});

app.get('/api/cow/:tag', (req, res) => {
    const child = fork(path.join(__dirname, 'sessionInstance.js'));

    // Send the session information to the child process
    child.send({ action: 'fetchCowData', dbConfig: req.session.dbConfig, cowTag: req.params.tag });

    child.on('message', (message) => {
        if (message.success) {
            res.json(message.data);
        } else {
            res.status(500).json({ error: message.error });
        }
    });
});

app.listen(3000, () => {
    console.log('Session Manager running on port 3000');
});
