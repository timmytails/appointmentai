import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../utils/api'

const AuthContext = createContext(null)

const saveSession = (data, setUser) => {
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchMe = useCallback(async () => {
        const token = localStorage.getItem('token')
        if (!token) {
            setLoading(false)
            return
        }

        try {
            const { data } = await authApi.me()
            setUser(data.user)
        } catch {
            localStorage.removeItem('token')
            setUser(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        queueMicrotask(fetchMe)
    }, [fetchMe])

    const login = async (identifier, password) => {
        const { data } = await authApi.login({ identifier, password })
        return saveSession(data, setUser)
    }

    const googleLogin = async (credential) => {
        const { data } = await authApi.google(credential)
        return saveSession(data, setUser)
    }

    const register = async (phone, otp) => {
        const { data } = await authApi.register({ phone, otp })
        return saveSession(data, setUser)
    }

    const sendRegisterOtp = async (formData) => {
        const { data } = await authApi.sendRegisterOtp(formData)
        return data
    }

    const sendCompleteProfileOtp = async (phone) => {
        const { data } = await authApi.sendCompleteProfileOtp({ phone })
        return data
    }

    const completeProfile = async (profile) => {
        const { data } = await authApi.completeProfile(profile)
        setUser(data.user)
        return data
    }

    const sendProfilePhoneOtp = async (phone) => {
        const { data } = await authApi.sendProfilePhoneOtp({ phone })
        return data
    }

    const updateProfile = async (profile) => {
        const { data } = await authApi.updateProfile(profile)
        setUser(data.user)
        return data
    }

    const sendPasswordOtp = async (identifier) => {
        const { data } = await authApi.sendPasswordOtp({ identifier })
        return data
    }

    const resetPasswordWithOtp = async ({
        identifier,
        otp,
        newPassword
    }) => {
        const { data } = await authApi.resetPassword({
            identifier,
            otp,
            newPassword
        })
        return data
    }

    const logout = () => {
        localStorage.removeItem('token')
        sessionStorage.removeItem('postLoginReturnTo')
        setUser(null)
    }

    const value = useMemo(() => ({
        user,
        loading,
        login,
        googleLogin,
        register,
        sendRegisterOtp,
        sendCompleteProfileOtp,
        completeProfile,
        sendProfilePhoneOtp,
        updateProfile,
        sendPasswordOtp,
        resetPasswordWithOtp,
        refreshUser: fetchMe,
        logout
    }), [user, loading, fetchMe])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// This hook shares the provider's context and intentionally lives beside it.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used inside AuthProvider')
    return context
}
