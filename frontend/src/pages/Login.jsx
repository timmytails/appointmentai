import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Ban, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage, warmupBackendServer } from '../utils/api'
import { consumeReturnTo, peekReturnTo, rememberReturnTo, resolvePostLoginRoute } from '../utils/authRouting'
import GoogleSignInButton from '../features/auth/components/GoogleSignInButton'
import loginImage from '../assets/images/login-groomer.png'

export default function Login() {
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const location = useLocation()
    const navigate = useNavigate()
    const { login, googleLogin } = useAuth()

    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
    const urlReason = searchParams.get('reason')
    const urlMsg = searchParams.get('msg')

    const initialBanMsg = useMemo(() => {
        if (urlReason === 'banned' || urlReason === 'blocked' || urlReason === 'suspended') {
            return urlMsg || 'Your customer account has been suspended by salon administration.'
        }
        return ''
    }, [urlReason, urlMsg])

    const [banErrorMsg, setBanErrorMsg] = useState(initialBanMsg)
    const [googleHintMsg, setGoogleHintMsg] = useState('')

    useEffect(() => {
        if (initialBanMsg) setBanErrorMsg(initialBanMsg)
    }, [initialBanMsg])

    useEffect(() => {
        // Pre-warm backend container as soon as user opens Login page
        warmupBackendServer()
    }, [])

    const requestedReturnTo = useMemo(() => {
        const statePath = location.state?.returnTo || location.state?.from
        if (statePath) rememberReturnTo(statePath)
        return statePath || peekReturnTo()
    }, [location.state])

    const finishLogin = useCallback((user) => {
        const returnTo = consumeReturnTo() || requestedReturnTo
        if (!user?.profileCompleted && returnTo) rememberReturnTo(returnTo)
        navigate(resolvePostLoginRoute({ user, returnTo }), { replace: true })
    }, [navigate, requestedReturnTo])

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (submitting) return
        setSubmitting(true)
        setBanErrorMsg('')
        setGoogleHintMsg('')
        try {
            const data = await login(identifier.trim(), password)
            toast.success('Signed in successfully')
            finishLogin(data.user)
        } catch (error) {
            const msg = getErrorMessage(error)
            const code = error?.response?.data?.code
            if (code === 'GOOGLE_AUTH_REQUIRED' || msg.toLowerCase().includes('google')) {
                setGoogleHintMsg(msg || 'This account was created with Google. Click "Continue with Google" below to sign in.')
            } else if (error?.response?.status === 403 || msg.toLowerCase().includes('suspended') || msg.toLowerCase().includes('banned') || msg.toLowerCase().includes('blocked')) {
                setBanErrorMsg(msg || 'Your customer account has been suspended by salon administration.')
            }
            toast.error(msg)
        } finally {
            setSubmitting(false)
        }
    }

    const handleGoogle = useCallback(async (credential) => {
        setSubmitting(true)
        setBanErrorMsg('')
        setGoogleHintMsg('')
        try {
            const data = await googleLogin(credential)
            toast.success(data.user.profileCompleted ? 'Signed in successfully' : 'Complete your profile to continue')
            finishLogin(data.user)
        } catch (error) {
            const msg = getErrorMessage(error)
            if (error?.response?.status === 403 || msg.toLowerCase().includes('suspended') || msg.toLowerCase().includes('banned') || msg.toLowerCase().includes('blocked')) {
                setBanErrorMsg(msg || 'Your customer account has been suspended by salon administration.')
            }
            toast.error(msg)
        } finally {
            setSubmitting(false)
        }
    }, [finishLogin, googleLogin])

    return (
        <div className='min-h-screen bg-[#F6F7F2] text-[#13231B] lg:grid lg:grid-cols-[1.05fr_.95fr]'>
            <section className='relative hidden min-h-screen overflow-hidden bg-[#13231B] lg:block'>
                <img src={loginImage} alt='Professional groomer pampering a pet' className='absolute inset-0 h-full w-full object-cover opacity-75' />
                <div className='absolute inset-0 bg-gradient-to-t from-[#13231B] via-[#13231B]/25 to-[#13231B]/20' />
                <div className='relative flex h-full min-h-screen flex-col justify-between p-10 xl:p-14'>
                    <Link to='/' className='flex w-fit items-center gap-3 text-white transition hover:opacity-85'>
                        <img src='/logo.png' alt='TimmyTails logo' className='h-10 w-10 rounded-full object-cover shadow-xs ring-2 ring-white/30 bg-white' />
                        <span className='font-serif text-3xl font-bold tracking-tight'>TimmyTails</span>
                    </Link>
                    <div className='max-w-xl'>
                        <span className='inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#F3D58C] backdrop-blur'>Your pet-care workspace</span>
                        <h2 className='mt-5 font-serif text-5xl leading-[.98] tracking-[-.03em] text-white xl:text-6xl'>Pick up right where your last visit left off.</h2>
                        <p className='mt-5 max-w-lg text-sm leading-7 text-[#D2DDD6]'>Appointments, pet profiles, style references, and visit history stay connected to one account.</p>
                    </div>
                </div>
            </section>

            <main className='flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-12'>
                <div className='w-full max-w-[470px]'>
                    <Link to='/' className='group mb-8 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#68776F] hover:text-[#13231B]'>
                        <ArrowLeft size={14} className='transition-transform group-hover:-translate-x-1' />Back to home
                    </Link>

                    <div className='mb-8 flex items-center gap-3 lg:hidden'>
                        <img src='/logo.png' alt='TimmyTails logo' className='h-9 w-9 rounded-full object-cover shadow-xs ring-2 ring-[#DDE4DE] bg-white' />
                        <p className='font-serif text-2xl font-bold tracking-tight text-[#13231B]'>TimmyTails</p>
                    </div>

                    <p className='text-[10px] font-extrabold uppercase tracking-[.16em] text-[#2F6B57]'>Welcome back</p>
                    <h1 className='mt-3 font-serif text-4xl tracking-[-.02em] sm:text-5xl'>Sign in to your account.</h1>
                    <p className='mt-3 max-w-md text-sm leading-6 text-[#68776F]'>Manage appointments, pet profiles, and grooming preferences in one place.</p>

                    {location.state?.reason === 'booking-required' && (
                        <div className='mt-5 rounded-2xl border border-[#C9D9CE] bg-[#EDF3EE] px-4 py-3 text-xs font-bold text-[#1F4D3E]'>Sign in first, then we’ll return you to your booking.</div>
                    )}

                    {banErrorMsg && (
                        <div className='mt-5 rounded-2xl border border-[#F0CCCC] bg-[#FBEAEA] p-4 text-left'>
                            <div className='flex items-start gap-3'>
                                <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#9E3E3E]'><Ban size={17} /></span>
                                <div><h4 className='text-xs font-extrabold uppercase tracking-[.12em] text-[#7F3333]'>Account access suspended</h4><p className='mt-1 text-xs font-medium leading-6 text-[#7F3333]'>{banErrorMsg}</p></div>
                            </div>
                        </div>
                    )}

                    {googleHintMsg && (
                        <div className='mt-5 rounded-2xl border border-[#F0DEB6] bg-[#FFF9EC] p-4 text-left animate-in fade-in'>
                            <div className='flex items-start gap-3'>
                                <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white shadow-xs'>
                                    <svg className='h-4 w-4' viewBox='0 0 24 24'>
                                        <path fill='#4285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' />
                                        <path fill='#34A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' />
                                        <path fill='#FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z' />
                                        <path fill='#EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z' />
                                    </svg>
                                </span>
                                <div>
                                    <h4 className='text-xs font-extrabold uppercase tracking-[.12em] text-[#8A5D13]'>Signed up with Google?</h4>
                                    <p className='mt-1 text-xs font-medium leading-5 text-[#6E4A0D]'>{googleHintMsg}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <form id='login-form' onSubmit={handleSubmit} className='mt-7 space-y-5'>
                        <label className='block'>
                            <span className='mb-2 block text-xs font-extrabold text-[#405148]'>Phone number or email</span>
                            <input
                                id='login-identifier'
                                type='text'
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                autoComplete='username'
                                placeholder='0917 123 4567 or email@example.com'
                                className='h-12 w-full rounded-xl border border-[#D5DDD7] bg-white px-4 text-sm font-medium text-[#13231B] outline-none transition placeholder:text-[#9AA69F] focus:border-[#2F6B57] focus:ring-4 focus:ring-[#DCE9E0]'
                            />
                        </label>

                        <label className='block'>
                            <span className='mb-2 block text-xs font-extrabold text-[#405148]'>Password</span>
                            <div className='relative'>
                                <input
                                    id='login-password'
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete='current-password'
                                    placeholder='Enter your password'
                                    className='h-12 w-full rounded-xl border border-[#D5DDD7] bg-white pl-4 pr-11 text-sm font-medium text-[#13231B] outline-none transition placeholder:text-[#9AA69F] focus:border-[#2F6B57] focus:ring-4 focus:ring-[#DCE9E0]'
                                />
                                <button type='button' onClick={() => setShowPassword((p) => !p)} className='absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8880] hover:text-[#13231B]' aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                            </div>
                            <span className='mt-2 flex justify-end'><Link to='/forgot-password' className='text-xs font-extrabold text-[#2F6B57] hover:underline'>Forgot password?</Link></span>
                        </label>

                        <button type='submit' disabled={submitting} className='tt-primary h-12 w-full text-sm disabled:opacity-60'>
                            {submitting ? <><Loader2 size={16} className='animate-spin' />Signing in…</> : 'Sign in'}
                        </button>
                    </form>

                    <div className='my-6 flex items-center gap-3 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#9AA69F]'><span className='h-px flex-1 bg-[#DDE4DE]' /><span>or continue with</span><span className='h-px flex-1 bg-[#DDE4DE]' /></div>
                    <div className='mx-auto flex w-full justify-center'><GoogleSignInButton onCredential={handleGoogle} disabled={submitting} text='continue_with' /></div>

                    <p className='mt-7 text-center text-sm text-[#68776F]'>New to TimmyTails? <Link to='/signup' state={{ returnTo: requestedReturnTo }} className='font-extrabold text-[#1F4D3E] hover:underline'>Create an account</Link></p>
                </div>
            </main>
        </div>
    )
}