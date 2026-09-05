const express = require('express')
const mongoose = require('mongoose')
const { body, validationResult } = require('express-validator')

const Appointment = require('../models/Appointment')
const AiPreview = require('../models/AiPreview')
const Notification = require('../models/Notification')
const Pet = require('../models/Pet')
const User = require('../models/User')
const {
    sendAppointmentCancelledEmail,
    sendAppointmentConfirmedEmail,
    sendAppointmentRescheduledEmail
} = require('../services/mailer')
const { protect } = require('../middleware/auth')
const {
    SERVICES,
    findService,
    findStyle,
    isStyleCompatibleWithPet
} = require('../config/services')
const {
    SOURCE_PHOTO_POLICY_VERSION
} = require('../config/photoVerificationPolicy')
const {
    sendAppointmentReminderTodayEmail,
    sendAppointmentConfirmedEmail
} = require('../services/mailer')

const router = express.Router()

// Fixed two-hour booking periods.
// The shop operates from 8:00 AM to 5:00 PM.
// The final booking ends at 4:00 PM, leaving 4:00 PM–5:00 PM
// for cleanup, preparation, and closing.
const FIXED_BOOKING_SLOTS = [
    {
        startTime: '08:00',
        endTime: '10:00'
    },
    {
        startTime: '10:00',
        endTime: '12:00'
    },
    {
        startTime: '12:00',
        endTime: '14:00'
    },
    {
        startTime: '14:00',
        endTime: '16:00'
    }
]

const OPEN_TIME = '08:00'
const CLOSE_TIME = '17:00'
const SLOT_DURATION_MINUTES = 120

const MAX_BOOKING_DAYS = Math.max(
    1,
    Number(process.env.MAX_BOOKING_DAYS) || 90
)

const BOOKING_LEAD_MINUTES = Math.max(
    0,
    Number(process.env.BOOKING_LEAD_MINUTES) || 30
)

const CLOSED_DAYS = new Set(
    String(
        process.env.BOOKING_CLOSED_DAYS || '0'
    )
        .split(',')
        .map((value) => Number(value.trim()))
        .filter(
            (value) =>
                Number.isInteger(value) &&
                value >= 0 &&
                value <= 6
        )
)

const ACTIVE_BOOKING_STATUSES = [
    'pending',
    'confirmed'
]

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const parseStoredAiPreview = (value) => {
    const match = String(value || '').match(
        /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/
    )

    if (!match) return null

    const buffer = Buffer.from(match[2], 'base64')

    // Keep appointment documents comfortably below MongoDB's 16 MB limit.
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
        return null
    }

    return {
        dataUrl: `data:${match[1]};base64,${match[2]}`,
        mimeType: match[1]
    }
}

const pad = (value) =>
    String(value).padStart(2, '0')

const toMinutes = (value) => {
    if (value === '24:00') {
        return 1440
    }

    const [hours, minutes] =
        String(value)
            .split(':')
            .map(Number)

    return hours * 60 + minutes
}

const minutesToTime = (totalMinutes) => {
    const normalized =
        ((totalMinutes % 1440) + 1440) %
        1440

    const hours =
        Math.floor(normalized / 60)

    const minutes =
        normalized % 60

    return `${pad(hours)}:${pad(minutes)}`
}

// Converts a Manila local date and time into a JavaScript UTC Date.
const manilaDateTime = (
    dateString,
    totalMinutes
) => {
    const [year, month, day] =
        dateString
            .split('-')
            .map(Number)

    const dayOffset =
        Math.floor(totalMinutes / 1440)

    const minutesInDay =
        totalMinutes % 1440

    const hours =
        Math.floor(minutesInDay / 60)

    const minutes =
        minutesInDay % 60

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day + dayOffset,
            hours - 8,
            minutes,
            0,
            0
        )
    )
}

const getManilaDateString = (
    date = new Date()
) => {
    const parts =
        new Intl.DateTimeFormat(
            'en-US',
            {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }
        )
            .formatToParts(date)
            .reduce(
                (result, part) => {
                    if (
                        part.type !==
                        'literal'
                    ) {
                        result[part.type] =
                            part.value
                    }

                    return result
                },
                {}
            )

    return (
        `${parts.year}-` +
        `${parts.month}-` +
        `${parts.day}`
    )
}

const addDaysToDateString = (
    dateString,
    days
) => {
    const [year, month, day] =
        dateString
            .split('-')
            .map(Number)

    const date = new Date(
        Date.UTC(
            year,
            month - 1,
            day + days
        )
    )

    return (
        `${date.getUTCFullYear()}-` +
        `${pad(
            date.getUTCMonth() + 1
        )}-` +
        `${pad(date.getUTCDate())}`
    )
}

