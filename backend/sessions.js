// sessions.js

const express = require('express');
const session = require('express-session');
const sql = require('mssql');

const sessionMiddleware = session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if you are using HTTPS
        httpOnly: true,
    }
});

const sessionRouter = express.Router();

sessionRouter.use(sessionMiddleware);

sessionRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Create a temporary config for SQL authentication
    const tempDbConfig = {
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        user: username,
        password: password,
        options: {
            encrypt: process.env.DB_ENCRYPT === 'true',
            trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
        }
    };

    try {
        // Try to connect to the database with the provided credentials
        await sql.connect(tempDbConfig);

        // Store credentials and connection pool in session if connection is successful
        req.session.dbUser = username;
        req.session.dbPassword = password;
        req.session.dbConfig = tempDbConfig;
        res.json({ success: true, redirect: '/data' });
    } catch (err) {
        console.error('Error authenticating user:', err);
        res.json({ success: false, message: 'Invalid username or password' });
    }
});

sessionRouter.use((req, res, next) => {
    if (req.session.dbConfig) {
        req.dbConfig = req.session.dbConfig;
    } else {
        req.dbConfig = null;
    }
    next();
});

module.exports = { sessionRouter, sessionMiddleware };
