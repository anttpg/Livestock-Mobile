// db/inputValidation.js - Comprehensive input validation for all database operations
const { body, param, validationResult } = require('express-validator');

/**
 * Common validation patterns
 */
const commonPatterns = {
    cowTag: /^[A-Za-z0-9-]+$/,
    dateISO: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    username: /^[A-Za-z0-9_-]+$/
};

/**
 * Reusable field validators
 */
const fieldValidators = {
    cowTag: () => [
        body('cowTag')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Cow tag is required')
            .matches(commonPatterns.cowTag)
            .withMessage('Cow tag must contain only letters, numbers, and hyphens')
            .isLength({ min: 1, max: 20 })
            .withMessage('Cow tag must be 1-20 characters')
    ],

    cowTagParam: () => [
        param('tag')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Cow tag is required')
            .matches(commonPatterns.cowTag)
            .withMessage('Cow tag must contain only letters, numbers, and hyphens')
            .isLength({ min: 1, max: 20 })
            .withMessage('Cow tag must be 1-20 characters')
    ],

    note: () => [
        body('note')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('Note is required')
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
            .isLength({ min: 1, max: 100 })
            .withMessage('Medicine name must be 1-100 characters')
    ],

    observation: () => [
        body('observation')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Observation must be less than 500 characters')
    ],

    treatment: () => [
        body('treatment')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Treatment must be less than 500 characters')
    ],

    treatmentResponse: () => [
        body('treatmentResponse')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Treatment response must be less than 500 characters')
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
    ]
};

/**
 * Validation schemas for specific operations
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
        body('description')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description must be less than 500 characters'),
        body('dam')
            .optional()
            .matches(commonPatterns.cowTag)
            .withMessage('Dam (mother) tag must contain only letters, numbers, and hyphens'),
        body('sire')
            .optional()
            .matches(commonPatterns.cowTag)
            .withMessage('Sire (father) tag must contain only letters, numbers, and hyphens')
    ],

    deleteCow: [
        ...fieldValidators.cowTagParam()
    ]
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
    
    // Legacy exports for backward compatibility
    setupInputValidation: () => createValidationMiddleware('login'),
    validateInputs: () => createValidationMiddleware('addObservation')
};