const getWeekdayInManila = (
    dateString
) => {
    const [year, month, day] =
        dateString
            .split('-')
            .map(Number)

    return new Date(
        Date.UTC(
            year,
            month - 1,
            day
        )
    ).getUTCDay()
}

const validateBookingDate = (
    dateString
) => {
    if (!datePattern.test(dateString)) {
        return 'Invalid date format'
    }

    const today =
        getManilaDateString()

    const latest =
        addDaysToDateString(
            today,
            MAX_BOOKING_DAYS
        )

    if (dateString < today) {
        return 'Past dates cannot be booked'
    }

    if (dateString > latest) {
        return (
            'Appointments can only be ' +
            `booked up to ${MAX_BOOKING_DAYS} ` +
            'days in advance'
        )
    }

    if (
        CLOSED_DAYS.has(
            getWeekdayInManila(
                dateString
            )
        )
    ) {
        return (
            'The grooming shop is ' +
            'closed on this date'
        )
    }

    return ''
}

const getAppointmentInterval = (
    appointment,
    fallbackDate
) => {
    if (
        appointment.startAt &&
        appointment.endAt
    ) {
        return {
            startAt: new Date(
                appointment.startAt
            ),
            endAt: new Date(
                appointment.endAt
            )
        }
    }

    // Compatibility for old appointment records.
    const date =
        appointment.date ||
        fallbackDate

    const startMinutes =
        toMinutes(
            appointment.time ||
            '08:00'
        )

    const legacyService =
        findService(
            appointment.serviceId ||
            appointment.service
        )

    const durationMinutes =
        Number(
            appointment.durationMinutes
        ) ||
        legacyService?.durationMinutes ||
        60

    return {
        startAt: manilaDateTime(
            date,
            startMinutes
        ),
        endAt: manilaDateTime(
            date,
            startMinutes +
            durationMinutes
        )
    }
}

const loadActiveAppointmentsForDate = (
    date
) =>
    Appointment.find({
        date,
        status: {
            $in: ACTIVE_BOOKING_STATUSES
        }
    }).select(
        [
            'date',
            'time',
            'startAt',
            'endAt',
            'durationMinutes',
            'serviceId',
            'service'
        ].join(' ')
    )

const isFixedStartTime = (
    time
) =>
    FIXED_BOOKING_SLOTS.some(
        (slot) =>
            slot.startTime === time
    )

const findFixedSlot = (time) =>
    FIXED_BOOKING_SLOTS.find(
        (slot) => slot.startTime === time
    ) || null

const autoCancelOverdueAppointments = async () => {
    try {
        const GRACE_PERIOD_MS = 10 * 60 * 1000 // 10 minutes grace period
        const nowMs = Date.now()

        const activeAppointments = await Appointment.find({
            status: { $in: ['pending', 'confirmed'] }
        })

        const autoCancelReason = 'Automatically cancelled due to 10+ minutes late arrival (no-show).'

        for (const appointment of activeAppointments) {
            let startAtMs = null
            if (appointment.startAt) {
                startAtMs = new Date(appointment.startAt).getTime()
            } else if (appointment.date && appointment.time) {
                startAtMs = manilaDateTime(appointment.date, toMinutes(appointment.time)).getTime()
            }

            if (startAtMs && nowMs >= startAtMs + GRACE_PERIOD_MS) {
                appointment.status = 'cancelled'
                appointment.cancellationReason = autoCancelReason
                await appointment.save()

                await Notification.create({
                    title: 'Appointment Auto-Cancelled',
                    message: `Your appointment for ${appointment.petName} on ${appointment.date} at ${appointment.time} was automatically cancelled due to 10+ minutes late arrival.`,
                    audience: 'user',
                    targetUser: appointment.user,
                    type: 'appointment-status',
                    appointment: appointment._id
                }).catch(() => {})

                // Send cancellation email for auto-cancelled appointment
                User.findById(appointment.user).select('email firstName').then((u) => {
                    const email = u?.email || appointment.contactEmail
                    if (email) {
                        sendAppointmentCancelledEmail({
                            to: email,
                            name: u?.firstName,
                            appointment,
                            reason: autoCancelReason
                        }).catch((err) => console.error('Auto-cancel email dispatch error:', err.message))
                    }
                }).catch(() => {})
            }
        }
    } catch (error) {
        console.error('Auto-cancel overdue appointments error:', error)
    }
}

