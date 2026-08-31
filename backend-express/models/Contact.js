const mongoose = require('mongoose')

const contactSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters']
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
        },
        phone: {
            type: String,
            trim: true,
            default: ''
        },
        message: {
            type: String,
            required: [true, 'Message is required'],
            maxlength: [1000, 'Message cannot exceed 1000 characters']
        },
        read: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model('Contact', contactSchema)
