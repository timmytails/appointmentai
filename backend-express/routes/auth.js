const express = require('express')
const rateLimit = require('express-rate-limit')
const { body, validationResult } = require('express-validator')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

const User = require('../models/User')
const OtpRequest = require('../models/OtpRequest')
const { sendOtp } = require('../services/textbee')
const { sendWelcomeEmail } = require('../services/mailer')
const { protect } = require('../middleware/auth')

const router = express.Router()

let googleJwksCache = { expiresAt: 0, keys: [] }

const decodeBase64Url = (value) => {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
    return Buffer.from(normalized + padding, 'base64')
}

const getGoogleJwks = async () => {
    if (googleJwksCache.expiresAt > Date.now() && googleJwksCache.keys.length) {
        return googleJwksCache.keys
    }

    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs')
    if (!response.ok) throw new Error('Unable to load Google signing keys')

    const data = await response.json()
    const cacheControl = response.headers.get('cache-control') || ''
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
    const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600

    googleJwksCache = {
        keys: data.keys || [],
        expiresAt: Date.now() + maxAgeSeconds * 1000
    }

    return googleJwksCache.keys
}

const verifyGoogleCredential = async (credential) => {
    const parts = String(credential || '').split('.')
    if (parts.length !== 3) throw new Error('Invalid Google credential')

    const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'))
    const payload = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'))

    if (header.alg !== 'RS256' || !header.kid) {
        throw new Error('Unsupported Google token')
    }

    const keys = await getGoogleJwks()
    const jwk = keys.find((key) => key.kid === header.kid)
    if (!jwk) throw new Error('Google signing key was not found')

    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' })
    const validSignature = crypto.verify(
        'RSA-SHA256',
        Buffer.from(`${parts[0]}.${parts[1]}`),
        publicKey,
        decodeBase64Url(parts[2])
    )

    if (!validSignature) throw new Error('Invalid Google token signature')

    const nowSeconds = Math.floor(Date.now() / 1000)
    const validIssuer = [
        'accounts.google.com',
        'https://accounts.google.com'
    ].includes(payload.iss)

    if (!validIssuer || Number(payload.exp) <= nowSeconds) {
        throw new Error('Expired or invalid Google token')
    }

    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Google token audience mismatch')
    }

    return payload
}

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_REQUEST_COOLDOWN_MS = 5 * 60 * 1000

const normalizePhone = (value) => {
    let digits = String(value || '').replace(/\D/g, '')
    if (digits.startsWith('63')) digits = digits.slice(2)
    if (digits.startsWith('0')) digits = digits.slice(1)
    if (!/^9\d{9}$/.test(digits)) return ''
    return `+63${digits}`
}

