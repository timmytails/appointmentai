import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/routes/ProtectedRoute'
import ProfileCompletionRoute from './components/routes/ProfileCompletionRoute'
import GuestRoute from './components/routes/GuestRoute'
import Home from './pages/Home'
import Services from './pages/Services'
import About from './pages/About'
import Contact from './pages/Contact'
import Booking from './pages/Booking'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Admin from './pages/Admin'
import UserDashboard from './pages/UserDashboard'
import MyPets from './pages/MyPets'
import Appointments from './pages/Appointments'
import Profile from './pages/Profile'
import CompleteProfile from './pages/CompleteProfile'
import ForgotPassword from './pages/ForgotPassword'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import { useAuth } from './context/AuthContext'
import { appointmentsApi, warmupBackendServer } from './utils/api'

import BottomNav from './components/BottomNav'

const publicFooterRoutes = new Set([
    '/',
    '/services',
    '/about',
    '/contact',
    '/privacy-policy',
    '/terms-of-service'
])

function AppLayout() {
    const location = useLocation()
    const showFooter = publicFooterRoutes.has(location.pathname)

    return (
        <div className='min-h-screen bg-[#F6F7F2] text-[#13231B] antialiased selection:bg-[#2F6B57] selection:text-[#F6F7F2] pb-16 md:pb-0'>
            <Header />
            <main><Outlet /></main>
            {showFooter && <Footer />}
            <BottomNav />
        </div>
    )
}

function CompleteProfileEntry() {
    const { user, loading } = useAuth()
    if (loading) return null
    if (!user) return <Navigate to='/login' replace />
    if (user.profileCompleted) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
    return <CompleteProfile />
}

function AdminEntry() {
    const { user, loading } = useAuth()
    if (loading) return null
    if (!user) return <Navigate to='/login' replace />
    if (user.role !== 'admin') return <Navigate to='/dashboard' replace />
    return <Admin />
}

export default function App() {
    useEffect(() => {
        // Trigger silent background health check to wake up Render free tier container immediately on app mount
        warmupBackendServer()

        // Prefetch grooming services in background so booking loads instantly
        appointmentsApi.getServices().catch(() => { })

        // Send a heartbeat ping every 4 minutes to keep Render backend container warm while user browses
        const interval = setInterval(() => {
            warmupBackendServer()
        }, 4 * 60 * 1000)

        return () => clearInterval(interval)
    }, [])

    return (
        <BrowserRouter>
            <ScrollToTop />
            <Routes>
                <Route element={<AppLayout />}>
                    <Route path='/' element={<Home />} />
                    <Route path='/services' element={<Services />} />
                    <Route path='/about' element={<About />} />
                    <Route path='/contact' element={<Contact />} />
                    <Route path='/privacy-policy' element={<PrivacyPolicy />} />
                    <Route path='/terms-of-service' element={<TermsOfService />} />

                    <Route element={<GuestRoute />}>
                        <Route path='/login' element={<Login />} />
                        <Route path='/signup' element={<Signup />} />
                    </Route>
                    <Route path='/forgot-password' element={<ForgotPassword />} />
                    <Route path='/complete-profile' element={<CompleteProfileEntry />} />

                    <Route element={<ProtectedRoute />}>
                        <Route element={<ProfileCompletionRoute />}>
                            <Route path='/dashboard' element={<UserDashboard />} />
                            <Route path='/booking' element={<Booking />} />
                            <Route path='/my-pets' element={<MyPets />} />
                            <Route path='/appointments' element={<Appointments />} />
                            <Route path='/profile' element={<Profile />} />
                        </Route>
                    </Route>

                    <Route path='/admin' element={<AdminEntry />} />
                    <Route path='*' element={<Navigate to='/' replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}
