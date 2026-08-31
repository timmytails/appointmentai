export const ACCOUNT_STATUSES = Object.freeze([
    'active',
    'warned',
    'booking_blocked',
    'banned'
])

export const normalizeAccountStatus = (value) =>
    ACCOUNT_STATUSES.includes(value) ? value : 'active'

export const getAccountStatusLabel = (value) => {
    const labels = {
        active: 'Active',
        warned: 'Warned',
        booking_blocked: 'Booking Blocked',
        banned: 'Banned'
    }

    return labels[normalizeAccountStatus(value)]
}

export const mergePersistedCustomerStatus = (customer, persistedUser) => ({
    ...customer,
    accountStatus: normalizeAccountStatus(persistedUser?.accountStatus),
    statusReason: persistedUser?.statusReason || '',
    warningMessage: persistedUser?.warningMessage || '',
    statusUpdatedAt: persistedUser?.statusUpdatedAt || customer?.statusUpdatedAt || null
})
