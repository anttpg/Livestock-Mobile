const express = require('express');
const bodyParser = require('body-parser');
const sql = require('mssql');
const cors = require('cors'); 
const path = require('path'); 
const loginRoutes = require('./login'); 
require('dotenv').config(); 

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors()); 

app.set("views", path.resolve(__dirname, "../frontend"));
app.set("view engine", "ejs");

let dbConfig;

if (process.env.USE_SQL_AUTH === 'true') {
    dbConfig = {
        server: process.env.DB_SERVER,
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
        database: process.env.DB_DATABASE,
        options: {
            encrypt: process.env.DB_ENCRYPT === 'true',
            trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
        },
        authentication: {
            type: 'ntlm',
            options: {
                domain: process.env.DB_DOMAIN || '',
                user: process.env.DB_USERNAME || '',
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

// Serve image files from the 'images' directory
app.use('/images', express.static(path.join(__dirname, '../images')));

// Define a route to render the 'page.ejs' file
app.get('/', (req, res) => {
    res.render('page');
});

// Get specific data by cow tag
app.get('/api/cow/:tag', async (req, res) => {
    const cowTag = req.params.tag;
    try {
        const cowDataRequest = new sql.Request();
        const cowDataQuery = `
            SELECT 
                CowTagMain, DateOfBirth, Weight, Notes AS Description, HeadshotPath, BodyPath
            FROM 
                CowTable 
            WHERE 
                CowTagMain = @cowTag`;
        cowDataRequest.input('cowTag', sql.NVarChar, cowTag);
        const cowData = await cowDataRequest.query(cowDataQuery);

        const medicalRecordsRequest = new sql.Request();
        const medicalRecordsQuery = `
            SELECT 
                MedicineApplied, TreatmentDate 
            FROM 
                MedicalRecords 
            WHERE 
                CowTag = @cowTag`;
        medicalRecordsRequest.input('cowTag', sql.NVarChar, cowTag);
        const medicalRecords = await medicalRecordsRequest.query(medicalRecordsQuery);

        const notesRequest = new sql.Request();
        const notesQuery = `
            SELECT 
                Note, DateOfEntry 
            FROM 
                Notes 
            WHERE 
                CowTag = @cowTag`;
        notesRequest.input('cowTag', sql.NVarChar, cowTag);
        const notes = await notesRequest.query(notesQuery);

        const calvesRequest = new sql.Request();
        const calvesQuery = `
            SELECT 
                CowTagMain AS CalfTag, DateOfBirth AS DOB
            FROM 
                CowTable
            WHERE 
                MotherTag = @cowTag OR FatherTag = @cowTag`;
        calvesRequest.input('cowTag', sql.NVarChar, cowTag);
        const calves = await calvesRequest.query(calvesQuery);

        res.json({
            cowData: cowData.recordset,
            medicalRecords: medicalRecords.recordset,
            notes: notes.recordset,
            calves: calves.recordset
        });
    } catch (err) {
        console.error('Error querying database:', err);
        res.status(500).json({ error: 'Error querying database' });
    }
});

app.get('/general', (req, res) => {
    res.render('general');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