const normalizeEmail = (value) => {
    const email = String(value || '').trim().toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

const getPhoneCandidates = (value) => {
    const normalized = normalizePhone(value)
    if (!normalized) return []
    const local = normalized.slice(3)
    return [normalized, `0${local}`, local, `63${local}`]
}

const escapeRegex = (value) =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildAddress = (source = {}) => ({
    street: String(source.street || '').trim(),
    barangay: String(source.barangay || '').trim(),
    city: String(source.city || '').trim(),
    province: String(source.province || '').trim()
})

const formatAddress = (address = {}) =>
    [
        address.street,
        address.barangay ? `Brgy. ${address.barangay}` : '',
        address.city,
        address.province
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(', ')

const hasRequiredAddress = (address) =>
    Boolean(
        address.street &&
        address.barangay &&
        address.city &&
        address.province
    )

const otpRequestLimiter = rateLimit({
    windowMs: OTP_REQUEST_COOLDOWN_MS,
    max: 1,
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
    keyGenerator: (req) => {
        const key =
            normalizePhone(req.body?.phone) ||
            normalizeEmail(req.body?.identifier) ||
            String(req.body?.identifier || '').trim().toLowerCase() ||
            req.ip

        return `${req.path}:${key}`
    },
    handler: (req, res) => {
        const resetTime = req.rateLimit?.resetTime
        const retryAfter = resetTime instanceof Date
            ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
            : 300

        res.status(429).json({
            success: false,
            message:
                'An OTP was already requested. Please wait 5 minutes before requesting another code.',
            retryAfter
        })
    }
})

const generateToken = (id) =>
    jwt.sign(
        { id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    )

const validateRequest = (req, res) => {
    const errors = validationResult(req)
    if (errors.isEmpty()) return true

    res.status(400).json({
        success: false,
        errors: errors.array()
    })

    return false
}

const generateSixDigitOtp = () =>
    `${Math.floor(100000 + Math.random() * 900000)}`

const serializeUser = (user) => {
    const storedAddress = buildAddress(user.address || {})
    const hasStructuredAddress = Object.values(storedAddress).some(Boolean)
    const legacyAddress = String(user.homeAddress || '').trim()

    return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || '',
        phone: user.phone || '',
        address: hasStructuredAddress
            ? storedAddress
            : {
                ...storedAddress,
                street: legacyAddress
            },
        homeAddress:
            legacyAddress ||
            formatAddress(storedAddress),
        profileImage: user.profileImage || '',
        profileCompleted: Boolean(user.profileCompleted),
        authProvider: user.authProvider,
        role: user.role,
        accountStatus: user.accountStatus || 'active',
        statusReason: user.statusReason || '',
        warningMessage: user.warningMessage || '',
        statusUpdatedAt: user.statusUpdatedAt || user.createdAt
    }
}

const findUserByIdentifier = async (identifier, includePassword = false) => {
    const raw = String(identifier || '').trim()
    const email = normalizeEmail(raw)

    let query
    if (email) {
        query = {
            email: {
                $regex: new RegExp(`^${escapeRegex(email)}$`, 'i')
            }
        }
    } else {
        const phoneCandidates = getPhoneCandidates(raw)
        query = {
            phone: {
                $in: phoneCandidates.length
                    ? phoneCandidates
                    : [raw]
            }
        }
    }

    const request = User.findOne(query)
    return includePassword
        ? request.select('+password')
        : request
}

router.post(
    '/register/send-otp',
    [
        body('firstName').trim().notEmpty().withMessage('First name is required'),
        body('lastName').trim().notEmpty().withMessage('Last name is required'),
        body('phone').trim().notEmpty().withMessage('Phone number is required'),
        body('email')
            .optional({ checkFalsy: true })
            .isEmail()
            .withMessage('Enter a valid email address'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
    ],
    otpRequestLimiter,
    async (req, res) => {
        if (!validateRequest(req, res)) return

        const phone = normalizePhone(req.body.phone)
        const email = normalizeEmail(req.body.email)
        const address = buildAddress(req.body.address)

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid Philippine mobile number'
            })
        }

        if (!hasRequiredAddress(address)) {
            return res.status(400).json({
                success: false,
                message:
                    'Street, barangay, city, and province are required'
            })
        }

        try {
            const duplicateQuery = [{ phone: { $in: getPhoneCandidates(phone) } }]
            if (email) {
                duplicateQuery.push({
                    email: {
                        $regex: new RegExp(`^${escapeRegex(email)}$`, 'i')
                    }
                })
            }

            const existingUser = await User.findOne({ $or: duplicateQuery })

            if (existingUser) {
                const message =
                    email &&
                    String(existingUser.email || '').toLowerCase() === email
                        ? 'Email address is already registered'
                        : 'Phone number is already registered'

                return res.status(400).json({
                    success: false,
                    message
                })
            }

            const code = generateSixDigitOtp()
            const otpHash = await bcrypt.hash(code, 10)

            await OtpRequest.findOneAndUpdate(
                { purpose: 'signup', phone },
                {
                    purpose: 'signup',
                    phone,
                    email: email || undefined,
                    otpHash,
                    expiresAt: new Date(Date.now() + OTP_TTL_MS),
                    payload: {
                        firstName: req.body.firstName,
                        lastName: req.body.lastName,
                        phone,
                        email: email || undefined,
                        password: req.body.password,
                        address,
                        homeAddress: formatAddress(address)
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )

            await sendOtp({
                phone,
                code,
                purpose: 'signup'
            })

            res.json({
                success: true,
                message: 'OTP sent to your mobile number'
            })
        } catch (error) {
            console.error('Send signup OTP error:', error)

            res.status(500).json({
                success: false,
                message: 'Failed to send OTP'
            })
        }
    }
)

router.post(
    '/register',
    [
        body('phone').trim().notEmpty().withMessage('Phone number is required'),
        body('otp')
            .isLength({ min: 6, max: 6 })
            .withMessage('OTP must be 6 digits')
    ],
    async (req, res) => {
        if (!validateRequest(req, res)) return

        const phone = normalizePhone(req.body.phone)

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number'
            })
        }

        try {
            const otpRequest = await OtpRequest.findOne({
                purpose: 'signup',
                phone
            })

            if (
                !otpRequest ||
                otpRequest.expiresAt.getTime() < Date.now()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'OTP expired or not found. Request a new code.'
                })
            }

            const isMatch = await bcrypt.compare(
                String(req.body.otp),
                otpRequest.otpHash
            )

            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid OTP'
                })
            }

            const payload = otpRequest.payload || {}
            const duplicateQuery = [
                { phone: { $in: getPhoneCandidates(phone) } }
            ]

            if (payload.email) {
                duplicateQuery.push({
                    email: {
                        $regex: new RegExp(
                            `^${escapeRegex(payload.email)}$`,
                            'i'
                        )
                    }
                })
            }

            const existing = await User.findOne({ $or: duplicateQuery })

            if (existing) {
                await OtpRequest.deleteOne({ _id: otpRequest._id })

                return res.status(400).json({
                    success: false,
                    message: 'Phone number or email is already registered'
                })
            }

            const user = await User.create({
                firstName: payload.firstName,
                lastName: payload.lastName,
                phone,
                email: payload.email || undefined,
                password: payload.password,
                address: buildAddress(payload.address),
                homeAddress:
                    payload.homeAddress ||
                    formatAddress(payload.address),
                authProvider: 'phone',
                profileCompleted: true
            })

            await OtpRequest.deleteOne({ _id: otpRequest._id })

            if (user.email) {
                sendWelcomeEmail({
                    to: user.email,
                    name: user.firstName
                }).catch((emailErr) => {
                    console.error('Welcome email dispatch error:', emailErr.message)
                })
            }

            res.status(201).json({
                success: true,
                message: 'Account created successfully',
                token: generateToken(user._id),
                user: serializeUser(user)
            })
        } catch (error) {
            console.error('Register error:', error)

            res.status(500).json({
                success: false,
                message: 'Server error'
            })
        }
    }
)

