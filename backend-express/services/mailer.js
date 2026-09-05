const nodemailer = require('nodemailer')

let transporterInstance = null

const getTransporter = () => {
    if (transporterInstance) return transporterInstance

    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT) || 587
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!host || !user || !pass) {
        console.warn('[MAILER] SMTP credentials not fully configured in environment (SMTP_HOST, SMTP_USER, SMTP_PASS). Emails will be logged to console.')
        return null
    }

    transporterInstance = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
            user,
            pass
        }
    })

    return transporterInstance
}

const getSenderAddress = () => {
    return process.env.SMTP_FROM || `"Timmy Tails Pet Grooming" <${process.env.SMTP_USER || 'noreply@timmytails.com'}>`
}

/**
 * Send day-of appointment reminder email
 * Customer booked today or previous day, and today is their appointment day.
 */
const sendAppointmentReminderTodayEmail = async ({ to, name, appointment }) => {
    if (!to) {
        console.warn('[MAILER] No recipient email provided for appointment reminder:', appointment._id)
        return { delivered: false, skipped: true }
    }

    const clientName = name || appointment.ownerName || 'Valued Customer'
    const petName = appointment.petName || 'your pet'
    const petType = appointment.petType === 'cat' ? 'Cat' : 'Dog'
    const serviceName = appointment.service || 'Grooming Service'
    const haircutStyle = appointment.haircutStyle ? ` (${appointment.haircutStyle})` : ''
    const timeSlot = `${appointment.time} – ${appointment.endTime || ''}`
    const priceFormatted = Number(appointment.price || 0).toLocaleString('en-PH')

    const subject = `🐾 Reminder: Your grooming appointment for ${petName} is TODAY at ${appointment.time}`

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Appointment is Today</title>
</head>
<body style="margin:0;padding:0;background-color:#F8F7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#261C14;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8F7F4;padding:30px 15px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #E5D6C5;">
        <!-- Header -->
        <tr>
          <td style="background-color:#C25E2B;padding:28px 24px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">🐾 Timmy Tails Pet Grooming</h1>
            <p style="margin:6px 0 0 0;color:#FFE9DF;font-size:14px;font-weight:500;">Same-Day Appointment Reminder</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 28px;">
            <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:#261C14;">
              Hello <strong>${clientName}</strong>,
            </p>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;color:#4A3B32;">
              Today is the day! This is a friendly reminder that <strong>${petName}</strong> is scheduled for grooming today at Timmy Tails.
            </p>

            <!-- Prominent Warning Notice Box -->
            <div style="background-color:#FFF5F0;border:2px solid #E06D38;border-radius:12px;padding:18px 20px;margin:24px 0;">
              <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#B3471A;text-transform:uppercase;letter-spacing:0.5px;">
                ⚠️ Important Salon Policy Notice
              </p>
              <p style="margin:0;font-size:15px;font-weight:600;line-height:1.5;color:#93330C;">
                Please arrive 5–10 minutes before ${appointment.time} or the slot will be automatically cancelled and will open to others.
              </p>
            </div>

            <!-- Appointment Details Table -->
            <h3 style="margin:24px 0 12px 0;font-size:16px;color:#261C14;border-bottom:1px solid #F0E6DC;padding-bottom:8px;">
              📋 Appointment Details
            </h3>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="6" style="font-size:14px;color:#4A3B32;">
              <tr>
                <td style="width:38%;color:#8C7A6D;font-weight:600;">Pet Name:</td>
                <td style="color:#261C14;font-weight:700;">${petName} (${petType})</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Breed:</td>
                <td style="color:#261C14;">${appointment.breed || 'N/A'}</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Service:</td>
                <td style="color:#261C14;font-weight:600;">${serviceName}${haircutStyle}</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Date:</td>
                <td style="color:#C25E2B;font-weight:700;">Today (${appointment.date})</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Time Slot:</td>
                <td style="color:#C25E2B;font-weight:700;">${timeSlot}</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Total Amount:</td>
                <td style="color:#261C14;font-weight:700;">₱${priceFormatted}</td>
              </tr>
            </table>

            <!-- Salon Location & Contact -->
            <div style="margin-top:28px;padding:16px;background-color:#FAF7F2;border-radius:10px;font-size:13px;color:#68594E;line-height:1.5;">
              <p style="margin:0 0 6px 0;font-weight:700;color:#261C14;">📍 Salon Address &amp; Guidelines:</p>
              <p style="margin:0 0 6px 0;">Tangos, Baliuag City, Bulacan</p>
              <p style="margin:0;">Please bring your pet on a leash or inside a pet carrier, and ensure vaccinations are up to date.</p>
            </div>

            <p style="margin:28px 0 0 0;font-size:14px;line-height:1.5;color:#68594E;">
              We look forward to seeing you and ${petName} today! If you have questions, reply directly to this email or reach us at <a href="mailto:timmytails.cs@gmail.com" style="color:#C25E2B;text-decoration:none;font-weight:600;">timmytails.cs@gmail.com</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#FAF7F2;padding:20px 24px;text-align:center;font-size:12px;color:#8C7A6D;border-top:1px solid #E5D6C5;">
            <p style="margin:0 0 4px 0;">© ${new Date().getFullYear()} Timmy Tails Pet Grooming Salon. All rights reserved.</p>
            <p style="margin:0;">Tangos, Baliuag City, Bulacan, Philippines</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`

    const text = `
🐾 TIMMY TAILS PET GROOMING - APPOINTMENT TODAY REMINDER

Hello ${clientName},

Today is the day! This is a reminder that ${petName} is scheduled for grooming today at Timmy Tails.

⚠️ IMPORTANT NOTICE:
Please arrive 5-10 minutes before ${appointment.time} or the slot will be automatically cancel and will open to others.

APPOINTMENT DETAILS:
- Pet: ${petName} (${petType} - ${appointment.breed || 'N/A'})
- Service: ${serviceName}${haircutStyle}
- Date: Today (${appointment.date})
- Time: ${timeSlot}
- Total Price: ₱${priceFormatted}

Salon Address: Tangos, Baliuag City, Bulacan

See you soon!
Timmy Tails Pet Grooming Team
timmytails.cs@gmail.com
`

    const transporter = getTransporter()
    if (!transporter) {
        console.log(`[DEV EMAIL REMINDER] Sent to ${to} (${subject}):\n${text}`)
        return { delivered: false, skipped: true }
    }

    try {
        const info = await transporter.sendMail({
            from: getSenderAddress(),
            to,
            subject,
            text,
            html
        })
        console.log(`[MAILER] Reminder email sent to ${to}, messageId: ${info.messageId}`)
        return { delivered: true, messageId: info.messageId }
    } catch (error) {
        console.error(`[MAILER] Error sending reminder email to ${to}:`, error)
        throw error
    }
}

/**
 * Send appointment confirmation email when a booking is placed
 */
const sendAppointmentConfirmedEmail = async ({ to, name, appointment, isToday = false }) => {
    if (!to) return { delivered: false, skipped: true }

    const clientName = name || appointment.ownerName || 'Valued Customer'
    const petName = appointment.petName || 'your pet'
    const petType = appointment.petType === 'cat' ? 'Cat' : 'Dog'
    const serviceName = appointment.service || 'Grooming Service'
    const haircutStyle = appointment.haircutStyle ? ` (${appointment.haircutStyle})` : ''
    const timeSlot = `${appointment.time} – ${appointment.endTime || ''}`
    const priceFormatted = Number(appointment.price || 0).toLocaleString('en-PH')

    const subject = isToday
        ? `🐾 Booking Confirmed: Your appointment for ${petName} is TODAY at ${appointment.time}`
        : `🐾 Booking Confirmed: Grooming appointment for ${petName} on ${appointment.date}`

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Booking Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#F8F7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#261C14;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F8F7F4;padding:30px 15px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #E5D6C5;">
        <tr>
          <td style="background-color:#2B4C3F;padding:28px 24px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🐾 Timmy Tails Pet Grooming</h1>
            <p style="margin:6px 0 0 0;color:#D8E5DF;font-size:14px;">Appointment Booking Confirmation</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 28px;">
            <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;color:#261C14;">
              Hello <strong>${clientName}</strong>,
            </p>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;color:#4A3B32;">
              Thank you for choosing Timmy Tails! Your grooming appointment for <strong>${petName}</strong> has been successfully placed and is pending review by our staff.
            </p>

            ${isToday ? `
            <div style="background-color:#FFF5F0;border:2px solid #E06D38;border-radius:12px;padding:18px 20px;margin:24px 0;">
              <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#B3471A;text-transform:uppercase;">
                ⚠️ Note for Today's Appointment
              </p>
              <p style="margin:0;font-size:15px;font-weight:600;line-height:1.5;color:#93330C;">
                Please arrive 5–10 minutes before ${appointment.time} or the slot will be automatically cancelled and will open to others.
              </p>
            </div>
            ` : `
            <div style="background-color:#F5FAF7;border:1px solid #A3D4BE;border-radius:12px;padding:16px 20px;margin:20px 0;">
              <p style="margin:0;font-size:14px;line-height:1.5;color:#1B4332;">
                <strong>Friendly Note:</strong> We will send you an appointment reminder on the day of your booking. Please arrive 5–10 minutes before ${appointment.time} to keep your reserved slot.
              </p>
            </div>
            `}

            <h3 style="margin:24px 0 12px 0;font-size:16px;color:#261C14;border-bottom:1px solid #F0E6DC;padding-bottom:8px;">
              📋 Booking Summary
            </h3>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="6" style="font-size:14px;color:#4A3B32;">
              <tr>
                <td style="width:38%;color:#8C7A6D;font-weight:600;">Pet Name:</td>
                <td style="color:#261C14;font-weight:700;">${petName} (${petType})</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Breed:</td>
                <td style="color:#261C14;">${appointment.breed || 'N/A'}</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Service:</td>
                <td style="color:#261C14;font-weight:600;">${serviceName}${haircutStyle}</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Date:</td>
                <td style="color:#261C14;font-weight:700;">${appointment.date} ${isToday ? '(Today)' : ''}</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Time Slot:</td>
                <td style="color:#261C14;font-weight:700;">${timeSlot}</td>
              </tr>
              <tr>
                <td style="color:#8C7A6D;font-weight:600;">Total Amount:</td>
                <td style="color:#261C14;font-weight:700;">₱${priceFormatted}</td>
              </tr>
            </table>

            <div style="margin-top:28px;padding:16px;background-color:#FAF7F2;border-radius:10px;font-size:13px;color:#68594E;line-height:1.5;">
              <p style="margin:0 0 6px 0;font-weight:700;color:#261C14;">📍 Salon Address:</p>
              <p style="margin:0;">Tangos, Baliuag City, Bulacan, Philippines</p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="background-color:#FAF7F2;padding:20px 24px;text-align:center;font-size:12px;color:#8C7A6D;border-top:1px solid #E5D6C5;">
            <p style="margin:0 0 4px 0;">© ${new Date().getFullYear()} Timmy Tails Pet Grooming Salon. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`

    const transporter = getTransporter()
    if (!transporter) {
        console.log(`[DEV EMAIL CONFIRMATION] Sent to ${to} (${subject})`)
        return { delivered: false, skipped: true }
    }

    try {
        const info = await transporter.sendMail({
            from: getSenderAddress(),
            to,
            subject,
            html
        })
        return { delivered: true, messageId: info.messageId }
    } catch (error) {
        console.error(`[MAILER] Error sending confirmation email to ${to}:`, error)
        return { delivered: false, error: error.message }
    }
}

module.exports = {
    sendAppointmentReminderTodayEmail,
    sendAppointmentConfirmedEmail
}
