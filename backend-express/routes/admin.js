const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')

const Appointment = require('../models/Appointment')
const Contact = require('../models/Contact')
const User = require('../models/User')
const Notification = require('../models/Notification')
const Pet = require('../models/Pet')
const { normalizeAccountStatus, persistAccountStatus, toAccountStatusResponse } = require('../services/accountStatus')
const {
    sendAppointmentCancelledEmail,
    sendAppointmentConfirmedEmail,
    sendAppointmentCompletedEmail
} = require('../services/mailer')

const { protect, adminOnly } = require('../middleware/auth')

const TERMINAL_STATUSES = ['completed', 'cancelled']
const REVENUE_STATUSES = ['confirmed', 'completed']
const MANILA_TIME_ZONE = 'Asia/Manila'

const padNumber = (value) => String(value).padStart(2, '0')

// ─────────────────────────────────────────────────────────────
// Manila date helpers
// ─────────────────────────────────────────────────────────────

const getManilaDateParts = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: MANILA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date)

    return parts.reduce((result, part) => {
        if (part.type !== 'literal') {
            result[part.type] = part.value
        }

        return result
    }, {})
}

const getManilaDateKey = (date = new Date()) => {
    const parts = getManilaDateParts(date)

    return `${parts.year}-${parts.month}-${parts.day}`
}

const getMonthKey = (monthOffset = 0) => {
    const { year, month } = getManilaDateParts()

    const date = new Date(
        Date.UTC(
            Number(year),
            Number(month) - 1 + monthOffset,
            1,
            12
        )
    )

    return [
        date.getUTCFullYear(),
        padNumber(date.getUTCMonth() + 1)
    ].join('-')
}

const getDaysInMonth = (monthKey) => {
    const [year, month] = monthKey
        .split('-')
        .map(Number)

    return new Date(
        Date.UTC(year, month, 0)
    ).getUTCDate()
}

const getEnglishMonthLabel = (monthKey) => {
    const [year, month] = monthKey
        .split('-')
        .map(Number)

    return new Date(
        Date.UTC(year, month - 1, 1, 12)
    ).toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC'
    })
}

const getMonthDateRange = (monthKey) => {
    const lastDay = getDaysInMonth(monthKey)

    return {
        start: `${monthKey}-01`,
        end: `${monthKey}-${padNumber(lastDay)}`
    }
}

const getRecentDayBuckets = (numberOfDays = 7) => {
    const { year, month, day } = getManilaDateParts()

    const currentDate = new Date(
        Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            12
        )
    )

    return Array.from(
        { length: numberOfDays },
        (_, index) => {
            const daysBack =
                numberOfDays - 1 - index

            const date = new Date(currentDate)

            date.setUTCDate(
                currentDate.getUTCDate() - daysBack
            )

            return {
                key: [
                    date.getUTCFullYear(),
                    padNumber(date.getUTCMonth() + 1),
                    padNumber(date.getUTCDate())
                ].join('-'),

                day: date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    timeZone: 'UTC'
                })
            }
        }
    )
}

const getRecentMonthBuckets = (numberOfMonths = 6) => {
    const { year, month } = getManilaDateParts()

    return Array.from(
        { length: numberOfMonths },
        (_, index) => {
            const monthsBack =
                numberOfMonths - 1 - index

            const date = new Date(
                Date.UTC(
                    Number(year),
                    Number(month) - 1 - monthsBack,
                    1,
                    12
                )
            )

            return {
                key: [
                    date.getUTCFullYear(),
                    padNumber(date.getUTCMonth() + 1)
                ].join('-'),

                year: date.getUTCFullYear(),
                monthIndex: date.getUTCMonth(),

                label: date.toLocaleDateString(
                    'en-US',
                    {
                        month: 'short',
                        timeZone: 'UTC'
                    }
                )
            }
        }
    )
}

// ─────────────────────────────────────────────────────────────
// Revenue aggregation
// ─────────────────────────────────────────────────────────────