router.post(
    '/google',
    [
        body('credential')
            .notEmpty()
            .withMessage('Google credential is required')
    ],
    async (req, res) => {
        if (!validateRequest(req, res)) return

        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(503).json({
                success: false,
                message: 'Google sign-in is not configured'
            })
        }

        try {
            const payload = await verifyGoogleCredential(
                req.body.credential
            )

            if (
                !payload?.sub ||
                !payload?.email ||
                !payload.email_verified
            ) {
                return res.status(401).json({
                    success: false,
                    message: 'Google account could not be verified'
                })
            }

            const email = normalizeEmail(payload.email)

            let user = await User.findOne({
                $or: [
                    { googleId: payload.sub },
                    {
                        email: {
                            $regex: new RegExp(
                                `^${escapeRegex(email)}$`,
                                'i'
                            )
                        }
                    }
                ]
            }).select('+googleId +password')

            if (!user) {
                user = await User.create({
                    firstName: payload.given_name || 'Google',
                    lastName: payload.family_name || 'User',
                    email,
                    googleId: payload.sub,
                    profileImage: payload.picture || '',
                    authProvider: 'google',
                    profileCompleted: false
                })

                if (email) {
                    sendWelcomeEmail({
                        to: email,
                        name: user.firstName
                    }).catch((emailErr) => {
                        console.error('Google welcome email dispatch error:', emailErr.message)
                    })
                }
            } else {
                await User.findByIdAndUpdate(user._id, {
                    $set: {
                        googleId: payload.sub,
                        email,
                        profileImage: user.profileImage || payload.picture || '',
                        authProvider: user.authProvider === 'phone' ? 'phone' : 'google'
                    }
                })
            }

            // Re-read the persisted status so a newly banned account cannot authenticate.
            const freshUser = await User.findById(user._id).select('accountStatus statusReason')
            const isBanned = freshUser?.accountStatus === 'banned'
            const banReason = freshUser?.statusReason || ''

            if (isBanned) {
                return res.status(403).json({
                    success: false,
                    isBanned: true,
                    message: `Your customer account has been permanently suspended by salon administration. ${banReason ? `Reason: ${banReason}` : ''}`
                })
            }

            res.json({
                success: true,
                token: generateToken(user._id),
                user: serializeUser(user)
            })
        } catch (error) {
            console.error('Google sign-in error:', error)

            res.status(401).json({
                success: false,
                message: 'Google sign-in failed'
            })
        }
    }
)

