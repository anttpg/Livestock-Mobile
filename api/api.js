// db/api.js - Central API wrapper that forces validation on all operations
const { validationResult } = require('express-validator');
const { setupAccessControl } = require('./accessControl');
const dbOperations = require('./dbOperations');

/**
 * Central API wrapper that enforces validation and access control
 * All database operations must go through this wrapper
 */
class APIWrapper {
    constructor() {
        this.accessControl = setupAccessControl();
    }

    /**
     * Execute a database operation with forced validation and access control
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object  
     * @param {Array} validationRules - Array of express-validator rules
     * @param {string} operation - Name of the operation in dbOperations
     * @param {Object} params - Parameters to pass to the operation
     * @returns {Promise} - Database operation result
     */
    async executeOperation(req, res, validationRules, operation, params = {}) {
        try {
            // Step 1: Access Control (always enforced)
            const accessResult = await this.checkAccess(req, res);
            if (!accessResult.success) {
                return res.status(403).json({ error: accessResult.error });
            }

            // Step 2: Input Validation (always enforced)
            const validationResult = this.validateInput(req);
            if (!validationResult.success) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: validationResult.errors 
                });
            }

            // Step 3: Execute database operation
            if (!dbOperations[operation]) {
                throw new Error(`Operation '${operation}' not found in dbOperations`);
            }

            const result = await dbOperations[operation](params);
            
            return res.status(200).json({ 
                success: true, 
                data: result,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error(`API Error in ${operation}:`, error);
            return res.status(500).json({ 
                success: false, 
                error: 'Internal server error',
                operation: operation
            });
        }
    }

    /**
     * Apply validation rules and run validation check
     */
    validateInput(req) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return {
                success: false,
                errors: errors.array()
            };
        }
        return { success: true };
    }

    /**
     * Check access control
     */
    async checkAccess(req, res) {
        return new Promise((resolve) => {
            this.accessControl(req, res, (error) => {
                if (error) {
                    resolve({ success: false, error: 'Access denied' });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    /**
     * Wrapper methods for common operations
     */
    
    async getCowData(req, res, validationRules) {
        const cowTag = req.params.tag || req.body.cowTag;
        return this.executeOperation(req, res, validationRules, 'fetchCowData', { cowTag });
    }

    async addObservation(req, res, validationRules) {
        const { note, dateOfEntry, cowTag } = req.body;
        return this.executeOperation(req, res, validationRules, 'addObservation', {
            note,
            dateOfEntry: dateOfEntry || new Date(),
            cowTag
        });
    }

    async addMedicalRecord(req, res, validationRules) {
        const { cowTag, medicineApplied, treatmentDate, observation, treatment, treatmentResponse } = req.body;
        return this.executeOperation(req, res, validationRules, 'addMedicalRecord', {
            cowTag,
            medicineApplied,
            treatmentDate: treatmentDate || new Date(),
            observation,
            treatment,
            treatmentResponse
        });
    }

    async updateCowWeight(req, res, validationRules) {
        const { cowTag, weight } = req.body;
        return this.executeOperation(req, res, validationRules, 'updateCowWeight', {
            cowTag,
            weight
        });
    }
}

// Export singleton instance
module.exports = new APIWrapper();