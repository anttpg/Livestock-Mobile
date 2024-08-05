const express = require('express');
const sql = require('mssql');
const path = require('path');
const router = express.Router();

// Serve the login page
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Handle login POST request
router.post('/login', async (req, res) => {
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

module.exports = router;
