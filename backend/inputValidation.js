// db/inputValidation.js - Comprehensive input validation with enhanced security
const { body, param, query, validationResult } = require('express-validator');

/**
 * Common validation patterns
 */
const commonPatterns = {
    cowTag: /^[A-Za-z0-9 _\-*/]+$/,  // Allow letters, numbers, spaces, underscores, hyphens, asterisks
    dateISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    username: /^[A-Za-z0-9_-]+$/
};

/**
 * Security sanitization functions
 */
const sanitizationFunctions = {
    /**
     * Sanitize filepath to prevent command injection and path traversal
     * @param {string} filepath - Input filepath to sanitize
     * @returns {string} Sanitized filepath
     */
    sanitizeFilepath: (filepath) => {
        if (!filepath || typeof filepath !== 'string') {
            throw new Error('Filepath must be a non-empty string');
        }

        // Remove dangerous characters that could be used for command injection or path traversal
        const dangerous = [
            // Path traversal
            '..', './',
            // Command separators and operators
            '|', '&', ';', '$', '>', '<', '`', '!',
            // Brackets and braces (could be used in command substitution)
            '{', '}', '[', ']', '(', ')',
            // Quotes (could break out of strings)
            '"', "'",
            // Null bytes and control characters
            '\0', '\n', '\r', '\t',
            // Windows-specific
            '%', '^',
            // Unix-specific dangerous chars
            '~'
        ];

        let sanitized = filepath;
        dangerous.forEach(char => {
            sanitized = sanitized.replace(new RegExp(escapeRegExp(char), 'g'), '');
        });

        // Additional check: ensure no absolute paths
        if (sanitized.startsWith('/') || /^[A-Za-z]:\\/.test(sanitized)) {
            throw new Error('Absolute paths not allowed');
        }

        // Trim whitespace
        sanitized = sanitized.trim();

        if (sanitized.length === 0) {
            throw new Error('Filepath cannot be empty after sanitization');
        }

        return sanitized;
    },

    /**
     * Sanitize input for SQL injection prevention (defense in depth)
     * @param {string} input - Input to sanitize for SQL
     * @returns {string} Sanitized input
     */
    sanitizeForSQL: (input) => {
        if (input === null || input === undefined) {
            return input;
        }

        if (typeof input !== 'string') {
            input = String(input);
        }

        // Remove/escape SQL injection patterns
        const sqlDangerous = [
            // SQL comment patterns
            '--', '/*', '*/',
            // SQL command separators
            ';',
            // Extended stored procedures (dangerous in SQL Server)
            'xp_', 'sp_',
            // Union attacks
            'UNION', 'union',
            // Common SQL injection patterns
            'DROP', 'drop',
            'DELETE', 'delete',
            'INSERT', 'insert',
            'UPDATE', 'update',
            'EXEC', 'exec',
            'EXECUTE', 'execute'
        ];

        let sanitized = input;
        
        // Escape single quotes (most common SQL injection vector)
        sanitized = sanitized.replace(/'/g, "''");
        
        // Remove dangerous SQL patterns
        sqlDangerous.forEach(pattern => {
            const regex = new RegExp(escapeRegExp(pattern), 'gi');
            sanitized = sanitized.replace(regex, '');
        });

        // Remove null bytes and control characters
        sanitized = sanitized.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, '');

        return sanitized;
    },

    /**
     * Sanitize cow tag specifically
     * @param {string} cowTag - Cow tag to sanitize
     * @returns {string} Sanitized cow tag
     */
    sanitizeCowTag: (cowTag) => {
        if (!cowTag || typeof cowTag !== 'string') {
            throw new Error('Cow tag must be a non-empty string');
        }
    
        // Only sanitize for SQL, skip filepath sanitization otherwise forward slashes are removed '268/1'
        let sanitized = sanitizationFunctions.sanitizeForSQL(cowTag);
        sanitized = sanitized.trim();
        
        if (!commonPatterns.cowTag.test(sanitized)) {
            throw new Error('Cow tag contains invalid characters after sanitization');
        }
    
        return sanitized;
    },

    /**
     * Sanitize field name for file operations
     * @param {string} fieldName - Field name to sanitize
     * @returns {string} Sanitized field name
     */
    sanitizeFieldName: (fieldName) => {
        if (!fieldName || typeof fieldName !== 'string') {
            throw new Error('Field name must be a non-empty string');
        }

        // Sanitize for filepath
        let sanitized = sanitizationFunctions.sanitizeFilepath(fieldName);
        
        // Additional field name specific rules
        // Allow letters, numbers, spaces, hyphens, underscores, parentheses
        sanitized = sanitized.replace(/[^A-Za-z0-9 \-_(),.…]/g, '');
        
        sanitized = sanitized.trim();
        
        if (sanitized.length === 0) {
            throw new Error('Field name cannot be empty after sanitization');
        }

        return sanitized;
    }
};

