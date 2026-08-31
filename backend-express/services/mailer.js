const nodemailer = require('nodemailer')

// Create SMTP Transporter with fallback support
function createTransporter() {
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587)
    const user = process.env.SMTP_USER || process.env.EMAIL_USER
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS
    const service = process.env.SMTP_SERVICE || process.env.EMAIL_SERVICE // e.g. 'gmail'

    if (!user || !pass) {
        return null
    }

    if (service) {
        return nodemailer.createTransport({
            service,
            auth: { user, pass }
        })
    }

    return nodemailer.createTransport({
        host: host || 'smtp.gmail.com',
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
    })
}

let transporterInstance = null

function getTransporter() {
    if (!transporterInstance) {
        transporterInstance = createTransporter()
    }
    return transporterInstance
}

/**
 * Base email sending wrapper
 */
async function sendMail({ to, subject, html, text }) {
    if (!to) {
        console.warn('[Mailer] Missing recipient email address')
        return { success: false, reason: 'missing_recipient' }
    }

    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"TimmyTails Pet Grooming" <${process.env.SMTP_USER || 'timmytails.cs@gmail.com'}>`
    const replyTo = process.env.SMTP_USER || 'timmytails.cs@gmail.com'
    const activeTransporter = getTransporter()

    if (!activeTransporter) {
        console.log(`[Mailer] ✉️ (Preview Mode - configure SMTP_USER & SMTP_PASS in .env to send real emails)`)
        console.log(`  To: ${to}`)
        console.log(`  Subject: ${subject}`)
        return { success: true, preview: true }
    }

    try {
        const info = await activeTransporter.sendMail({
            from,
            to,
            replyTo,
            subject,
            text,
            html,
            headers: {
                'X-Entity-Ref-ID': `tt-${Date.now()}`,
                'X-Mailer': 'TimmyTails Mailer',
                'X-Auto-Response-Suppress': 'OOF, AutoReply'
            }
        })
        console.log(`[Mailer] ✅ Email delivered to ${to} (Message ID: ${info.messageId})`)
        return { success: true, messageId: info.messageId }
    } catch (error) {
        console.error(`[Mailer] ❌ Failed to send email to ${to}:`, error.message)
        return { success: false, error: error.message }
    }
}

function getAppUrl() {
    if (process.env.APP_URL) {
        return process.env.APP_URL.trim().replace(/\/+$/, '')
    }
    if (process.env.PUBLIC_FRONTEND_URL) {
        return process.env.PUBLIC_FRONTEND_URL.trim().replace(/\/+$/, '')
    }

    const origins = (process.env.FRONTEND_URL || 'http://localhost:5173')
        .split(',')
        .map((s) => s.trim().replace(/\/+$/, ''))
        .filter(Boolean)

    // Prefer live production HTTPS URL (e.g. https://timmytails.vercel.app)
    const productionOrigin = origins.find((origin) => origin.startsWith('https://'))
    if (productionOrigin) {
        return productionOrigin
    }

    return origins[0] || 'http://localhost:5173'
}

/**
 * Send Welcome Email upon Account Creation
 */
async function sendWelcomeEmail({ to, name }) {
    const displayName = name ? name.trim() : 'there'
    const frontendUrl = getAppUrl()

    const subject = 'Welcome to TimmyTails'
    const text = `Hi ${displayName},\n\nWelcome to TimmyTails! Your account is all set up. You can now save your pet profiles, visualize styles with our AI hairstyle preview, and schedule grooming sessions with ease.\n\nVisit your dashboard: ${frontendUrl}/dashboard\n\nWarmly,\nThe TimmyTails Team`

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to TimmyTails</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #13231B;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F6F7F2; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; border: 1px solid #DDE4DE; overflow: hidden; box-shadow: 0 10px 30px rgba(19, 35, 27, 0.05);" cellspacing="0" cellpadding="0">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #13231B; padding: 36px 40px; text-align: center;">
                            <h1 style="margin: 0; font-family: Georgia, serif; font-size: 28px; font-weight: bold; color: #F6F7F2; letter-spacing: -0.5px;">TimmyTails</h1>
                            <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #A9C6B4;">Pet Grooming Experience</p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="margin: 0 0 16px 0; font-family: Georgia, serif; font-size: 22px; color: #13231B;">Welcome, ${displayName}!</h2>
                            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #405148;">
                                We're thrilled to have you and your furry companions with us. Your TimmyTails account is now active and ready.
                            </p>

                            <div style="background-color: #FAFBF8; border: 1px solid #E5EAE6; border-radius: 16px; padding: 20px; margin-bottom: 25px;">
                                <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: bold; color: #1F4D3E; text-transform: uppercase; letter-spacing: 1px;">What you can do:</h3>
                                <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8; color: #405148;">
                                    <li><strong>Save Pet Profiles:</strong> Keep coat type, vaccination notes, and photos organized.</li>
                                    <li><strong>AI Style Previews:</strong> Visualize haircut styles before your visit.</li>
                                    <li><strong>Easy Booking:</strong> Reserve slots and manage appointments seamlessly.</li>
                                </ul>
                            </div>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 20px 0;">
                                        <a href="${frontendUrl}/dashboard" style="display: inline-block; background-color: #1F4D3E; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(31, 77, 62, 0.2);">
                                            Go to Your Dashboard →
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.6; color: #68776F;">
                                If you ever have questions or need assistance, reply directly to this email or reach out to us at Tangos, Baliuag City, Bulacan.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #FAFBF8; border-top: 1px solid #E5EAE6; padding: 24px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 600; color: #68776F;">TimmyTails Pet Grooming</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #9AA69F;">Tangos, Baliuag City, Bulacan · +63 975 669 2647</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

    return sendMail({ to, subject, html, text })
}

/**
 * Send Appointment Cancellation Notification Email
 */
async function sendAppointmentCancelledEmail({ to, name, appointment, reason }) {
    const displayName = name ? name.trim() : 'Valued Customer'
    const frontendUrl = getAppUrl()

    const petName = appointment?.petName || 'your pet'
    const serviceName = appointment?.service || 'Grooming Visit'
    const dateFormatted = appointment?.date || 'Scheduled Date'
    const timeFormatted = appointment?.time ? `${appointment.time}${appointment.endTime ? ` – ${appointment.endTime}` : ''}` : 'Scheduled Time'

    const subject = `Appointment Cancelled: ${serviceName} for ${petName}`
    const text = `Hi ${displayName},\n\nYour ${serviceName} appointment for ${petName} on ${dateFormatted} at ${timeFormatted} has been cancelled.\n${reason ? `Reason: ${reason}\n\n` : '\n'}If you'd like to reschedule or choose another date, please visit: ${frontendUrl}/booking\n\nWarmly,\nTimmyTails Team`

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Cancelled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #13231B;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F6F7F2; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; border: 1px solid #DDE4DE; overflow: hidden; box-shadow: 0 10px 30px rgba(19, 35, 27, 0.05);" cellspacing="0" cellpadding="0">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #13231B; padding: 36px 40px; text-align: center;">
                            <h1 style="margin: 0; font-family: Georgia, serif; font-size: 28px; font-weight: bold; color: #F6F7F2; letter-spacing: -0.5px;">TimmyTails</h1>
                            <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #A9C6B4;">Appointment Update</p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <div style="display: inline-block; background-color: #FBEAEA; border: 1px solid #F0CCCC; border-radius: 8px; padding: 4px 12px; margin-bottom: 16px;">
                                <span style="font-size: 11px; font-weight: 700; color: #9E3E3E; text-transform: uppercase; letter-spacing: 1px;">Booking Cancelled</span>
                            </div>

                            <h2 style="margin: 0 0 14px 0; font-family: Georgia, serif; font-size: 22px; color: #13231B;">Appointment Cancelled</h2>
                            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #405148;">
                                Hi ${displayName}, your scheduled grooming appointment has been cancelled.
                            </p>

                            <!-- Appointment Summary Box -->
                            <div style="background-color: #FAFBF8; border: 1px solid #E5EAE6; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Pet:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${petName}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Service:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${serviceName}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Date:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${dateFormatted}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Time Slot:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${timeFormatted}</td>
                                    </tr>
                                </table>
                            </div>

                            ${reason ? `
                            <div style="background-color: #FFF8EC; border: 1px solid #F0DEB6; border-radius: 12px; padding: 14px 16px; margin-bottom: 25px;">
                                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #8A5D13;">Cancellation Reason:</p>
                                <p style="margin: 4px 0 0 0; font-size: 13px; color: #6E4A0D; line-height: 1.5;">${reason}</p>
                            </div>` : ''}

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 20px 0;">
                                        <a href="${frontendUrl}/booking" style="display: inline-block; background-color: #1F4D3E; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(31, 77, 62, 0.2);">
                                            Book a New Appointment →
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.6; color: #68776F;">
                                Need to talk to us? Reach us at +63 975 669 2647 or reply to this message.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #FAFBF8; border-top: 1px solid #E5EAE6; padding: 24px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 600; color: #68776F;">TimmyTails Pet Grooming</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #9AA69F;">Tangos, Baliuag City, Bulacan · +63 975 669 2647</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

    return sendMail({ to, subject, html, text })
}

