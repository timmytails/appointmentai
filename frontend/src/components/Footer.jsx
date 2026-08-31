import { ArrowUpRight, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Footer() {
    return (
        <footer className='border-t border-[#DDE4DE] bg-[#13231B] text-white'>
            <div className='mx-auto max-w-[1480px] px-6 py-14 lg:px-8 lg:py-16'>
                <div className='grid gap-12 lg:grid-cols-[1.25fr_.75fr]'>
                    <div>
                        <div className='flex items-center gap-3'>
                            <img src='/logo.png' alt='TimmyTails logo' className='h-10 w-10 rounded-full object-cover shadow-xs ring-2 ring-white/25 bg-white' />
                            <p className='font-serif text-3xl font-bold tracking-tight text-white'>TimmyTails</p>
                        </div>
                        <h2 className='mt-8 max-w-2xl font-serif text-4xl leading-[1.05] tracking-[-.02em] sm:text-5xl'>Good grooming should feel simple—for you and your pet.</h2>
                        <p className='mt-5 max-w-xl text-sm leading-7 text-[#C6D0CA]'>Clear services, thoughtful handling, saved pet profiles, and appointment management without the usual back-and-forth.</p>
                    </div>

                    <div className='grid gap-8 sm:grid-cols-2'>
                        <div>
                            <p className='text-[11px] font-extrabold uppercase tracking-[.16em] text-[#E5B95D]'>Location</p>
                            <div className='mt-4 space-y-3 text-sm text-[#D9E1DC]'>
                                <p className='flex gap-2.5'><MapPin size={16} className='mt-0.5 shrink-0 text-[#E8795B]' />Tangos, Baliuag City, Bulacan</p>
                                <p className='flex gap-2.5'><Phone size={16} className='shrink-0 text-[#E8795B]' />+63 975 669 2647</p>
                                <p className='flex gap-2.5'><Mail size={16} className='shrink-0 text-[#E8795B]' />contact@timmytails.com</p>
                                <p className='flex gap-2.5'><Clock size={16} className='shrink-0 text-[#E8795B]' />Mon–Sat · 8 AM–6 PM</p>
                            </div>
                        </div>
                        <nav aria-label='Footer navigation'>
                            <p className='text-[11px] font-extrabold uppercase tracking-[.16em] text-[#E5B95D]'>Explore</p>
                            <div className='mt-4 grid gap-3 text-sm font-bold text-[#D9E1DC]'>
                                {[
                                    ['Services & pricing', '/services'],
                                    ['About us', '/about'],
                                    ['Contact', '/contact'],
                                    ['Privacy', '/privacy-policy'],
                                    ['Terms', '/terms-of-service']
                                ].map(([label, to]) => <Link key={to} to={to} className='inline-flex items-center gap-1.5 hover:text-white'>{label}<ArrowUpRight size={13} /></Link>)}
                            </div>
                        </nav>
                    </div>
                </div>
                <div className='mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-[#9FADA5] sm:flex-row sm:items-center sm:justify-between'>
                    <span>© {new Date().getFullYear()} TimmyTails. All rights reserved.</span>
                    <span>Made for calmer visits and tidier coats.</span>
                </div>
            </div>
        </footer>
    )
}
