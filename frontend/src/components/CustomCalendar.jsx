import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Helper to format Date to YYYY-MM-DD in local time
export function toLocalDateString(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export default function CustomCalendar({
    value = '',
    onChange,
    minDate = toLocalDateString(new Date()),
    maxDate,
    disabled = false
}) {
    // Current viewed month/year in calendar view
    const initialDate = value ? new Date(`${value}T00:00:00`) : new Date()
    const [viewYear, setViewYear] = useState(initialDate.getFullYear())
    const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

    const todayStr = useMemo(() => toLocalDateString(new Date()), [])

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11)
            setViewYear(viewYear - 1)
        } else {
            setViewMonth(viewMonth - 1)
        }
    }

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0)
            setViewYear(viewYear + 1)
        } else {
            setViewMonth(viewMonth + 1)
        }
    }

    // Build grid cells for the current month view
    const gridCells = useMemo(() => {
        const firstDayOfMonth = new Date(viewYear, viewMonth, 1)
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
        const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Sun, 1 = Mon...

        const cells = []

        // Empty padding cells before 1st of month
        for (let i = 0; i < startDayOfWeek; i++) {
            cells.push({ type: 'empty', key: `empty-${i}` })
        }

        // Days of current month
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(viewYear, viewMonth, day)
            const dateStr = toLocalDateString(dateObj)

            const isPast = dateStr < minDate
            const isFutureMax = maxDate ? dateStr > maxDate : false
            const isDisabledDay = isPast || isFutureMax || disabled
            const isToday = dateStr === todayStr
            const isSelected = value === dateStr

            cells.push({
                type: 'day',
                key: dateStr,
                dateStr,
                dayNumber: day,
                isDisabled: isDisabledDay,
                isToday,
                isSelected
            })
        }

        return cells
    }, [viewYear, viewMonth, minDate, maxDate, value, todayStr, disabled])

    // Can go to previous month? Check if viewMonth is already <= minDate's month
    const minDateObj = useMemo(() => new Date(`${minDate}T00:00:00`), [minDate])
    const canPrevMonth = useMemo(() => {
        const firstOfView = new Date(viewYear, viewMonth, 1)
        const firstOfMin = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), 1)
        return firstOfView > firstOfMin
    }, [viewYear, viewMonth, minDateObj])

    return (
        <div className='w-full rounded-2xl border border-[#DDE4DE] bg-white p-4 text-[#13231B] shadow-xs select-none'>
            {/* Header: Month/Year navigation */}
            <div className='flex items-center justify-between pb-3 border-b border-[#DDE4DE] mb-3'>
                <button
                    type='button'
                    onClick={handlePrevMonth}
                    disabled={!canPrevMonth || disabled}
                    className='grid h-8 w-8 place-items-center rounded-xl border border-[#DDE4DE] bg-white text-[#405148] transition hover:bg-[#F6F7F2] disabled:opacity-30 disabled:cursor-not-allowed'
                    aria-label='Previous Month'
                >
                    <ChevronLeft size={16} />
                </button>

                <h4 className='font-serif text-sm font-bold text-[#13231B]'>
                    {monthNames[viewMonth]} {viewYear}
                </h4>

                <button
                    type='button'
                    onClick={handleNextMonth}
                    disabled={disabled}
                    className='grid h-8 w-8 place-items-center rounded-xl border border-[#DDE4DE] bg-white text-[#405148] transition hover:bg-[#F6F7F2] disabled:opacity-30 disabled:cursor-not-allowed'
                    aria-label='Next Month'
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Days of week header */}
            <div className='grid grid-cols-7 gap-1 text-center mb-1.5'>
                {dayNames.map((d) => (
                    <span key={d} className='text-[10px] font-bold uppercase tracking-wider text-[#68776F]'>
                        {d}
                    </span>
                ))}
            </div>

            {/* Calendar Days Grid */}
            <div className='grid grid-cols-7 gap-1'>
                {gridCells.map((cell) => {
                    if (cell.type === 'empty') {
                        return <div key={cell.key} className='h-9 w-full' />
                    }

                    return (
                        <button
                            key={cell.key}
                            type='button'
                            disabled={cell.isDisabled}
                            onClick={() => !cell.isDisabled && onChange?.(cell.dateStr)}
                            className={`relative grid h-9 w-full place-items-center rounded-xl text-xs font-semibold transition-all ${
                                cell.isSelected
                                    ? 'bg-[#1F4D3E] text-white font-bold shadow-xs scale-105 z-10'
                                    : cell.isDisabled
                                        ? 'text-[#BAC5BE] bg-transparent cursor-not-allowed line-through opacity-50'
                                        : cell.isToday
                                            ? 'border-2 border-[#1F4D3E] bg-[#EDF3EE] text-[#1F4D3E] font-bold hover:bg-[#EDF3EE]'
                                            : 'bg-[#FAFBF8] text-[#13231B] border border-[#E5EAE6] hover:border-[#1F4D3E] hover:bg-[#EDF3EE]/50'
                            }`}
                        >
                            <span>{cell.dayNumber}</span>
                            {cell.isToday && !cell.isSelected && (
                                <span className='absolute bottom-1 h-1 w-1 rounded-full bg-[#1F4D3E]' />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