/**
 * Send Appointment Confirmation & Receipt Email
 */
async function sendAppointmentConfirmedEmail({ to, name, appointment }) {
    const displayName = name ? name.trim() : 'Valued Customer'
    const frontendUrl = getAppUrl()

    const petName = appointment?.petName || 'your pet'
    const breed = appointment?.breed ? ` (${appointment.breed})` : ''
    const serviceName = appointment?.service || 'Grooming Visit'
    const haircutStyle = appointment?.haircutStyle ? appointment.haircutStyle : null
    const dateFormatted = appointment?.date || 'Scheduled Date'
    const timeFormatted = appointment?.time ? `${appointment.time}${appointment.endTime ? ` – ${appointment.endTime}` : ''}` : 'Scheduled Time'
    const priceFormatted = appointment?.price ? `₱${Number(appointment.price).toLocaleString('en-PH')}` : ''

    const subject = `Booking Confirmed: ${serviceName} for ${petName}`
    const text = `Hi ${displayName},\n\nYour ${serviceName} booking for ${petName} on ${dateFormatted} at ${timeFormatted} is confirmed!\n\nArrival Policy: Please arrive 5–10 minutes before your scheduled appointment time at Tangos, Baliuag City, Bulacan.\n\nView your appointments: ${frontendUrl}/appointments\n\nWarmly,\nTimmyTails Team`

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #13231B;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F6F7F2; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; border: 1px solid #DDE4DE; overflow: hidden; box-shadow: 0 10px 30px rgba(19, 35, 27, 0.05);" cellspacing="0" cellpadding="0">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #13231B; padding: 36px 40px; text-align: center;">
                            <h1 style="margin: 0; font-family: Georgia, serif; font-size: 28px; font-weight: bold; color: #F6F7F2; letter-spacing: -0.5px;">TimmyTails</h1>
                            <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #A9C6B4;">Appointment Confirmed</p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <div style="display: inline-block; background-color: #EDF3EE; border: 1px solid #C9D9CE; border-radius: 8px; padding: 4px 12px; margin-bottom: 16px;">
                                <span style="font-size: 11px; font-weight: 700; color: #1F4D3E; text-transform: uppercase; letter-spacing: 1px;">✓ Reserved & Scheduled</span>
                            </div>

                            <h2 style="margin: 0 0 14px 0; font-family: Georgia, serif; font-size: 22px; color: #13231B;">Your visit is all set!</h2>
                            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #405148;">
                                Hi ${displayName}, we’re looking forward to welcoming <strong>${petName}</strong> for their grooming session.
                            </p>

                            <!-- Appointment Summary Box -->
                            <div style="background-color: #FAFBF8; border: 1px solid #E5EAE6; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Pet:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${petName}${breed}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Service:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${serviceName}</td>
                                    </tr>
                                    ${haircutStyle ? `
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Hairstyle:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${haircutStyle}</td>
                                    </tr>` : ''}
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Date:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${dateFormatted}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Time Slot:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${timeFormatted}</td>
                                    </tr>
                                    ${priceFormatted ? `
                                    <tr>
                                        <td style="padding: 8px 0 0 0; font-size: 12px; font-weight: 700; color: #1F4D3E; border-top: 1px dashed #DDE4DE;">Total Price:</td>
                                        <td style="padding: 8px 0 0 0; font-size: 15px; font-weight: bold; color: #1F4D3E; text-align: right; border-top: 1px dashed #DDE4DE;">${priceFormatted}</td>
                                    </tr>` : ''}
                                </table>
                            </div>

                            <!-- Arrival Policy Banner -->
                            <div style="background-color: #FFF9EC; border: 1px solid #F0DEB6; border-radius: 14px; padding: 14px 16px; margin-bottom: 25px;">
                                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #8A5D13;">Arrival Guideline</p>
                                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6E4A0D; line-height: 1.5;">
                                    Please arrive <strong>5–10 minutes before</strong> your scheduled time. Late arrival beyond 10 minutes may result in cancellation to respect other booked slots.
                                </p>
                            </div>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 20px 0;">
                                        <a href="${frontendUrl}/appointments" style="display: inline-block; background-color: #1F4D3E; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(31, 77, 62, 0.2);">
                                            View Your Appointments →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #FAFBF8; border-top: 1px solid #E5EAE6; padding: 24px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 600; color: #68776F;">TimmyTails Pet Grooming</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #9AA69F;">Tangos, Baliuag City, Bulacan · +63 975 669 2647</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

    return sendMail({ to, subject, html, text })
}

