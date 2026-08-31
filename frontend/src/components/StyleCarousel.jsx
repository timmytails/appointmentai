import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Scissors } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { rememberReturnTo } from '../utils/authRouting'

import shihTzu from '../assets/images/style-shih-tzu.png'
import poodle from '../assets/images/style-poodle.png'
import persian from '../assets/images/style-persian.png'
import maltese from '../assets/images/style-maltese.png'
import yorkie from '../assets/images/style-yorkie.png'
import mixed from '../assets/images/style-mixed.png'

const CUT_STYLES = [
    { id: '1', style: 'Teddy Bear Cut', breed: 'Toy Poodle', image: poodle },
    { id: '2', style: 'Puppy Cut', breed: 'Shih Tzu', image: shihTzu },
    { id: '3', style: 'Lion Trim & De-Shed', breed: 'Persian Cat', image: persian },
    { id: '4', style: 'Summer Bob Cut', breed: 'Maltese', image: maltese },
    { id: '5', style: 'Silky Clean Trim', breed: 'Yorkshire Terrier', image: yorkie },
    { id: '6', style: 'Fluffy Hygiene Trim', breed: 'Mixed Companion', image: mixed }
]

export default function StyleCarousel() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [startIndex, setStartIndex] = useState(0)
    const [isPaused, setIsPaused] = useState(false)

    // Auto-swipe scroll index every 3.5 seconds
    useEffect(() => {
        if (isPaused) return
        const timer = setInterval(() => {
            setStartIndex((prev) => (prev + 1) % CUT_STYLES.length)
        }, 3500)
        return () => clearInterval(timer)
    }, [isPaused])

    const handleBook = () => {
        if (user) {
            navigate(user.profileCompleted ? '/booking' : '/complete-profile')
            return
        }
        rememberReturnTo('/booking')
        navigate('/login', { state: { returnTo: '/booking', reason: 'booking-required' } })
    }

    const prev = () => {
        setStartIndex((prev) => (prev === 0 ? CUT_STYLES.length - 1 : prev - 1))
    }

    const next = () => {
        setStartIndex((prev) => (prev + 1) % CUT_STYLES.length)
    }

    // Get 3 visible items wrapped infinitely
    const visibleItems = [
        CUT_STYLES[startIndex % CUT_STYLES.length],
        CUT_STYLES[(startIndex + 1) % CUT_STYLES.length],
        CUT_STYLES[(startIndex + 2) % CUT_STYLES.length]
    ]

    return (
        <div
            className='relative space-y-6'
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Nav Arrows Header Bar */}
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#405148]'>
                    <Scissors size={14} className='text-[#1F4D3E]' />
                    <span>Featured Pet Cuts ({startIndex + 1}/{CUT_STYLES.length})</span>
                </div>
                <div className='flex items-center gap-2'>
                    <button
                        onClick={prev}
                        aria-label='Previous style'
                        className='grid h-9 w-9 place-items-center rounded-xl border border-[#DDE4DE] bg-white text-[#405148] transition hover:border-[#1F4D3E] hover:text-[#1F4D3E] shadow-xs'
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={next}
                        aria-label='Next style'
                        className='grid h-9 w-9 place-items-center rounded-xl border border-[#DDE4DE] bg-white text-[#405148] transition hover:border-[#1F4D3E] hover:text-[#1F4D3E] shadow-xs'
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Responsive 3-Card Auto-Swiping Grid */}
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                {visibleItems.map((item, index) => (
                    <figure
                        key={`${item.id}-${index}`}
                        className='group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#DDE4DE] bg-white shadow-xs transition-all duration-300 hover:border-[#1F4D3E] hover:shadow-md'
                    >
                        <div className='h-60 overflow-hidden bg-[#FAFBF8] relative'>
                            <img
                                src={item.image}
                                alt={`${item.style} reference cut`}
                                className='h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105'
                            />
                            <span className='absolute top-3 right-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-[#1F4D3E] backdrop-blur-xs shadow-sm border border-[#DDE4DE]'>
                                {item.breed}
                            </span>
                        </div>
                        <figcaption className='flex items-center justify-between p-4.5 bg-white border-t border-[#DDE4DE]'>
                            <div>
                                <h3 className='font-serif text-base font-bold text-[#13231B]'>{item.style}</h3>
                                <p className='mt-0.5 text-xs text-[#68776F]'>Available for Custom Booking</p>
                            </div>
                            <button
                                onClick={handleBook}
                                className='rounded-xl bg-[#1F4D3E] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#13231B] shadow-xs active:scale-95'
                            >
                                Book
                            </button>
                        </figcaption>
                    </figure>
                ))}
            </div>

            {/* Pagination Indicators */}
            <div className='flex items-center justify-center gap-1.5 pt-2'>
                {CUT_STYLES.map((item, idx) => (
                    <button
                        key={item.id}
                        onClick={() => setStartIndex(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-2 rounded-full transition-all duration-300 ${
                            idx === startIndex % CUT_STYLES.length
                                ? 'w-6 bg-[#1F4D3E]'
                                : 'w-2 bg-[#DDE4DE] hover:bg-[#1F4D3E]'
                        }`}
                    />
                ))}
            </div>
        </div>
    )
}
