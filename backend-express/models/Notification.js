const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            maxlength: [120, 'Title cannot exceed 120 characters']
        },
        message: {
            type: String,
            required: [true, 'Message is required'],
            trim: true,
            maxlength: [1000, 'Message cannot exceed 1000 characters']
        },
        audience: {
            type: String,
            enum: ['all-users', 'user'],
            default: 'all-users'
        },
        targetUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false
        },
        type: {
            type: String,
            enum: ['broadcast', 'appointment-status'],
            default: 'broadcast'
        },
        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
            required: false
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false
        },
        readBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    },
    { timestamps: true }
)

notificationSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
