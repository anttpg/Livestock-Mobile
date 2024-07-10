const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

const dbConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true', // Convert string to boolean
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' // Convert string to boolean
    },
    authentication: {
        type: 'ntlm',
        options: {
            domain: process.env.DB_DOMAIN || '', // Load domain if needed, otherwise empty
            userName: process.env.DB_USERNAME || '', // Load username if needed, otherwise empty
            password: process.env.DB_PASSWORD || '' // Load password if needed, otherwise empty
        }
    }
};

// Connect to SQL Server
sql.connect(dbConfig, err => {
    if (err) {
        console.error('SQL Connection Error:', err);
    } else {
        console.log('Connected to SQL Server');
    }
});

// Sample endpoint to get data
app.get('/api/data', async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM your_table`;
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send('Error querying database');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
