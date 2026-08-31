import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000
})

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config
        if (error.response?.status === 403 && (error.response?.data?.isBanned || error.response?.data?.message?.includes('suspended') || error.response?.data?.message?.includes('banned'))) {
            localStorage.removeItem('token')
            const msg = encodeURIComponent(error.response?.data?.message || 'Your customer account has been suspended by salon administration.')
            if (window.location.pathname !== '/login') {
                window.location.href = `/login?reason=banned&msg=${msg}`
            }
        }
        if (error.response?.status === 429 && config && (!config._retryCount || config._retryCount < 2)) {
            config._retryCount = (config._retryCount || 0) + 1
            const retryAfterSeconds = Number(error.response.headers?.['retry-after']) || 4
            await delay(retryAfterSeconds * 1000)
            return api(config)
        }
        return Promise.reject(error)
    }
)

export const authApi = {
    login: (data) => api.post('/auth/login', data),
    google: (credential) => api.post('/auth/google', { credential }),
    sendRegisterOtp: (data) => api.post('/auth/register/send-otp', data),
    register: (data) => api.post('/auth/register', data),
    sendPasswordOtp: (data) => api.post('/auth/password/send-otp', data),
    resetPassword: (data) => api.post('/auth/password/reset', data),
    me: () => api.get('/auth/me'),
    sendCompleteProfileOtp: (data) => api.post('/auth/complete-profile/send-otp', data),
    completeProfile: (data) => api.patch('/auth/complete-profile', data),
    sendProfilePhoneOtp: (data) => api.post('/auth/me/phone/send-otp', data),
    updateProfile: (data) => api.patch('/auth/me/profile', data)
}

export const petsApi = {
    getMine: () => api.get('/pets'),
    create: (data) => api.post('/pets', data),
    update: (id, data) => api.patch(`/pets/${id}`, data),
    remove: (id) => api.delete(`/pets/${id}`)
}

export const appointmentsApi = {
    getServices: () => api.get('/appointments/services'),
    create: (data) => api.post('/appointments', data),
    getAvailability: (date, serviceId) => api.get('/appointments/availability', {
        params: { date, serviceId }
    }),
    getMonthAvailability: (month, serviceId) => api.get('/appointments/availability/month', {
        params: { month, serviceId }
    }),
    getMy: () => api.get('/appointments/my'),
    cancel: (id) => api.delete(`/appointments/${id}`),
    reschedule: (id, data) => api.patch(`/appointments/${id}/reschedule`, data)
}

export const aiPreviewApi = {
    getStyles: (petType) => api.get('/ai/styles', {
        params: petType ? { petType } : undefined
    }),
    getRecommendations: (data) => api.post('/ai/recommendations', data),
    verifyPhoto: (data) => api.post('/ai/photo-verification', data, { timeout: 40000 }),
    generate: (data) => api.post('/ai/style-preview', data, { timeout: 240000 })
}

export const contactApi = {
    send: (data) => api.post('/contact', data)
}

export const adminApi = {
    getStats: () => api.get('/admin/stats'),
    getAppointments: (params) => api.get('/admin/appointments', { params }),
    getAppointmentPreview: (id) => api.get(`/admin/appointments/${id}/preview`, { timeout: 30000 }),
    updateStatus: (id, status, cancellationReason) => api.patch(`/admin/appointments/${id}/status`, { status, cancellationReason }),
    deleteAppointment: (id, cancellationReason) => api.delete(`/admin/appointments/${id}`, { data: { cancellationReason } }),
    getAnalytics: () => api.get('/admin/analytics', { timeout: 25000 }),
    getContacts: () => api.get('/admin/contacts'),
    markContactRead: (id) => api.patch(`/admin/contacts/${id}/read`),
    deleteContact: (id) => api.delete(`/admin/contacts/${id}`),
    getUsers: () => api.get('/admin/users'),
    updateCustomerStatus: (id, data) => api.patch(`/admin/users/${id}/status`, data),
    getNotifications: () => api.get('/admin/notifications'),
    createNotification: (data) => api.post('/admin/notifications', data)
}

export const notificationsApi = {
    getMine: () => api.get('/notifications'),
    markAsRead: (id) => api.patch(`/notifications/${id}/read`)
}

export const systemApi = {
    health: () => api.get('/health', { timeout: 35000 })
}

export function warmupBackendServer() {
    // Fire a silent background health check request to wake up cold-started backends (e.g. Render free tier)
    return systemApi.health().catch(() => {
        // Silent catch: background warmup request
    })
}

export const getErrorMessage = (error) => {
    if (error?.response?.data?.message) return error.response.data.message
    if (error?.response?.data?.errors?.length) return error.response.data.errors[0].msg
    if (error?.message) return error.message
    return 'An unexpected error occurred'
}
