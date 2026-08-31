import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rememberReturnTo } from '../../utils/authRouting'

export default function ProfileCompletionRoute() {
    const { user } = useAuth()
    const location = useLocation()

    if (user?.role === 'admin') return <Navigate to='/admin' replace />

    if (!user?.profileCompleted) {
        rememberReturnTo(`${location.pathname}${location.search}`)
        return <Navigate to='/complete-profile' replace />
    }

    return <Outlet />
}