router.post(
    '/login',
    [
        body('identifier')
            .trim()
            .notEmpty()
            .withMessage('Email or phone number is required'),
        body('password')
            .notEmpty()
            .withMessage('Password is required')
    ],
    async (req, res) => {
        if (!validateRequest(req, res)) return

        try {
            const user = await findUserByIdentifier(
                req.body.identifier,
                true
            )

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email, phone number, or password'
                })
            }

            if (user.authProvider === 'google' && !user.password) {
                return res.status(400).json({
                    success: false,
                    code: 'GOOGLE_AUTH_REQUIRED',
                    message: 'This account is linked with Google. Please click "Continue with Google" below to sign in, or use "Forgot password?" to set a password.'
                })
            }

            if (!(await user.matchPassword(req.body.password))) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email, phone number, or password'
                })
            }

            const freshUser = await User.findById(user._id).select('accountStatus statusReason')
            const isBanned = freshUser?.accountStatus === 'banned'
            const banReason = freshUser?.statusReason || ''

            if (isBanned) {
                return res.status(403).json({
                    success: false,
                    isBanned: true,
                    message: `Your customer account has been permanently suspended by salon administration. ${banReason ? `Reason: ${banReason}` : ''}`
                })
            }

            res.json({
                success: true,
                message: 'Login successful',
                token: generateToken(user._id),
                user: serializeUser(user)
            })
        } catch (error) {
            console.error('Login error:', error)

            res.status(500).json({
                success: false,
                message: 'Server error'
            })
        }
    }
)

router.get('/me', protect, async (req, res) => {
    res.json({
        success: true,
        user: serializeUser(req.user)
    })
})

router.post(
    '/complete-profile/send-otp',
    protect,
    [
        body('phone')
            .trim()
            .notEmpty()
            .withMessage('Phone number is required')
    ],
    otpRequestLimiter,
    async (req, res) => {
        if (!validateRequest(req, res)) return

        if (req.user.profileCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Profile is already complete. Use the Profile page to update your information.'
            })
        }

        const phone = normalizePhone(req.body.phone)

        if (!phone) {
            return res.status(400).json({
                success: false,
                message:
                    'Enter a valid Philippine mobile number in +63 or 09 format'
            })
        }

        try {
            const duplicate = await User.findOne({
                phone: { $in: getPhoneCandidates(phone) },
                _id: { $ne: req.user._id }
            })

            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number is already in use'
                })
            }

            const code = generateSixDigitOtp()
            const otpHash = await bcrypt.hash(code, 10)

            await OtpRequest.findOneAndUpdate(
                {
                    purpose: 'profile_phone',
                    phone,
                    'payload.userId': String(req.user._id),
                    'payload.action': 'complete_profile'
                },
                {
                    purpose: 'profile_phone',
                    phone,
                    email: req.user.email || undefined,
                    otpHash,
                    expiresAt: new Date(Date.now() + OTP_TTL_MS),
                    payload: {
                        userId: String(req.user._id),
                        action: 'complete_profile'
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )

            await sendOtp({
                phone,
                code,
                purpose: 'profile_phone'
            })

            res.json({
                success: true,
                message: 'Verification code sent to your mobile number',
                phone
            })
        } catch (error) {
            console.error('Complete profile OTP error:', error)

            res.status(500).json({
                success: false,
                message: 'Failed to send verification code'
            })
        }
    }
)

router.patch(
    '/complete-profile',
    protect,
    [
        body('firstName')
            .trim()
            .notEmpty()
            .withMessage('First name is required'),
        body('lastName')
            .trim()
            .notEmpty()
            .withMessage('Last name is required'),
        body('phone')
            .trim()
            .notEmpty()
            .withMessage('Phone number is required'),
        body('otp')
            .isLength({ min: 6, max: 6 })
            .withMessage('Enter the six-digit mobile verification code')
    ],
    async (req, res) => {
        if (!validateRequest(req, res)) return

        if (req.user.profileCompleted) {
            return res.status(400).json({
                success: false,
                message: 'Profile is already complete. Use the Profile page to update your information.'
            })
        }

        const phone = normalizePhone(req.body.phone)
        const address = buildAddress(req.body.address)

        if (!phone) {
            return res.status(400).json({
                success: false,
                message:
                    'Enter a valid Philippine mobile number in +63 or 09 format'
            })
        }

        if (!hasRequiredAddress(address)) {
            return res.status(400).json({
                success: false,
                message:
                    'Street, barangay, city, and province are required'
            })
        }

        try {
            const duplicate = await User.findOne({
                phone: { $in: getPhoneCandidates(phone) },
                _id: { $ne: req.user._id }
            })

            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number is already in use'
                })
            }

            const otpRequest = await OtpRequest.findOne({
                purpose: 'profile_phone',
                phone,
                'payload.userId': String(req.user._id),
                'payload.action': 'complete_profile'
            })

            if (
                !otpRequest ||
                otpRequest.expiresAt.getTime() < Date.now()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Verification code expired or not found. Request a new code.'
                })
            }

            const validOtp = await bcrypt.compare(
                String(req.body.otp),
                otpRequest.otpHash
            )

            if (!validOtp) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid verification code'
                })
            }

            const user = await User.findById(req.user._id)

            user.firstName = String(req.body.firstName).trim()
            user.lastName = String(req.body.lastName).trim()
            user.phone = phone
            user.address = address
            user.homeAddress = formatAddress(address)
            user.profileCompleted = true

            await user.save()
            await OtpRequest.deleteOne({ _id: otpRequest._id })

            res.json({
                success: true,
                message: 'Profile completed',
                user: serializeUser(user)
            })
        } catch (error) {
            console.error('Complete profile error:', error)

            res.status(500).json({
                success: false,
                message: 'Server error'
            })
        }
    }
)

