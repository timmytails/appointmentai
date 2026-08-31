import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function GuestRoute() {
    const { user, loading } = useAuth()
    if (loading) return null
    if (user) {
        if (user.role === 'admin') return <Navigate to='/admin' replace />
        return <Navigate to={user.profileCompleted ? '/dashboard' : '/complete-profile'} replace />
    }
    return <Outlet />
}
