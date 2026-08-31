import { CalendarCheck, CalendarDays, Dog, Home, LayoutDashboard, LogIn, Shield, Sparkles, User } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function BottomNav() {
    const { user } = useAuth()
    const location = useLocation()
    if (['/login', '/signup', '/forgot-password', '/complete-profile', '/admin'].includes(location.pathname)) return null

    const items = user?.role === 'user'
        ? [
            { label: 'Home', to: '/dashboard', icon: LayoutDashboard },
            { label: 'Book', to: '/booking', icon: CalendarDays },
            { label: 'Pets', to: '/my-pets', icon: Dog },
            { label: 'Visits', to: '/appointments', icon: CalendarCheck },
            { label: 'Profile', to: '/profile', icon: User }
        ]
        : user?.role === 'admin'
            ? [{ label: 'Home', to: '/', icon: Home }, { label: 'Admin', to: '/admin', icon: Shield }]
            : [
                { label: 'Home', to: '/', icon: Home },
                { label: 'Services', to: '/services', icon: Sparkles },
                { label: 'Book', to: '/booking', icon: CalendarDays },
                { label: 'Sign in', to: '/login', icon: LogIn }
            ]

    return (
        <nav aria-label='Mobile navigation' className='fixed inset-x-3 bottom-3 z-40 rounded-[22px] border border-[#DDE4DE] bg-white/95 p-1.5 shadow-[0_14px_45px_rgba(19,35,27,.12)] backdrop-blur-xl md:hidden'>
            <div className='flex min-h-14 items-stretch justify-around gap-1'>
                {items.map((item) => {
                    const Icon = item.icon
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/' || item.to === '/dashboard'}
                            className={({ isActive }) => `flex min-w-0 flex-1 flex-col items-center justify-center rounded-[16px] px-1 py-1.5 text-[10px] font-bold transition ${isActive ? 'bg-[#EDF3EE] text-[#1F4D3E]' : 'text-[#68776F] hover:bg-[#F6F7F2] hover:text-[#13231B]'}`}
                        >
                            <Icon size={19} />
                            <span className='mt-1 truncate'>{item.label}</span>
                        </NavLink>
                    )
                })}
            </div>
        </nav>
    )
}
