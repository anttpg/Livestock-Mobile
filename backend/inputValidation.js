const { body, param, query, validationResult } = require('express-validator');
const { assignBreedingRecords } = require('../api/api');

/**
 * Common patterns
 */
const commonPatterns = {
    cowTag: /^[A-Za-z0-9 _\-*/]+$/,  // Allow letters, numbers, spaces, underscores, hyphens, asterisks
    dateISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    username: /^[A-Za-z0-9_\-]+$/
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
            // Unix-specific
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
    sanitizeCowTag: (cowTag, allowEmpty = false) => {
        if (!cowTag || typeof cowTag !== 'string') {
            if (allowEmpty) {
                return "";
            }
            else {
                throw new Error('Cow tag must be a non-empty string');
            }
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
 * escape regex special characters
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cowTagValidator(fieldName, allowEmpty = false) {
    if (allowEmpty) {
        return [
            body(fieldName)
                .optional({ nullable: true })
                .isString()
                .isEmpty()
                .withMessage('Cow tag must be a string')
        ];
    }

    return [
        body(fieldName)
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Cow tag is required')
            .customSanitizer((value) => sanitizationFunctions.sanitizeCowTag(value, allowEmpty))
            .matches(commonPatterns.cowTag)
            .withMessage('Cow tag must contain only letters, numbers, spaces, underscores, hyphens, and asterisks')
            .isLength({ min: 1, max: 50 })
            .withMessage('Cow tag must be 1-50 characters')
    ];
}

/**
 * Reusable field validators with sanitization
 */
const fieldValidators = {

    cowTag: () => [
        cowTagValidator('cowTag')
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
            .matches(/^[a-zA-Z0-9_-]+$/)
            .withMessage('Username must contain only letters, numbers, underscores, and hyphens')
            .isLength({ min: 3, max: 50 })
            .withMessage('Username must be 3-50 characters'),
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
            .isIn(['refilled', 'checked_empty', 'checked_not_empty', 'level_check'])
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

    pastureNameParam: () => [
        param('pastureName')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Pasture name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Pasture name must be 1-100 characters')
    ],

    usernameParam: () => [
        param('username')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Username is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .matches(commonPatterns.username)
            .withMessage('Username must contain only letters, numbers, underscores, and hyphens')
    ],

    levelAtRefill: () => [
        body('levelAtRefill')
            .optional()
            .isInt({ min: 0, max: 100 })
            .withMessage('Level at refill must be between 0 and 100')
            .toInt()
    ],

    eventType: () => [
        body('eventType')
            .isString()
            .trim()
            .isIn(['movement', 'membership', 'health', 'breeding', 'general'])
            .withMessage('Event type must be valid')
    ],

    cowTagsArray: () => [
        body('cowTags')
            .isArray()
            .withMessage('Cow tags must be an array')
            .custom((value) => {
                value.forEach(tag => {
                    if (!commonPatterns.cowTag.test(tag)) {
                        throw new Error('Invalid cow tag in array');
                    }
                });
                return true;
            })
    ],

    recordType: () => [
        body('recordType')
            .isString()
            .trim()
            .isIn(['issue', 'treatment', 'maintenance', 'vet'])
            .withMessage('Record type must be issue, treatment, maintenance, or vet')
    ],

    eventId: () => [
        body('eventID')
            .optional()
            .isInt()
            .toInt()
    ],

    issueDescription: () => [
        body('issueDescription')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    issueObservedBy: () => [
        body('issueObservedBy')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 255 })
    ],

    issueObservationDate: () => [
        body('issueObservationDate')
            .optional()
            .isISO8601()
            .toDate()
    ],

    issueSerious: () => [
        body('issueSerious')
            .optional()
            .isBoolean()
            .toBoolean()
    ],

    treatmentMedicine: () => [
        body('treatmentMedicine')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 255 })
    ],

    treatmentMethod: () => [
        body('treatmentMethod')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    treatmentIsImmunization: () => [
        body('treatmentIsImmunization')
            .optional()
            .isBoolean()
            .toBoolean()
    ],

    treatmentIsActive: () => [
        body('treatmentIsActive')
            .optional()
            .isBoolean()
            .toBoolean()
    ],

    vetName: () => [
        body('vetName')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 255 })
    ],

    vetComments: () => [
        body('vetComments')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    recordIdParam: () => [
        param('recordId')
            .isInt({ min: 1 })
            .withMessage('Record ID must be a positive integer')
            .toInt()
    ],

    resolutionNote: () => [
        body('resolutionNote')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Resolution note is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 1000 })
            .withMessage('Resolution note must be 1-1000 characters')
    ],

    resolutionDate: () => [
        body('resolutionDate')
            .optional()
            .isISO8601()
            .toDate()
    ],

    dam: () => [
        body('dam')
            .optional()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeCowTag(value) : value;
            })
            .matches(commonPatterns.cowTag)
            .withMessage('Dam (mother) tag must contain only valid cow tag characters')
    ],

    sire: () => [
        body('sire')
            .optional()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeCowTag(value) : value;
            })
            .matches(commonPatterns.cowTag)
            .withMessage('Sire (father) tag must contain only valid cow tag characters')
    ],

    sheetColumns: () => [
        body('dataColumns.*.name')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 100 }),
        body('dataColumns.*.dataPath')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 200 }),
        body('fillableColumns.*.name')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 100 }),
        body('fillableColumns.*.dataPath')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 200 })
    ],

    sheetName: () => [
        body('name')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Sheet name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Sheet name must be 1-100 characters')
    ],

    dataColumnsArray: () => [
        body('dataColumns')
            .isArray()
            .withMessage('Data columns must be array')
            .isLength({ max: 50 })
            .withMessage('Maximum 50 data columns allowed')
    ],

    fillableColumnsArray: () => [
        body('fillableColumns')
            .isArray()
            .withMessage('Fillable columns must be array')
            .isLength({ max: 50 })
            .withMessage('Maximum 50 fillable columns allowed')
    ],

    reusableQuery: () => [
        query('reusable')
            .optional()
            .isBoolean()
            .withMessage('Reusable must be a boolean value')
            .toBoolean()
    ],

    dateRequired: () => [
        body('date')
            .isISO8601()
            .withMessage('Date must be in ISO 8601 format')
            .toDate()
    ],

    records: () => [
        body('records')
            .isArray({ min: 1 })
            .withMessage('Records must be a non-empty array')
            .isLength({ max: 1000 })
            .withMessage('Maximum 1000 records allowed')
    ],

    pregnancyRecord: () => [
        body('records.*.cowTag')
            .isString()
            .trim()
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeCowTag(value);
            })
            .matches(commonPatterns.cowTag),
        body('records.*.result')
            .isString()
            .isIn(['Pregnant', 'Open'])
            .withMessage('Result must be "Pregnant" or "Open"'),
        body('records.*.sex')
            .optional()
            .isString()
            .isIn(['Heifer', 'Bull', ''])
            .withMessage('Sex must be "Heifer", "Bull", or empty'),
        body('records.*.weight')
            .optional()
            .isInt({ min: 0, max: 5000 })
            .withMessage('Weight must be between 0 and 5000')
            .toInt(),
        body('records.*.notes')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    calvingRecord: () => [
        body('breedingRecordId')
            .isInt({ min: 1 })
            .withMessage('Breeding record ID must be a positive integer')
            .toInt(),
        body('calfTag')
            .isString()
            .trim()
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeCowTag(value);
            })
            .matches(commonPatterns.cowTag)
            .isLength({ min: 1, max: 50 }),
        body('damTag')
            .isString()
            .trim()
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeCowTag(value);
            })
            .matches(commonPatterns.cowTag)
            .isLength({ min: 1, max: 50 }),
        body('birthDate')
            .isISO8601()
            .withMessage('Birth date must be in ISO 8601 format')
            .toDate(),
        body('calfSex')
            .optional()
            .isString()
            .isIn(['Male', 'Female', 'Heifer', 'Bull', ''])
            .withMessage('Calf sex must be valid option'),
        body('twins')
            .optional()
            .isBoolean()
            .toBoolean()
    ],

    weaningRecord: () => [
        body('records.*.cowTag')
            .isString()
            .trim()
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeCowTag(value);
            })
            .matches(commonPatterns.cowTag),
        body('records.*.notes')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    weightRecord: () => [
        body('records.*.cowTag')
            .isString()
            .trim()
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeCowTag(value);
            })
            .matches(commonPatterns.cowTag),
        body('records.*.weight')
            .isFloat({ min: 0, max: 5000 })
            .withMessage('Weight must be between 0 and 5000')
            .toFloat(),
        body('records.*.notes')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    planIdParam: () => [
        param('planId')
            .isNumeric()
            .withMessage('Plan ID must be numeric')
            .toInt()
            .isInt({ min: 1 })
            .withMessage('Plan ID must be a positive integer')
    ],

    updateHandler: () => [
        body('handler')
            .isString()
            .trim()
            .isIn([
                'updatePregancyResult',
                'updateFetusSex',
                'updatePregCheckWeight',
                'updatePregCheckNotes',
                'updatePregCheckDate', 
                'updateMonthsPregnant',
                'updateBreedingStatus',
                'updateWeaningStatus',
                'recordNewWeight',
                'updateWeightDate',
                'addCalvingNote',
                'addWeaningNote',
                'addWeightNote'
            ])
            .withMessage('Invalid update handler type')
    ],
    
    updatesBatch: () => [
        body('updates')
            .isArray()
            .withMessage('Updates must be an array')
            .custom((updates) => {
                if (updates.length === 0) {
                    throw new Error('Updates array cannot be empty');
                }
                if (updates.length > 100) {
                    throw new Error('Cannot update more than 100 cells at once');
                }
                return true;
            })
    ],

    updateCowTag: () => [
        body('updates.*.cowTag')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Each update needs a cow tag')
            .isLength({ max: 50 })
            .withMessage('Cow tag must be less than 50 characters')
    ],

    updateColumnKey: () => [
        body('updates.*.columnKey')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Each update needs a column key')
            .isLength({ max: 100 })
            .withMessage('Column key must be less than 100 characters')
    ],

    updateValue: () => [
        body('updates.*.value')
            .exists()
            .withMessage('Each update needs a value')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(String(value));
            })
            .isLength({ max: 1000 })
            .withMessage('Update value must be less than 1000 characters')
    ],

    updateHandlerBatch: () => [
    body('updates.*.handler')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Each update needs a handler')
        .isLength({ max: 100 })
        .withMessage('Handler must be less than 100 characters')
    ],

    breedingYear: () => [
        body('breedingYear')
            .optional()
            .isInt({ min: 1900, max: 2099 })
            .withMessage('Breeding year must be between 1900 and 2099')
            .toInt()
    ],

    sheetName: () => [
        body('sheetName')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Sheet name must be less than 100 characters')
    ],

    cellValue: () => [
        body('value')
            .exists()
            .withMessage('Value is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(String(value));
            })
            .isLength({ max: 1000 })
            .withMessage('Value must be less than 1000 characters')
    ],

    parentSheetId: () => [
        body('parentSheetId')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Parent sheet ID must be a positive integer')
            .toInt()
    ],

    locked: () => [
        body('locked')
            .optional()
            .isBoolean()
            .withMessage('Locked must be a boolean value')
            .toBoolean()
    ],

    eventDescription: () => [
        body('description')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Description is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 500 })
            .withMessage('Description must be 1-500 characters')
    ],

    optionalNotes: () => [
        body('notes')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
            .withMessage('Notes must be less than 1000 characters')
    ],

    pastureNameBody: () => [
        body('pastureName')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Pasture name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Pasture name must be 1-100 characters')
    ],

    targetOfMaintenance: () => [
        body('targetOfMaintenance')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Target of maintenance is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 200 })
            .withMessage('Target of maintenance must be 1-200 characters')
    ],

    actionPerformed: () => [
        body('actionPerformed')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Action performed is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 1000 })
            .withMessage('Action performed must be 1-1000 characters')
    ],

    needsFollowUp: () => [
        body('needsFollowUp')
            .optional()
            .isBoolean()
            .withMessage('Needs follow up must be a boolean value')
            .toBoolean()
    ],

    cowsArray: () => [
        body('cows')
            .optional()
            .isArray()
            .withMessage('Cows must be an array')
    ],

    currentPasture: () => [
        body('currentPasture')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 100 })
            .withMessage('Current pasture must be less than 100 characters')
    ],

    targetHerd: () => [
        body('targetHerd')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Target herd is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 100 })
            .withMessage('Target herd must be 1-100 characters')
    ],

    sourceHerd: () => [
        body('sourceHerd')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 100 })
            .withMessage('Source herd must be less than 100 characters')
    ],

    treatmentMedicineOptional: () => [
        body('treatmentMedicine')
            .optional({ nullable: true, checkFalsy: true }) // Allow empty strings
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : null;
            })
            .isLength({ max: 255 })
    ],

    treatmentMethodOptional: () => [
        body('treatmentMethod')
            .optional({ nullable: true, checkFalsy: true }) // Allow empty strings
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : null;
            })
            .isLength({ max: 1000 })
    ],

    treatmentResponseOptional: () => [
        body('treatmentResponse')
            .optional({ nullable: true, checkFalsy: true }) // Allow empty strings
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : null;
            })
            .isLength({ max: 1000 })
    ],

    vetNameOptional: () => [
        body('vetName')
            .optional({ nullable: true, checkFalsy: true }) // Allow empty strings
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : null;
            })
            .isLength({ max: 255 })
    ],

    vetCommentsOptional: () => [
        body('vetComments')
            .optional({ nullable: true, checkFalsy: true }) // Allow empty strings
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : null;
            })
            .isLength({ max: 1000 })
    ],

    noteOptional: () => [
        body('note')
            .optional({ nullable: true, checkFalsy: true }) // Allow empty strings
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : null;
            })
            .isLength({ max: 1000 })
    ],

    updateIssueDescription: () => [
        body('IssueDescription')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    updateIssueObservedBy: () => [
        body('IssueObservedBy')
            .optional()
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 255 })
    ],

    updateIssueObservationDate: () => [
        body('IssueObservationDate')
            .optional()
            .isISO8601()
            .toDate()
    ],

    updateIssueSerious: () => [
        body('IssueSerious')
            .optional()
            .isBoolean()
            .toBoolean()
    ],

    updateTreatmentMedicine: () => [
        body('TreatmentMedicine')
            .optional({ nullable: true, checkFalsy: true })
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 255 })
    ],

    updateTreatmentDate: () => [
        body('TreatmentDate')
            .optional()
            .isISO8601()
            .toDate()
    ],

    updateTreatmentMethod: () => [
        body('TreatmentMethod')
            .optional({ nullable: true, checkFalsy: true })
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    updateTreatmentResponse: () => [
        body('TreatmentResponse')
            .optional({ nullable: true, checkFalsy: true })
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    updateTreatmentIsImmunization: () => [
        body('TreatmentIsImmunization')
            .optional()
            .isBoolean()
            .toBoolean()
    ],

    updateTreatmentIsActive: () => [
        body('TreatmentIsActive')
            .optional()
            .isBoolean()
            .toBoolean()
    ],

    updateVetName: () => [
        body('VetName')
            .optional({ nullable: true, checkFalsy: true })
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 255 })
    ],

    updateVetComments: () => [
        body('VetComments')
            .optional({ nullable: true, checkFalsy: true })
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    updateVetComments: () => [
        body('VetComments')
            .optional({ nullable: true, checkFalsy: true })
            .isString()
            .trim()
            .customSanitizer((value) => {
                return value ? sanitizationFunctions.sanitizeForSQL(value) : value;
            })
            .isLength({ max: 1000 })
    ],

    email: () => [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required')
    ],

    permissionList: () => [
        body('permissions')
            .isArray()
            .withMessage('Permissions must be an array')
    ],

    specificPermission: () => [
        body('permissions.*')
            .isString()
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

    getCowEpds: [
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

    getMedicalRecord: [
        ...fieldValidators.recordIdParam()
    ],



    createMedicalRecord: [
        ...fieldValidators.cowTag(),
        ...fieldValidators.recordType(),
        ...fieldValidators.eventId(),
        ...fieldValidators.issueDescription(),
        ...fieldValidators.issueObservedBy(),
        ...fieldValidators.issueObservationDate(),
        ...fieldValidators.issueSerious(),
        ...fieldValidators.treatmentMedicineOptional(), 
        ...fieldValidators.treatmentDate(),
        ...fieldValidators.treatmentResponseOptional(),
        ...fieldValidators.treatmentMethodOptional(), 
        ...fieldValidators.treatmentIsImmunization(),
        ...fieldValidators.treatmentIsActive(),
        ...fieldValidators.vetNameOptional(),
        ...fieldValidators.vetCommentsOptional(), 
        ...fieldValidators.noteOptional()
    ],

    updateMedicalRecord: [
        ...fieldValidators.recordIdParam(),
        ...fieldValidators.updateIssueDescription(),
        ...fieldValidators.updateIssueObservedBy(),
        ...fieldValidators.updateIssueObservationDate(),
        ...fieldValidators.updateIssueSerious(),
        ...fieldValidators.updateTreatmentMedicine(),
        ...fieldValidators.updateTreatmentDate(),
        ...fieldValidators.updateTreatmentResponse(),
        ...fieldValidators.updateTreatmentMethod(),
        ...fieldValidators.updateTreatmentIsImmunization(),
        ...fieldValidators.updateTreatmentIsActive(),
        ...fieldValidators.updateVetName(),
        ...fieldValidators.updateVetComments()
    ],

    getMedicines: [],

    addMedicine: [
        body('medicine')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Medicine name is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 255 })
            .withMessage('Medicine name must be 1-255 characters'),
        body('applicationMethod')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Application method is required')
            .customSanitizer((value) => {
                return sanitizationFunctions.sanitizeForSQL(value);
            })
            .isLength({ min: 1, max: 255 })
            .withMessage('Application method must be 1-255 characters'),
        body('isImmunization')
            .isBoolean()
            .withMessage('Is immunization must be true or false')
            .toBoolean()
    ],

    uploadMedicalImage: [
        param('recordId').isInt({ min: 1 }).toInt()
    ],

    getMedicalImage: [
        param('recordId').isInt({ min: 1 }).toInt(),
        param('imageType').isString().isIn(['issue']),
        param('n').optional().isInt({ min: 1 }).toInt()
    ],

    getMedicalImageCount: [
        param('recordId').isInt({ min: 1 }).toInt()
    ],

    resolveIssue: [
        ...fieldValidators.recordIdParam(),
        ...fieldValidators.resolutionNote(),
        ...fieldValidators.resolutionDate()
    ],

    addCow: [
        ...fieldValidators.cowTag(),
        ...fieldValidators.dateOfEntry(),
        ...fieldValidators.description(),
        ...fieldValidators.dam(),
        ...fieldValidators.sire(),
        body('createCalvingRecord')
            .optional()
            .isBoolean().withMessage('createCalvingRecord must be true or false')
            .toBoolean(),
        ...fieldValidators.breedingYear(),
    ],

    updateCowWeight: [
        ...fieldValidators.cowTag(),
        ...fieldValidators.weight()
    ],

    deleteCow: [
        ...fieldValidators.cowTagParam()
    ],

    getAllCows: [
        ...fieldValidators.page(),
        ...fieldValidators.limit(),
        ...fieldValidators.search()
    ],

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

    getMinimap: [
        ...fieldValidators.fieldNameParam()
    ],

    fieldNameBody: [
        ...fieldValidators.fieldName()
    ],

    setHerd: [
        ...fieldValidators.cowTag(),
        ...fieldValidators.herdName(),
    ],

    getHerdFeedStatus: [
        ...fieldValidators.herdNameParam(),
        ...fieldValidators.feedsQuery()
    ],

    recordFeedActivity: [
        ...fieldValidators.herdName(),
        ...fieldValidators.feedType(),
        ...fieldValidators.activityType(),
        ...fieldValidators.levelAtRefill(),
        ...fieldValidators.wasEmpty(),
        ...fieldValidators.optionalUsername()
    ],

    addFeedType: [
        ...fieldValidators.feedType()
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
        ...fieldValidators.herdName(),
        ...fieldValidators.breedingYear(),
        ...fieldValidators.sheetName()
    ],

    batchUpdateSheet: [
    ...fieldValidators.updatesBatch(),
    ...fieldValidators.updateCowTag(),
    ...fieldValidators.updateColumnKey(),
    ...fieldValidators.updateValue(),
    ...fieldValidators.updateHandlerBatch()
    ],

    getSheetStructure: [
        ...fieldValidators.sheetIdParam()
    ],

    deleteSheet: [
        ...fieldValidators.sheetIdParam()
    ],

    getHerdEvents: [
        ...fieldValidators.herdNameParam()
    ],

    getPastureMaintenanceEvents: [
        ...fieldValidators.pastureNameParam()
    ],

    addHerdEvent: [
        ...fieldValidators.herdNameParam(),
        ...fieldValidators.eventType(),
        ...fieldValidators.eventDescription(),
        ...fieldValidators.optionalNotes(),
        ...fieldValidators.optionalUsername()
    ],

    addPastureMaintenanceEvent: [
        ...fieldValidators.pastureNameBody(),
        ...fieldValidators.targetOfMaintenance(),
        ...fieldValidators.actionPerformed(),
        ...fieldValidators.needsFollowUp(),
        ...fieldValidators.optionalUsername()
    ],

    createHerd: [
        ...fieldValidators.herdName(),
        ...fieldValidators.cowsArray(),
        ...fieldValidators.currentPasture()
    ],

    batchMoveCows: [
        ...fieldValidators.cowTagsArray(),
        ...fieldValidators.targetHerd(),
        ...fieldValidators.sourceHerd()
    ],

    getUserPreferences: [
        ...fieldValidators.usernameParam()
    ],

    updateUserPreferences: [
        ...fieldValidators.usernameParam(),
        body('preferences').isObject().withMessage('Preferences must be an object')
    ],

    updateSheetCell: [
        ...fieldValidators.updateHandler(),
        ...fieldValidators.cowTag(),
        ...fieldValidators.cellValue()
    ],

    createSheet: [
        ...fieldValidators.sheetName(),
        ...fieldValidators.dataColumnsArray(),
        ...fieldValidators.fillableColumnsArray(),
        ...fieldValidators.sheetColumns()
    ],

    updateSheet: [
        ...fieldValidators.sheetIdParam(),
        ...fieldValidators.sheetName(),
        ...fieldValidators.dataColumnsArray(),
        ...fieldValidators.fillableColumnsArray(),
        ...fieldValidators.sheetColumns()
    ],

    getHerdBreedingCandidates: [
        ...fieldValidators.herdNameParam()
    ],

    submitPregancyCheck: [
        ...fieldValidators.herdName(),
        ...fieldValidators.dateRequired(),
        ...fieldValidators.records(),
        ...fieldValidators.pregnancyRecord()
    ],

    getCalvingStatus: [
        ...fieldValidators.herdNameParam()
    ],

    addCalvingRecord: [
        ...fieldValidators.calvingRecord(),
        ...fieldValidators.note()
    ],

    getWeaningCandidates: [
        ...fieldValidators.herdNameParam()
    ],

    recordWeaning: [
        ...fieldValidators.dateRequired(),
        ...fieldValidators.records(),
        ...fieldValidators.weaningRecord()
    ],

    generateTagSuggestions: [
        ...fieldValidators.cowTagParam(),
        ...fieldValidators.reusableQuery()
    ],

    recordBatchWeights: [
        ...fieldValidators.dateRequired(),
        ...fieldValidators.records(),
        ...fieldValidators.weightRecord()
    ],

    // Breeding Plan Functions
    getBreedingPlanOverview: [
        ...fieldValidators.planIdParam()
    ],

    // Updated Sheet Functions
    updateSheetCellNew: [
        ...fieldValidators.updateHandler(),
        ...fieldValidators.cowTag(),
        ...fieldValidators.cellValue()
    ],

    createSheetNew: [
        ...fieldValidators.sheetName(),
        ...fieldValidators.dataColumnsArray(),
        ...fieldValidators.fillableColumnsArray(),
        ...fieldValidators.parentSheetId(),
        ...fieldValidators.locked()
    ],

    
    findBreedingRecordForDam: [
        cowTagValidator('damTag'),
        ...fieldValidators.breedingYear()
    ],

    assignBreedingRecords: [
        body('planId').isInt({ min: 1 }).withMessage('Plan ID must be a positive integer').toInt(),
        cowTagValidator('primaryBull'),
        cowTagValidator('cleanupBull', allowEmpty = true),
        ...fieldValidators.cowTagsArray(),
        body('exposureStartDate').isISO8601().withMessage('Exposure start date must be valid').toDate(),
        body('exposureEndDate').isISO8601().withMessage('Exposure end date must be valid').toDate(),
        body('pasture').optional().isString().trim()
    ],

    updateSheetCell: [
        ...fieldValidators.updateHandler(),
        ...fieldValidators.cowTag(),
        ...fieldValidators.cellValue(),
        ...fieldValidators.breedingYear()
    ],

    register: [
        ...fieldValidators.username(),
        ...fieldValidators.email(),
        ...fieldValidators.password()
    ],
    
    setPassword: [
        ...fieldValidators.email(),
        ...fieldValidators.password()
    ],
    
    login: [
        ...fieldValidators.email(),
        ...fieldValidators.password()
    ],

    
    resetPassword: [
        ...fieldValidators.email(),
    ],
    
    updatePermissions: [
        ...fieldValidators.email(),
        ...fieldValidators.permissionList(),
        ...fieldValidators.specificPermission(),
    ],
    
    blockUser: [
        ...fieldValidators.email(),
    ],
    
    unblockUser: [
        ...fieldValidators.email(),
    ],

    preRegisterUser: [
        ...fieldValidators.email(),
        ...fieldValidators.permissionList(),
        ...fieldValidators.specificPermission(),
    ],

};

