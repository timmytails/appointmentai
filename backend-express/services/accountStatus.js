const VALID_ACCOUNT_STATUSES = Object.freeze([
    'active',
    'warned',
    'booking_blocked',
    'banned'
])

const normalizeAccountStatus = (value) =>
    VALID_ACCOUNT_STATUSES.includes(value) ? value : 'active'

const buildStatusUpdate = ({ accountStatus, statusReason, warningMessage }) => {
    if (!VALID_ACCOUNT_STATUSES.includes(accountStatus)) {
        const error = new Error('Invalid account status option')
        error.code = 'INVALID_ACCOUNT_STATUS'
        throw error
    }

    const reason = accountStatus === 'active'
        ? ''
        : String(statusReason || warningMessage || '').trim()

    return {
        accountStatus,
        statusReason: reason,
        warningMessage: accountStatus === 'active'
            ? ''
            : String(warningMessage || statusReason || '').trim(),
        statusUpdatedAt: new Date()
    }
}


const toAccountStatusResponse = (user) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    accountStatus: normalizeAccountStatus(user.accountStatus),
    statusReason: user.statusReason || '',
    warningMessage: user.warningMessage || '',
    statusUpdatedAt: user.statusUpdatedAt || null
})

const persistAccountStatus = async (UserModel, userId, payload) => {
    const update = buildStatusUpdate(payload)

    const user = await UserModel.findByIdAndUpdate(
        userId,
        { $set: update },
        { new: true, runValidators: true }
    )

    if (!user) return null

    if (normalizeAccountStatus(user.accountStatus) !== update.accountStatus) {
        const error = new Error('Account status update did not persist')
        error.code = 'ACCOUNT_STATUS_NOT_PERSISTED'
        throw error
    }

    return user
}

module.exports = {
    VALID_ACCOUNT_STATUSES,
    normalizeAccountStatus,
    buildStatusUpdate,
    persistAccountStatus,
    toAccountStatusResponse
}