/**
 * Helper function to escape regex special characters
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reusable field validators with enhanced security sanitization
 */
const fieldValidators = {
    cowTag: () => [
        body('cowTag')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Cow tag is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeCowTag(value);
            })
            .matches(commonPatterns.cowTag)
            .withMessage('Cow tag must contain only letters, numbers, spaces, underscores, hyphens, and asterisks')
            .isLength({ min: 1, max: 50 })
            .withMessage('Cow tag must be 1-50 characters')
    ],

    cowTagParam: () => [
        param('tag')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Cow tag is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeCowTag(value);
            })
            .matches(commonPatterns.cowTag)
            .withMessage('Cow tag must contain only letters, numbers, spaces, underscores, hyphens, and asterisks')
            .isLength({ min: 1, max: 50 })
            .withMessage('Cow tag must be 1-50 characters')
    ],

    nParam: () => [
        param('n')
            .isInt({ min: 1, max: 100 })
            .withMessage('N must be a positive integer between 1 and 100')
            .toInt()
    ],

    note: () => [
        body('note')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Note is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 1000 })
            .withMessage('Note must be 1-1000 characters')
    ],

    dateOfEntry: () => [
        body('dateOfEntry')
            .optional()
            .isISO8601()
            .withMessage('Date must be in ISO 8601 format')
            .toDate()
    ],

    treatmentDate: () => [
        body('treatmentDate')
            .optional()
            .isISO8601()
            .withMessage('Treatment date must be in ISO 8601 format')
            .toDate()
    ],

    medicineApplied: () => [
        body('medicineApplied')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Medicine applied is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 200 })
            .withMessage('Medicine name must be 1-200 characters')
    ],

    observation: () => [
        body('observation')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
            .withMessage('Observation must be less than 1000 characters')
    ],

    treatment: () => [
        body('treatment')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
            .withMessage('Treatment must be less than 1000 characters')
    ],

    treatmentResponse: () => [
        body('treatmentResponse')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
            .withMessage('Treatment response must be less than 1000 characters')
    ],

    weight: () => [
        body('weight')
            .isFloat({ min: 0, max: 5000 })
            .withMessage('Weight must be a number between 0 and 5000')
            .toFloat()
    ],

    username: () => [
        body('username')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Username is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .matches(commonPatterns.username)
            .withMessage('Username must contain only letters, numbers, underscores, and hyphens')
            .isLength({ min: 3, max: 50 })
            .withMessage('Username must be 3-50 characters')
    ],

    password: () => [
        body('password')
            .isString()
            .notEmpty()
            .withMessage('Password is required')
            .isLength({ min: 6, max: 100 })
            .withMessage('Password must be 6-100 characters')
    ],

    description: () => [
        body('description')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
            .withMessage('Description must be less than 1000 characters')
    ],

    fieldName: () => [
        body('fieldName')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Field name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeFieldName(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Field name must be 1-100 characters')
    ],

    fieldNameParam: () => [
        param('fieldName')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Field name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeFieldName(decodeURIComponent(value));
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Field name must be 1-100 characters')
    ],

    imageType: () => [
        body('imageType')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Image type is required')
            .isIn(['headshot', 'body'])
            .withMessage('Image type must be "headshot" or "body"')
    ],

    imageTypeParam: () => [
        param('imageType')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Image type is required')
            .isIn(['headshot', 'body'])
            .withMessage('Image type must be "headshot" or "body"')
    ],

    // Pagination and search parameters
    page: () => [
        body('page').optional()
            .isInt({ min: 1 })
            .withMessage('Page must be a positive integer')
            .toInt()
    ],

    limit: () => [
        body('limit').optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100')
            .toInt()
    ],

    search: () => [
        body('search').optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : '';
            })
            .isLength({ max: 200 })
            .withMessage('Search term must be less than 200 characters')
    ],

    
    herdName: () => [
        body('herdName')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Herd name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Herd name must be 1-100 characters')
    ],

    herdNameParam: () => [
        param('herdName')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Herd name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Herd name must be 1-100 characters')
    ],

    feedType: () => [
        body('feedType')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Feed type is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 50 })
            .withMessage('Feed type must be 1-50 characters')
    ],

    activityType: () => [
        body('activityType')
            .isString()
            .trim()
            .isIn(['refilled', 'checked_empty', 'checked_not_empty'])
            .withMessage('Activity type must be "refilled", "checked_empty", or "checked_not_empty"')
    ],

    wasEmpty: () => [
        body('wasEmpty')
            .optional()
            .isBoolean()
            .withMessage('wasEmpty must be a boolean value')
            .toBoolean()
    ],

    pastureName: () => [
        body('newPastureName')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('New pasture name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Pasture name must be 1-100 characters')
    ],

    optionalUsername: () => [
        body('username')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .matches(commonPatterns.username)
            .withMessage('Username must contain only letters, numbers, underscores, and hyphens')
            .isLength({ max: 50 })
            .withMessage('Username must be less than 50 characters')
    ],

    feedsQuery: () => [
        query('feeds')
            .optional()
            .isString()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .withMessage('Feeds must be a comma-separated string')
    ],

    sheetId: () => [
        body('sheetId')
            .trim()
            .notEmpty()
            .withMessage('Sheet ID is required')
            .toInt()
    ],

    sheetIdParam: () => [
        param('sheetId')
            .trim()
            .notEmpty()
            .withMessage('Sheet ID is required')
            .toInt()
    ]
    
};