/**
 * Simple validator for parameterized queries
 * Only validates type, length, and format
 */
const createSimpleGenericValidator = (options = {}) => {
    const { maxLength = 1000 } = options;

    return (req, res, next) => {
        const errors = [];

        const validateValue = (value, fieldName, path) => {
            if (value === null || value === undefined || value === '') {
                return; // Allow empty values
            }

            const strValue = String(value);

            // Just check length - that's it
            if (strValue.length > maxLength) {
                errors.push({
                    field: fieldName,
                    path: path,
                    message: `${fieldName} exceeds maximum length of ${maxLength} characters`
                });
            }
        };

        const validateObject = (obj, pathPrefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    validateObject(value, fullPath);
                } else if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        if (typeof item === 'object' && item !== null) {
                            validateObject(item, `${fullPath}[${index}]`);
                        } else {
                            validateValue(item, key, `${fullPath}[${index}]`);
                        }
                    });
                } else {
                    validateValue(value, key, fullPath);
                }
            }
        };

        if (req.body && Object.keys(req.body).length > 0) {
            validateObject(req.body, 'body');
        }
        if (req.query && Object.keys(req.query).length > 0) {
            validateObject(req.query, 'query');
        }
        if (req.params && Object.keys(req.params).length > 0) {
            validateObject(req.params, 'params');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        next();
    };
};


/**
 * Validation middleware generator
 */
const createValidationMiddleware = (schemaName, useGenericValidation = false, genericOptions = {}) => {
    // If using generic validation, return generic validator
    if (useGenericValidation) {
        return createSimpleGenericValidator(genericOptions);
    }
    
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
    cowTagValidator,

    // Legacy exports for backward compatibility
    setupInputValidation: () => createValidationMiddleware('login'),
    validateInputs: () => createValidationMiddleware('addObservation')
};