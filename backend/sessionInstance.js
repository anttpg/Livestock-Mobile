
const sql = require('mssql');
const { fetchCowData } = require('./dbOperations');
require('dotenv').config();

process.on('message', async (message) => {
    const { action, dbConfig, cowTag } = message;

    try {
        await sql.connect(dbConfig);

        if (action === 'login') {
            process.send({ success: true });
        } else if (action === 'fetchCowData') {
            const data = await fetchCowData(cowTag);
            process.send({ success: true, data });
        }
    } catch (err) {
        console.error('Error in child process:', err);
        process.send({ success: false, error: err.message });
    }
});
