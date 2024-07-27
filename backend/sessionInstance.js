// sessionInstance.js

const sql = require('mssql');
require('dotenv').config();

process.on('message', async (message) => {
    const { action, dbConfig, data } = message;

    try {
        await sql.connect(dbConfig);

        if (action === 'login') {
            process.send({ success: true });
        } else if (action === 'fetchData') {
            const result = await sql.query('SELECT * FROM CowTable');
            process.send({ success: true, data: result.recordset });
        } else if (action === 'insertData') {
            const { firstName, age, money } = data;
            await sql.query`INSERT INTO UserTable ([First Name], Age, Money) VALUES (${firstName}, ${age}, ${money})`;
            process.send({ success: true });
        }
    } catch (err) {
        console.error('Error in child process:', err);
        process.send({ success: false, error: err.message });
    }
});
