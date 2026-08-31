const normalizePhone = (phone) => {
    let cleaned = String(phone || '').trim().replace(/[^\d\+]/g, '')

    if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`

    if (!cleaned.startsWith('+')) {
        if (cleaned.startsWith('0')) {
            cleaned = `+63${cleaned.slice(1)}`
        } else if (cleaned.startsWith('63')) {
            cleaned = `+${cleaned}`
        }
    }

    return cleaned
}

const sendOtp = async ({ phone, code, purpose }) => {
    const apiKey = process.env.TEXTBEE_API_KEY || process.env.TEXTBEE_API_TOKEN || process.env.TEXTBEE_TOKEN
    const deviceId = process.env.TEXTBEE_DEVICE_ID || process.env.TEXTBEE_DEVICE
    const allowLogOnly = process.env.TEXTBEE_LOG_ONLY === 'true'

    const recipient = normalizePhone(phone)
    const message = purpose === 'signup'
        ? `Your Timmy Tails account OTP is ${code}. It expires in 10 minutes.`
        : purpose === 'profile_phone'
            ? `Your Timmy Tails mobile verification OTP is ${code}. It expires in 10 minutes.`
            : `Your Timmy Tails password reset OTP is ${code}. It expires in 10 minutes.`

    if (!apiKey || !deviceId) {
        if (allowLogOnly && (process.env.NODE_ENV || 'development') !== 'production') {
            console.log(`[DEV OTP] ${recipient} (${purpose}): ${code}`)
            return { delivered: false, skipped: true }
        }

        throw new Error('TextBee is not configured. Set TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID.')
    }

    const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "x-api-key": apiKey
        },
        body: JSON.stringify({
            recipients: [recipient],
            message
        })
    })

    if (!response.ok) {
        const raw = await response.text()
        throw new Error(`TextBee send failed (${response.status}): ${raw}`)
    }

    return { delivered: true, skipped: false }
}

module.exports = { sendOtp }