const buildRevenueAggregation = (dateFormat) => [
    {
        $match: {
            status: {
                $in: REVENUE_STATUSES
            }
        }
    },
    {
        $addFields: {
            effectiveRevenueDate: {
                $ifNull: [
                    '$revenueRecordedAt',
                    {
                        $ifNull: [
                            '$updatedAt',
                            '$createdAt'
                        ]
                    }
                ]
            }
        }
    },
    {
        $group: {
            _id: {
                $dateToString: {
                    format: dateFormat,
                    date: '$effectiveRevenueDate',
                    timezone: MANILA_TIME_ZONE
                }
            },

            revenue: {
                $sum: {
                    $ifNull: ['$price', 0]
                }
            },

            bookings: {
                $sum: 1
            }
        }
    },
    {
        $sort: {
            _id: 1
        }
    }
]


// ─────────────────────────────────────────────────────────────
// Appointment notification helper
// ─────────────────────────────────────────────────────────────

const buildStatusNotification = (
    appointment,
    status
) => {
    const statusLabels = {
        pending: 'Pending Review',
        confirmed: 'Confirmed',
        completed: 'Completed',
        cancelled: 'Cancelled'
    }

    const title =
        `Service ${statusLabels[status] || status
        }`

    const messageMap = {
        pending:
            `Your booking for ${appointment.service} is now pending review.`,

        confirmed:
            `Great news! Your ${appointment.service} booking on ${appointment.date} at ${appointment.time} is confirmed.`,

        completed:
            `Your ${appointment.service} service on ${appointment.date} is marked as completed. Thank you for trusting Timmy Tails!`,

        cancelled:
            `Your ${appointment.service} booking on ${appointment.date} at ${appointment.time} has been cancelled.${
                appointment.cancellationReason ? ` Reason: ${appointment.cancellationReason}` : ''
            }`
    }

    return {
        title,

        message:
            messageMap[status] ||
            `Your booking status has been updated to ${status}.`
    }
}

// All routes below require an authenticated admin.
router.use(protect, adminOnly)

// ─────────────────────────────────────────────────────────────
// GET /api/admin/users
// ─────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
    try {
        const users = await User.find({
            role: { $ne: 'admin' }
        })
            .select(
                '_id firstName lastName email phone address homeAddress createdAt accountStatus statusReason warningMessage statusUpdatedAt'
            )
            .sort({
                firstName: 1,
                lastName: 1
            })
            .lean()

        const userIds = users.map(
            (user) => user._id
        )

        const [
            pets,
            appointmentSummaries
        ] = await Promise.all([
            Pet.find({
                owner: {
                    $in: userIds
                }
            })
                .select(
                    'owner name type breed photoUrl'
                )
                .lean(),

            Appointment.aggregate([
                {
                    $match: {
                        user: {
                            $in: userIds
                        }
                    }
                },
                {
                    $group: {
                        _id: '$user',
                        visits: {
                            $sum: 1
                        },
                        completedVisits: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: [
                                            '$status',
                                            'completed'
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },
                        totalSpend: {
                            $sum: {
                                $cond: [
                                    {
                                        $in: [
                                            '$status',
                                            REVENUE_STATUSES
                                        ]
                                    },
                                    {
                                        $ifNull: [
                                            '$price',
                                            0
                                        ]
                                    },
                                    0
                                ]
                            }
                        },
                        lastVisit: {
                            $max: {
                                $cond: [
                                    {
                                        $in: [
                                            '$status',
                                            [
                                                'confirmed',
                                                'completed'
                                            ]
                                        ]
                                    },
                                    '$startAt',
                                    null
                                ]
                            }
                        }
                    }
                }
            ])
        ])

        const petsByOwner =
            pets.reduce(
                (result, pet) => {
                    const key =
                        String(pet.owner)

                    if (!result[key]) {
                        result[key] = []
                    }

                    result[key].push(pet)

                    return result
                },
                {}
            )

        const summariesByUser =
            appointmentSummaries.reduce(
                (result, item) => {
                    result[
                        String(item._id)
                    ] = item

                    return result
                },
                {}
            )

        const customerRecords = users.map((user) => {
            const summary =
                summariesByUser[
                    String(user._id)
                ] || {
                    visits: 0,
                    completedVisits: 0,
                    totalSpend: 0,
                    lastVisit: null
                }

            return {
                ...user,
                accountStatus: normalizeAccountStatus(user.accountStatus),
                statusReason: user.statusReason || '',
                warningMessage: user.warningMessage || '',
                pets:
                    petsByOwner[
                        String(user._id)
                    ] || [],
                visits:
                    summary.visits,
                completedVisits:
                    summary.completedVisits,
                totalSpend:
                    summary.totalSpend,
                lastVisit:
                    summary.lastVisit
            }
        })

        res.json({
            success: true,
            users: customerRecords
        })
    } catch (error) {
        console.error(
            'Get customer records error:',
            error
        )

        res.status(500).json({
            success: false,
            message: 'Server error'
        })
    }
})

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/status
// ─────────────────────────────────────────────────────────────

