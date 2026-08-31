import { useEffect, useRef, useState } from 'react'
import { Bell, CalendarDays, CheckCheck, Megaphone, X } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'

/* ── helpers ─────────────────────────────────────────────── */

function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

function NotifIcon({ type }) {
    if (type === 'appointment-status')
        return (
            <span className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F6F7F2] text-[#2F6B57] border border-[#DDE4DE]'>
                <CalendarDays size={15} />
            </span>
        )
    return (
        <span className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EDF3EE] text-[#2F6B57] border border-[#DDE4DE]'>
            <Megaphone size={15} />
        </span>
    )
}

/* ── main component ──────────────────────────────────────── */

export default function NotificationBell() {
    const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications()
    const [open, setOpen] = useState(false)
    const panelRef = useRef(null)

    // Close on outside click
    useEffect(() => {
        if (!open) return
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [open])

    // Close on Escape
    useEffect(() => {
        if (!open) return
        const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [open])

    const handleItemClick = (notif) => {
        if (!notif.isRead) markRead(notif._id)
    }

    return (
        <div className='relative' ref={panelRef}>
            {/* Bell button */}
            <button
                id='notification-bell-btn'
                onClick={() => setOpen((v) => !v)}
                aria-label={`Notifications${unreadCount ? ` – ${unreadCount} unread` : ''}`}
                className='relative grid h-11 w-11 place-items-center rounded-xl border border-[#DDE4DE] bg-white text-[#405148] transition hover:border-[#1F4D3E] hover:text-[#1F4D3E] active:scale-95'
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className='absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#1F4D3E] px-1 text-[10px] font-bold text-white shadow-xs ring-2 ring-white'>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    id='notification-panel'
                    className='fixed left-3 right-3 top-[76px] z-50 rounded-2xl border border-[#DDE4DE] bg-white shadow-[0_20px_50px_rgba(19,35,27,.16)] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96'
                    style={{ animation: 'notifSlide 0.15s ease' }}
                >
                    {/* Header */}
                    <div className='flex items-center justify-between border-b border-[#E8EEE9] bg-[#FBFDFB] px-4 py-3.5 rounded-t-2xl'>
                        <div className='flex items-center gap-2'>
                            <span className='grid h-7 w-7 place-items-center rounded-lg bg-[#EDF3EE] text-[#1F4D3E]'>
                                <Bell size={14} />
                            </span>
                            <span className='text-sm font-bold text-[#13231B]'>Notifications</span>
                            {unreadCount > 0 && (
                                <span className='rounded-full bg-[#EDF3EE] px-2 py-0.5 text-[10px] font-extrabold text-[#1F4D3E] border border-[#D0DFD5]'>
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className='flex items-center gap-1'>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    title='Mark all as read'
                                    className='flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-[#2F6B57] transition hover:bg-[#EDF3EE]'
                                >
                                    <CheckCheck size={14} />
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className='grid h-7 w-7 place-items-center rounded-lg text-[#68776F] transition hover:bg-[#F6F7F2] hover:text-[#13231B]'
                                aria-label='Close notifications'
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className='max-h-[380px] overflow-y-auto divide-y divide-[#E8EEE9]'>
                        {loading && notifications.length === 0 ? (
                            <div className='flex flex-col items-center justify-center gap-2 py-10 text-[#68776F]'>
                                <span className='h-5 w-5 animate-spin rounded-full border-2 border-[#1F4D3E] border-t-transparent' />
                                <span className='text-xs font-semibold'>Loading updates…</span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className='flex flex-col items-center gap-2 py-10 text-[#68776F]'>
                                <span className='grid h-12 w-12 place-items-center rounded-2xl bg-[#F6F7F2] text-[#9AA69F]'>
                                    <Bell size={22} strokeWidth={1.5} />
                                </span>
                                <p className='text-xs font-bold text-[#13231B]'>No notifications yet</p>
                                <p className='text-[11px] text-[#7A8880]'>Updates about your bookings and appointments will appear here.</p>
                            </div>
                        ) : (
                            <div>
                                {notifications.map((notif) => (
                                    <button
                                        key={notif._id}
                                        onClick={() => handleItemClick(notif)}
                                        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[#F9FAF8] ${
                                            !notif.isRead ? 'bg-[#F4F8F5]' : 'bg-white'
                                        }`}
                                    >
                                        <NotifIcon type={notif.type} />
                                        <div className='min-w-0 flex-1'>
                                            <div className='flex items-start justify-between gap-2'>
                                                <p className={`text-xs font-bold leading-snug ${!notif.isRead ? 'text-[#1F4D3E]' : 'text-[#13231B]'}`}>
                                                    {notif.title}
                                                </p>
                                                <span className='shrink-0 text-[10px] font-semibold text-[#809187]'>
                                                    {timeAgo(notif.createdAt)}
                                                </span>
                                            </div>
                                            <p className='mt-1 text-xs leading-relaxed text-[#58675F]'>
                                                {notif.message}
                                            </p>
                                        </div>
                                        {!notif.isRead && (
                                            <span className='mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1F4D3E]' />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className='border-t border-[#E8EEE9] bg-[#FBFDFB] px-4 py-2.5 text-center rounded-b-2xl'>
                            <p className='text-[10px] font-bold text-[#68776F]'>
                                Showing latest notifications
                            </p>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes notifSlide {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
