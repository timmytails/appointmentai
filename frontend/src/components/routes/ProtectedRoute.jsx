import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rememberReturnTo } from '../../utils/authRouting'

export default function ProtectedRoute() {
    const { user, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return <div className='min-h-[60vh] grid place-items-center text-sm text-[#405148]'>Loading your account...</div>
    }

    if (!user) {
        const returnTo = `${location.pathname}${location.search}`
        rememberReturnTo(returnTo)
        return <Navigate to='/login' replace state={{ returnTo }} />
    }

    return <Outlet />
}