router.patch('/users/:id/status', async (req, res) => {
    const { accountStatus, statusReason, warningMessage } = req.body

    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid customer ID'
        })
    }

    try {
        const user = await persistAccountStatus(User, req.params.id, {
            accountStatus,
            statusReason,
            warningMessage
        })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            })
        }

        // Create in-app Notification for the customer if warned, blocked, banned, or unblocked
        if (['warned', 'booking_blocked', 'banned', 'active'].includes(accountStatus)) {
            let notifTitle = 'Account Status Update'
            let notifMessage = statusReason || warningMessage || 'Your account status has been updated by salon administration.'

            if (accountStatus === 'warned') {
                notifTitle = '⚠️ Formal Warning Issued'
                notifMessage = warningMessage || statusReason || 'You have received a formal warning regarding multiple booking cancellations or no-show policy violations.'
            } else if (accountStatus === 'booking_blocked') {
                notifTitle = '⛔ Booking Access Suspended'
                notifMessage = statusReason || warningMessage || 'Your booking privileges have been suspended due to policy violations.'
            } else if (accountStatus === 'banned') {
                notifTitle = '🚫 Account Banned'
                notifMessage = statusReason || warningMessage || 'Your customer account has been permanently suspended due to terms violations.'
            } else if (accountStatus === 'active') {
                notifTitle = '✅ Account Privileges Restored'
                notifMessage = 'Your customer account status is active. You may now book appointments.'
            }

            try {
                await Notification.create({
                    title: notifTitle,
                    message: notifMessage,
                    audience: 'user',
                    targetUser: user._id,
                    type: 'appointment-status',
                    createdBy: req.user._id
                })
            } catch (notificationError) {
                // The persisted account status is authoritative. A notification failure must not
                // turn a successful database write into a misleading failed status update.
                console.error('Customer status notification error:', notificationError)
            }
        }

        res.json({
            success: true,
            message: `Customer status updated to ${accountStatus}`,
            user: toAccountStatusResponse(user)
        })
    } catch (error) {
        console.error('Update customer status error:', error)

        if (error.code === 'INVALID_ACCOUNT_STATUS') {
            return res.status(400).json({
                success: false,
                message: error.message
            })
        }

        res.status(500).json({
            success: false,
            message: error.code === 'ACCOUNT_STATUS_NOT_PERSISTED'
                ? 'Customer status could not be persisted'
                : 'Server error updating customer status'
        })
    }
})


// ─────────────────────────────────────────────────────────────
// GET /api/admin/stats
// ─────────────────────────────────────────────────────────────

