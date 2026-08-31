import { useEffect, useState } from 'react'
import { Calendar, CalendarDays, Clock3, MapPin, Phone, Scissors, Sparkles, User, XCircle } from 'lucide-react'
import { formatDateLong, formatTimeRange } from '../features/booking/utils/dateTime'
import { getRemainingEditSeconds, formatRemainingTime } from '../utils/appointmentEditWindow'

export default function AppointmentDetailsModal({ appointment, onClose, onCancel, onReschedule }) {
    if (!appointment) return null

    const [secondsLeft, setSecondsLeft] = useState(() => getRemainingEditSeconds(appointment))

    useEffect(() => {
        setSecondsLeft(getRemainingEditSeconds(appointment))
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
    }, [appointment])

    const statusLabel = appointment.status === 'confirmed' ? 'Approved' : appointment.status === 'pending' ? 'Pending' : appointment.status === 'completed' ? 'Completed' : 'Cancelled'
    const statusStyle =
        appointment.status === 'confirmed'
            ? 'bg-[#1F4D3E] text-[#1F4D3E] border-[#1F4D3E]'
            : appointment.status === 'pending'
            ? 'bg-[#E8795B] text-[#13231B] border-[#E8795B]'
            : appointment.status === 'completed'
            ? 'bg-[#E4F1EA] text-[#216245] border-[#C9E1D3]'
            : 'bg-[#FFF4DC] text-[#8A5D13] border-[#F0DEB6]'

    const isUpcoming = ['pending', 'confirmed'].includes(appointment.status)
    const isEditable = secondsLeft > 0 && isUpcoming

    return (
        <div
            className='fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#13231B]/40 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto'
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className='w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-[#F6F7F2] p-5 sm:p-6 border border-[#DDE4DE] space-y-4 text-[#13231B] pb-safe'>
                {/* Header */}
                <div className='flex items-start justify-between border-b border-[#2F6B57] pb-3.5 gap-3'>
                    <div>
                        <div className='flex items-center gap-2'>
                            <span className={`inline-block rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusStyle}`}>
                                {statusLabel}
                            </span>
                            {appointment._id && (
                                <span className='text-[10px] font-mono text-[#405148]'>
                                    ID: #{appointment._id.slice(-6).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <h2 className='mt-1.5 font-serif text-2xl font-bold text-[#13231B]'>
                            {appointment.petName}
                        </h2>
                        <p className='mt-0.5 text-[11px] font-semibold text-[#405148] uppercase tracking-wider'>
                            {appointment.petType === 'cat' ? 'Cat' : 'Dog'} {appointment.breed ? `· ${appointment.breed}` : ''}
                        </p>
                    </div>

                    {/* Top Right Action / Status Badge */}
                    {isUpcoming && isEditable && onReschedule && (
                        <button
                            onClick={() => {
                                onReschedule(appointment)
                                onClose()
                            }}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-[#E8795B] bg-[#E8795B] px-3 py-1.5 text-xs font-bold text-[#13231B] transition hover:bg-[#E8795B] shrink-0'
                        >
                            <Calendar size={14} className='text-[#13231B]' />
                            <span>Edit Date ({formatRemainingTime(secondsLeft)})</span>
                        </button>
                    )}
                    {isUpcoming && !isEditable && (
                        <span className='inline-block text-[11px] font-medium text-[#405148] bg-[#F6F7F2] px-2.5 py-1 rounded-md border border-[#DDE4DE] shrink-0' title='Rescheduling is only allowed within 3 minutes of booking.'>
                            Cannot be edited
                        </span>
                    )}
                </div>

                {/* Service & Price Details */}
                <div className='rounded-xl border border-[#DDE4DE] bg-white p-4 space-y-3'>
                    <div className='flex items-start justify-between gap-4'>
                        <div className='flex items-center gap-3'>
                            <span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#2F6B57] text-[#F6F7F2]'>
                                <Scissors size={16} />
                            </span>
                            <div>
                                <h3 className='font-serif text-base font-bold text-[#13231B]'>
                                    {appointment.service}
                                </h3>
                                {appointment.haircutStyle && (
                                    <p className='text-xs font-semibold text-[#2F6B57]'>
                                        Style: {appointment.haircutStyle}
                                    </p>
                                )}
                            </div>
                        </div>
                        <span className='font-serif text-xl font-bold text-[#13231B] shrink-0'>
                            ₱{Number(appointment.price || 0).toLocaleString('en-PH')}
                        </span>
                    </div>

                    <div className='grid gap-2 pt-2.5 border-t border-[#2F6B57] sm:grid-cols-2 text-xs text-[#405148] font-semibold'>
                        <div className='flex items-center gap-2'>
                            <CalendarDays size={14} className='text-[#2F6B57]' />
                            <span>{formatDateLong(appointment.date)}</span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <Clock3 size={14} className='text-[#2F6B57]' />
                            <span>{formatTimeRange(appointment.time, appointment.endTime)}</span>
                        </div>
                    </div>
                </div>

                {/* AI Preview Image (if available) */}
                {(appointment.aiPreviewImage || appointment.aiPreview?.generatedImage) && (
                    <div className='space-y-1.5'>
                        <div className='flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2F6B57]'>
                            <Sparkles size={13} />
                            <span>Requested Haircut Style Preview</span>
                        </div>
                        <div className='overflow-hidden rounded-xl border border-[#DDE4DE] bg-[#13231B] text-center p-2'>
                            <img
                                src={appointment.aiPreviewImage || appointment.aiPreview?.generatedImage}
                                alt='Haircut preview'
                                className='max-h-52 w-full object-contain mx-auto'
                            />
                        </div>
                    </div>
                )}

                {/* Customer Information */}
                <div className='space-y-2 pt-0.5'>
                    <h4 className='text-[10px] font-bold uppercase tracking-wider text-[#405148]'>
                        Customer & Appointment Info
                    </h4>
                    <div className='grid gap-2.5 text-xs text-[#405148] sm:grid-cols-2'>
                        {appointment.ownerName && (
                            <div className='flex items-center gap-2.5 rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] p-2.5'>
                                <User size={15} className='shrink-0 text-[#2F6B57]' />
                                <div>
                                    <p className='text-[9px] text-[#405148] uppercase font-bold'>Pet Owner</p>
                                    <p className='font-bold text-[#13231B]'>{appointment.ownerName}</p>
                                </div>
                            </div>
                        )}
                        {appointment.ownerPhone && (
                            <div className='flex items-center gap-2.5 rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] p-2.5'>
                                <Phone size={15} className='shrink-0 text-[#2F6B57]' />
                                <div>
                                    <p className='text-[9px] text-[#405148] uppercase font-bold'>Mobile Phone</p>
                                    <p className='font-bold text-[#13231B]'>{appointment.ownerPhone}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Notes */}
                {appointment.notes && (
                    <div className='rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] p-3 text-xs space-y-1'>
                        <p className='font-bold text-[#405148] uppercase tracking-wider text-[9px]'>Special Instructions</p>
                        <p className='text-[#405148] leading-relaxed'>&quot;{appointment.notes}&quot;</p>
                    </div>
                )}

                {/* Cancellation Reason Alert (if cancelled) */}
                {appointment.status === 'cancelled' && (
                    <div className='rounded-lg border border-[#F0CCCC] bg-[#FBEAEA] p-3 text-xs text-[#7F3333] space-y-1'>
                        <div className='flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] text-[#9E3E3E]'>
                            <XCircle size={14} />
                            <span>Cancellation Explanation</span>
                        </div>
                        <p className='leading-relaxed font-medium text-xs'>
                            {appointment.cancellationReason || 'This booking was cancelled.'}
                        </p>
                    </div>
                )}

                {/* Location & Arrival Policy Reminder */}
                <div className='rounded-lg border border-[#E8795B] bg-[#E8795B] p-3 text-xs text-[#13231B] space-y-1'>
                    <div className='flex items-center gap-2 font-bold text-[#13231B]'>
                        <MapPin size={15} className='shrink-0 text-[#2F6B57]' />
                        <span>TimmyTails · Baliuag City, Bulacan</span>
                    </div>
                    <p className='pl-5 text-[11px] text-[#13231B]/90 leading-normal'>
                        Please arrive <strong>5–10 minutes before</strong> your appointment. Late arrival beyond 10 minutes will automatically cancel your booking.
                    </p>
                </div>

                {/* Actions */}
                <div className='flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#2F6B57]'>
                    {isUpcoming && onCancel && (
                        <button
                            onClick={() => {
                                onCancel(appointment)
                                onClose()
                            }}
                            className='inline-flex items-center gap-1.5 rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 py-2 text-xs font-bold text-[#1F4D3E] transition hover:bg-[#1F4D3E] hover:border-[#2F6B57]'
                        >
                            <XCircle size={14} />
                            <span>Cancel Appointment</span>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className='rounded-lg bg-[#2F6B57] px-5 py-2 text-xs font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E]'
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
