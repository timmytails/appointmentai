import { useMemo } from 'react'

export default function PhoneField({
    label = 'Phone Number',
    name = 'phone',
    value = '',
    onChange,
    required = true,
    disabled = false,
    placeholder = '917 123 4567',
    help,
    error,
    className = ''
}) {
    // Extract local 10 digits for display (strip +63, 63, or leading 0)
    const displayValue = useMemo(() => {
        let digits = String(value || '').replace(/\D/g, '')
        if (digits.startsWith('63')) digits = digits.slice(2)
        if (digits.startsWith('0')) digits = digits.slice(1)
        return digits.slice(0, 10)
    }, [value])

    const handleChange = (e) => {
        let raw = e.target.value.replace(/\D/g, '')
        if (raw.startsWith('63')) raw = raw.slice(2)
        if (raw.startsWith('0')) raw = raw.slice(1)
        raw = raw.slice(0, 10)

        // Pass full +63... phone to parent handler
        const formatted = raw ? `+63${raw}` : ''
        onChange?.({
            target: {
                name,
                value: formatted,
                raw
            }
        })
    }

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && (
                <label className='block text-xs font-bold uppercase tracking-[0.14em] text-[#2F6B57]'>
                    {label}
                </label>
            )}
            <div
                className={`flex h-11 items-center rounded-xl border bg-[#F6F7F2] overflow-hidden transition ${
                    error
                        ? 'border-[#2F6B57] focus-within:border-[#2F6B57] focus-within:ring-2 focus-within:ring-[#2F6B57]/10'
                        : 'border-[#F6F7F2] focus-within:border-[#2F6B57] focus-within:ring-2 focus-within:ring-[#2F6B57]/10'
                } ${disabled ? 'opacity-60' : ''}`}
            >
                <div className='flex h-full items-center gap-1.5 border-r border-[#F6F7F2] bg-[#F6F7F2] px-3 text-xs font-bold text-[#405148] select-none shrink-0'>
                    <span className='text-sm leading-none'>🇵🇭</span>
                    <span>+63</span>
                </div>
                <input
                    type='tel'
                    name={name}
                    placeholder={placeholder}
                    value={displayValue}
                    onChange={handleChange}
                    required={required}
                    disabled={disabled}
                    className='h-full w-full bg-transparent px-3.5 text-sm font-mono text-[#13231B] outline-none placeholder:font-sans placeholder:text-[#9AA69F]'
                />
            </div>
            {help && <p className='text-xs text-[#2F6B57]'>{help}</p>}
            {error && <p className='text-xs font-medium text-[#1F4D3E]'>{error}</p>}
        </div>
    )
}
