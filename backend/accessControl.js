
const setupAccessControl = () => (req, res, next) => {
    console.log('Access control check for user:', req.session.user);

    if (!req.session.user || !req.session.user.username) {
        console.log('Access denied. No user session found.');
        return res.status(403).json({ error: 'Access denied' });
    }

    next();
};

module.exports = { setupAccessControl };