router.post(
    '/me/phone/send-otp',
    protect,
    [
        body('phone')
            .trim()
            .notEmpty()
            .withMessage('Phone number is required')
    ],
    otpRequestLimiter,
    async (req, res) => {
        if (!validateRequest(req, res)) return

        const phone = normalizePhone(req.body.phone)

        if (!phone) {
            return res.status(400).json({
                success: false,
                message:
                    'Enter a valid Philippine mobile number in +63 or 09 format'
            })
        }

        try {
            const duplicate = await User.findOne({
                phone: { $in: getPhoneCandidates(phone) },
                _id: { $ne: req.user._id }
            })

            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number is already in use'
                })
            }

            const code = generateSixDigitOtp()
            const otpHash = await bcrypt.hash(code, 10)

            await OtpRequest.findOneAndUpdate(
                {
                    purpose: 'profile_phone',
                    phone,
                    'payload.userId': String(req.user._id),
                    'payload.action': 'update_profile'
                },
                {
                    purpose: 'profile_phone',
                    phone,
                    email: req.user.email || undefined,
                    otpHash,
                    expiresAt: new Date(Date.now() + OTP_TTL_MS),
                    payload: {
                        userId: String(req.user._id),
                        action: 'update_profile'
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )

            await sendOtp({
                phone,
                code,
                purpose: 'profile_phone'
            })

            res.json({
                success: true,
                message: 'Verification code sent to your mobile number',
                phone
            })
        } catch (error) {
            console.error('Profile phone OTP error:', error)

            res.status(500).json({
                success: false,
                message: 'Failed to send verification code'
            })
        }
    }
)

router.patch(
    '/me/profile',
    protect,
    [
        body('phone')
            .trim()
            .notEmpty()
            .withMessage('Phone number is required'),
        body('email')
            .optional({ checkFalsy: true })
            .isEmail()
            .withMessage('Enter a valid email address')
    ],
    async (req, res) => {
        if (!validateRequest(req, res)) return

        const phone = normalizePhone(req.body.phone)
        const address = buildAddress(req.body.address)
        const requestedEmail = normalizeEmail(req.body.email)

        if (!phone) {
            return res.status(400).json({
                success: false,
                message:
                    'Enter a valid Philippine mobile number in +63 or 09 format'
            })
        }

        if (!hasRequiredAddress(address)) {
            return res.status(400).json({
                success: false,
                message:
                    'Street, barangay, city, and province are required'
            })
        }

        try {
            const user = await User.findById(req.user._id)
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User account was not found'
                })
            }

            const currentPhone = normalizePhone(user.phone)
            const phoneChanged = currentPhone !== phone

            const duplicatePhone = await User.findOne({
                phone: { $in: getPhoneCandidates(phone) },
                _id: { $ne: user._id }
            })

            if (duplicatePhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number is already in use'
                })
            }

            let verifiedOtpRequest = null

            if (phoneChanged) {
                if (!/^\d{6}$/.test(String(req.body.phoneOtp || ''))) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'Verify the new mobile number using the six-digit OTP'
                    })
                }

                verifiedOtpRequest = await OtpRequest.findOne({
                    purpose: 'profile_phone',
                    phone,
                    'payload.userId': String(user._id),
                    'payload.action': 'update_profile'
                })

                if (
                    !verifiedOtpRequest ||
                    verifiedOtpRequest.expiresAt.getTime() < Date.now()
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'Verification code expired or not found. Request a new code.'
                    })
                }

                const validOtp = await bcrypt.compare(
                    String(req.body.phoneOtp),
                    verifiedOtpRequest.otpHash
                )

                if (!validOtp) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid verification code'
                    })
                }
            }

            if (user.authProvider !== 'google') {
                if (!requestedEmail) {
                    user.email = undefined
                } else {
                    const duplicateEmail = await User.findOne({
                        email: {
                            $regex: new RegExp(
                                `^${escapeRegex(requestedEmail)}$`,
                                'i'
                            )
                        },
                        _id: { $ne: user._id }
                    })

                    if (duplicateEmail) {
                        return res.status(400).json({
                            success: false,
                            message: 'Email address is already in use'
                        })
                    }

                    user.email = requestedEmail
                }
            }

            user.phone = phone
            user.address = address
            user.homeAddress = formatAddress(address)

            await user.save()

            if (verifiedOtpRequest) {
                await OtpRequest.deleteOne({
                    _id: verifiedOtpRequest._id
                })
            }

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: serializeUser(user)
            })
        } catch (error) {
            console.error('Update profile error:', error)

            res.status(500).json({
                success: false,
                message: 'Server error'
            })
        }
    }
)

