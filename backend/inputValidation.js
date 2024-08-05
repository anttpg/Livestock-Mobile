
const { body, validationResult } = require('express-validator');

const setupInputValidation = () => [
    body('username').isString().notEmpty(),
    body('password').isString().notEmpty()
];

const validateInputs = () => [
    body('firstName').isString().notEmpty(),
    body('age').isInt({ min: 0 }),
    body('money').isFloat({ min: 0 }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

module.exports = { setupInputValidation, validateInputs };