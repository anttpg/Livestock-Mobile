const localFileOps = require('../api/local');
require('dotenv').config();

class AccessControl {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
        this.devBypassEmail = process.env.DEV_BYPASS_EMAIL || '_development';
    }

    /**
     * Initialize user system check/create users.csv on server start
     */
    async initialize() {
        try {
            const result = await localFileOps.checkUsers();
            if (result.created) {
                console.log('User system initialized - first user will receive admin privileges');
            } else {
                console.log(`User system loaded - ${result.userCount} users found`);
                if (!result.hasAdmin) {
                    console.warn('WARNING: No active admin users found!');
                }
            }
            return result;
        } catch (error) {
            console.error('Failed to initialize user system:', error);
            throw error;
        }
    }

    /**
     * Extract user email from Cloudflare Access header or development mode
     */
    getUserEmail(req) {
        // In development, allow bypass
        if (this.isDevelopment) {
            const devEmail = req.headers['x-dev-email'] || this.devBypassEmail;
            console.log('Development mode - using email:', devEmail);
            return devEmail;
        }

        // Production: Get email from Cloudflare Access
        const email = req.headers['cf-access-authenticated-user-email'];
        if (!email) {
            console.warn('No Cloudflare Access email header found');
            return null;
        }

        return email;
    }

    /**
     * Authenticate user and establish session
     */
    async authenticate(req, res, next) {
        try {
            const email = this.getUserEmail(req);
            
            if (!email) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            const userResult = await localFileOps.lookupUser({ email });

            if (!userResult.exists) {
                return res.json({
                    success: true,
                    needsRegistration: true,
                    email: email
                });
            }

            const user = userResult.user;

            if (user.blocked) {
                return res.json({
                    success: true,
                    blocked: true,
                    email: email,
                    userName: user.username
                });
            }

            // Check if user is pre-registered (needs to complete registration)
            if (user.username === 'PREREGISTERED' && !user.hasPassword) {
                return res.json({
                    success: true,
                    needsRegistration: true,  // Send to registration page
                    email: email,
                    isPreregistered: true
                });
            }

            if (!user.hasPassword) {
                return res.json({
                    success: true,
                    needsPasswordSetup: true,
                    email: email,
                    userName: user.username
                });
            }

            return res.json({
                success: true,
                needsLogin: true,
                email: email,
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


    /**
     * Verify login credentials
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password required'
                });
            }

            // Validate password
            const result = await localFileOps.validatePassword({ email, password });

            if (result.success) {
                // Set session
                req.session.user = result.user;
                
                req.session.save(() => {
                    return res.json({
                        success: true,
                        user: {
                            id: result.user.id,
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

    /**
     * Register new user
     */
    async register(req, res) {
        try {
            const { username, email, password } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, email, and password required'
                });
            }

            // Verify email matches Cloudflare Access email (or dev bypass)
            const authenticatedEmail = this.getUserEmail(req);
            if (email.toLowerCase() !== authenticatedEmail.toLowerCase()) {
                return res.status(403).json({
                    success: false,
                    message: 'Email does not match authenticated user'
                });
            }

            const result = await localFileOps.setupUser({ username, email, password });

            if (result.success) {
                // Automatically log in new user
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

    /**
     * Set password for existing user (password reset or first-time setup)
     */
    async setPassword(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password required'
                });
            }

            // Verify email matches authenticated user
            const authenticatedEmail = this.getUserEmail(req);
            if (email.toLowerCase() !== authenticatedEmail.toLowerCase()) {
                return res.status(403).json({
                    success: false,
                    message: 'Email does not match authenticated user'
                });
            }

            const result = await localFileOps.setUserPassword({ email, password });

            if (result.success) {
                // Automatically log in user
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

    /**
     * Main access control middleware - checks if user has valid session
     */
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

    /**
     * Require specific permission
     */
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

    /**
     * Require admin permission
     */
    requireAdmin() {
        return this.requirePermission('admin');
    }

    /**
     * Require dev permission
     */
    requireDev() {
        return this.requirePermission('dev');
    }
}

// Export singleton instance
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