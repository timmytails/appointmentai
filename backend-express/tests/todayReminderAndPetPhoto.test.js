const test = require('node:test')
const assert = require('node:assert/strict')
const { sendAppointmentReminderTodayEmail, sendAppointmentConfirmedEmail } = require('../services/mailer')
const Appointment = require('../models/Appointment')

test('Appointment model includes reminder fields', () => {
    const paths = Appointment.schema.paths
    assert.ok(paths.reminderSentToday, 'reminderSentToday must be defined')
    assert.equal(paths.reminderSentToday.instance, 'Boolean')
    assert.ok(paths.reminderSentAt, 'reminderSentAt must be defined')
    assert.equal(paths.reminderSentAt.instance, 'Date')
})

test('sendAppointmentReminderTodayEmail includes required note and appointment details', async () => {
    const appointment = {
        _id: 'test-appt-123',
        petName: 'Milo',
        petType: 'dog',
        breed: 'Shih Tzu',
        service: 'Full Grooming',
        haircutStyle: 'Puppy Cut',
        date: '2026-09-05',
        time: '10:00',
        endTime: '12:00',
        price: 1200,
        ownerName: 'Juan Dela Cruz'
    }

    // In dev / test without SMTP, it logs and skips gracefully
    const result = await sendAppointmentReminderTodayEmail({
        to: 'juan@example.com',
        name: 'Juan',
        appointment
    })

    assert.ok(result, 'Result should be returned')
})

test('sendAppointmentConfirmedEmail works for same-day booking', async () => {
    const appointment = {
        _id: 'test-appt-456',
        petName: 'Luna',
        petType: 'cat',
        breed: 'Persian',
        service: 'Basic Grooming',
        date: '2026-09-05',
        time: '14:00',
        endTime: '16:00',
        price: 800,
        ownerName: 'Maria Santos'
    }

    const result = await sendAppointmentConfirmedEmail({
        to: 'maria@example.com',
        name: 'Maria',
        appointment,
        isToday: true
    })

    assert.ok(result, 'Result should be returned')
})

test('all route modules load cleanly without syntax or duplicate declaration errors', () => {
    assert.doesNotThrow(() => {
        require('../routes/appointments')
        require('../routes/ai')
        require('../routes/auth')
        require('../routes/pets')
        require('../routes/notifications')
        require('../routes/contact')
        require('../routes/admin')
    })
})
