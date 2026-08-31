import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../utils/api'
import loginImage from '../assets/images/login-groomer.png'

export default function ForgotPassword() {
    const { sendPasswordOtp, resetPasswordWithOtp } = useAuth()
    const navigate = useNavigate()

    const [step, setStep] = useState('request')
    const [form, setForm] = useState({ identifier: '', otp: '', newPassword: '', confirmPassword: '' })
    const [otpTimer, setOtpTimer] = useState(0)
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (otpTimer <= 0) return
        const interval = setInterval(() => {
            setOtpTimer((prev) => prev - 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [otpTimer])

    const canReset = useMemo(() =>
        /^\d{6}$/.test(form.otp) && form.newPassword.length >= 8 && form.newPassword === form.confirmPassword,
        [form.otp, form.newPassword, form.confirmPassword]
    )

    const update = (e) => {
        const { name, value } = e.target
        setForm((c) => ({ ...c, [name]: name === 'otp' ? value.replace(/\D/g, '').slice(0, 6) : value }))
    }

    const requestOtp = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const data = await sendPasswordOtp(form.identifier)
            toast.success(data.message)
            setStep('verify')
            setOtpTimer(60)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    const resendPasswordOtp = async () => {
        if (otpTimer > 0 || submitting) return
        setSubmitting(true)
        try {
            const data = await sendPasswordOtp(form.identifier)
            setOtpTimer(60)
            toast.success(data.message || 'New verification code sent')
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    const resetPassword = async (e) => {
        e.preventDefault()
        if (form.newPassword !== form.confirmPassword) { toast.error('Passwords do not match'); return }
        setSubmitting(true)
        try {
            await resetPasswordWithOtp({ identifier: form.identifier, otp: form.otp, newPassword: form.newPassword })
            setStep('success')
            toast.success('Password updated successfully')
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className='min-h-screen w-full bg-[#F6F7F2] text-[#13231B] lg:grid lg:h-screen lg:grid-cols-12 lg:overflow-hidden'>

            {/* Left Image Side */}
            <div className='relative hidden h-full overflow-hidden bg-[#13231B] lg:col-span-5 lg:block xl:col-span-6'>
                <img
                    src={loginImage}
                    alt='A groomer caring for a pet'
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
                        &ldquo;Recover your account securely using the mobile number connected to your profile.&rdquo;
                    </p>
                    <p className='mt-2 text-xs font-bold uppercase tracking-widest text-[#F6F7F2]'>
                        TimmyTails Pet Grooming
                    </p>
                </div>
            </div>

            {/* Right Panel */}
            <div className='flex h-full min-h-screen items-center justify-center p-6 lg:col-span-7 lg:min-h-0 lg:overflow-y-auto xl:col-span-6'>
                <div className='my-auto w-full max-w-md py-4'>

                    {/* Back link */}
                    <Link
                        to='/login'
                        className='group mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#405148] transition hover:text-[#13231B]'
                    >
                        <ArrowLeft size={14} className='transition-transform duration-200 group-hover:-translate-x-1' />
                        <span>Back to Sign In</span>
                    </Link>

                    {/* Brand title */}
                    <div className='mb-2 flex items-center gap-2.5'>
                        <img src='/logo.png' alt='TimmyTails logo' className='h-7 w-7 rounded-full object-cover shadow-xs ring-1 ring-[#DDE4DE] bg-white' />
                        <span className='font-serif text-xl font-bold tracking-tight text-[#13231B]'>
                            TimmyTails
                        </span>
                    </div>

                    {/* Card Container */}
                    <div className='rounded-xl border border-[#DDE4DE] bg-white p-6 sm:p-8'>

                        {/* Step: Request */}
                        {step === 'request' && (
                            <>
                                <div className='mb-4 inline-grid h-10 w-10 place-items-center rounded-lg bg-[#F6F7F2] text-[#2F6B57]'>
                                    <KeyRound size={20} />
                                </div>

                                <h1 className='font-serif text-2xl font-bold tracking-tight text-[#13231B]'>
                                    Forgot Password?
                                </h1>
                                <p className='mt-1 text-sm text-[#405148]'>
                                    Enter your email or mobile number to receive a 6-digit recovery OTP code.
                                </p>

                                <form onSubmit={requestOtp} className='mt-6 space-y-4'>
                                    <Field
                                        label='Email Address or Mobile Number'
                                        name='identifier'
                                        value={form.identifier}
                                        onChange={update}
                                        placeholder='you@example.com or 0917 123 4567'
                                        autoComplete='username'
                                    />
                                    <button
                                        disabled={submitting}
                                        className='h-10 w-full rounded-lg bg-[#2F6B57] font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E] disabled:opacity-60 text-sm'
                                    >
                                        {submitting ? 'Sending code...' : 'Send Recovery Code'}
                                    </button>
                                </form>
                            </>
                        )}

                        {/* Step: Verify & Reset */}
                        {step === 'verify' && (
                            <>
                                <div className='mb-4 inline-grid h-10 w-10 place-items-center rounded-lg bg-[#E4F1EA] text-[#216245]'>
                                    <ShieldCheck size={20} />
                                </div>

                                <h1 className='font-serif text-2xl font-bold tracking-tight text-[#13231B]'>
                                    Create New Password
                                </h1>
                                <p className='mt-1 text-sm text-[#405148]'>
                                    Enter the verification code sent to your phone, then choose a new password.
                                </p>

                                <form onSubmit={resetPassword} className='mt-6 space-y-4'>
                                    <Field
                                        label='Six-Digit Verification Code'
                                        name='otp'
                                        value={form.otp}
                                        onChange={update}
                                        inputMode='numeric'
                                        placeholder='000000'
                                        minLength={6}
                                        maxLength={6}
                                    />
                                    <PasswordField
                                        label='New Password'
                                        name='newPassword'
                                        value={form.newPassword}
                                        onChange={update}
                                        visible={showPassword}
                                        toggle={() => setShowPassword((c) => !c)}
                                    />
                                    <PasswordField
                                        label='Confirm New Password'
                                        name='confirmPassword'
                                        value={form.confirmPassword}
                                        onChange={update}
                                        visible={showPassword}
                                        toggle={() => setShowPassword((c) => !c)}
                                    />

                                    <button
                                        disabled={submitting || !canReset}
                                        className='h-10 w-full rounded-lg bg-[#2F6B57] font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E] disabled:opacity-60 text-sm'
                                    >
                                        {submitting ? 'Updating password...' : 'Update Password'}
                                    </button>

                                    <div className='flex items-center justify-between rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] p-3 text-xs text-[#405148]'>
                                        <span>{otpTimer > 0 ? `Resend code available in ${otpTimer}s` : "Didn't receive the code?"}</span>
                                        <button
                                            type='button'
                                            onClick={resendPasswordOtp}
                                            disabled={submitting || otpTimer > 0}
                                            className='font-bold text-[#2F6B57] transition hover:underline disabled:opacity-50 disabled:no-underline'
                                        >
                                            {otpTimer > 0 ? `Resend (${otpTimer}s)` : 'Resend OTP'}
                                        </button>
                                    </div>

                                    <button
                                        type='button'
                                        onClick={() => setStep('request')}
                                        className='w-full text-xs font-bold text-[#2F6B57] hover:underline'
                                    >
                                        &larr; Use Different Email or Number
                                    </button>
                                </form>
                            </>
                        )}

                        {/* Step: Success */}
                        {step === 'success' && (
                            <div className='py-4 text-center'>
                                <span className='mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#E4F1EA] text-[#216245]'>
                                    <CheckCircle2 size={28} />
                                </span>
                                <h1 className='mt-4 font-serif text-2xl font-bold text-[#13231B]'>Password Updated!</h1>
                                <p className='mt-1 text-sm text-[#405148]'>
                                    Your account password was changed successfully.
                                </p>
                                <button
                                    onClick={() => navigate('/login', { replace: true })}
                                    className='mt-6 h-10 w-full rounded-lg bg-[#2F6B57] font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E] text-sm'
                                >
                                    Return to Sign In
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function Field({ label, ...props }) {
    return (
        <label className='block'>
            <span className='mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#405148]'>{label}</span>
            <input
                required
                className='h-10 w-full rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 text-sm font-medium text-[#13231B] outline-none transition focus:border-[#2F6B57] focus:ring-2 focus:ring-[#2F6B57]/20 placeholder:text-[#9AA69F]'
                {...props}
            />
        </label>
    )
}

function PasswordField({ label, visible, toggle, ...props }) {
    return (
        <label className='block'>
            <span className='mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#405148]'>{label}</span>
            <span className='relative block'>
                <input
                    required
                    type={visible ? 'text' : 'password'}
                    minLength={8}
                    className='h-10 w-full rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] pl-3.5 pr-10 text-sm font-medium text-[#13231B] outline-none transition focus:border-[#2F6B57] focus:ring-2 focus:ring-[#2F6B57]/20 placeholder:text-[#9AA69F]'
                    {...props}
                />
                <button
                    type='button'
                    onClick={toggle}
                    className='absolute right-2.5 top-1/2 -translate-y-1/2 text-[#F6F7F2] hover:text-[#405148]'
                    aria-label={visible ? 'Hide password' : 'Show password'}
                >
                    {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </span>
        </label>
    )
}
