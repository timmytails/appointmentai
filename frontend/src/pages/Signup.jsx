import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage, warmupBackendServer } from '../utils/api'
import { normalizePhilippinePhone } from '../utils/phone'
import PhoneField from '../components/PhoneField'
import { consumeReturnTo, peekReturnTo, rememberReturnTo, resolvePostLoginRoute } from '../utils/authRouting'
import GoogleSignInButton from '../features/auth/components/GoogleSignInButton'
import loginImage from '../assets/images/login-groomer.png'

const initialForm = {
    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
    address: { street: '', barangay: '', city: '', province: '' }
}

export default function Signup() {
    const [form, setForm] = useState(initialForm)
    const [otp, setOtp] = useState('')
    const [otpTimer, setOtpTimer] = useState(0)
    const [step, setStep] = useState('details')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        warmupBackendServer()
    }, [])

    useEffect(() => {
        if (otpTimer <= 0) return
        const interval = setInterval(() => {
            setOtpTimer((prev) => prev - 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [otpTimer])

    const { sendRegisterOtp, register, googleLogin } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    const requestedReturnTo = useMemo(() => {
        const statePath = location.state?.returnTo
        if (statePath) rememberReturnTo(statePath)
        return statePath || peekReturnTo()
    }, [location.state])

    const routeAfterAuth = useCallback((user) => {
        const returnTo = consumeReturnTo() || requestedReturnTo
        if (!user?.profileCompleted && returnTo) rememberReturnTo(returnTo)
        navigate(resolvePostLoginRoute({ user, returnTo }), { replace: true })
    }, [navigate, requestedReturnTo])

    const update = (e) => setForm((c) => ({ ...c, [e.target.name]: e.target.value }))
    const updateAddress = (e) => setForm((c) => ({ ...c, address: { ...c.address, [e.target.name]: e.target.value } }))

    const requestOtp = async (e) => {
        e.preventDefault()
        if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }
        const normalizedPhone = normalizePhilippinePhone(form.phone)
        if (!normalizedPhone) { toast.error('Enter a valid mobile number using +63 or 09 format'); return }
        setSubmitting(true)
        try {
            await sendRegisterOtp({ firstName: form.firstName, lastName: form.lastName, email: form.email.trim() || undefined, phone: normalizedPhone, address: form.address, password: form.password })
            setForm((c) => ({ ...c, phone: normalizedPhone }))
            setStep('otp')
            setOtpTimer(60)
            toast.success('Verification code sent')
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    const resendOtp = async () => {
        if (otpTimer > 0 || submitting) return
        setSubmitting(true)
        try {
            await sendRegisterOtp({ firstName: form.firstName, lastName: form.lastName, email: form.email.trim() || undefined, phone: form.phone, address: form.address, password: form.password })
            setOtpTimer(60)
            toast.success('New verification code sent')
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    const verifyOtp = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const data = await register(normalizePhilippinePhone(form.phone), otp)
            toast.success('Account created')
            routeAfterAuth(data.user)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    const handleGoogle = useCallback(async (credential) => {
        setSubmitting(true)
        try {
            const data = await googleLogin(credential)
            routeAfterAuth(data.user)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }, [googleLogin, routeAfterAuth])

    return (
        <div className='min-h-screen bg-[#F6F7F2] text-[#13231B] lg:grid lg:min-h-screen lg:grid-cols-12'>

            {/* Left Photo Panel (Desktop) */}
            <div className='relative hidden h-full overflow-hidden bg-[#13231B] lg:col-span-5 lg:block xl:col-span-4'>
                <img
                    src={loginImage}
                    alt='Professional groomer at TimmyTails'
                    className='h-full w-full object-cover opacity-60'
                />
                <div className='absolute inset-0 bg-[#13231B]/40' />

                <div className='absolute left-8 top-8 flex items-center gap-3'>
                    <img src='/logo.png' alt='TimmyTails logo' className='h-9 w-9 rounded-full object-cover shadow-xs ring-2 ring-white/30 bg-white' />
                    <span className='font-serif text-2xl font-bold tracking-tight text-[#F6F7F2]'>
                        TimmyTails
                    </span>
                </div>

                <div className='absolute bottom-10 left-10 right-10 border-l-2 border-[#2F6B57] pl-4 text-[#F6F7F2]'>
                    <p className='font-serif text-xl leading-relaxed text-[#F6F7F2]'>
                        &ldquo;Join pet owners who trust TimmyTails for gentle, professional grooming.&rdquo;
                    </p>
                    <p className='mt-2 text-xs font-bold uppercase tracking-widest text-[#F6F7F2]'>
                        TimmyTails Pet Grooming
                    </p>
                </div>
            </div>

            {/* Right Form Panel */}
            <div className='flex min-h-screen items-start justify-center px-4 py-10 sm:px-6 sm:py-14 lg:col-span-7 lg:overflow-y-auto xl:col-span-8'>
                <div className='w-full max-w-2xl'>

                    {/* Back */}
                    <Link
                        to='/'
                        className='group mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#405148] transition hover:text-[#13231B]'
                    >
                        <ArrowLeft size={14} className='transition-transform duration-200 group-hover:-translate-x-1' />
                        <span>Back to Home</span>
                    </Link>

                    {/* Card Container */}
                    <div className='rounded-xl border border-[#DDE4DE] bg-white p-6 sm:p-10'>

                        {/* Brand */}
                        <div className='mb-2 flex items-center gap-2.5'>
                            <img src='/logo.png' alt='TimmyTails logo' className='h-7 w-7 rounded-full object-cover shadow-xs ring-1 ring-[#DDE4DE] bg-white' />
                            <span className='font-serif text-xl font-bold tracking-tight text-[#13231B]'>
                                TimmyTails
                            </span>
                        </div>
                        <h1 className='font-serif text-3xl font-bold tracking-tight text-[#13231B]'>
                            Create Account
                        </h1>
                        <p className='mt-1 text-sm text-[#405148]'>
                            Register with Google or verify your mobile number to get started.
                        </p>

                        {step === 'details' ? (
                            <>
                                {/* Google SSO */}
                                <div className='mx-auto mt-6 flex w-full max-w-sm justify-center'>
                                    <GoogleSignInButton onCredential={handleGoogle} disabled={submitting} text='signup_with' />
                                </div>

                                {/* Divider */}
                                <div className='my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-[#F6F7F2]'>
                                    <span className='h-px flex-1 bg-[#F6F7F2]' />
                                    <span>or register manually</span>
                                    <span className='h-px flex-1 bg-[#F6F7F2]' />
                                </div>

                                {/* Registration Form */}
                                <form onSubmit={requestOtp} className='space-y-4'>
                                    <div className='grid gap-4 sm:grid-cols-2'>
                                        <Field label='First Name' name='firstName' value={form.firstName} onChange={update} />
                                        <Field label='Last Name' name='lastName' value={form.lastName} onChange={update} />
                                    </div>
                                    <div className='grid gap-4 sm:grid-cols-2'>
                                        <Field
                                            label='Email Address'
                                            name='email'
                                            type='email'
                                            required={false}
                                            value={form.email}
                                            onChange={update}
                                            placeholder='example@gmail.com'
                                            help='Optional — enables email notifications.'
                                        />
                                        <PhoneField label='Mobile Number' name='phone' value={form.phone} onChange={update} placeholder='917 123 4567' />
                                    </div>

                                    {/* Address Block */}
                                    <div className='rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] p-5'>
                                        <h2 className='font-serif text-base font-bold text-[#13231B]'>Home Address</h2>
                                        <p className='mt-0.5 text-xs text-[#405148]'>Used for appointment confirmation.</p>
                                        <div className='mt-4 space-y-4'>
                                            <Field label='Street / House Number' name='street' value={form.address.street} onChange={updateAddress} placeholder='e.g. 123 Grooming Street' />
                                            <div className='grid gap-4 sm:grid-cols-2'>
                                                <Field label='Barangay' name='barangay' value={form.address.barangay} onChange={updateAddress} />
                                                <Field label='City' name='city' value={form.address.city} onChange={updateAddress} />
                                            </div>
                                            <Field label='Province' name='province' value={form.address.province} onChange={updateAddress} />
                                        </div>
                                    </div>

                                    {/* Password Block */}
                                    <div className='grid gap-4 sm:grid-cols-2'>
                                        <Field label='Password' name='password' type='password' value={form.password} onChange={update} minLength={8} />
                                        <Field label='Confirm Password' name='confirmPassword' type='password' value={form.confirmPassword} onChange={update} minLength={8} />
                                    </div>

                                    <button
                                        type='submit'
                                        disabled={submitting}
                                        className='flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2F6B57] px-4 text-sm font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E] disabled:opacity-60'
                                    >
                                        {submitting ? (
                                            <><Loader2 size={16} className='animate-spin' /><span>Sending code...</span></>
                                        ) : (
                                            <span>Send Verification Code</span>
                                        )}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <form onSubmit={verifyOtp} className='mt-6 space-y-4'>
                                <div className='rounded-lg border border-[#DDE4DE]/30 bg-[#2F6B57]/10 p-4 text-sm font-medium text-[#13231B]'>
                                    Enter the 6-digit verification code sent to{' '}
                                    <strong className='text-[#2F6B57]'>{form.phone}</strong>.
                                </div>

                                <Field
                                    label='Six-Digit Verification Code'
                                    name='otp'
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    inputMode='numeric'
                                    minLength={6}
                                    maxLength={6}
                                    placeholder='000000'
                                />

                                <button
                                    type='submit'
                                    disabled={submitting || otp.length !== 6}
                                    className='flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2F6B57] px-4 text-sm font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E] disabled:opacity-60'
                                >
                                    {submitting ? (
                                        <><Loader2 size={16} className='animate-spin' /><span>Creating account...</span></>
                                    ) : (
                                        <span>Verify &amp; Create Account</span>
                                    )}
                                </button>

                                <div className='flex items-center justify-between rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] p-3 text-xs text-[#405148]'>
                                    <span>{otpTimer > 0 ? `Resend code available in ${otpTimer}s` : "Didn't receive the code?"}</span>
                                    <button
                                        type='button'
                                        onClick={resendOtp}
                                        disabled={submitting || otpTimer > 0}
                                        className='font-bold text-[#2F6B57] transition hover:underline disabled:opacity-50 disabled:no-underline'
                                    >
                                        {otpTimer > 0 ? `Resend (${otpTimer}s)` : 'Resend Code'}
                                    </button>
                                </div>

                                <button
                                    type='button'
                                    onClick={() => setStep('details')}
                                    className='w-full text-xs font-bold text-[#2F6B57] hover:underline'
                                >
                                    &larr; Edit Registration Details
                                </button>
                            </form>
                        )}

                        <p className='mt-6 text-center text-xs text-[#405148] sm:text-sm'>
                            Already registered?{' '}
                            <Link to='/login' state={{ returnTo: requestedReturnTo }} className='font-bold text-[#2F6B57] transition hover:underline'>
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Field({ label, help, required = true, ...props }) {
    return (
        <label className='block'>
            <span className='mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#405148]'>{label}</span>
            <input
                required={required}
                className='h-10 w-full rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 text-sm font-medium text-[#13231B] outline-none transition focus:border-[#2F6B57] focus:ring-2 focus:ring-[#2F6B57]/20 placeholder:text-[#9AA69F]'
                {...props}
            />
            {help && <span className='mt-1 block text-[11px] text-[#405148]'>{help}</span>}
        </label>
    )
}
