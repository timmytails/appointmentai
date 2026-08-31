import { useState, useEffect } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'

const QUICK_REASONS = [
    'Late arrival (10+ mins no-show)',
    'Schedule conflict / Fully booked',
    'Groomer unavailable / sick leave',
    'Customer requested cancellation',
    'Pet health or safety condition',
    'Facility emergency closure'
]

export default function AdminCancelModal({
    isOpen,
    appointment,
    loading = false,
    onConfirm,
    onClose
}) {
    const [reason, setReason] = useState('')

    useEffect(() => {
        if (isOpen) {
            setReason('')
        }
    }, [isOpen])

    if (!isOpen || !appointment) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        onConfirm(reason.trim() || 'Cancelled by admin')
    }

    return (
        <div
            className='fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#13231B]/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto'
            onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
        >
            <div className='w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-2xl border border-[#DDE4DE] space-y-4 text-[#13231B] pb-safe sm:pb-6 my-0 sm:my-auto'>
                {/* Header */}
                <div className='flex items-center gap-3.5 border-b border-[#DDE4DE] pb-3.5'>
                    <span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FBEAEA] text-[#9E3E3E] border border-[#F0CCCC]'>
                        <AlertTriangle size={20} />
                    </span>
                    <div>
                        <h3 className='font-serif text-lg font-bold text-[#13231B] leading-tight'>
                            Cancel Appointment
                        </h3>
                        <p className='text-xs text-[#68776F] font-medium mt-0.5'>
                            {appointment.service} for <strong className='text-[#13231B]'>{appointment.petName}</strong>
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className='space-y-4'>
                    {/* Reason Input */}
                    <div>
                        <label className='block text-xs font-bold uppercase tracking-wider text-[#405148] mb-1.5'>
                            Reason for Cancellation <span className='text-[#9E3E3E]'>*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder='State why this booking is being cancelled. This message will be sent via email to the pet owner...'
                            rows={3}
                            required
                            className='w-full rounded-xl border border-[#DDE4DE] bg-[#FAFBF8] p-3 text-xs text-[#13231B] outline-none transition focus:border-[#9E3E3E] focus:bg-white focus:ring-1 focus:ring-[#9E3E3E]/20 placeholder:text-[#A6B1AA]'
                        />
                        <p className='mt-1 text-[11px] text-[#68776F] italic'>
                            This explanation will be stored and emailed directly to the customer.
                        </p>
                    </div>

                    {/* Quick Selection Chips */}
                    <div>
                        <p className='text-[10px] font-bold uppercase tracking-wider text-[#405148] mb-2'>
                            Quick Reason Suggestions:
                        </p>
                        <div className='flex flex-wrap gap-1.5'>
                            {QUICK_REASONS.map((quickText) => (
                                <button
                                    key={quickText}
                                    type='button'
                                    onClick={() => setReason(quickText)}
                                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                                        reason === quickText
                                            ? 'border-[#9E3E3E] bg-[#FBEAEA] text-[#9E3E3E] font-bold shadow-xs'
                                            : 'border-[#DDE4DE] bg-white text-[#405148] hover:border-[#B8C7BE] hover:bg-[#FAFBF8]'
                                    }`}
                                >
                                    {quickText}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className='flex flex-col-reverse sm:grid sm:grid-cols-2 gap-2.5 pt-3 border-t border-[#DDE4DE]'>
                        <button
                            type='button'
                            onClick={onClose}
                            disabled={loading}
                            className='w-full rounded-xl border border-[#DDE4DE] bg-white px-3 py-2.5 text-xs font-bold text-[#405148] text-center transition hover:bg-[#F6F7F2] disabled:opacity-50'
                        >
                            Keep Booking
                        </button>
                        <button
                            type='submit'
                            disabled={loading || !reason.trim()}
                            className='inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-[#9E3E3E] px-3 py-2.5 text-xs font-bold text-white text-center shadow-xs transition hover:bg-[#7F3333] active:scale-[0.98] disabled:opacity-50'
                        >
                            <XCircle size={15} />
                            <span>{loading ? 'Cancelling...' : 'Confirm Cancel'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
