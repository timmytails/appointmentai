const mongoose = require('mongoose')

const appointmentSchema = new mongoose.Schema(
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
            required: false
        },
        petName: {
            type: String,
            required: [true, 'Pet name is required'],
            trim: true,
            maxlength: 50
        },
        petType: {
            type: String,
            enum: ['dog', 'cat'],
            default: 'dog'
        },
        breed: {
            type: String,
            required: [true, 'Breed is required'],
            trim: true
        },
        petAgeMonths: {
            type: Number,
            default: null
        },
        vaccinated: {
            type: Boolean,
            default: true
        },
        serviceId: {
            type: String,
            required: true,
            index: true
        },
        service: {
            type: String,
            required: [true, 'Service is required']
        },
        haircutStyle: {
            type: String,
            default: null,
            trim: true
        },
        aiPreviewUsed: {
            type: Boolean,
            default: false
        },
        aiPreview: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AiPreview',
            default: null
        },
        aiPreviewStyleId: {
            type: String,
            default: null,
            trim: true
        },
        aiPreviewModel: {
            type: String,
            default: null,
            trim: true
        },
        aiPreviewSourceHash: {
            type: String,
            default: null,
            trim: true,
            select: false
        },
        aiPreviewSeasonKey: {
            type: String,
            default: null,
            trim: true
        },
        aiPreviewSeasonLabel: {
            type: String,
            default: null,
            trim: true
        },
        aiPreviewVersion: {
            type: String,
            default: null,
            trim: true
        },
        aiPreviewFidelityCheck: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
            select: false
        },
        aiPreviewImage: {
            type: String,
            default: null,
            select: false
        },
        date: {
            type: String,
            required: [true, 'Appointment date is required'],
            index: true
        },
        time: {
            type: String,
            required: [true, 'Appointment time is required']
        },
        endTime: {
            type: String,
            required: true
        },
        startAt: {
            type: Date,
            required: true,
            index: true
        },
        endAt: {
            type: Date,
            required: true,
            index: true
        },
        durationMinutes: {
            type: Number,
            required: true,
            min: 15
        },
        ownerName: {
            type: String,
            required: [true, 'Owner name is required'],
            trim: true
        },
        ownerEmail: {
            type: String,
            required: false,
            lowercase: true,
            trim: true
        },
        ownerPhone: {
            type: String,
            required: [true, 'Owner phone is required'],
            trim: true
        },
        ownerAddress: {
            type: String,
            trim: true,
            default: ''
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'completed', 'cancelled'],
            default: 'pending'
        },
        cancellationReason: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ''
        },
        notes: {
            type: String,
            maxlength: 500,
            default: ''
        },
        price: {
            type: Number,
            default: 0,
            min: 0
        },
        revenueRecordedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
)

appointmentSchema.index({ startAt: 1, endAt: 1, status: 1 })
appointmentSchema.index({ ownerEmail: 1 })
appointmentSchema.index({ status: 1 })
appointmentSchema.index({ revenueRecordedAt: 1 })

module.exports = mongoose.model('Appointment', appointmentSchema)
