import { useState } from 'react'
import { CalendarDays, LogOut, Menu, UserRound, X } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { rememberReturnTo } from '../utils/authRouting'
import NotificationBell from './NotificationBell'

const publicLinks = [
    { label: 'Services', to: '/services' },
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' }
]

const userLinks = [
    { label: 'Overview', to: '/dashboard' },
    { label: 'Appointments', to: '/appointments' },
    { label: 'My pets', to: '/my-pets' }
]

export default function Header() {
    const [open, setOpen] = useState(false)
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    if (['/login', '/signup', '/forgot-password', '/complete-profile', '/admin'].includes(location.pathname)) return null

    const startBooking = () => {
        setOpen(false)
        if (user) {
            navigate(user.profileCompleted ? '/booking' : '/complete-profile')
            return
        }
        rememberReturnTo('/booking')
        navigate('/login', { state: { returnTo: '/booking', reason: 'booking-required' } })
    }

    const signOut = () => {
        logout()
        setOpen(false)
        navigate('/')
    }

    const links = user?.role === 'user' ? userLinks : publicLinks

    return (
        <header className='sticky top-0 z-50 border-b border-[#DDE4DE] bg-white/95 backdrop-blur-xl'>
            <div className='mx-auto flex min-h-[72px] max-w-[1480px] items-center gap-5 px-4 sm:px-6 lg:px-8'>
                <Link
                    to={user?.role === 'user' ? '/dashboard' : '/'}
                    className='flex shrink-0 items-center gap-2.5 text-[#13231B] transition hover:opacity-85'
                    aria-label='TimmyTails home'
                >
                    <img src='/logo.png' alt='TimmyTails logo' className='h-10 w-10 rounded-full object-cover shadow-xs ring-2 ring-[#DDE4DE]/80 bg-white' />
                    <span className='font-serif text-[24px] font-bold tracking-tight text-[#13231B]'>
                        TimmyTails
                    </span>
                </Link>

                <nav className='ml-4 hidden flex-1 items-center justify-center gap-1 lg:flex' aria-label='Primary navigation'>
                    {links.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/dashboard'}
                            className={({ isActive }) => `rounded-lg px-3.5 py-2 text-sm font-bold transition ${isActive ? 'bg-[#EDF3EE] text-[#1F4D3E]' : 'text-[#58675F] hover:bg-[#F6F7F2] hover:text-[#13231B]'}`}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className='ml-auto hidden items-center gap-2 lg:flex'>
                    {user ? (
                        <>
                            <NotificationBell />
                            <Link to='/profile' className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DDE4DE] bg-white px-3.5 text-sm font-bold text-[#13231B] hover:bg-[#F6F7F2]'>
                                <span className='grid h-7 w-7 place-items-center rounded-full bg-[#DCE9E0] text-[#1F4D3E]'><UserRound size={14} /></span>
                                <span className='max-w-28 truncate'>{user.firstName || 'Account'}</span>
                            </Link>
                            <button onClick={startBooking} className='tt-primary'><CalendarDays size={17} />Book</button>
                        </>
                    ) : (
                        <>
                            <Link to='/login' className='px-3 py-2 text-sm font-bold text-[#405148] hover:text-[#13231B]'>Sign in</Link>
                            <button onClick={startBooking} className='tt-primary'><CalendarDays size={17} />Book a visit</button>
                        </>
                    )}
                </div>

                <div className='ml-auto flex items-center gap-2 lg:hidden'>
                    {user && <NotificationBell />}
                    <button
                        type='button'
                        onClick={() => setOpen((value) => !value)}
                        className='grid h-11 w-11 place-items-center rounded-xl border border-[#DDE4DE] bg-white text-[#13231B]'
                        aria-label={open ? 'Close navigation' : 'Open navigation'}
                        aria-expanded={open}
                    >
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {open && (
                <div className='border-t border-[#DDE4DE] bg-white px-4 py-4 shadow-xl lg:hidden'>
                    <nav className='mx-auto grid max-w-[1480px] gap-1' aria-label='Mobile navigation'>
                        {links.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setOpen(false)}
                                className={({ isActive }) => `rounded-xl px-4 py-3 text-sm font-bold ${isActive ? 'bg-[#EDF3EE] text-[#1F4D3E]' : 'text-[#405148]'}`}
                            >
                                {item.label}
                            </NavLink>
                        ))}
                        <div className='mt-3 grid grid-cols-2 gap-2 border-t border-[#DDE4DE] pt-3'>
                            {user ? (
                                <>
                                    <Link to='/profile' onClick={() => setOpen(false)} className='tt-secondary'>Account</Link>
                                    <button onClick={signOut} className='tt-secondary'><LogOut size={16} />Sign out</button>
                                </>
                            ) : (
                                <Link to='/login' onClick={() => setOpen(false)} className='tt-secondary'>Sign in</Link>
                            )}
                            <button onClick={startBooking} className='tt-primary col-span-2'><CalendarDays size={17} />Book an appointment</button>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    )
}
