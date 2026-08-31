const mongoose = require('mongoose')

const petSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        name: {
            type: String,
            required: [true, 'Pet name is required'],
            trim: true,
            maxlength: 50
        },
        type: {
            type: String,
            enum: ['dog', 'cat'],
            required: true
        },
        breed: {
            type: String,
            required: [true, 'Breed is required'],
            trim: true,
            maxlength: 80
        },
        coatType: {
            type: String,
            trim: true,
            maxlength: 100,
            default: ''
        },
        notes: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ''
        },
        ageMonths: {
            type: Number,
            min: 0,
            default: 12
        },
        vaccinated: {
            type: Boolean,
            default: true
        },
        photoUrl: {
            type: String,
            default: ''
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model('Pet', petSchema)
