const mongoose = require('mongoose')

const otpRequestSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: false,
            lowercase: true,
            trim: true,
            index: true
        },
        purpose: {
            type: String,
            enum: ['signup', 'reset_password', 'profile_phone'],
            required: true,
            index: true
        },
        otpHash: {
            type: String,
            required: true
        },
        payload: {
            type: Object,
            default: {}
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true
        }
    },
    { timestamps: true }
)

otpRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 })

module.exports = mongoose.model('OtpRequest', otpRequestSchema)