router.get('/stats', async (req, res) => {
    try {
        const todayKey =
            getManilaDateKey()

        const currentMonthKey =
            todayKey.slice(0, 7)

        const [
            todayCount,
            totalCustomers,
            confirmedCount,
            pendingCount,
            dailyRevenueResults,
            monthlyRevenueResults,
            totalRevenueResults
        ] = await Promise.all([
            Appointment.countDocuments({
                date: todayKey,

                status: {
                    $in: [
                        'pending',
                        'confirmed'
                    ]
                }
            }),

            User.countDocuments({
                role: 'user'
            }),

            Appointment.countDocuments({
                status: 'confirmed'
            }),

            Appointment.countDocuments({
                status: 'pending'
            }),

            Appointment.aggregate(
                buildRevenueAggregation(
                    '%Y-%m-%d'
                )
            ),

            Appointment.aggregate(
                buildRevenueAggregation(
                    '%Y-%m'
                )
            ),

            Appointment.aggregate([
                {
                    $match: {
                        status: {
                            $in:
                                REVENUE_STATUSES
                        }
                    }
                },
                {
                    $group: {
                        _id: null,

                        total: {
                            $sum: {
                                $ifNull: [
                                    '$price',
                                    0
                                ]
                            }
                        }
                    }
                }
            ])
        ])

        const todayRevenue =
            dailyRevenueResults.find(
                (item) =>
                    item._id === todayKey
            )?.revenue || 0

        const monthlyRevenue =
            monthlyRevenueResults.find(
                (item) =>
                    item._id ===
                    currentMonthKey
            )?.revenue || 0

        const totalRevenue =
            totalRevenueResults[0]
                ?.total || 0

        res.json({
            success: true,

            stats: {
                todayAppointments:
                    todayCount,

                todayRevenue,

                todayRevenueFormatted:
                    `₱${todayRevenue.toLocaleString(
                        'en-PH'
                    )}`,

                monthlyRevenue:
                    `₱${monthlyRevenue.toLocaleString(
                        'en-PH'
                    )}`,

                monthlyRevenueValue:
                    monthlyRevenue,

                totalRevenue,
                totalCustomers,

                confirmedBookings:
                    confirmedCount,

                pendingAppointments:
                    pendingCount
            }
        })
    } catch (error) {
        console.error(
            'Admin stats error:',
            error
        )

        res.status(500).json({
            success: false,
            message: 'Server error'
        })
    }
})

// ─────────────────────────────────────────────────────────────
// GET /api/admin/appointments
// ─────────────────────────────────────────────────────────────

router.get(
    '/appointments',
    async (req, res) => {
        try {
            const {
                status,
                date,
                page = 1,
                limit = 20
            } = req.query

            const query = {}

            const validStatuses = [
                'pending',
                'confirmed',
                'completed',
                'cancelled'
            ]

            if (status) {
                if (
                    !validStatuses.includes(
                        status
                    )
                ) {
                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                'Invalid status filter'
                        })
                }

                query.status =
                    String(status)
            }

            if (date) {
                if (
                    !/^\d{4}-\d{2}-\d{2}$/.test(
                        date
                    )
                ) {
                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                'Invalid date format'
                        })
                }

                query.date =
                    String(date)
            }

            const pageNum =
                Math.max(
                    1,
                    parseInt(page, 10) || 1
                )

            const limitNum =
                Math.min(
                    100,
                    Math.max(
                        1,
                        parseInt(limit, 10) ||
                        20
                    )
                )

            const skip =
                (pageNum - 1) *
                limitNum

            const [
                appointments,
                total
            ] = await Promise.all([
                Appointment.find(query)
                    .sort({
                        date: -1,
                        createdAt: -1
                    })
                    .skip(skip)
                    .limit(limitNum)
                    .populate(
                        'user',
                        'firstName lastName email phone address homeAddress'
                    )
                    .populate(
                        'pet',
                        'name type breed photoUrl'
                    ),

                Appointment.countDocuments(
                    query
                )
            ])

            res.json({
                success: true,
                appointments,

                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,

                    pages:
                        Math.ceil(
                            total /
                            limitNum
                        )
                }
            })
        } catch (error) {
            console.error(
                'Get admin appointments error:',
                error
            )

            res.status(500).json({
                success: false,
                message: 'Server error'
            })
        }
    }
)

