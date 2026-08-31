import { createElement } from 'react'
import { CalendarDays, Camera, HeartHandshake, ShieldCheck, UserRoundCheck } from 'lucide-react'
import salonImage from '../assets/images/salon-grooming.png'

const points = [
    [HeartHandshake, 'Patient handling', 'Every visit is paced around comfort, coat condition, and practical handling needs.'],
    [Camera, 'Visual style references', 'Use a photo-based haircut reference when words alone are not enough to explain the look.'],
    [CalendarDays, 'Clear scheduling', 'See available times, service duration, and visit details before you confirm.'],
    [UserRoundCheck, 'Pet profiles that stay useful', 'Breed, coat notes, photos, and handling preferences stay connected to your account.']
]

export default function About() {
    return (
        <div className='bg-[#F6F7F2] text-[#13231B]'>
            <section className='border-b border-[#DDE4DE] bg-white'>
                <div className='mx-auto grid max-w-[1480px] gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[.88fr_1.12fr] lg:items-center lg:px-8 lg:py-20'>
                    <div>
                        <p className='tt-kicker'>About TimmyTails</p>
                        <h1 className='mt-4 font-serif text-[clamp(3.2rem,7vw,6rem)] leading-[.92] tracking-[-.04em]'>Built for a calmer kind of grooming visit.</h1>
                        <p className='mt-6 max-w-xl text-base leading-8 text-[#68776F]'>TimmyTails combines professional grooming in Tangos, Baliuag City with a clearer digital experience, so pet owners know what they are booking, what their pet needs, and what to expect before arrival.</p>
                    </div>
                    <div className='relative overflow-hidden rounded-[2rem] bg-[#DCE9E0]'>
                        <img src={salonImage} alt='A pet receiving professional grooming care' className='h-[430px] w-full object-cover sm:h-[560px]' />
                        <div className='absolute bottom-5 left-5 right-5 rounded-2xl bg-white/94 p-5 shadow-xl backdrop-blur sm:right-auto sm:max-w-sm'>
                            <div className='flex items-center gap-3'><span className='grid h-9 w-9 place-items-center rounded-xl bg-[#EDF3EE] text-[#1F4D3E]'><ShieldCheck size={18} /></span><p className='text-sm font-extrabold'>Care first, software second.</p></div>
                            <p className='mt-2 text-xs leading-5 text-[#68776F]'>The product is designed to reduce uncertainty around the real-world grooming experience—not add more steps.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className='mx-auto max-w-[1480px] px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
                <div className='grid gap-10 lg:grid-cols-[.7fr_1.3fr]'>
                    <div>
                        <p className='tt-kicker'>What we optimize for</p>
                        <h2 className='tt-section-title mt-4'>Clear expectations make better visits.</h2>
                    </div>
                    <div className='grid gap-px overflow-hidden rounded-[1.75rem] border border-[#DDE4DE] bg-[#DDE4DE] sm:grid-cols-2'>
                        {points.map(([icon, title, description]) => (
                            <article key={title} className='bg-white p-6 sm:p-7'>
                                <span className='grid h-11 w-11 place-items-center rounded-2xl bg-[#EDF3EE] text-[#1F4D3E]'>{createElement(icon, { size: 19 })}</span>
                                <h3 className='mt-7 font-serif text-2xl'>{title}</h3>
                                <p className='mt-3 text-sm leading-7 text-[#68776F]'>{description}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
