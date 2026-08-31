import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, Check, Clock3, Heart, MapPin, PawPrint, Scissors } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { rememberReturnTo } from '../utils/authRouting'
import StyleCarousel from '../components/StyleCarousel'
import heroImage from '../assets/images/hero-grooming.png'
import salonImage from '../assets/images/salon-grooming.png'

const services = [
    { name: 'Bath & tidy', price: 'from ₱500', duration: '60 min', desc: 'Bath, brush, nails, ears, and a clean finish for regular upkeep.' },
    { name: 'Full groom', price: 'from ₱1,200', duration: '120 min', desc: 'A complete reset with haircut, hygiene trim, coat finishing, and detail work.', featured: true },
    { name: 'Custom styling', price: 'from ₱1,000', duration: '90 min', desc: 'Bring a look or use a style reference to shape the cut around your pet.' }
]

const steps = [
    ['01', 'Choose a pet', 'Keep breed, coat notes, and photos attached to one profile.'],
    ['02', 'Pick the care', 'Compare the service, duration, price, and available schedule.'],
    ['03', 'Set the look', 'Use style references when a haircut needs a clearer visual direction.'],
    ['04', 'Manage the visit', 'See status, schedule changes, and appointment history from your account.']
]

export default function Home() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const book = () => {
        if (user) {
            navigate(user.profileCompleted ? '/booking' : '/complete-profile')
            return
        }
        rememberReturnTo('/booking')
        navigate('/login', { state: { returnTo: '/booking', reason: 'booking-required' } })
    }

    return (
        <div className='bg-[#F6F7F2] text-[#13231B]'>
            <section className='border-b border-[#DDE4DE]'>
                <div className='mx-auto grid max-w-[1480px] gap-8 px-5 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.02fr_.98fr] lg:px-8 lg:py-16'>
                    <div className='flex flex-col justify-center lg:pr-10'>
                        <div className='inline-flex w-fit items-center gap-2 rounded-full border border-[#C9D9CE] bg-[#EDF3EE] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[.13em] text-[#1F4D3E]'>
                            <MapPin size={13} /> Tangos, Baliuag City, Bulacan
                        </div>
                        <h1 className='mt-6 max-w-3xl font-serif text-[clamp(3.15rem,7vw,6.6rem)] leading-[.88] tracking-[-.045em]'>A better grooming day starts with less fuss.</h1>
                        <p className='mt-6 max-w-xl text-base leading-8 text-[#5C6B63] sm:text-lg'>Book the right service, save every pet profile, and keep the whole visit organized without message threads and repeated forms.</p>

                        <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
                            <button onClick={book} className='tt-primary px-5'><CalendarDays size={18} />Book an appointment</button>
                            <Link to='/services' className='tt-secondary px-5'>Explore services <ArrowRight size={17} /></Link>
                        </div>

                        <div className='mt-10 grid max-w-2xl grid-cols-3 gap-4 border-t border-[#DDE4DE] pt-6'>
                            {[
                                ['Mon–Sat', 'Open weekly'],
                                ['Dogs + cats', 'All companions'],
                                ['One account', 'Pets + visits']
                            ].map(([value, label]) => (
                                <div key={label}>
                                    <p className='text-sm font-extrabold text-[#13231B]'>{value}</p>
                                    <p className='mt-1 text-[11px] font-semibold text-[#7A8880]'>{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='relative min-h-[420px] overflow-hidden rounded-[2.2rem] bg-[#DCE9E0] shadow-sm sm:min-h-[520px] lg:min-h-[620px]'>
                        <img src={heroImage} alt='Pet receiving professional grooming care' className='h-full w-full object-cover object-center' />
                    </div>
                </div>
            </section>

            <section className='mx-auto max-w-[1480px] px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
                <div className='grid gap-10 lg:grid-cols-[.78fr_1.22fr]'>
                    <div className='lg:sticky lg:top-28 lg:self-start'>
                        <p className='tt-kicker'>The grooming menu</p>
                        <h2 className='tt-section-title mt-4 max-w-lg'>Pick by outcome, not by jargon.</h2>
                        <p className='tt-muted mt-5 max-w-md text-sm leading-7'>Three core paths cover routine upkeep, full grooming, and a more intentional haircut. Smaller add-ons are available on the full services page.</p>
                        <Link to='/services' className='mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#1F4D3E]'>See all services <ArrowRight size={16} /></Link>
                    </div>

                    <div className='grid gap-4'>
                        {services.map((service, index) => (
                            <article key={service.name} className={`grid gap-5 border border-[#DDE4DE] p-5 sm:grid-cols-[58px_1fr_auto] sm:items-center sm:p-6 ${service.featured ? 'bg-[#13231B] text-white' : 'bg-white'} ${index === 0 ? 'rounded-t-[1.6rem]' : ''} ${index === services.length - 1 ? 'rounded-b-[1.6rem]' : ''}`}>
                                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${service.featured ? 'bg-[#E8795B] text-[#13231B]' : 'bg-[#EDF3EE] text-[#1F4D3E]'}`}><Scissors size={19} /></span>
                                <div>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <h3 className='font-serif text-2xl'>{service.name}</h3>
                                        {service.featured && <span className='rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-[#F3D58C]'>Most booked</span>}
                                    </div>
                                    <p className={`mt-1.5 text-sm leading-6 ${service.featured ? 'text-[#C7D2CC]' : 'text-[#68776F]'}`}>{service.desc}</p>
                                </div>
                                <div className='flex items-center justify-between gap-6 sm:block sm:min-w-32 sm:text-right'>
                                    <p className='font-serif text-xl'>{service.price}</p>
                                    <p className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${service.featured ? 'text-[#AFC0B6]' : 'text-[#7A8880]'}`}><Clock3 size={13} />{service.duration}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className='bg-[#EDF3EE]'>
                <div className='mx-auto max-w-[1480px] px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
                    <div className='max-w-3xl'>
                        <p className='tt-kicker'>One continuous experience</p>
                        <h2 className='tt-section-title mt-4'>No handoff between booking and care.</h2>
                    </div>
                    <div className='mt-10 grid border-y border-[#C9D9CE] sm:grid-cols-2 lg:grid-cols-4'>
                        {steps.map(([number, title, body], index) => (
                            <article key={number} className={`py-7 sm:p-6 ${index < 3 ? 'lg:border-r lg:border-[#C9D9CE]' : ''} ${index < 2 ? 'sm:border-b sm:border-[#C9D9CE] lg:border-b-0' : ''}`}>
                                <p className='font-mono text-xs font-bold text-[#2F6B57]'>{number}</p>
                                <h3 className='mt-8 font-serif text-2xl'>{title}</h3>
                                <p className='mt-3 text-sm leading-6 text-[#637169]'>{body}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className='mx-auto max-w-[1480px] px-5 py-16 sm:px-6 lg:px-8 lg:py-24'>
                <div className='grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end'>
                    <div>
                        <p className='tt-kicker'>Style references</p>
                        <h2 className='tt-section-title mt-4'>Show the shape you have in mind.</h2>
                    </div>
                    <p className='max-w-xl text-sm leading-7 text-[#68776F] lg:justify-self-end'>Upload photos to help us match your preferred coat length, face shape, and overall cut before you arrive.</p>
                </div>
                <div className='mt-10'><StyleCarousel /></div>
            </section>

            <section className='border-t border-[#DDE4DE] bg-white'>
                <div className='mx-auto grid max-w-[1480px] gap-8 px-5 py-16 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-20'>
                    <div className='relative overflow-hidden rounded-[2rem] bg-[#DCE9E0]'>
                        <img src={salonImage} alt='TimmyTails grooming salon' className='h-[420px] w-full object-cover sm:h-[520px]' />
                        <div className='absolute bottom-4 left-4 rounded-2xl bg-white p-4 shadow-xl sm:bottom-6 sm:left-6'>
                            <p className='text-[10px] font-extrabold uppercase tracking-[.15em] text-[#2F6B57]'>Tangos, Baliuag City</p>
                            <p className='mt-1 font-serif text-lg font-bold text-[#13231B]'>Clean, calm, dedicated pet grooming.</p>
                        </div>
                    </div>
                    <div className='space-y-6 lg:pl-10'>
                        <p className='tt-kicker'>Visit the salon</p>
                        <h2 className='tt-section-title'>A calm setting built around pet comfort.</h2>
                        <p className='tt-muted text-sm leading-7 sm:text-base'>We pace every appointment so pets never feel rushed or stressed. Our clean, sanitized workspace ensures each companion receives the dedicated care they deserve.</p>
                        <div className='grid gap-4 border-t border-[#DDE4DE] pt-6 sm:grid-cols-2'>
                            {[
                                ['Stress-free handling', 'Patient coat care and dedicated attention throughout every visit.'],
                                ['Sanitized workspace', 'Fresh towels, sterilized tools, and clean suites for every pet.']
                            ].map(([title, desc]) => (
                                <div key={title} className='rounded-2xl border border-[#DDE4DE] bg-[#F6F7F2] p-5'>
                                    <h3 className='font-serif text-lg font-bold text-[#13231B]'>{title}</h3>
                                    <p className='mt-2 text-xs leading-6 text-[#68776F]'>{desc}</p>
                                </div>
                            ))}
                        </div>
                        <button onClick={book} className='tt-primary mt-8 px-5'><PawPrint size={17} />Plan your pet’s visit</button>
                    </div>
                </div>
            </section>
        </div>
    )
}