// Run auto-cancel interval every 60 seconds
setInterval(autoCancelOverdueAppointments, 60 * 1000)

const sendTodayAppointmentReminders = async () => {
    try {
        const today = getManilaDateString()
        const pendingReminders = await Appointment.find({
            date: today,
            status: { $in: ['pending', 'confirmed'] },
            reminderSentToday: { $ne: true }
        }).populate('user', 'email firstName lastName')

        for (const appointment of pendingReminders) {
            const recipientEmail = appointment.ownerEmail || appointment.user?.email
            const recipientName = appointment.ownerName || (appointment.user ? `${appointment.user.firstName} ${appointment.user.lastName}`.trim() : 'Valued Customer')

            if (recipientEmail) {
                await sendAppointmentReminderTodayEmail({
                    to: recipientEmail,
                    name: recipientName,
                    appointment
                }).catch((err) => console.error(`[REMINDER ERROR] Failed to send today reminder to ${recipientEmail}:`, err))
            }

            await Notification.create({
                title: 'Appointment Today Reminder',
                message: `Your appointment for ${appointment.petName} is scheduled for TODAY at ${appointment.time}. Please arrive 5-10 minutes before ${appointment.time} or your slot will be automatically cancelled and will open to others.`,
                audience: 'user',
                targetUser: appointment.user?._id || appointment.user,
                type: 'appointment-status',
                appointment: appointment._id
            }).catch(() => {})

            appointment.reminderSentToday = true
            appointment.reminderSentAt = new Date()
            await appointment.save()
        }
    } catch (error) {
        console.error('Send today appointment reminders error:', error)
    }
}

// Run reminder checker every 5 minutes (and once on startup)
setInterval(sendTodayAppointmentReminders, 5 * 60 * 1000)
setTimeout(sendTodayAppointmentReminders, 5000)


const createSlotRows = (
    date,
    appointments = []
) => {
    const nowWithLead =
        new Date(
            Date.now() +
            BOOKING_LEAD_MINUTES *
            60 *
            1000
        )

    const appointmentIntervals =
        appointments.map(
            (appointment) =>
                getAppointmentInterval(
                    appointment,
                    date
                )
        )

    return FIXED_BOOKING_SLOTS.map(
        (slot) => {
            const startMinutes =
                toMinutes(
                    slot.startTime
                )

            const endMinutes =
                toMinutes(
                    slot.endTime
                )

            const startAt =
                manilaDateTime(
                    date,
                    startMinutes
                )

            const endAt =
                manilaDateTime(
                    date,
                    endMinutes
                )

            const hasConflict =
                appointmentIntervals.some(
                    (appointment) =>
                        appointment.startAt <
                        endAt &&
                        appointment.endAt >
                        startAt
                )

            const isPast =
                startAt <= nowWithLead

            return {
                startTime:
                    slot.startTime,
                endTime:
                    slot.endTime,
                startAt:
                    startAt.toISOString(),
                endAt:
                    endAt.toISOString(),
                status: isPast
                    ? 'past'
                    : hasConflict
                        ? 'booked'
                        : 'available'
            }
        }
    )
}

router.get(
    '/services',
    (_req, res) => {
        res.json({
            success: true,
            services: SERVICES
        })
    }
)

router.get(
    '/availability',
    async (req, res) => {
        const date =
            String(
                req.query.date ||
                ''
            )

        const service =
            findService(
                String(
                    req.query
                        .serviceId ||
                    ''
                )
            ) || SERVICES[0]

        const dateError =
            validateBookingDate(date)

        if (dateError) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: dateError,
                    slots: []
                })
        }

        try {
            const appointments =
                await loadActiveAppointmentsForDate(
                    date
                )

            const slots =
                createSlotRows(
                    date,
                    appointments
                )

            return res.json({
                success: true,
                date,
                service,
                operatingHours: {
                    open: OPEN_TIME,
                    close: CLOSE_TIME
                },
                slotDurationMinutes:
                    SLOT_DURATION_MINUTES,
                slots
            })
        } catch (error) {
            console.error(
                'Get availability error:',
                error
            )

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        'Unable to load availability'
                })
        }
    }
)

