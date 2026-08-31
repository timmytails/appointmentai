const mongoose = require('mongoose')
const {
    SOURCE_PHOTO_POLICY_VERSION
} = require('../config/photoVerificationPolicy')

const aiPreviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        pet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Pet',
            default: null,
            index: true
        },
        petName: {
            type: String,
            trim: true,
            maxlength: 50,
            default: ''
        },
        petType: {
            type: String,
            enum: ['dog', 'cat'],
            required: true
        },
        breed: {
            type: String,
            trim: true,
            maxlength: 80,
            required: true
        },
        styleId: {
            type: String,
            required: true,
            index: true
        },
        styleName: {
            type: String,
            required: true,
            trim: true
        },
        seasonKey: {
            type: String,
            required: true,
            trim: true
        },
        seasonLabel: {
            type: String,
            required: true,
            trim: true
        },
        sourcePhotoHash: {
            type: String,
            required: true,
            trim: true,
            select: false
        },
        generatedImage: {
            type: String,
            required: true,
            select: false
        },
        provider: {
            type: String,
            default: 'Google Cloud Vertex AI'
        },
        model: {
            type: String,
            required: true,
            trim: true
        },
        previewVersion: {
            type: String,
            required: true,
            trim: true
        },
        sourceVerificationPolicyVersion: {
            type: String,
            required: true,
            default: SOURCE_PHOTO_POLICY_VERSION,
            trim: true
        },
        sourceVerification: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        fidelityCheck: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        attemptCount: {
            type: Number,
            min: 1,
            max: 2,
            default: 1
        },
        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
            default: null
        },
        usedAt: {
            type: Date,
            default: null
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 }
        }
    },
    { timestamps: true }
)

aiPreviewSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('AiPreview', aiPreviewSchema)
