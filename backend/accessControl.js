// db/accessControl.js - Flexible access control for temp and future SQL authentication
const sql = require('mssql');
require('dotenv').config();

class AccessControl {
    constructor() {
        // Authentication mode: 'temp' or 'sql'
        this.authMode = process.env.AUTH_MODE || 'temp';
        this.tempCredentials = {
            username: process.env.TEMP_USERNAME || 'testUser',
            password: process.env.TEMP_PASSWORD || 'testPass'
        };
    }

    /**
     * Main access control middleware
     */
    setupAccessControl() {
        return (req, res, next) => {
            //console.log('Access control check for user:', req.session.user);

            if (!req.session.user || !req.session.user.username) {
                console.log('Access denied. No user session found.');
                return res.status(403).json({ error: 'Access denied' });
            }

            // Additional checks based on auth mode
            if (this.authMode === 'sql') {
                return this.validateSQLSession(req, res, next);
            } else {
                return this.validateTempSession(req, res, next);
            }
        };
    }

    /**
     * Validate temporary authentication session
     */
    validateTempSession(req, res, next) {
        // For temp mode, just check if user exists in session
        if (req.session.user && req.session.user.username) {
            //console.log('Temp auth validated for user:', req.session.user.username);
            next();
        } else {
            console.log('Temp auth failed - no valid session');
            return res.status(403).json({ error: 'Invalid session' });
        }
    }

    /**
     * Validate SQL-based authentication session
     */
    async validateSQLSession(req, res, next) {
        try {
            // Check if we have SQL credentials in session
            if (!req.session.dbUser || !req.session.dbPassword) {
                console.log('SQL auth failed - no database credentials in session');
                return res.status(403).json({ error: 'No database credentials' });
            }

            // Verify SQL connection is still valid
            const isValid = await this.verifySQLConnection(
                req.session.dbUser, 
                req.session.dbPassword
            );

            if (isValid) {
                console.log('SQL auth validated for user:', req.session.dbUser);
                next();
            } else {
                console.log('SQL auth failed - invalid database connection');
                // Clear invalid session
                req.session.destroy();
                return res.status(403).json({ error: 'Database authentication failed' });
            }
        } catch (error) {
            console.error('Error validating SQL session:', error);
            return res.status(500).json({ error: 'Authentication error' });
        }
    }

    /**
     * Authenticate user with temporary credentials
     */
    async authenticateTemp(username, password) {
        if (username === this.tempCredentials.username && 
            password === this.tempCredentials.password) {
            return {
                success: true,
                user: { username }
            };
        }
        return {
            success: false,
            message: 'Invalid username or password'
        };
    }

    /**
     * Authenticate user with SQL Server credentials
     */
    async authenticateSQL(username, password) {
        const tempDbConfig = {
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
            await sql.connect(tempDbConfig);
            return {
                success: true,
                user: { username },
                dbConfig: tempDbConfig
            };
        } catch (error) {
            console.error('SQL authentication failed:', error);
            return {
                success: false,
                message: 'Invalid database credentials'
            };
        }
    }

    /**
     * Verify existing SQL connection
     */
    async verifySQLConnection(username, password) {
        try {
            const tempDbConfig = {
                server: process.env.DB_SERVER,
                database: process.env.DB_DATABASE,
                user: username,
                password: password,
                options: {
                    encrypt: process.env.DB_ENCRYPT === 'true',
                    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
                }
            };

            const pool = new sql.ConnectionPool(tempDbConfig);
            await pool.connect();
            await pool.close();
            return true;
        } catch (error) {
            console.error('SQL connection verification failed:', error);
            return false;
        }
    }

    /**
     * Main authentication method - routes to appropriate auth
     */
    async authenticate(username, password) {
        if (this.authMode === 'sql') {
            return this.authenticateSQL(username, password);
        } else {
            return this.authenticateTemp(username, password);
        }
    }

    /**
     * Get user permissions (placeholder for future role-based access)
     */
    getUserPermissions(username) {
        // TODO: Implement role-based permissions
        return {
            canRead: true,
            canWrite: true,
            canDelete: false,
            admin: false
        };
    }
}

// Export singleton instance
const accessControl = new AccessControl();

module.exports = { 
    setupAccessControl: () => accessControl.setupAccessControl(),
    authenticate: (username, password) => accessControl.authenticate(username, password),
    getUserPermissions: (username) => accessControl.getUserPermissions(username)
};