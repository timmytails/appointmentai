import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationsApi } from '../utils/api'
import { useAuth } from '../context/AuthContext'

const POLL_INTERVAL = 30_000 // 30 seconds

export function useNotifications() {
    const { user } = useAuth()
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(false)
    const intervalRef = useRef(null)

    const fetch = useCallback(async () => {
        if (!user || user.role !== 'user') return
        setLoading(true)
        try {
            const { data } = await notificationsApi.getMine()
            const list = data.notifications || []
            setNotifications(list)

            // Instant Ban Eviction Check
            const banNotif = list.find((n) => String(n.title || '').toLowerCase().includes('banned'))
            const restoredNotif = list.find((n) => String(n.title || '').toLowerCase().includes('restored'))

            if (banNotif) {
                const banTime = new Date(banNotif.createdAt).getTime()
                const restoreTime = restoredNotif ? new Date(restoredNotif.createdAt).getTime() : 0
                if (banTime > restoreTime) {
                    localStorage.removeItem('token')
                    const notifMsg = encodeURIComponent(banNotif.message || 'Your customer account has been suspended by salon administration.')
                    if (window.location.pathname !== '/login') {
                        window.location.href = `/login?reason=banned&msg=${notifMsg}`
                    }
                }
            }
        } catch {
            // silently fail – non-critical
        } finally {
            setLoading(false)
        }
    }, [user])

    const markRead = useCallback(async (id) => {
        try {
            await notificationsApi.markAsRead(id)
            setNotifications((prev) =>
                prev.map((n) => n._id === id ? { ...n, isRead: true } : n)
            )
        } catch {
            // silently fail
        }
    }, [])

    const markAllRead = useCallback(async () => {
        const unread = notifications.filter((n) => !n.isRead)
        await Promise.allSettled(unread.map((n) => notificationsApi.markAsRead(n._id)))
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    }, [notifications])

    useEffect(() => {
        fetch()
        intervalRef.current = setInterval(fetch, POLL_INTERVAL)
        return () => clearInterval(intervalRef.current)
    }, [fetch])

    const unreadCount = notifications.filter((n) => !n.isRead).length

    return { notifications, loading, unreadCount, markRead, markAllRead, refetch: fetch }
}
