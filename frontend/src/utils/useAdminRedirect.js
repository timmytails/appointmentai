import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function useAdminRedirect() {
    const { user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (user?.role === 'admin') {
            navigate('/admin', { replace: true })
        }
    }, [user, navigate])
}
