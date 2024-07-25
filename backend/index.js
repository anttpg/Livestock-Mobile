const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors'); // Import the cors middleware
const path = require('path'); // Import the path module
const loginRoutes = require('./login'); // Import the login routes
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors()); // Use the cors middleware

app.set("views", path.resolve(__dirname, "frontend"));
app.set("view engine", "ejs");

let dbConfig;

if (process.env.USE_SQL_AUTH === 'true') {
    dbConfig = {
        server: process.env.DB_SERVER,
        port: parseInt(process.env.DB_PORT, 10),
        database: process.env.DB_DATABASE,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        options: {
            encrypt: process.env.DB_ENCRYPT === 'true',
            trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
        }
    };
} else {
    dbConfig = {
        server: process.env.DB_SERVER,
        port: parseInt(process.env.DB_PORT, 10),
        database: process.env.DB_DATABASE,
        options: {
            encrypt: process.env.DB_ENCRYPT === 'true',
            trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
        },
        authentication: {
            type: 'ntlm',
            options: {
                domain: process.env.DB_DOMAIN || '',
                user: process.env.DB_USERNAME || '', // Change userName to user
                password: process.env.DB_PASSWORD || ''
            }
        }
    };
}

sql.connect(dbConfig, err => {
    if (err) {
        console.error('SQL Connection Error:', err);
    } else {
        console.log('Connected to SQL Server');
    }
});

// Use the login routes
app.use('/api', loginRoutes);

// Serve static files from the 'frontend' directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Define a route to serve the 'page.html' file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'page.html'));
});

// Sample endpoint to get data
app.get('/api/data', async (req, res) => {
    try {
        const result = await sql.query`SELECT * FROM UserTable`; // Update the table name in the query
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying database:', err); // Log the specific error
        res.status(500).json({ error: 'Error querying database' }); // Ensure the error response is in JSON format
    }
});

// Endpoint to insert data
app.post('/api/data', async (req, res) => {
    const { firstName, age, money } = req.body;
    try {
        const result = await sql.query`INSERT INTO UserTable ([First Name], Age, Money) VALUES (${firstName}, ${age}, ${money})`;
        res.status(200).json({ message: 'Row inserted successfully' });
    } catch (err) {
        console.error('Error inserting data:', err); // Log the specific error
        res.status(500).json({ error: 'Error inserting data' }); // Ensure the error response is in JSON format
    }
});
const calvesMap = [
    { getName: () => 'Calf 1', getDOB: () => '2023-01-01' },
    { getName: () => 'Calf 2', getDOB: () => '2023-02-01' }
];

app.get('/calves', (req, res) => {
    let calvesTable = calvesMap.map(calf => 
        `<tr><td style="border: 2px double black;">${calf.getName()}</td>` +
        `<td style="border: 2px double black;">${calf.getDOB()}</td></tr>`
    ).join('');
    res.render('displayCalves', { calvesTable: `<table>${calvesTable}</table>` });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