/**
 * Send Appointment Rescheduled Notification Email
 */
async function sendAppointmentRescheduledEmail({ to, name, appointment, oldDate, oldTime }) {
    const displayName = name ? name.trim() : 'Valued Customer'
    const frontendUrl = getAppUrl()

    const petName = appointment?.petName || 'your pet'
    const serviceName = appointment?.service || 'Grooming Visit'
    const newDate = appointment?.date || 'New Scheduled Date'
    const newTime = appointment?.time ? `${appointment.time}${appointment.endTime ? ` – ${appointment.endTime}` : ''}` : 'New Time'

    const subject = `Appointment Rescheduled: ${serviceName} for ${petName}`
    const text = `Hi ${displayName},\n\nYour ${serviceName} appointment for ${petName} has been successfully rescheduled.\n\nNew Schedule: ${newDate} at ${newTime}\n\nView appointment: ${frontendUrl}/appointments\n\nWarmly,\nTimmyTails Team`

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Rescheduled</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #13231B;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F6F7F2; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; border: 1px solid #DDE4DE; overflow: hidden; box-shadow: 0 10px 30px rgba(19, 35, 27, 0.05);" cellspacing="0" cellpadding="0">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #13231B; padding: 36px 40px; text-align: center;">
                            <h1 style="margin: 0; font-family: Georgia, serif; font-size: 28px; font-weight: bold; color: #F6F7F2; letter-spacing: -0.5px;">TimmyTails</h1>
                            <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #A9C6B4;">Schedule Updated</p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <div style="display: inline-block; background-color: #EDF3EE; border: 1px solid #C9D9CE; border-radius: 8px; padding: 4px 12px; margin-bottom: 16px;">
                                <span style="font-size: 11px; font-weight: 700; color: #1F4D3E; text-transform: uppercase; letter-spacing: 1px;">Schedule Updated</span>
                            </div>

                            <h2 style="margin: 0 0 14px 0; font-family: Georgia, serif; font-size: 22px; color: #13231B;">New Schedule Confirmed</h2>
                            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #405148;">
                                Hi ${displayName}, your appointment for <strong>${petName}</strong> has been updated to your new selected slot.
                            </p>

                            <!-- New Schedule Summary -->
                            <div style="background-color: #FAFBF8; border: 1px solid #E5EAE6; border-radius: 16px; padding: 20px; margin-bottom: 25px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">Pet & Service:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #13231B; text-align: right;">${petName} · ${serviceName}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">New Date:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #1F4D3E; text-align: right;">${newDate}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; font-size: 12px; color: #68776F;">New Time:</td>
                                        <td style="padding: 6px 0; font-size: 13px; font-weight: bold; color: #1F4D3E; text-align: right;">${newTime}</td>
                                    </tr>
                                </table>
                            </div>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 20px 0;">
                                        <a href="${frontendUrl}/appointments" style="display: inline-block; background-color: #1F4D3E; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(31, 77, 62, 0.2);">
                                            View Updated Booking →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #FAFBF8; border-top: 1px solid #E5EAE6; padding: 24px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 600; color: #68776F;">TimmyTails Pet Grooming</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #9AA69F;">Tangos, Baliuag City, Bulacan · +63 975 669 2647</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

    return sendMail({ to, subject, html, text })
}

