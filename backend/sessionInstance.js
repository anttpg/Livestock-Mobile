// sessionInstance.js

const express = require('express');
const sql = require('mssql');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let dbConfig;

process.on('message', async (message) => {
    const { username, password } = message;

    // Create a temporary config for SQL authentication
    dbConfig = {
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
        await sql.connect(dbConfig);
        process.send({ success: true, port: process.env.PORT });
    } catch (err) {
        console.error('Error authenticating user:', err);
        process.send({ success: false });
    }
});

app.get('/api/data', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request().query('SELECT * FROM CowTable'); // Update the table name in the query
        res.json(result.recordset);
    } catch (err) {
        console.error('Error querying database:', err); // Log the specific error
        res.status(500).json({ error: 'Error querying database' }); // Ensure the error response is in JSON format
    }
});

app.post('/api/data', async (req, res) => {
    const { firstName, age, money } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
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

app.listen(0, () => {
    console.log(`Session instance running`);
});
