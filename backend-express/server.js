require('dotenv').config()

const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const connectDB = require('./config/db')

const app = express()

// Render and other cloud platforms use a reverse proxy.
app.set('trust proxy', 1)

// Connect to MongoDB
connectDB()

// ─────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────

const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://timmytails.vercel.app',
    'https://appmlv3.vercel.app'
]

// FRONTEND_URL may contain one URL or multiple comma-separated URLs.
const environmentOrigins = String(
    process.env.FRONTEND_URL || ''
)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const allowedOrigins = [
    ...new Set([
        ...defaultOrigins,
        ...environmentOrigins
    ])
]

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests without origin (Postman, server-to-server, health checks)
        if (!origin) {
            return callback(null, true)
        }

        if (
            allowedOrigins.includes(origin) ||
            origin.endsWith('.vercel.app') ||
            origin.endsWith('.onrender.com') ||
            origin.includes('localhost') ||
            origin.includes('127.0.0.1')
        ) {
            return callback(null, true)
        }

        // Fallback allow to avoid blocked requests across deployed preview domains
        return callback(null, true)
    },

    credentials: true,

    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],

    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With'
    ],

    optionsSuccessStatus: 204
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// ─────────────────────────────────────────────────────────────
// Body parsing
// ─────────────────────────────────────────────────────────────

app.use(
    express.json({
        limit: '15mb'
    })
)

app.use(
    express.urlencoded({
        extended: false
    })
)

const isProduction =
    process.env.NODE_ENV === 'production'

// ─────────────────────────────────────────────────────────────
// Rate limiters
// ─────────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,

    standardHeaders: true,
    legacyHeaders: false,

    skip: () => !isProduction,

    message: {
        success: false,
        message:
            'Too many requests. Please wait a moment and try again.'
    }
})

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,

    standardHeaders: true,
    legacyHeaders: false,

    skip: () => !isProduction,

    message: {
        success: false,
        message:
            'Too many authentication attempts. Please try again later.'
    }
})

const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,

    standardHeaders: true,
    legacyHeaders: false,

    skip: () => !isProduction,

    message: {
        success: false,
        message:
            'Too many OTP requests. Please wait before requesting another code.'
    }
})

const bookingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,

    standardHeaders: true,
    legacyHeaders: false,

    skip: () => !isProduction,

    message: {
        success: false,
        message:
            'Too many booking attempts. Please try again later.'
    }
})

const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,

    standardHeaders: true,
    legacyHeaders: false,

    skip: () => !isProduction,

    message: {
        success: false,
        message:
            'Too many messages sent. Please try again later.'
    }
})

const aiPreviewLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
    message: {
        success: false,
        message: 'AI preview limit reached. Please try again later.'
    }
})

// ─────────────────────────────────────────────────────────────
// Selective limiter middleware
// ─────────────────────────────────────────────────────────────

const applyAiLimiter = (req, res, next) => {
    // Limit only expensive AI generation and verification endpoints
    if (
        req.method === 'POST' &&
        (req.path === '/style-preview' || req.path === '/photo-verification')
    ) {
        return aiPreviewLimiter(req, res, next)
    }

    return next()
}

const applyAuthLimiter = (
    req,
    res,
    next
) => {
    if (req.method !== 'POST') {
        return next()
    }

    if (
        req.path === '/register/send-otp' ||
        req.path === '/password/send-otp' ||
        req.path === '/complete-profile/send-otp' ||
        req.path === '/me/phone/send-otp'
    ) {
        return otpLimiter(
            req,
            res,
            next
        )
    }

    if (
        req.path === '/login' ||
        req.path === '/password/reset'
    ) {
        return authLimiter(
            req,
            res,
            next
        )
    }

    return next()
}

const applyBookingLimiter = (
    req,
    res,
    next
) => {
    // Limit only POST /api/appointments.
    if (
        req.method === 'POST' &&
        req.path === '/'
    ) {
        return bookingLimiter(
            req,
            res,
            next
        )
    }

    return next()
}

const applyContactLimiter = (
    req,
    res,
    next
) => {
    if (
        req.method === 'POST' &&
        req.path === '/'
    ) {
        return contactLimiter(
            req,
            res,
            next
        )
    }

    return next()
}

// ─────────────────────────────────────────────────────────────
// General API protection
// ─────────────────────────────────────────────────────────────

app.use('/api', apiLimiter)

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

app.use(
    '/api/auth',
    applyAuthLimiter,
    require('./routes/auth')
)

app.use(
    '/api/appointments',
    applyBookingLimiter,
    require('./routes/appointments')
)

app.use(
    '/api/pets',
    require('./routes/pets')
)

app.use(
    '/api/ai',
    applyAiLimiter,
    require('./routes/ai')
)

app.use(
    '/api/admin',
    (req, res, next) => {
        try {
            delete require.cache[require.resolve('./routes/admin')]
        } catch (_) {}
        const adminRouter = require('./routes/admin')
        return adminRouter(req, res, next)
    }
)

app.use(
    '/api/contact',
    applyContactLimiter,
    require('./routes/contact')
)

app.use(
    '/api/notifications',
    require('./routes/notifications')
)

// ─────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message:
            'Timmy Tails API is running',
        environment:
            process.env.NODE_ENV ||
            'development',
        allowedOrigins,
        timestamp:
            new Date().toISOString()
    })
})

// ─────────────────────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    })
})

// ─────────────────────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────────────────────

app.use(
    (
        err,
        req,
        res,
        next
    ) => {
        console.error(
            err.stack || err
        )

        if (
            err.message?.includes(
                'not allowed by CORS'
            )
        ) {
            return res
                .status(403)
                .json({
                    success: false,
                    message:
                        'This website is not allowed to access the API.'
                })
        }

        return res
            .status(500)
            .json({
                success: false,
                message:
                    process.env
                        .NODE_ENV ===
                        'production'
                        ? 'Server error'
                        : err.message
            })
    }
)

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────

const PORT =
    process.env.PORT || 5000

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
        `Timmy Tails API running on port ${PORT} ` +
        `[${process.env.NODE_ENV || 'development'}]`
    )

    console.log(
        'Allowed frontend origins:',
        allowedOrigins
    )
})

server.headersTimeout = 300000
server.requestTimeout = 300000
server.keepAliveTimeout = 300000

module.exports = app