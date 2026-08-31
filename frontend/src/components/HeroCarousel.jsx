import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import heroImage from '../assets/images/hero-grooming.png'
import shihTzu from '../assets/images/style-shih-tzu.png'
import poodle from '../assets/images/style-poodle.png'
import persian from '../assets/images/style-persian.png'
import yorkie from '../assets/images/style-yorkie.png'
import mixed from '../assets/images/style-mixed.png'

const PET_IMAGES = [
    { id: 'pomeranian', image: shihTzu, alt: 'Golden Pomeranian Grooming' },
    { id: 'poodle', image: poodle, alt: 'Teddy Bear Poodle Cut' },
    { id: 'cat-orange', image: persian, alt: 'Orange Tabby Cat' },
    { id: 'cat-flat-top', image: yorkie, alt: 'Flat Top Cut Cat' },
    { id: 'collie', image: mixed, alt: 'Rough Collie Coat Trim' },
    { id: 'hero-spa', image: heroImage, alt: 'Pet Grooming Spa' }
]

export default function HeroCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0)

    // Auto-swipe slides every 2.8 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % PET_IMAGES.length)
        }, 2800)
        return () => clearInterval(interval)
    }, [])

    const prev = () => {
        setCurrentIndex((prev) => (prev === 0 ? PET_IMAGES.length - 1 : prev - 1))
    }

    const next = () => {
        setCurrentIndex((prev) => (prev + 1) % PET_IMAGES.length)
    }

    return (
        <div className='relative h-[400px] sm:h-[460px] w-full overflow-hidden rounded-2xl border border-[#1F4D3E]/80 bg-[#13231B] shadow-2xl shadow-[#13231B]/50 group'>
            {/* Clean Images with Smooth Fade Transition */}
            {PET_IMAGES.map((item, idx) => (
                <img
                    key={item.id}
                    src={item.image}
                    alt={item.alt}
                    className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${
                        idx === currentIndex ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105'
                    }`}
                />
            ))}

            {/* Side Arrow Controls (Hover) */}
            <button
                onClick={prev}
                aria-label='Previous slide'
                className='absolute left-3.5 top-1/2 z-20 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-[#13231B]/50 text-[#F6F7F2] backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hover:bg-[#1F4D3E] active:scale-95 focus:outline-none'
            >
                <ChevronLeft size={20} />
            </button>
            <button
                onClick={next}
                aria-label='Next slide'
                className='absolute right-3.5 top-1/2 z-20 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-[#13231B]/50 text-[#F6F7F2] backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 hover:bg-[#1F4D3E] active:scale-95 focus:outline-none'
            >
                <ChevronRight size={20} />
            </button>

            {/* Frosted Bottom Dot Navigation */}
            <div className='absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#13231B]/50 px-3.5 py-1.5 backdrop-blur-md border border-[#DDE4DE]/10'>
                {PET_IMAGES.map((item, idx) => (
                    <button
                        key={item.id}
                        onClick={() => setCurrentIndex(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-2 rounded-full transition-all duration-300 ${
                            idx === currentIndex
                                ? 'w-6 bg-[#2F6B57]'
                                : 'w-2 bg-[#F6F7F2]/50 hover:bg-[#F6F7F2]'
                        }`}
                    />
                ))}
            </div>
        </div>
    )
}
