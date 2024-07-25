const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const loginRoutes = require('./login'); // Import the login routes
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors({
    origin: true, // Reflect the request origin
    credentials: true, // Allow credentials (cookies) to be sent and received
}));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if you are using HTTPS
        httpOnly: true,
        //domain: 'your-domain.com', // Uncomment and set to your domain if needed
    }
}));

// Use the login routes
app.use('/api', loginRoutes);

// Serve static files from the 'frontend' directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Define a route to serve the 'login.html' file at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Define a route to serve the 'page.html' file at '/data'
app.get('/data', (req, res) => {
    if (!req.session.dbConfig) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, '../frontend', 'page.html'));
});

// Middleware to set up dbConfig with session-based credentials
app.use((req, res, next) => {
    if (req.session.dbConfig) {
        req.dbConfig = req.session.dbConfig;
    } else {
        req.dbConfig = null;
    }
    next();
});

// Sample endpoint to get data
app.get('/api/data', async (req, res) => {
    if (!req.dbConfig) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const pool = await sql.connect(req.dbConfig);
        const result = await pool.request().query('SELECT * FROM UserTable'); // Update the table name in the query
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying database:', err); // Log the specific error
        res.status(500).json({ error: 'Error querying database' }); // Ensure the error response is in JSON format
    }
});

// Endpoint to insert data
app.post('/api/data', async (req, res) => {
    if (!req.dbConfig) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const { firstName, age, money } = req.body;
    try {
        const pool = await sql.connect(req.dbConfig);
        const result = await pool.request()
            .input('firstName', sql.VarChar, firstName)
            .input('age', sql.Int, age)
            .input('money', sql.Decimal, money)
            .query('INSERT INTO UserTable ([First Name], Age, Money) VALUES (@firstName, @age, @money)');
        res.status(200).json({ message: 'Row inserted successfully' });
    } catch (err) {
        console.error('Error inserting data:', err); // Log the specific error
        res.status(500).json({ error: 'Error inserting data' }); // Ensure the error response is in JSON format
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