// ─────────────────────────────────────────────────────────────
// GET /api/admin/appointments/:id/preview
// Loads the saved AI preview only for the selected booking so the
// appointments list does not transfer large base64 images.
// ─────────────────────────────────────────────────────────────

router.get(
    '/appointments/:id/preview',
    async (req, res) => {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid appointment ID'
            })
        }

        try {
            const appointment = await Appointment.findById(
                req.params.id
            ).select(
                '+aiPreviewImage +aiPreviewSourceHash petName petType breed haircutStyle aiPreviewUsed aiPreviewStyleId aiPreviewModel aiPreviewSeasonKey aiPreviewSeasonLabel'
            )

            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found'
                })
            }

            if (!appointment.aiPreviewUsed || !appointment.aiPreviewImage) {
                return res.status(404).json({
                    success: false,
                    message: 'No saved AI preview is available for this booking'
                })
            }

            return res.json({
                success: true,
                preview: {
                    image: appointment.aiPreviewImage,
                    styleId: appointment.aiPreviewStyleId || null,
                    styleName: appointment.haircutStyle || null,
                    model: appointment.aiPreviewModel || null,
                    seasonKey: appointment.aiPreviewSeasonKey || null,
                    seasonLabel: appointment.aiPreviewSeasonLabel || null,
                    petName: appointment.petName,
                    petType: appointment.petType,
                    breed: appointment.breed
                }
            })
        } catch (error) {
            console.error('Get appointment AI preview error:', error)

            return res.status(500).json({
                success: false,
                message: 'Unable to load the saved AI preview'
            })
        }
    }
)

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/appointments/:id/status
// ─────────────────────────────────────────────────────────────

