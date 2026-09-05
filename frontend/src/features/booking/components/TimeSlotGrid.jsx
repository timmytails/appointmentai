import { formatTimeRange } from '../utils/dateTime'

export default function TimeSlotGrid({ slots, selectedTime, onSelect, loading }) {
    if (loading) {
        return <div className='rounded-2xl border border-[#e5d6c5] bg-white p-8 text-center text-sm text-[#806654]'>Loading available time slots...</div>
    }

    if (!slots.length) {
        return <div className='rounded-2xl border border-[#e5d6c5] bg-white p-8 text-center text-sm text-[#806654]'>Select an available date to view time slots.</div>
    }

    return (
        <div className='grid gap-3 sm:grid-cols-2'>
            {slots.map((slot) => {
                const selected = selectedTime === slot.startTime
                const disabled = slot.status !== 'available'
                const className = selected
                    ? 'border-[#a84522] bg-[#bf5a31] text-white'
                    : slot.status === 'booked'
                        ? 'border-red-200 bg-red-50 text-red-500'
                        : slot.status === 'past'
                            ? 'border-stone-200 bg-stone-100 text-stone-400'
                            : 'border-[#e5d6c5] bg-white text-[#2d211a] hover:border-[#bd5a34]'

                return (
                    <button
                        key={`${slot.startTime}-${slot.endTime}`}
                        type='button'
                        disabled={disabled}
                        onClick={() => onSelect(slot.startTime)}
                        className={`rounded-xl border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed ${className}`}
                    >
                        {formatTimeRange(slot.startTime, slot.endTime)}
                        {slot.status === 'booked' && <span className='ml-2 text-xs font-medium'>(Booked)</span>}
                        {slot.status === 'past' && <span className='ml-2 text-xs font-medium'>(Passed)</span>}
                    </button>
                )
            })}
        </div>
    )
}