// Kept for older frontend versions. Direct phone changes are blocked so
// mobile-number ownership cannot be bypassed without OTP verification.
router.patch('/me/phone', protect, (req, res) => {
    res.status(400).json({
        success: false,
        message:
            'Use the Profile page to verify and update your mobile number'
    })
})

router.post(
    '/password/send-otp',
    [
        body('identifier')
            .trim()
            .notEmpty()
            .withMessage('Enter your email address or phone number')
    ],
    otpRequestLimiter,
    async (req, res) => {
        if (!validateRequest(req, res)) return

        try {
            const user = await findUserByIdentifier(
                req.body.identifier,
                true
            )

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message:
                        'No account was found with that email address or phone number'
                })
            }

            if (!user.phone) {
                return res.status(400).json({
                    success: false,
                    message:
                        'This account has no verified phone number. Please sign in with Google.'
                })
            }

            const phone = normalizePhone(user.phone)
            if (!phone) {
                return res.status(400).json({
                    success: false,
                    message:
                        'This account does not have a valid recovery phone number'
                })
            }

            const email = normalizeEmail(user.email)
            const code = generateSixDigitOtp()

            await OtpRequest.findOneAndUpdate(
                {
                    purpose: 'reset_password',
                    phone
                },
                {
                    purpose: 'reset_password',
                    phone,
                    email: email || undefined,
                    otpHash: await bcrypt.hash(code, 10),
                    expiresAt: new Date(Date.now() + OTP_TTL_MS),
                    payload: {
                        userId: user._id.toString()
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            )

            await sendOtp({
                phone,
                code,
                purpose: 'reset_password'
            })

            const maskedPhone =
                `${phone.slice(0, 5)}*****${phone.slice(-2)}`

            res.json({
                success: true,
                message:
                    `OTP sent to the registered mobile number ${maskedPhone}`
            })
        } catch (error) {
            console.error('Password OTP error:', error)

            res.status(500).json({
                success: false,
                message: 'Failed to send OTP'
            })
        }
    }
)

router.post(
    '/password/reset',
    [
        body('identifier')
            .trim()
            .notEmpty()
            .withMessage('Email or phone number is required'),
        body('otp')
            .isLength({ min: 6, max: 6 })
            .withMessage('OTP must be 6 digits'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
    ],
    async (req, res) => {
        if (!validateRequest(req, res)) return

        try {
            const user = await findUserByIdentifier(
                req.body.identifier,
                true
            )

            if (!user || !user.phone) {
                return res.status(404).json({
                    success: false,
                    message: 'Account not found'
                })
            }

            const phone = normalizePhone(user.phone)
            const request = await OtpRequest.findOne({
                purpose: 'reset_password',
                phone
            })

            if (
                !request ||
                request.expiresAt.getTime() < Date.now()
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'OTP expired or not found'
                })
            }

            const otpMatches = await bcrypt.compare(
                String(req.body.otp),
                request.otpHash
            )

            if (!otpMatches) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid OTP'
                })
            }

            user.password = req.body.newPassword
            await user.save()
            await OtpRequest.deleteOne({ _id: request._id })

            res.json({
                success: true,
                message: 'Password updated successfully'
            })
        } catch (error) {
            console.error('Password reset error:', error)

            res.status(500).json({
                success: false,
                message: 'Unable to reset password'
            })
        }
    }
)

module.exports = router
