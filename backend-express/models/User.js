const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const addressSchema = new mongoose.Schema(
    {
        street: {
            type: String,
            trim: true,
            maxlength: [120, 'Street address cannot exceed 120 characters'],
            default: ''
        },
        barangay: {
            type: String,
            trim: true,
            maxlength: [80, 'Barangay cannot exceed 80 characters'],
            default: ''
        },
        city: {
            type: String,
            trim: true,
            maxlength: [80, 'City cannot exceed 80 characters'],
            default: ''
        },
        province: {
            type: String,
            trim: true,
            maxlength: [80, 'Province cannot exceed 80 characters'],
            default: ''
        }
    },
    { _id: false }
)

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
            maxlength: [50, 'First name cannot exceed 50 characters']
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
            maxlength: [50, 'Last name cannot exceed 50 characters']
        },
        email: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
            lowercase: true,
            trim: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email']
        },
        phone: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
            trim: true
        },
        password: {
            type: String,
            required: false,
            minlength: [8, 'Password must be at least 8 characters'],
            select: false
        },
        googleId: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
            select: false
        },
        authProvider: {
            type: String,
            enum: ['phone', 'google', 'legacy'],
            default: 'legacy'
        },
        address: {
            type: addressSchema,
            default: () => ({})
        },
        // Kept for backward compatibility with old records and old appointment snapshots.
        homeAddress: {
            type: String,
            trim: true,
            maxlength: [350, 'Home address cannot exceed 350 characters'],
            default: ''
        },
        profileImage: {
            type: String,
            default: ''
        },
        profileCompleted: {
            type: Boolean,
            default: false
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        },
        accountStatus: {
            type: String,
            enum: ['active', 'warned', 'booking_blocked', 'banned'],
            default: 'active'
        },
        statusReason: {
            type: String,
            default: ''
        },
        warningMessage: {
            type: String,
            default: ''
        },
        statusUpdatedAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
)

userSchema.pre('validate', function (next) {
    if (!this.email && !this.phone) {
        this.invalidate('phone', 'An email address or phone number is required')
    }

    if (this.isNew && this.authProvider !== 'google' && !this.password) {
        this.invalidate('password', 'Password is required')
    }

    next()
})

userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next()
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
})

userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false
    return bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('User', userSchema)
