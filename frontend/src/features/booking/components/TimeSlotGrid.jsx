import { formatTimeRange } from '../utils/dateTime'

export default function TimeSlotGrid({ slots, selectedTime, onSelect, loading }) {
    if (loading) {
        return <div className='rounded-2xl border border-[#DDE4DE] bg-white p-8 text-center text-sm text-[#2F6B57]'>Loading available time slots...</div>
    }

    if (!slots.length) {
        return <div className='rounded-2xl border border-[#DDE4DE] bg-white p-8 text-center text-sm text-[#2F6B57]'>Select an available date to view time slots.</div>
    }

    return (
        <div className='grid gap-3 sm:grid-cols-2'>
            {slots.map((slot) => {
                const selected = selectedTime === slot.startTime
                const disabled = slot.status !== 'available'
                const className = selected
                    ? 'border-[#2F6B57] bg-[#2F6B57] text-[#F6F7F2]'
                    : slot.status === 'booked'
                        ? 'border-[#1F4D3E] bg-[#1F4D3E] text-white'
                        : slot.status === 'past'
                            ? 'border-[#1F4D3E] bg-[#1F4D3E] text-white'
                            : 'border-[#F6F7F2] bg-[#F6F7F2] text-[#13231B] hover:border-[#2F6B57]'

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
                    </button>
                )
            })}
        </div>
    )
}
