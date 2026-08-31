const express = require('express')
const mongoose = require('mongoose')
const { body, validationResult } = require('express-validator')
const Pet = require('../models/Pet')
const { protect } = require('../middleware/auth')

const router = express.Router()

const validators = [
    body('name').trim().notEmpty().withMessage('Pet name is required'),
    body('type').isIn(['dog', 'cat']).withMessage('Pet type must be dog or cat'),
    body('breed').trim().notEmpty().withMessage('Breed is required'),
    body('coatType').optional().trim().isLength({ max: 100 }),
    body('notes').optional().trim().isLength({ max: 300 }),
    body('ageMonths').optional({ checkFalsy: true }).isNumeric().withMessage('Age in months must be a number'),
    body('vaccinated').optional()
]

router.get('/', protect, async (req, res) => {
    try {
        const pets = await Pet.find({ owner: req.user._id }).sort({ createdAt: -1 })
        res.json({ success: true, pets })
    } catch (error) {
        console.error('Get pets error:', error)
        res.status(500).json({ success: false, message: 'Unable to load pets' })
    }
})

router.post('/', protect, validators, async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
    }

    try {
        const isVaccinated = req.body.vaccinated === false || req.body.vaccinated === 'false' || req.body.vaccinated === 'no' ? false : true
        const pet = await Pet.create({
            owner: req.user._id,
            name: req.body.name,
            type: req.body.type,
            breed: req.body.breed,
            coatType: req.body.coatType || '',
            notes: req.body.notes || '',
            ageMonths: req.body.ageMonths !== undefined && req.body.ageMonths !== '' ? Number(req.body.ageMonths) : 12,
            vaccinated: isVaccinated,
            photoUrl: req.body.photoUrl || ''
        })
        res.status(201).json({ success: true, pet })
    } catch (error) {
        console.error('Create pet error:', error)
        res.status(500).json({ success: false, message: 'Unable to save pet' })
    }
})

router.patch('/:id', protect, validators, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid pet ID' })
    }

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
    }

    try {
        const isVaccinated = req.body.vaccinated === false || req.body.vaccinated === 'false' || req.body.vaccinated === 'no' ? false : true
        const pet = await Pet.findOneAndUpdate(
            { _id: req.params.id, owner: req.user._id },
            {
                name: req.body.name,
                type: req.body.type,
                breed: req.body.breed,
                coatType: req.body.coatType || '',
                notes: req.body.notes || '',
                ageMonths: req.body.ageMonths !== undefined && req.body.ageMonths !== '' ? Number(req.body.ageMonths) : 12,
                vaccinated: isVaccinated,
                photoUrl: req.body.photoUrl || ''
            },
            { new: true, runValidators: true }
        )

        if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' })
        res.json({ success: true, pet })
    } catch (error) {
        console.error('Update pet error:', error)
        res.status(500).json({ success: false, message: 'Unable to update pet' })
    }
})

router.delete('/:id', protect, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid pet ID' })
    }

    const pet = await Pet.findOneAndDelete({ _id: req.params.id, owner: req.user._id })
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' })
    res.json({ success: true, message: 'Pet removed' })
})

module.exports = router