router.get(
    '/availability/month',
    async (req, res) => {
        const month =
            String(
                req.query.month ||
                ''
            )

        const service =
            findService(
                String(
                    req.query
                        .serviceId ||
                    ''
                )
            )

        if (
            !/^\d{4}-\d{2}$/.test(
                month
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Month must use YYYY-MM format'
                })
        }

        if (!service) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Select a valid service'
                })
        }

        try {
            const [
                year,
                monthNumber
            ] = month
                .split('-')
                .map(Number)

            const daysInMonth =
                new Date(
                    Date.UTC(
                        year,
                        monthNumber,
                        0
                    )
                ).getUTCDate()

            const firstDate =
                `${month}-01`

            const lastDate =
                `${month}-` +
                `${pad(daysInMonth)}`

            const appointments =
                await Appointment.find({
                    date: {
                        $gte: firstDate,
                        $lte: lastDate
                    },
                    status: {
                        $in:
                            ACTIVE_BOOKING_STATUSES
                    }
                }).select(
                    [
                        'date',
                        'time',
                        'startAt',
                        'endAt',
                        'durationMinutes',
                        'serviceId',
                        'service'
                    ].join(' ')
                )

            const byDate =
                appointments.reduce(
                    (
                        map,
                        appointment
                    ) => {
                        const key =
                            appointment.date

                        if (!map[key]) {
                            map[key] = []
                        }

                        map[key].push(
                            appointment
                        )

                        return map
                    },
                    {}
                )

            const today =
                getManilaDateString()

            const latest =
                addDaysToDateString(
                    today,
                    MAX_BOOKING_DAYS
                )

            const dates = []

            for (
                let day = 1;
                day <= daysInMonth;
                day += 1
            ) {
                const date =
                    `${month}-` +
                    `${pad(day)}`

                let status =
                    'available'

                if (date < today) {
                    status = 'past'
                } else if (
                    date > latest
                ) {
                    status =
                        'outside-range'
                } else if (
                    CLOSED_DAYS.has(
                        getWeekdayInManila(
                            date
                        )
                    )
                ) {
                    status = 'closed'
                } else {
                    const slots =
                        createSlotRows(
                            date,
                            byDate[date] ||
                            []
                        )

                    const hasAvailableSlot =
                        slots.some(
                            (slot) =>
                                slot.status ===
                                'available'
                        )

                    if (
                        !hasAvailableSlot
                    ) {
                        status =
                            'fully-booked'
                    }
                }

                dates.push({
                    date,
                    status
                })
            }

            return res.json({
                success: true,
                month,
                dates
            })
        } catch (error) {
            console.error(
                'Month availability error:',
                error
            )

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        'Unable to load calendar availability'
                })
        }
    }
)