/**
 * Send Post-Grooming Completion & Care Tips Email
 */
async function sendAppointmentCompletedEmail({ to, name, appointment }) {
    const displayName = name ? name.trim() : 'Valued Customer'
    const frontendUrl = getAppUrl()

    const petName = appointment?.petName || 'your pet'
    const serviceName = appointment?.service || 'Grooming Visit'

    const subject = `Thank you for visiting TimmyTails! 🐾`
    const text = `Hi ${displayName},\n\nWe loved pampering ${petName} today for their ${serviceName} session!\n\nTo keep their coat healthy, we recommend daily brushing and booking their next session in 4–6 weeks.\n\nBook your next visit: ${frontendUrl}/booking\n\nWarmly,\nTimmyTails Team`

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You for Visiting</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F7F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #13231B;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F6F7F2; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 24px; border: 1px solid #DDE4DE; overflow: hidden; box-shadow: 0 10px 30px rgba(19, 35, 27, 0.05);" cellspacing="0" cellpadding="0">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #13231B; padding: 36px 40px; text-align: center;">
                            <h1 style="margin: 0; font-family: Georgia, serif; font-size: 28px; font-weight: bold; color: #F6F7F2; letter-spacing: -0.5px;">TimmyTails</h1>
                            <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #A9C6B4;">Visit Completed</p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 40px 40px 30px 40px;">
                            <h2 style="margin: 0 0 14px 0; font-family: Georgia, serif; font-size: 22px; color: #13231B;">Thank you, ${displayName}!</h2>
                            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #405148;">
                                We had a wonderful time taking care of <strong>${petName}</strong> during their <strong>${serviceName}</strong> session today.
                            </p>

                            <!-- Care Tips Box -->
                            <div style="background-color: #FAFBF8; border: 1px solid #E5EAE6; border-radius: 16px; padding: 20px; margin-bottom: 25px;">
                                <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: bold; color: #1F4D3E; text-transform: uppercase; letter-spacing: 1px;">💡 Coat Care Tips:</h3>
                                <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8; color: #405148;">
                                    <li>Regular gentle brushing prevents tangles and keeps the coat shiny.</li>
                                    <li>Ensure ears and paws stay dry after outdoor walks.</li>
                                    <li><strong>Next Visit Recommended:</strong> In 4–6 weeks to maintain coat hygiene and styling.</li>
                                </ul>
                            </div>

                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 20px 0;">
                                        <a href="${frontendUrl}/booking" style="display: inline-block; background-color: #1F4D3E; color: #ffffff; font-size: 13px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 14px; box-shadow: 0 4px 12px rgba(31, 77, 62, 0.2);">
                                            Book Next Appointment →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #FAFBF8; border-top: 1px solid #E5EAE6; padding: 24px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; font-weight: 600; color: #68776F;">TimmyTails Pet Grooming</p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #9AA69F;">Tangos, Baliuag City, Bulacan · +63 975 669 2647</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`

    return sendMail({ to, subject, html, text })
}

module.exports = {
    sendMail,
    sendWelcomeEmail,
    sendAppointmentCancelledEmail,
    sendAppointmentConfirmedEmail,
    sendAppointmentRescheduledEmail,
    sendAppointmentCompletedEmail
}
