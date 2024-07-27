// sessionManager.js

const { fork } = require('child_process');
const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if you are using HTTPS
        httpOnly: true,
    }
});

app.use(sessionMiddleware);

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Spawn a new child process for the session
    const child = fork(path.join(__dirname, 'sessionInstance.js'));

    // Send credentials to the child process
    child.send({ username, password });

    // Handle messages from the child process
    child.on('message', (message) => {
        if (message.success) {
            // Store the child's process ID in the session
            req.session.childPid = child.pid;
            res.json({ success: true, redirect: '/data' });
        } else {
            res.json({ success: false, message: 'Invalid username or password' });
        }
    });
});

app.use((req, res, next) => {
    if (!req.session.childPid) {
        return res.redirect('/');
    }
    next();
});

app.get('/data', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'page.html'));
});

app.listen(3000, () => {
    console.log('Session Manager running on port 3000');
});
