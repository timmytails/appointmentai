const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const Contact = require('../models/Contact')

// @route   POST /api/contact
// @desc    Submit a contact message
// @access  Public
router.post(
    '/',
    [
        body('name')
            .trim()
            .notEmpty().withMessage('Full name is required')
            .isLength({ min: 2, max: 100 }).withMessage('Name must be at least 2 characters long'),
        body('email')
            .trim()
            .notEmpty().withMessage('Email address is required')
            .isEmail().withMessage('Please enter a valid email address (e.g. name@example.com)')
            .normalizeEmail({ gmail_remove_dots: false }),
        body('phone')
            .trim()
            .notEmpty().withMessage('Phone number is required')
            .matches(/^(09|\+?639|\+?63|9)\d{9,10}$|^[0-9+\s-]{9,15}$/).withMessage('Please enter a valid phone number (e.g. 9171234567 or 09171234567)'),
        body('message')
            .trim()
            .notEmpty().withMessage('Message is required')
            .isLength({ min: 10, max: 1000 }).withMessage('Message must be at least 10 characters long')
    ],
    async (req, res) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            const firstMsg = errors.array()[0]?.msg || 'Invalid input'
            return res.status(400).json({ success: false, message: firstMsg, errors: errors.array() })
        }

        const { name, email, phone, message } = req.body

        try {
            await Contact.create({ name, email, phone: phone || '', message })
            res.status(201).json({
                success: true,
                message: "Thank you for your message! We'll get back to you within 24 hours."
            })
        } catch (error) {
            console.error(error)
            res.status(500).json({ success: false, message: 'Server error' })
        }
    }
)

module.exports = router