/**
 * Validation schemas for specific operations with enhanced security
 */
const validationSchemas = {
    // Authentication
    login: [
        ...fieldValidators.username(),
        ...fieldValidators.password()
    ],

    // Cow data operations
    getCowData: [
        ...fieldValidators.cowTagParam()
    ],

    getNthCowImage: [
        ...fieldValidators.cowTagParam(),
        ...fieldValidators.imageTypeParam(),
        ...fieldValidators.nParam()
    ],

    getCowImageCount: [
        ...fieldValidators.cowTagParam()
    ],

    addObservation: [
        ...fieldValidators.cowTag(),
        ...fieldValidators.note(),
        ...fieldValidators.dateOfEntry()
    ],

    addMedicalRecord: [
        ...fieldValidators.cowTag(),
        ...fieldValidators.medicineApplied(),
        ...fieldValidators.treatmentDate(),
        ...fieldValidators.observation(),
        ...fieldValidators.treatment(),
        ...fieldValidators.treatmentResponse()
    ],

    updateCowWeight: [
        ...fieldValidators.cowTag(),
        ...fieldValidators.weight()
    ],

    // Additional cow operations
    addCow: [
        ...fieldValidators.cowTag(),
        body('dateOfBirth')
            .optional()
            .isISO8601()
            .withMessage('Date of birth must be in ISO 8601 format')
            .toDate(),
        ...fieldValidators.description(),
        body('dam')
            .optional()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeCowTag(value) : value;
            })
            .matches(commonPatterns.cowTag)
            .withMessage('Dam (mother) tag must contain only valid cow tag characters'),
        body('sire')
            .optional()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeCowTag(value) : value;
            })
            .matches(commonPatterns.cowTag)
            .withMessage('Sire (father) tag must contain only valid cow tag characters')
    ],

    deleteCow: [
        ...fieldValidators.cowTagParam()
    ],

    getAllCows: [
        ...fieldValidators.page(),
        ...fieldValidators.limit(),
        ...fieldValidators.search()
    ],

    // Image operations
    uploadCowImage: [
        ...fieldValidators.cowTagParam(),
        ...fieldValidators.imageType()
    ],

    getCowImage: [
        ...fieldValidators.cowTagParam(),
        ...fieldValidators.imageTypeParam()
    ],

    getCowImages: [
        ...fieldValidators.cowTagParam()
    ],

    // Map operations
    getMinimap: [
        ...fieldValidators.fieldNameParam()
    ],

    // Field name validation for request body
    fieldNameBody: [
        ...fieldValidators.fieldName()
    ],

    setHerd: [
        ...fieldValidators.cowTag(),
        ...fieldValidators.herdName(),
    ],

    // Herd Management Operations - properly formatted to match your existing system
    getHerdFeedStatus: [
        ...fieldValidators.herdNameParam(),
        ...fieldValidators.feedsQuery()
    ],

    recordFeedActivity: [
        ...fieldValidators.herdName(),
        ...fieldValidators.feedType(),
        ...fieldValidators.activityType(),
        ...fieldValidators.wasEmpty(),
        ...fieldValidators.optionalUsername()
    ],

    getHerdAnimals: [
        ...fieldValidators.herdNameParam()
    ],

    moveHerd: [
        ...fieldValidators.herdName(),
        ...fieldValidators.pastureName(),
        ...fieldValidators.optionalUsername()
    ],

    loadSheet: [
        ...fieldValidators.sheetId(),
        ...fieldValidators.herdName()
    ],

    getSheetStructure: [
        ...fieldValidators.sheetIdParam()
    ],

    deleteSheet: [
        ...fieldValidators.sheetIdParam()
    ],

    updateSheetCell: [
        body('handler')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Handler is required')
            .isIn(['updateHerd', 'updateWeight', 'addNote', 'updateCullStatus', 'recordNewWeight', 'updateWeightDate'])
            .withMessage('Invalid handler type'),
        ...fieldValidators.cowTag(),
        body('value')
            .exists()
            .withMessage('Value is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(String(value));
            })
            .isLength({ max: 1000 })
            .withMessage('Value must be less than 1000 characters')
    ],

    createSheet: [
        body('name')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Sheet name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Sheet name must be 1-100 characters'),
        body('dataColumns')
            .isArray()
            .withMessage('Data columns must be array')
            .isLength({ max: 50 })
            .withMessage('Maximum 50 data columns allowed'),
        body('dataColumns.*.name')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 100 })
            .withMessage('Column name must be less than 100 characters'),
        body('dataColumns.*.dataPath')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 200 })
            .withMessage('Data path must be less than 200 characters'),
        body('fillableColumns')
            .isArray()
            .withMessage('Fillable columns must be array')
            .isLength({ max: 50 })
            .withMessage('Maximum 50 fillable columns allowed'),
        body('fillableColumns.*.name')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 100 })
            .withMessage('Column name must be less than 100 characters'),
        body('fillableColumns.*.dataPath')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 200 })
            .withMessage('Data path must be less than 200 characters')
    ],

    updateSheet: [
        ...fieldValidators.sheetIdParam(),
        body('name')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Sheet name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Sheet name must be 1-100 characters'),
        body('dataColumns')
            .isArray()
            .withMessage('Data columns must be array')
            .isLength({ max: 50 })
            .withMessage('Maximum 50 data columns allowed'),
        body('dataColumns.*.name')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 100 })
            .withMessage('Column name must be less than 100 characters'),
        body('dataColumns.*.dataPath')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 200 })
            .withMessage('Data path must be less than 200 characters'),
        body('fillableColumns')
            .isArray()
            .withMessage('Fillable columns must be array')
            .isLength({ max: 50 })
            .withMessage('Maximum 50 fillable columns allowed'),
        body('fillableColumns.*.name')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 100 })
            .withMessage('Column name must be less than 100 characters'),
        body('fillableColumns.*.dataPath')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 200 })
            .withMessage('Data path must be less than 200 characters')
    ],



};

