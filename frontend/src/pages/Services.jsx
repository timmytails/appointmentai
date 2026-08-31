import { Link } from 'react-router-dom'
import { ArrowRight, Bath, CalendarDays, Clock3, Ear, Scissors, Sparkles, WandSparkles } from 'lucide-react'

const services = [
    { id: 'basic-grooming', icon: Bath, name: 'Basic Grooming', price: 500, duration: '60 min', desc: 'A practical maintenance visit with bath, conditioner, brush-out, nail trim, ear hygiene, and fluff dry.', category: 'Routine care' },
    { id: 'full-grooming', icon: Sparkles, name: 'Full Grooming', price: 1200, duration: '120 min', desc: 'Complete grooming with bath, haircut, sanitary trim, pad cleaning, finishing, and style consultation.', category: 'Complete care', featured: true, ai: true },
    { id: 'custom-styling', icon: WandSparkles, name: 'Custom Styling', price: 1000, duration: '90 min', desc: 'A haircut session built around a chosen visual reference, coat goals, and your pet’s practical needs.', category: 'Haircut', ai: true },
    { id: 'bath-blow-dry', icon: Bath, name: 'Bath & Blow Dry', price: 800, duration: '90 min', desc: 'Deep cleansing, conditioner, thorough drying, and coat brushing for a clean, comfortable reset.', category: 'Coat care' },
    { id: 'nail-trimming', icon: Scissors, name: 'Nail Trimming', price: 200, duration: '30 min', desc: 'Careful nail clipping and edge smoothing to maintain paw comfort and everyday mobility.', category: 'Add-on' },
    { id: 'ear-cleaning', icon: Ear, name: 'Ear Cleaning', price: 250, duration: '30 min', desc: 'Gentle external ear cleaning and wax removal to keep ears clean and fresh.', category: 'Add-on' }
]

export default function Services() {
    return (
        <div className='min-h-screen bg-[#F6F7F2] text-[#13231B]'>
            <section className='border-b border-[#DDE4DE] bg-white'>
                <div className='mx-auto grid max-w-[1480px] gap-8 px-5 py-14 sm:px-6 lg:grid-cols-[1fr_.7fr] lg:items-end lg:px-8 lg:py-20'>
                    <div>
                        <p className='tt-kicker'>Services & pricing</p>
                        <h1 className='mt-4 max-w-4xl font-serif text-[clamp(3.2rem,7vw,6.2rem)] leading-[.92] tracking-[-.04em]'>Choose the amount of care your pet actually needs.</h1>
                    </div>
                    <p className='max-w-xl text-sm leading-7 text-[#68776F] lg:justify-self-end'>Prices are intentionally simple to scan. Every service shows its typical duration and what kind of visit it is, so you can compare without decoding salon terminology.</p>
                </div>
            </section>

            <section className='mx-auto max-w-[1480px] px-5 py-12 sm:px-6 lg:px-8 lg:py-16'>
                <div className='grid gap-4 lg:grid-cols-2'>
                    {services.map((service, index) => {
                        const Icon = service.icon
                        return (
                            <Link
                                key={service.name}
                                to='/booking'
                                state={{ serviceId: service.id, serviceName: service.name }}
                                className={`group grid min-h-[280px] cursor-pointer gap-6 overflow-hidden border border-[#DDE4DE] p-6 transition-all duration-200 hover:border-[#1F4D3E] hover:shadow-xl sm:grid-cols-[1fr_auto] sm:p-7 ${service.featured ? 'bg-[#13231B] text-white hover:border-[#F3D58C] lg:row-span-2 lg:min-h-[576px]' : 'bg-white hover:bg-[#FAFBF9]'} ${index === 0 ? 'rounded-tl-[1.8rem]' : ''} ${index === services.length - 1 ? 'rounded-br-[1.8rem]' : ''}`}
                            >
                                <div className='flex flex-col'>
                                    <div className='flex items-center gap-3'>
                                        <span className={`grid h-11 w-11 place-items-center rounded-2xl ${service.featured ? 'bg-[#E8795B] text-[#13231B]' : 'bg-[#EDF3EE] text-[#1F4D3E]'}`}><Icon size={19} /></span>
                                        <span className={`text-[10px] font-extrabold uppercase tracking-[.15em] ${service.featured ? 'text-[#E5B95D]' : 'text-[#2F6B57]'}`}>{service.category}</span>
                                    </div>
                                    <div className='mt-auto pt-12'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <h2 className='font-serif text-3xl transition group-hover:text-[#2F6B57] sm:text-4xl' style={service.featured ? { color: 'inherit' } : {}}>{service.name}</h2>
                                            {service.ai && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.11em] ${service.featured ? 'bg-white/10 text-[#F3D58C]' : 'bg-[#FBE9E4] text-[#B95843]'}`}><Sparkles size={11} />Style preview</span>}
                                        </div>
                                        <p className={`mt-3 max-w-xl text-sm leading-7 ${service.featured ? 'text-[#C4D0C9]' : 'text-[#68776F]'}`}>{service.desc}</p>
                                    </div>
                                </div>
                                <div className='flex items-end justify-between gap-6 border-t pt-5 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0'>
                                    <div className='sm:text-right'>
                                        <p className='font-serif text-3xl'>₱{service.price.toLocaleString('en-PH')}</p>
                                        <p className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${service.featured ? 'text-[#AFC0B6]' : 'text-[#7A8880]'}`}><Clock3 size={13} />{service.duration}</p>
                                    </div>
                                    <span className={`grid h-11 w-11 place-items-center rounded-full transition-all duration-300 group-hover:scale-110 group-hover:translate-x-1.5 ${service.featured ? 'bg-white text-[#13231B] group-hover:bg-[#F3D58C]' : 'bg-[#13231B] text-white group-hover:bg-[#1F4D3E]'}`} aria-label={`Book ${service.name}`}><ArrowRight size={18} /></span>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </section>

            <section className='mx-auto max-w-[1480px] px-5 pb-16 sm:px-6 lg:px-8 lg:pb-24'>
                <div className='grid gap-6 rounded-[2rem] bg-[#DCE9E0] p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center'>
                    <div>
                        <p className='text-[10px] font-extrabold uppercase tracking-[.15em] text-[#2F6B57]'>Ready when you are</p>
                        <h2 className='mt-2 font-serif text-3xl sm:text-4xl'>Reserve the visit that fits your pet.</h2>
                        <p className='mt-2 max-w-2xl text-sm leading-6 text-[#5F6F66]'>Select a saved pet, choose a service, and confirm an available schedule in one flow.</p>
                    </div>
                    <Link to='/booking' className='tt-primary px-5'><CalendarDays size={17} />Book an appointment</Link>
                </div>
            </section>
        </div>
    )
}