router.patch(
    '/appointments/:id/status',
    async (req, res) => {
        const status = String(req.body.status || '').trim()

        const validStatuses = [
            'pending',
            'confirmed',
            'completed',
            'cancelled'
        ]

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            })
        }

        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid appointment ID'
            })
        }

        try {
            const existingAppointment =
                await Appointment.findById(req.params.id)

            if (!existingAppointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found'
                })
            }

            if (existingAppointment.status === status) {
                return res.json({
                    success: true,
                    appointment: existingAppointment
                })
            }

            if (
                TERMINAL_STATUSES.includes(
                    existingAppointment.status
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Cannot change status because this booking is already ${existingAppointment.status}`
                })
            }

            const previousStatus = existingAppointment.status
            const previouslyCountedAsRevenue =
                REVENUE_STATUSES.includes(previousStatus)
            const shouldCountAsRevenue =
                REVENUE_STATUSES.includes(status)

            let revenueRecordedAt =
                existingAppointment.revenueRecordedAt || null

            if (
                shouldCountAsRevenue &&
                !previouslyCountedAsRevenue
            ) {
                revenueRecordedAt = new Date()
            } else if (!shouldCountAsRevenue) {
                revenueRecordedAt = null
            }

            const cancellationReason =
                status === 'cancelled'
                    ? String(req.body.cancellationReason || req.body.reason || '').trim()
                    : existingAppointment.cancellationReason || ''

            const appointment =
                await Appointment.findByIdAndUpdate(
                    req.params.id,
                    {
                        $set: {
                            status,
                            revenueRecordedAt,
                            cancellationReason
                        }
                    },
                    {
                        new: true,
                        runValidators: false
                    }
                )

            if (
                appointment.user &&
                mongoose.isValidObjectId(appointment.user)
            ) {
                try {
                    const statusNotification =
                        buildStatusNotification(
                            appointment,
                            status
                        )

                    await Notification.create({
                        ...statusNotification,
                        audience: 'user',
                        targetUser: appointment.user,
                        type: 'appointment-status',
                        appointment: appointment._id,
                        createdBy: req.user._id
                    })

                    // Send transactional email notifications based on status update
                    User.findById(appointment.user).select('email firstName').then((targetUser) => {
                        const customerEmail = targetUser?.email || appointment.contactEmail
                        if (!customerEmail) return

                        if (status === 'cancelled') {
                            sendAppointmentCancelledEmail({
                                to: customerEmail,
                                name: targetUser?.firstName,
                                appointment,
                                reason: cancellationReason || 'Cancelled by administration'
                            }).catch((emailErr) => console.error('Admin cancel email error:', emailErr.message))
                        } else if (status === 'confirmed') {
                            sendAppointmentConfirmedEmail({
                                to: customerEmail,
                                name: targetUser?.firstName,
                                appointment
                            }).catch((emailErr) => console.error('Admin approve email error:', emailErr.message))
                        } else if (status === 'completed') {
                            sendAppointmentCompletedEmail({
                                to: customerEmail,
                                name: targetUser?.firstName,
                                appointment
                            }).catch((emailErr) => console.error('Admin completed email error:', emailErr.message))
                        }
                    }).catch(() => {})
                } catch (notificationError) {
                    console.error(
                        'Status notification error:',
                        notificationError
                    )
                }
            }

            return res.json({
                success: true,
                appointment
            })
        } catch (error) {
            console.error(
                'Update appointment status error:',
                error
            )

            return res.status(500).json({
                success: false,
                message:
                    error.message ||
                    'Unable to update appointment status'
            })
        }
    }
)

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/appointments/:id
// ─────────────────────────────────────────────────────────────

router.delete(
    '/appointments/:id',
    async (req, res) => {
        if (
            !mongoose.isValidObjectId(
                req.params.id
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Invalid appointment ID'
                })
        }

        try {
            const appointment =
                await Appointment
                    .findByIdAndDelete(
                        req.params.id
                    )

            if (!appointment) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            'Appointment not found'
                    })
            }

            res.json({
                success: true,

                message:
                    'Appointment deleted successfully'
            })
        } catch (error) {
            console.error(
                'Delete appointment error:',
                error
            )

            res.status(500).json({
                success: false,
                message: 'Server error'
            })
        }
    }
)

// ─────────────────────────────────────────────────────────────
// GET /api/admin/analytics
// ─────────────────────────────────────────────────────────────

router.get(
    '/analytics',
    async (req, res) => {
        try {
            const monthBuckets =
                getRecentMonthBuckets(6)

            const dayBuckets =
                getRecentDayBuckets(7)

            const [
                monthlyRevenueResults,
                dailyRevenueResults,
                serviceAgg,
                breedAgg
            ] = await Promise.all([
                Appointment.aggregate(
                    buildRevenueAggregation(
                        '%Y-%m'
                    )
                ),

                Appointment.aggregate(
                    buildRevenueAggregation(
                        '%Y-%m-%d'
                    )
                ),

                Appointment.aggregate([
                    {
                        $match: {
                            status: {
                                $nin: [
                                    'cancelled'
                                ]
                            }
                        }
                    },
                    {
                        $group: {
                            _id: '$service',
                            count: {
                                $sum: 1
                            }
                        }
                    },
                    {
                        $sort: {
                            count: -1
                        }
                    }
                ]),

                Appointment.aggregate([
                    {
                        $match: {
                            status: {
                                $nin: [
                                    'cancelled'
                                ]
                            },

                            haircutStyle: {
                                $ne: null
                            }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                breed: '$breed',
                                haircut:
                                    '$haircutStyle'
                            },

                            count: {
                                $sum: 1
                            }
                        }
                    },
                    {
                        $sort: {
                            count: -1
                        }
                    },
                    {
                        $limit: 10
                    }
                ])
            ])

            const monthlyRevenueMap =
                monthlyRevenueResults.reduce(
                    (result, item) => {
                        result[item._id] = {
                            revenue:
                                item.revenue,

                            bookings:
                                item.bookings
                        }

                        return result
                    },
                    {}
                )

            const dailyRevenueMap =
                dailyRevenueResults.reduce(
                    (result, item) => {
                        result[item._id] = {
                            revenue:
                                item.revenue,

                            bookings:
                                item.bookings
                        }

                        return result
                    },
                    {}
                )

            const monthlyData =
                monthBuckets.map(
                    (month) => {
                        const metrics =
                            monthlyRevenueMap[
                            month.key
                            ] || {
                                revenue: 0,
                                bookings: 0
                            }

                        return {
                            month:
                                month.label,

                            monthKey:
                                month.key,

                            monthIndex:
                                month.monthIndex,

                            year:
                                month.year,

                            revenue:
                                metrics.revenue,

                            appointments:
                                metrics.bookings
                        }
                    }
                )

            const dailyRevenue =
                dayBuckets.map(
                    (day) => {
                        const metrics =
                            dailyRevenueMap[
                            day.key
                            ] || {
                                revenue: 0,
                                bookings: 0
                            }

                        return {
                            date: day.key,
                            day: day.day,

                            revenue:
                                metrics.revenue,

                            bookings:
                                metrics.bookings
                        }
                    }
                )

            const totalApps =
                serviceAgg.reduce(
                    (sum, item) =>
                        sum + item.count,
                    0
                ) || 1

            const serviceDistribution =
                serviceAgg.map(
                    (service) => ({
                        name:
                            service._id,

                        percentage:
                            Math.round(
                                (
                                    service.count /
                                    totalApps
                                ) * 100
                            )
                    })
                )

            const trendingData =
                breedAgg.map(
                    (breed) => ({
                        breed:
                            breed._id.breed,

                        haircut:
                            breed._id.haircut,

                        bookings:
                            breed.count,

                        trend:
                            Math.min(
                                99,
                                70 +
                                breed.count
                            )
                    })
                )


            const currentMonthIndex =
                Number(
                    getManilaDateParts()
                        .month
                ) - 1

            const isPhilippinesRainySeason =
                currentMonthIndex >= 5 &&
                currentMonthIndex <= 10

            const weatherInsights = {
                region: 'Philippines',

                seasonType:
                    isPhilippinesRainySeason
                        ? 'Rainy'
                        : 'Dry',

                guidance:
                    isPhilippinesRainySeason
                        ? 'Prioritize easy-maintenance trims and anti-matting services for humid and rainy days.'
                        : 'Promote lightweight cooling styles and de-shedding services for warm, dry conditions.'
            }

            res.json({
                success: true,

                analytics: {
                    monthlyData,
                    dailyRevenue,
                    weatherInsights,
                    serviceDistribution,
                    trendingData
                }
            })
        } catch (error) {
            console.error(
                'Admin analytics error:',
                error
            )

            res.status(500).json({
                success: false,
                message: 'Server error'
            })
        }
    }
)

// ─────────────────────────────────────────────────────────────
// GET /api/admin/contacts
// ─────────────────────────────────────────────────────────────

router.get(
    '/contacts',
    async (req, res) => {
        try {
            const contacts =
                await Contact.find()
                    .sort({
                        createdAt: -1
                    })
                    .limit(50)

            res.json({
                success: true,
                contacts
            })
        } catch (error) {
            console.error(
                'Get contacts error:',
                error
            )

            res.status(500).json({
                success: false,
                message: 'Server error'
            })
        }
    }
)

// ─────────────────────────────────────────────────────────────
// PATCH /api/admin/contacts/:id/read
// ─────────────────────────────────────────────────────────────

router.patch(
    '/contacts/:id/read',
    async (req, res) => {
        if (
            !mongoose.isValidObjectId(
                req.params.id
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Invalid contact message ID'
                })
        }

        try {
            const contact =
                await Contact.findByIdAndUpdate(
                    req.params.id,
                    {
                        read: true
                    },
                    {
                        new: true,
                        runValidators: true
                    }
                )

            if (!contact) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            'Contact message not found'
                    })
            }

            return res.json({
                success: true,
                message:
                    'Contact message marked as read',
                contact
            })
        } catch (error) {
            console.error(
                'Mark contact message as read error:',
                error
            )

            return res
                .status(500)
                .json({
                    success: false,
                    message: 'Server error'
                })
        }
    }
)

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/contacts/:id
// ─────────────────────────────────────────────────────────────

router.delete(
    '/contacts/:id',
    async (req, res) => {
        if (
            !mongoose.isValidObjectId(
                req.params.id
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Invalid contact message ID'
                })
        }

        try {
            const contact =
                await Contact.findByIdAndDelete(
                    req.params.id
                )

            if (!contact) {
                return res
                    .status(404)
                    .json({
                        success: false,
                        message:
                            'Contact message not found'
                    })
            }

            return res.json({
                success: true,
                message:
                    'Contact message deleted successfully'
            })
        } catch (error) {
            console.error(
                'Delete contact message error:',
                error
            )

            return res
                .status(500)
                .json({
                    success: false,
                    message: 'Server error'
                })
        }
    }
)

// ─────────────────────────────────────────────────────────────
// GET /api/admin/notifications
// ─────────────────────────────────────────────────────────────

router.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find()
            .sort({
                createdAt: -1
            })
            .limit(100)
            .populate(
                'createdBy',
                'firstName lastName email'
            )
            .populate(
                'targetUser',
                'firstName lastName email'
            )

        res.json({
            success: true,
            notifications
        })
    } catch (error) {
        console.error(
            'Get admin notifications error:',
            error
        )

        res.status(500).json({
            success: false,
            message: 'Server error'
        })
    }
})

// ─────────────────────────────────────────────────────────────
// POST /api/admin/notifications
// ─────────────────────────────────────────────────────────────

router.post('/notifications', async (req, res) => {
    const {
        title,
        message,
        audience = 'user',
        targetUser
    } = req.body

    const cleanTitle =
        typeof title === 'string'
            ? title.trim()
            : ''

    const cleanMessage =
        typeof message === 'string'
            ? message.trim()
            : ''

    if (!cleanTitle) {
        return res.status(400).json({
            success: false,
            message: 'Title is required'
        })
    }

    if (!cleanMessage) {
        return res.status(400).json({
            success: false,
            message: 'Message is required'
        })
    }

    if (
        !['user', 'all-users'].includes(audience)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Invalid notification audience'
        })
    }

    try {
        let recipient = null

        if (audience === 'user') {
            if (
                !targetUser ||
                !mongoose.isValidObjectId(targetUser)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Please select a valid user'
                })
            }

            recipient = await User.findById(targetUser)

            if (!recipient) {
                return res.status(404).json({
                    success: false,
                    message: 'Selected user was not found'
                })
            }

            // Notifications communicate with the customer; enforcement changes go through /users/:id/status only.
        }

        const notification =
            await Notification.create({
                title: cleanTitle,
                message: cleanMessage,
                audience,

                targetUser:
                    audience === 'user'
                        ? recipient._id
                        : null,

                type: 'broadcast',
                createdBy: req.user._id
            })

        await notification.populate(
            'createdBy',
            'firstName lastName email'
        )

        await notification.populate(
            'targetUser',
            'firstName lastName email'
        )

        res.status(201).json({
            success: true,

            message:
                audience === 'user'
                    ? `Notification sent only to ${recipient.firstName} ${recipient.lastName}`
                    : 'Notification sent to all users',

            notification
        })
    } catch (error) {
        console.error(
            'Create notification error:',
            error
        )

        res.status(500).json({
            success: false,
            message: 'Server error'
        })
    }
})

module.exports = router
