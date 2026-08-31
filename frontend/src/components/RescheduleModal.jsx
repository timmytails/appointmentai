import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, Clock, AlertCircle, CheckCircle2, Scissors } from 'lucide-react'
import toast from 'react-hot-toast'

import { appointmentsApi, getErrorMessage } from '../utils/api'
import { getRemainingEditSeconds, formatRemainingTime } from '../utils/appointmentEditWindow'
import CustomCalendar, { toLocalDateString } from './CustomCalendar'

const TIME_SLOTS = [
    { value: '08:00', label: '08:00 AM – 10:00 AM' },
    { value: '10:00', label: '10:00 AM – 12:00 PM' },
    { value: '12:00', label: '12:00 PM – 02:00 PM' },
    { value: '14:00', label: '02:00 PM – 04:00 PM' }
]

export default function RescheduleModal({
    isOpen,
    appointment,
    onClose,
    onSuccess
}) {
    const [selectedDate, setSelectedDate] = useState('')
    const [selectedTime, setSelectedTime] = useState('')
    const [availableSlots, setAvailableSlots] = useState([])
    const [loadingSlots, setLoadingSlots] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Countdown Timer State
    const [secondsLeft, setSecondsLeft] = useState(0)

    useEffect(() => {
        if (!isOpen || !appointment) return

        setSelectedDate(appointment.date || toLocalDateString(new Date()))
        setSelectedTime(appointment.time || '')

        // Calculate initial remaining seconds
        const rem = getRemainingEditSeconds(appointment)
        setSecondsLeft(rem)

        const timer = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [isOpen, appointment])

    // Load available slots when date changes
    useEffect(() => {
        if (!selectedDate) return

        let mounted = true
        setLoadingSlots(true)

        appointmentsApi.getAvailability(selectedDate, appointment?.serviceId || appointment?.service)
            .then(({ data }) => {
                if (mounted) {
                    const slots = data?.slots || data?.availableSlots || []
                    setAvailableSlots(slots)
                }
            })
            .catch(() => {
                if (mounted) setAvailableSlots([])
            })
            .finally(() => {
                if (mounted) setLoadingSlots(false)
            })

        return () => { mounted = false }
    }, [selectedDate, appointment?.serviceId, appointment?.service])

    if (!isOpen || !appointment) return null

    const todayStr = toLocalDateString(new Date())
    const isExpired = secondsLeft <= 0

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (isExpired) {
            toast.error('The 3-minute edit window for this appointment has expired.')
            return
        }

        if (!selectedDate || !selectedTime) {
            toast.error('Please select both a date and a time slot.')
            return
        }

        if (selectedDate === appointment.date && selectedTime === appointment.time) {
            toast.error('You selected the same date and time slot.')
            return
        }

        setSubmitting(true)
        try {
            const { data } = await appointmentsApi.reschedule(appointment._id, {
                date: selectedDate,
                time: selectedTime
            })
            toast.success(data.message || 'Appointment successfully rescheduled!')
            onSuccess?.(data.appointment)
            onClose()
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div
            className='fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#13231B]/40 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto'
            onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose() }}
        >
            <div className='w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 border border-[#DDE4DE] space-y-4 text-[#13231B] my-0 sm:my-auto pb-safe shadow-xl'>
                {/* Header */}
                <div className='flex items-center gap-3 border-b border-[#DDE4DE] pb-3.5'>
                    <span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EDF3EE] text-[#1F4D3E] border border-[#C9D9CE]'>
                        <CalendarIcon size={20} />
                    </span>
                    <div>
                        <h3 className='font-serif text-xl font-bold text-[#13231B] leading-tight'>
                            Reschedule Booking
                        </h3>
                        <p className='text-xs text-[#68776F] font-medium mt-0.5'>
                            {appointment.service} for <strong className='text-[#13231B]'>{appointment.petName}</strong>
                        </p>
                    </div>
                </div>

                {/* 3-Minute Timer Banner */}
                {!isExpired ? (
                    <div className='flex items-center justify-between rounded-xl border border-[#F0DEB6] bg-[#FFF8EC] px-3.5 py-2.5 text-xs text-[#8A5D13] shadow-xs'>
                        <div className='flex items-center gap-2 font-bold'>
                            <Clock size={15} className='text-[#8A5D13] shrink-0' />
                            <span>Edit window remaining:</span>
                        </div>
                        <span className='font-mono font-bold text-[#8A5D13] bg-[#FFF0D1] border border-[#F0DEB6] px-2.5 py-0.5 rounded-lg text-xs'>
                            {formatRemainingTime(secondsLeft)}
                        </span>
                    </div>
                ) : (
                    <div className='flex items-center gap-2 rounded-xl border border-[#F0DEB6] bg-[#FFF4DC] p-3 text-xs text-[#6E4A0D] font-medium'>
                        <AlertCircle size={16} className='text-[#8A5D13] shrink-0' />
                        <span>The 3-minute edit window for this booking has expired.</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className='space-y-4'>
                    {/* Custom Interactive Calendar */}
                    <div>
                        <label className='block text-xs font-bold text-[#13231B] mb-2 flex items-center gap-1.5'>
                            <CalendarIcon size={14} className='text-[#1F4D3E]' /> 1. Select New Date
                        </label>
                        <CustomCalendar
                            value={selectedDate}
                            onChange={(dateStr) => {
                                setSelectedDate(dateStr)
                                setSelectedTime('')
                            }}
                            minDate={todayStr}
                            disabled={isExpired || submitting}
                        />
                    </div>

                    {/* Time Slot Picker */}
                    <div>
                        <label className='block text-xs font-bold text-[#13231B] mb-2 flex items-center gap-1.5'>
                            <Clock size={14} className='text-[#1F4D3E]' /> 2. Select Time Slot
                        </label>

                        {loadingSlots ? (
                            <div className='rounded-xl border border-[#DDE4DE] bg-[#FAFBF8] p-4 text-center text-xs text-[#68776F] italic'>
                                Checking slot availability...
                            </div>
                        ) : (
                            <div className='grid grid-cols-2 gap-2'>
                                {TIME_SLOTS.map((slot) => {
                                    const slotInfo = availableSlots.find((s) => s.startTime === slot.value)
                                    const isOwnCurrentSlot = selectedDate === appointment.date && slot.value === appointment.time
                                    const isAvailable = slotInfo ? (slotInfo.status === 'available' || isOwnCurrentSlot) : true
                                    const isSelected = selectedTime === slot.value
                                    const statusText = !isAvailable
                                        ? (slotInfo?.status === 'past' ? 'Past' : 'Booked')
                                        : isSelected
                                            ? 'Selected'
                                            : 'Available'

                                    return (
                                        <button
                                            key={slot.value}
                                            type='button'
                                            disabled={isExpired || submitting || !isAvailable}
                                            onClick={() => setSelectedTime(slot.value)}
                                            className={`rounded-xl border p-2.5 text-left text-xs transition ${
                                                isSelected
                                                    ? 'border-[#1F4D3E] bg-[#1F4D3E] text-white font-bold shadow-xs'
                                                    : isAvailable
                                                        ? 'border-[#DDE4DE] bg-white text-[#13231B] hover:border-[#1F4D3E] hover:bg-[#EDF3EE]/40'
                                                        : 'border-[#E5EAE6] bg-[#FAFBF8] text-[#9AA69F] cursor-not-allowed opacity-50 line-through'
                                            }`}
                                        >
                                            <div className='font-mono font-bold'>{slot.label}</div>
                                            <div className='text-[10px] mt-0.5 font-medium opacity-85'>
                                                {statusText}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className='flex flex-col-reverse sm:grid sm:grid-cols-2 gap-2.5 pt-3 border-t border-[#DDE4DE]'>
                        <button
                            type='button'
                            onClick={onClose}
                            disabled={submitting}
                            className='w-full rounded-xl border border-[#DDE4DE] bg-white px-4 py-2.5 text-xs font-bold text-[#405148] text-center transition hover:bg-[#F6F7F2] disabled:opacity-50'
                        >
                            Keep Date
                        </button>
                        <button
                            type='submit'
                            disabled={isExpired || submitting || !selectedDate || !selectedTime}
                            className='inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-[#1F4D3E] px-4 py-2.5 text-xs font-bold text-white text-center shadow-xs transition hover:bg-[#13231B] active:scale-[0.98] disabled:opacity-50'
                        >
                            <CheckCircle2 size={15} />
                            <span>{submitting ? 'Saving...' : 'Save New Date'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
