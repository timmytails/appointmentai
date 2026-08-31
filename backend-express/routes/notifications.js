const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const Notification = require('../models/Notification')
const { protect } = require('../middleware/auth')

const USER_NOTIFICATION_LIMIT = 50

const userCanAccessNotification = (userId) => ({
    $or: [
        { audience: 'all-users' },
        { audience: 'user', targetUser: userId }
    ]
})

// @route   GET /api/notifications
// @desc    Get only notifications visible to the logged-in user
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find(
            userCanAccessNotification(req.user._id)
        )
            .sort({ createdAt: -1 })
            .limit(USER_NOTIFICATION_LIMIT)

        const userId = req.user._id.toString()

        const items = notifications.map((notification) => ({
            _id: notification._id,
            title: notification.title,
            message: notification.message,
            audience: notification.audience,
            type: notification.type || 'broadcast',
            appointment: notification.appointment || null,
            createdAt: notification.createdAt,
            updatedAt: notification.updatedAt,
            isRead: notification.readBy.some(
                (id) => id.toString() === userId
            )
        }))

        res.json({ success: true, notifications: items })
    } catch (error) {
        console.error('Get user notifications error:', error)
        res.status(500).json({ success: false, message: 'Server error' })
    }
})

// @route   PATCH /api/notifications/:id/read
// @desc    Mark an accessible notification as read
// @access  Private
router.patch('/:id/read', protect, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid notification ID'
        })
    }

    try {
        const notification = await Notification.findOneAndUpdate(
            {
                _id: req.params.id,
                ...userCanAccessNotification(req.user._id)
            },
            { $addToSet: { readBy: req.user._id } },
            { new: true }
        )

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            })
        }

        res.json({
            success: true,
            message: 'Notification marked as read'
        })
    } catch (error) {
        console.error('Mark notification as read error:', error)
        res.status(500).json({ success: false, message: 'Server error' })
    }
})

module.exports = router