router.post(
    '/',
    protect,
    [
        body('petName')
            .trim()
            .notEmpty()
            .withMessage(
                'Pet name is required'
            ),

        body('petType')
            .optional()
            .isIn(['dog', 'cat'])
            .withMessage(
                'Pet type must be dog or cat'
            ),

        body('breed')
            .trim()
            .notEmpty()
            .withMessage(
                'Breed is required'
            ),

        body('serviceId')
            .trim()
            .notEmpty()
            .withMessage(
                'Service is required'
            ),

        body('petId')
            .optional({
                checkFalsy: true
            })
            .isMongoId()
            .withMessage(
                'Select a valid pet profile'
            ),

        body('aiPreviewId')
            .optional({
                checkFalsy: true
            })
            .isMongoId()
            .withMessage(
                'The selected AI preview is invalid'
            ),

        body('haircutStyle')
            .optional({
                nullable: true
            })
            .trim(),

        body('date')
            .matches(datePattern)
            .withMessage(
                'Invalid date format'
            ),

        body('time')
            .matches(timePattern)
            .withMessage(
                'Invalid time format'
            ),

        body('ownerName')
            .trim()
            .notEmpty()
            .withMessage(
                'Owner name is required'
            ),

        body('ownerEmail')
            .optional({
                checkFalsy: true
            })
            .isEmail()
            .normalizeEmail({ gmail_remove_dots: false })
            .withMessage(
                'Enter a valid email'
            ),

        body('ownerPhone')
            .trim()
            .notEmpty()
            .withMessage(
                'Owner phone is required'
            ),

        body('notes')
            .optional()
            .isLength({
                max: 500
            })
            .withMessage(
                'Notes cannot exceed 500 characters'
            ),

        body('petAgeMonths')
            .optional({ checkFalsy: true })
            .isNumeric()
            .withMessage(
                'Pet age in months must be a number'
            ),

        body('vaccinated')
            .optional()
    ],
    async (req, res) => {
        // Enforce the persisted account status. Notifications are communication only.
        const freshUser = await User.findById(req.user._id).select('accountStatus statusReason')
        const isBlockedOrBanned = freshUser && ['booking_blocked', 'banned'].includes(freshUser.accountStatus)

        if (isBlockedOrBanned) {
            const reasonMsg = freshUser.accountStatus === 'banned'
                ? `Your customer account has been permanently suspended by administration. ${freshUser.statusReason || ''}`
                : `Your booking access is currently blocked by administration. ${freshUser.statusReason || ''}`

            return res.status(403).json({
                success: false,
                message: reasonMsg.trim()
            })
        }

        const errors =
            validationResult(req)

        if (!errors.isEmpty()) {
            return res
                .status(400)
                .json({
                    success: false,
                    errors:
                        errors.array()
                })
        }

        const service =
            findService(
                req.body.serviceId
            )

        if (!service) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Invalid service selected'
                })
        }

        const dateError =
            validateBookingDate(
                req.body.date
            )

        if (dateError) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: dateError
                })
        }

        const selectedSlot =
            findFixedSlot(
                req.body.time
            )

        if (!selectedSlot) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Select one of the available two-hour booking periods'
                })
        }

        if (
            !isFixedStartTime(
                selectedSlot.startTime
            )
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Invalid booking period'
                })
        }

        const startMinutes =
            toMinutes(
                selectedSlot.startTime
            )

        const endMinutes =
            toMinutes(
                selectedSlot.endTime
            )

        const startAt =
            manilaDateTime(
                req.body.date,
                startMinutes
            )

        const endAt =
            manilaDateTime(
                req.body.date,
                endMinutes
            )

        const earliestAllowed =
            new Date(
                Date.now() +
                BOOKING_LEAD_MINUTES *
                60 *
                1000
            )

        if (
            startAt <= earliestAllowed
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        `This time slot has already passed or requires at least ${BOOKING_LEAD_MINUTES} minutes advance booking notice.`
                })
        }

        const style =
            req.body.haircutStyle
                ? findStyle(
                    req.body
                        .haircutStyle
                )
                : null

        if (
            req.body.haircutStyle &&
            !style
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'Invalid grooming style selected'
                })
        }

        if (
            style &&
            !service.supportsAiPreview
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        'A haircut style cannot be added to this service'
                })
        }

        try {
            const activeAppointments =
                await loadActiveAppointmentsForDate(
                    req.body.date
                )

            const hasConflict =
                activeAppointments.some(
                    (appointment) => {
                        const interval =
                            getAppointmentInterval(
                                appointment,
                                req.body.date
                            )

                        return (
                            interval.startAt <
                            endAt &&
                            interval.endAt >
                            startAt
                        )
                    }
                )

            if (hasConflict) {
                return res
                    .status(409)
                    .json({
                        success: false,
                        message:
                            'This schedule overlaps an existing appointment'
                    })
            }

            let pet = null

            if (
                req.body.petId &&
                mongoose.isValidObjectId(
                    req.body.petId
                )
            ) {
                pet =
                    await Pet.findOne({
                        _id:
                            req.body
                                .petId,
                        owner:
                            req.user
                                ._id
                    })

                if (!pet) {
                    return res
                        .status(404)
                        .json({
                            success:
                                false,
                            message:
                                'Selected pet was not found'
                        })
                }
            }

            const authoritativePetName =
                pet?.name ||
                req.body.petName
            const authoritativePetType = String(
                pet?.type ||
                req.body.petType ||
                'dog'
            ).toLowerCase()
            const authoritativeBreed = String(
                pet?.breed ||
                req.body.breed
            ).trim()
            const authoritativePetAgeMonths = pet?.ageMonths !== undefined
                ? pet.ageMonths
                : (req.body.petAgeMonths !== undefined && req.body.petAgeMonths !== '' ? Number(req.body.petAgeMonths) : null)
            const authoritativeVaccinated = pet?.vaccinated !== undefined
                ? pet.vaccinated
                : (req.body.vaccinated === false || req.body.vaccinated === 'false' || req.body.vaccinated === 'no' ? false : true)

            if (authoritativePetAgeMonths !== null && authoritativePetAgeMonths < 3) {
                return res.status(400).json({
                    success: false,
                    message: 'Notice: Pets must be at least 3 months old to be groomed.'
                })
            }

            if (authoritativeVaccinated === false) {
                return res.status(400).json({
                    success: false,
                    message: 'Booking Ends: Pets must be fully vaccinated to receive grooming services.'
                })
            }

            if (
                style &&
                !isStyleCompatibleWithPet(
                    style,
                    authoritativePetType
                )
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            `${style.name} is not available for the selected ${authoritativePetType}`
                    })
            }

            let previewRecord = null
            let submittedPreview = null

            if (req.body.aiPreviewId) {
                previewRecord =
                    await AiPreview.findOne({
                        _id:
                            req.body.aiPreviewId,
                        user:
                            req.user._id
                    }).select(
                        '+generatedImage +sourcePhotoHash'
                    )

                const acceptedPreviewPolicies = [
                    SOURCE_PHOTO_POLICY_VERSION,
                    'breed-species-v5-strict-check',
                    'species-v4-neutral-context-bound'
                ]

                if (
                    !previewRecord ||
                    previewRecord.expiresAt <= new Date() ||
                    !acceptedPreviewPolicies.includes(previewRecord.sourceVerificationPolicyVersion)
                ) {
                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                'This AI preview is outdated or has expired. Generate it again before booking.'
                        })
                }

                if (
                    !style ||
                    previewRecord.styleId !== style.id ||
                    previewRecord.petType !== authoritativePetType ||
                    previewRecord.breed.trim().toLowerCase() !==
                        authoritativeBreed.toLowerCase() ||
                    (
                        previewRecord.petName &&
                        previewRecord.petName.trim().toLowerCase() !==
                            String(authoritativePetName || '').trim().toLowerCase()
                    ) ||
                    (
                        previewRecord.pet &&
                        (
                            !pet ||
                            !previewRecord.pet.equals(pet._id)
                        )
                    )
                ) {
                    return res
                        .status(400)
                        .json({
                            success: false,
                            message:
                                'The AI preview does not match the selected pet and grooming style.'
                        })
                }

                submittedPreview =
                    parseStoredAiPreview(
                        previewRecord.generatedImage
                    )
            } else if (req.body.aiPreviewImage) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        code:
                            'AI_PREVIEW_REGENERATION_REQUIRED',
                        message:
                            'This older preview cannot be verified safely. Generate a new preview before booking.'
                    })
            }

            if (
                (
                    req.body.aiPreviewImage ||
                    req.body.aiPreviewId
                ) &&
                !submittedPreview
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            'The saved AI preview image is invalid or too large'
                    })
            }

            if (
                req.body.aiPreviewUsed &&
                style &&
                !submittedPreview
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            'Generate a valid AI preview before booking with AI preview enabled'
                    })
            }

            const appointment =
                await Appointment.create({
                    user:
                        req.user._id,

                    pet:
                        pet?._id,

                    petName:
                        authoritativePetName,

                    petType:
                        authoritativePetType,

                    breed:
                        authoritativeBreed,

                    petAgeMonths:
                        authoritativePetAgeMonths,

                    vaccinated:
                        authoritativeVaccinated,

                    serviceId:
                        service.id,

                    service:
                        service.name,

                    haircutStyle:
                        style?.name ||
                        null,

                    aiPreviewUsed:
                        Boolean(
                            style &&
                            submittedPreview
                        ),

                    aiPreview:
                        submittedPreview && previewRecord
                            ? previewRecord._id
                            : null,

                    aiPreviewStyleId:
                        submittedPreview && style
                            ? style.id
                            : null,

                    aiPreviewModel:
                        submittedPreview && style
                            ? previewRecord?.model ||
                                String(req.body.aiPreviewModel || '') ||
                                null
                            : null,

                    aiPreviewSourceHash:
                        submittedPreview && style
                            ? previewRecord?.sourcePhotoHash ||
                                String(req.body.aiPreviewSourceHash || '') ||
                                null
                            : null,

                    aiPreviewSeasonKey:
                        submittedPreview && previewRecord
                            ? previewRecord.seasonKey
                            : null,

                    aiPreviewSeasonLabel:
                        submittedPreview && previewRecord
                            ? previewRecord.seasonLabel
                            : null,

                    aiPreviewVersion:
                        submittedPreview && previewRecord
                            ? previewRecord.previewVersion
                            : null,

                    aiPreviewFidelityCheck:
                        submittedPreview && previewRecord
                            ? previewRecord.fidelityCheck
                            : null,

                    aiPreviewImage:
                        submittedPreview && style
                            ? submittedPreview.dataUrl
                            : null,

                    date:
                        req.body.date,

                    time:
                        selectedSlot
                            .startTime,

                    endTime:
                        selectedSlot
                            .endTime,

                    startAt,
                    endAt,

                    durationMinutes:
                        SLOT_DURATION_MINUTES,

                    ownerName:
                        req.body.ownerName,

                    ownerEmail:
                        req.body.ownerEmail ||
                        req.user.email ||
                        '',

                    ownerPhone:
                        req.body.ownerPhone,

                    ownerAddress:
                        req.body.ownerAddress ||
                        req.user
                            .homeAddress ||
                        '',

                    notes:
                        req.body.notes ||
                        '',

                    price:
                        service.price
                })

            if (previewRecord) {
                previewRecord.appointment =
                    appointment._id
                previewRecord.usedAt = new Date()
                await previewRecord.save()
            }

            const isAppointmentToday = appointment.date === getManilaDateString()
            const recipientEmail = appointment.ownerEmail || req.user.email
            const recipientName = appointment.ownerName || `${req.user.firstName} ${req.user.lastName}`.trim()

            if (isAppointmentToday) {
                // If booked today, instantly mark reminder sent and dispatch today's reminder email & notification
                appointment.reminderSentToday = true
                appointment.reminderSentAt = new Date()
                await appointment.save()

                if (recipientEmail) {
                    sendAppointmentReminderTodayEmail({
                        to: recipientEmail,
                        name: recipientName,
                        appointment
                    }).catch((err) => console.error('[MAILER] Immediate today reminder failed:', err))

                    sendAppointmentConfirmedEmail({
                        to: recipientEmail,
                        name: recipientName,
                        appointment,
                        isToday: true
                    }).catch((err) => console.error('[MAILER] Booking confirmation email failed:', err))
                }

                await Notification.create({
                    title: 'Appointment Today Reminder',
                    message: `Your appointment for ${appointment.petName} is scheduled for TODAY at ${appointment.time}. Please arrive 5-10 minutes before ${appointment.time} or your slot will be automatically cancelled and will open to others.`,
                    audience: 'user',
                    targetUser: req.user._id,
                    type: 'appointment-status',
                    appointment: appointment._id
                }).catch(() => {})
            } else {
                if (recipientEmail) {
                    sendAppointmentConfirmedEmail({
                        to: recipientEmail,
                        name: recipientName,
                        appointment,
                        isToday: false
                    }).catch((err) => console.error('[MAILER] Booking confirmation email failed:', err))
                }
            }

            const appointmentResponse =
                appointment.toObject()

            delete appointmentResponse.aiPreviewImage
            delete appointmentResponse.aiPreviewSourceHash
            delete appointmentResponse.aiPreviewFidelityCheck

            // Send Booking Confirmation Email
            const customerEmail = appointment.ownerEmail || req.user?.email
            if (customerEmail) {
                sendAppointmentConfirmedEmail({
                    to: customerEmail,
                    name: req.body.ownerName || req.user?.firstName,
                    appointment
                }).catch((emailErr) => {
                    console.error('Booking confirmation email dispatch error:', emailErr.message)
                })
            }

            return res
                .status(201)
                .json({
                    success: true,
                    message:
                        'Appointment booked successfully. The staff will review and confirm it.',
                    appointment:
                        appointmentResponse
                })
        } catch (error) {
            console.error(
                'Create appointment error:',
                error
            )

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        'Unable to create the appointment'
                })
        }
    }
)