/**
 * Validation middleware generator
 */
const createValidationMiddleware = (schemaName) => {
    const schema = validationSchemas[schemaName];
    if (!schema) {
        throw new Error(`Validation schema '${schemaName}' not found`);
    }

    return [
        ...schema,
        (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.error(`Validation failed for ${req.method} ${req.originalUrl}:`, errors.array());
                console.error('Request body:', req.body);

                return res.status(400).json({ 
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
            }
            next();
        }
    ];
};

/**
 * Get validation rules without middleware (for API wrapper)
 */
const getValidationRules = (schemaName) => {
    const schema = validationSchemas[schemaName];
    if (!schema) {
        throw new Error(`Validation schema '${schemaName}' not found`);
    }
    return schema;
};

/**
 * Custom validation helpers
 */
const customValidators = {
    // Check if cow tag exists in database
    cowTagExists: async (cowTag) => {
        // TODO: Implement database check
        return true;
    },

    // Check if date is not in the future
    dateNotFuture: (date) => {
        return new Date(date) <= new Date();
    },

    // Sanitize and normalize cow tag
    normalizeCowTag: (cowTag) => {
        return cowTag.trim().toUpperCase();
    }
};

module.exports = {
    validationSchemas,
    createValidationMiddleware,
    getValidationRules,
    fieldValidators,
    customValidators,
    sanitizationFunctions, // Export sanitization functions for API layer
    commonPatterns,        // Export patterns for reference
    
    // Legacy exports for backward compatibility
    setupInputValidation: () => createValidationMiddleware('login'),
    validateInputs: () => createValidationMiddleware('addObservation')
};