const express = require('express');
const router = express.Router();

// Simulated user authentication for demonstration purposes
const users = [
    { username: 'user1', password: 'password1' },
    { username: 'user2', password: 'password2' }
];

// Serve the login page
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Handle login POST request
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Check if the user exists and the password is correct
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Invalid username or password' });
    }
});

module.exports = router;