router.get(
    '/my',
    protect,
    async (req, res) => {
        try {
            await autoCancelOverdueAppointments()

            const appointments =
                await Appointment.find({
                    user:
                        req.user._id
                })
                    .populate(
                        'pet',
                        [
                            'name',
                            'type',
                            'breed',
                            'photoUrl'
                        ].join(' ')
                    )
                    .sort({
                        startAt: -1
                    })

            return res.json({
                success: true,
                appointments
            })
        } catch (error) {
            console.error(
                'Get appointments error:',
                error
            )

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        'Unable to load appointments'
                })
        }
    }
)

router.delete(
    '/:id',
    protect,
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
                await Appointment.findById(
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

            const isOwner =
                appointment.user
                    .toString() ===
                req.user._id
                    .toString()

            const isAdmin =
                req.user.role ===
                'admin'

            if (
                !isOwner &&
                !isAdmin
            ) {
                return res
                    .status(403)
                    .json({
                        success: false,
                        message:
                            'Not authorized'
                    })
            }

            if (
                appointment.status ===
                'completed'
            ) {
                return res
                    .status(400)
                    .json({
                        success: false,
                        message:
                            'Completed appointments cannot be cancelled'
                    })
            }

            appointment.status =
                'cancelled'

            appointment.cancellationReason =
                String(req.body.cancellationReason || req.body.reason || '').trim() ||
                (isAdmin ? 'Cancelled by admin' : 'Cancelled by pet owner')

            appointment.revenueRecordedAt =
                null

            await appointment.save()

            await Notification.create({
                title:
                    'Booking Cancelled',

                message:
                    `The ${appointment.service} ` +
                    'appointment on ' +
                    `${appointment.date}, ` +
                    `${appointment.time}–` +
                    `${appointment.endTime}, ` +
                    'was cancelled.',

                audience: 'user',

                targetUser:
                    appointment.user,

                type:
                    'appointment-status',

                appointment:
                    appointment._id,

                createdBy:
                    isAdmin
                        ? req.user._id
                        : null
            })

            // Send cancellation email to customer
            try {
                const targetUser = await User.findById(appointment.user).select('email firstName')
                const customerEmail = targetUser?.email || appointment.contactEmail
                if (customerEmail) {
                    sendAppointmentCancelledEmail({
                        to: customerEmail,
                        name: targetUser?.firstName,
                        appointment,
                        reason: appointment.cancellationReason
                    }).catch((emailErr) => {
                        console.error('Cancellation email dispatch error:', emailErr.message)
                    })
                }
            } catch (err) {
                console.error('Error finding user for cancellation email:', err.message)
            }

            return res.json({
                success: true,
                message:
                    'Appointment cancelled',
                appointment
            })
        } catch (error) {
            console.error(
                'Cancel appointment error:',
                error
            )

            return res
                .status(500)
                .json({
                    success: false,
                    message:
                        'Unable to cancel appointment'
                })
        }
    }
)

