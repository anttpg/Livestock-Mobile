const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// SQL Server configuration
const dbConfig = {
    user: 'your_db_username',
    password: 'your_db_password',
    server: 'your_db_server',
    database: 'your_database',
    options: {
        encrypt: true, // for Azure
        trustServerCertificate: true // change to false for production
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
