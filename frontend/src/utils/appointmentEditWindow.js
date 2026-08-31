const EDIT_WINDOW_MS = 3 * 60 * 1000 // 3 minutes

export function canEditAppointmentDate(appointment) {
    if (!appointment || !appointment.createdAt) return false
    if (['completed', 'cancelled'].includes(appointment.status)) return false

    const createdAt = new Date(appointment.createdAt).getTime()
    const elapsed = Date.now() - createdAt
    return elapsed >= 0 && elapsed <= EDIT_WINDOW_MS
}

export function getRemainingEditSeconds(appointment) {
    if (!appointment || !appointment.createdAt) return 0
    if (['completed', 'cancelled'].includes(appointment.status)) return 0

    const createdAt = new Date(appointment.createdAt).getTime()
    const elapsed = Date.now() - createdAt
    const remaining = EDIT_WINDOW_MS - elapsed
    return Math.max(0, Math.floor(remaining / 1000))
}

export function formatRemainingTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}m ${secs.toString().padStart(2, '0')}s`
}
