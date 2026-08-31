export const pad = (value) => String(value).padStart(2, '0')

export const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const fromDateKey = (key) => {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date()
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export const toMonthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

export const monthFromKey = (key) => {
    const [year, month] = key.split('-').map(Number)
    return new Date(year, month - 1, 1, 12, 0, 0, 0)
}

export const addDays = (date, days) => {
    const copy = new Date(date)
    copy.setDate(copy.getDate() + days)
    return copy
}

export const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1, 12)

export const formatDateLong = (key) => fromDateKey(key).toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
})

export const formatTimeRange = (start, end) => {
    if (!start) return 'Not available'
    if (!end) return formatTime(start)
    return `${formatTime(start)} – ${formatTime(end)}`
}

export const formatTime = (value) => {
    if (!value) return 'Not available'
    const normalized = String(value).trim()
    if (/\b(?:AM|PM)\b/i.test(normalized)) return normalized
    const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return normalized
    const hours = Number(match[1])
    const minutes = Number(match[2])
    const suffix = hours >= 12 ? 'PM' : 'AM'
    const displayHour = hours % 12 || 12
    return `${displayHour}:${pad(minutes)} ${suffix}`
}