router.patch(
    '/:id/reschedule',
    protect,
    async (req, res) => {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid appointment ID'
            })
        }

        const { date, time } = req.body
        if (!date || !time) {
            return res.status(400).json({
                success: false,
                message: 'New date and time slot are required.'
            })
        }

        try {
            const appointment = await Appointment.findById(req.params.id)
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found'
                })
            }

            const isOwner = appointment.user.toString() === req.user._id.toString()
            const isAdmin = req.user.role === 'admin'

            if (!isOwner && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized'
                })
            }

            if (['completed', 'cancelled'].includes(appointment.status)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot reschedule a ${appointment.status} appointment.`
                })
            }

            // Enforce 3-minute edit limit for non-admin users
            const THREE_MINUTES_MS = 3 * 60 * 1000
            const elapsedMs = Date.now() - new Date(appointment.createdAt).getTime()
            if (!isAdmin && elapsedMs > THREE_MINUTES_MS) {
                return res.status(400).json({
                    success: false,
                    message: 'Appointment dates can only be edited within 3 minutes of booking.'
                })
            }

            // Find matching slot from FIXED_BOOKING_SLOTS
            const slot = FIXED_BOOKING_SLOTS.find((s) => s.startTime === time)
            if (!slot) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid time slot.'
                })
            }

            // Check if slot is taken by another active appointment on the requested date
            const existingConflict = await Appointment.findOne({
                _id: { $ne: appointment._id },
                date,
                time: slot.startTime,
                status: { $ne: 'cancelled' }
            })

            if (existingConflict) {
                return res.status(400).json({
                    success: false,
                    message: `The time slot ${slot.startTime} on ${date} is already booked. Please choose another slot.`
                })
            }

            // Update startAt / endAt ISO objects
            const startAt = new Date(`${date}T${slot.startTime}:00.000Z`)
            const endAt = new Date(`${date}T${slot.endTime}:00.000Z`)

            appointment.date = date
            appointment.time = slot.startTime
            appointment.endTime = slot.endTime
            appointment.startAt = startAt
            appointment.endAt = endAt

            await appointment.save()

            await Notification.create({
                title: 'Appointment Rescheduled',
                message: `Your appointment for ${appointment.petName} has been rescheduled to ${appointment.date} at ${appointment.time}–${appointment.endTime}.`,
                audience: 'user',
                targetUser: appointment.user,
                type: 'appointment-status',
                appointment: appointment._id,
                createdBy: isAdmin ? req.user._id : null
            })

            // Send Reschedule Notification Email
            const rescheduleEmail = appointment.ownerEmail || req.user?.email
            if (rescheduleEmail) {
                sendAppointmentRescheduledEmail({
                    to: rescheduleEmail,
                    name: appointment.ownerName || req.user?.firstName,
                    appointment
                }).catch((emailErr) => {
                    console.error('Reschedule email dispatch error:', emailErr.message)
                })
            }

            return res.json({
                success: true,
                message: 'Appointment successfully rescheduled.',
                appointment
            })
        } catch (error) {
            console.error('Reschedule appointment error:', error)
            return res.status(500).json({
                success: false,
                message: 'Unable to reschedule appointment.'
            })
        }
    }
)

router.put('/:id/reschedule', protect, async (req, res, next) => {
    return router.handle(req, res, next)
})

router.post('/:id/reschedule', protect, async (req, res, next) => {
    return router.handle(req, res, next)
})

module.exports = router
