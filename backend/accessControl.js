const localFileOps = require('../api/local');
const dbOperations = require('../api/dbOperations');
require('dotenv').config();

class AccessControl {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
        this.devBypassEmail = process.env.DEV_BYPASS_EMAIL || '_development';
    }

    async initialize() {
        try {
            // Ensure CSV exists
            const csvResult = await localFileOps.checkUsers();
            if (csvResult.created) {
                console.log('User system initialized - users.csv created');
            } else {
                console.log(`users.csv loaded - ${csvResult.userCount} users found`);
            }

            // Check DB for active admin
            const dbResult = await dbOperations.checkUsers();

            if (dbResult.hasAdmin) {
                console.log(`User system ready - ${dbResult.userCount} users in database`);
                return dbResult;
            }

            // No active admin in DB — attempt CSV import
            console.log('No active admin found in database, attempting CSV import...');

            const csvUsers = await localFileOps.readoutUsersJSON();
            if (csvUsers.success && csvUsers.users.length > 0) {
                const importResult = await dbOperations.importUsers({ users: csvUsers.users });
                console.log(`CSV import complete: ${importResult.message}`);

                // Re-check after import
                const postImportCheck = await dbOperations.checkUsers();
                if (postImportCheck.hasAdmin) {
                    console.log('User system ready - admin found after CSV import');
                    return postImportCheck;
                }
            }

            // Still no admin — fresh install, first user to register will become admin
            console.log('No users imported - first user to register will receive admin privileges');
            return { success: true, hasAdmin: false, userCount: 0 };

        } catch (error) {
            console.error('Failed to initialize user system:', error);
            throw error;
        }
    }

    getUserEmail(req) {
        if (this.isDevelopment) {
            const devEmail = req.headers['x-dev-email'] || this.devBypassEmail;
            console.log('Development mode - using email:', devEmail);
            return devEmail;
        }

        const email = req.headers['cf-access-authenticated-user-email'];
        if (!email) {
            console.warn('No Cloudflare Access email header found');
            return null;
        }

        return email;
    }

    async authenticate(req, res, next) {
        try {
            const email = this.getUserEmail(req);

            if (!email) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const userResult = await dbOperations.lookupUser({ email });

            if (!userResult.exists) {
                return res.json({
                    success: true,
                    needsRegistration: true,
                    email
                });
            }

            const user = userResult.user;

            if (user.blocked) {
                return res.json({
                    success: true,
                    blocked: true,
                    email,
                    userName: user.username
                });
            }

            if (user.preRegistered) {
                return res.json({
                    success: true,
                    needsRegistration: true,
                    email,
                    isPreregistered: true
                });
            }

            if (!user.hasPassword) {
                return res.json({
                    success: true,
                    needsPasswordSetup: true,
                    email,
                    userName: user.username
                });
            }

            return res.json({
                success: true,
                needsLogin: true,
                email,
                userName: user.username,
                blocked: false
            });

        } catch (error) {
            console.error('Authentication error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authentication service error'
            });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password required'
                });
            }

            const result = await dbOperations.validatePassword({ email, password });

            if (result.success) {
                req.session.user = result.user;

                req.session.save(() => {
                    return res.json({
                        success: true,
                        user: {
                            username: result.user.username,
                            email: result.user.email,
                            permissions: result.user.permissions
                        }
                    });
                });
            } else {
                return res.status(401).json(result);
            }
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({
                success: false,
                message: 'Login service error'
            });
        }
    }

    async register(req, res) {
        try {
            const { username, email, password } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, email, and password required'
                });
            }

            const authenticatedEmail = this.getUserEmail(req);
            if (email.toLowerCase() !== authenticatedEmail.toLowerCase()) {
                return res.status(403).json({
                    success: false,
                    message: 'Email does not match authenticated user'
                });
            }

            const result = await dbOperations.setupUser({ username, email, password });

            if (result.success) {
                req.session.user = result.user;

                req.session.save(() => {
                    return res.json({
                        success: true,
                        user: result.user,
                        isFirstUser: result.isFirstUser
                    });
                });
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Registration error:', error);
            return res.status(500).json({
                success: false,
                message: 'Registration service error'
            });
        }
    }

    async setPassword(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password required'
                });
            }

            const authenticatedEmail = this.getUserEmail(req);
            if (email.toLowerCase() !== authenticatedEmail.toLowerCase()) {
                return res.status(403).json({
                    success: false,
                    message: 'Email does not match authenticated user'
                });
            }

            const result = await dbOperations.setUserPassword({ email, password });

            if (result.success) {
                req.session.user = result.user;

                req.session.save(() => {
                    return res.json({
                        success: true,
                        user: result.user
                    });
                });
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Set password error:', error);
            return res.status(500).json({
                success: false,
                message: 'Set password service error'
            });
        }
    }

    requireAuth() {
        return (req, res, next) => {
            if (!req.session.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            next();
        };
    }

    requirePermission(permission) {
        return (req, res, next) => {
            if (!req.session.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            if (!req.session.user.permissions.includes(permission)) {
                return res.status(403).json({
                    success: false,
                    message: `Permission '${permission}' required`
                });
            }

            next();
        };
    }

    requireAdmin() {
        return this.requirePermission('admin');
    }

    requireDev() {
        return this.requirePermission('dev');
    }
}

const accessControl = new AccessControl();

module.exports = {
    initialize: () => accessControl.initialize(),
    authenticate: (req, res, next) => accessControl.authenticate(req, res, next),
    login: (req, res) => accessControl.login(req, res),
    register: (req, res) => accessControl.register(req, res),
    setPassword: (req, res) => accessControl.setPassword(req, res),
    requireAuth: () => accessControl.requireAuth(),
    requirePermission: (permission) => accessControl.requirePermission(permission),
    requireAdmin: () => accessControl.requireAdmin(),
    requireDev: () => accessControl.requireDev(),
    getUserEmail: (req) => accessControl.getUserEmail(req)
};