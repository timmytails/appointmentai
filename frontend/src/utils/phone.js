export const normalizePhilippinePhone = (value) => {
    let digits = String(value || '').replace(/\D/g, '')

    if (digits.startsWith('63')) {
        digits = digits.slice(2)
    }

    if (digits.startsWith('0')) {
        digits = digits.slice(1)
    }

    if (!/^9\d{9}$/.test(digits)) {
        return ''
    }

    return `+63${digits}`
}

export const isValidPhilippinePhone = (value) =>
    Boolean(normalizePhilippinePhone(value))
