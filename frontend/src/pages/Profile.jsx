import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, LockKeyhole, LogOut, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../utils/api'
import { normalizePhilippinePhone } from '../utils/phone'
import PhoneField from '../components/PhoneField'

const emptyAddress = { street: '', barangay: '', city: '', province: '' }

export default function Profile() {
    const { user, sendProfilePhoneOtp, updateProfile, logout } = useAuth()
    const navigate = useNavigate()

    const [form, setForm] = useState({ email: '', phone: '', address: emptyAddress })
    const [phoneOtp, setPhoneOtp] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [otpTimer, setOtpTimer] = useState(0)
    const [sendingOtp, setSendingOtp] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const handleLogout = () => {
        logout()
        toast.success('Signed out successfully')
        navigate('/')
    }

    useEffect(() => {
        if (otpTimer <= 0) return
        const interval = setInterval(() => {
            setOtpTimer((prev) => prev - 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [otpTimer])

    useEffect(() => {
        if (!user) return
        setForm({
            email: user.email || '',
            phone: user.phone || '',
            address: {
                street: user.address?.street || '',
                barangay: user.address?.barangay || '',
                city: user.address?.city || '',
                province: user.address?.province || ''
            }
        })
    }, [user])

    const initials = useMemo(() => {
        if (!user) return ''
        const f = user.firstName?.[0] || ''
        const l = user.lastName?.[0] || ''
        return `${f}${l}`.toUpperCase()
    }, [user])

    const phoneChanged = useMemo(() => {
        if (!user) return false
        const currentNormalized = normalizePhilippinePhone(form.phone)
        const savedNormalized = normalizePhilippinePhone(user.phone || '')
        return currentNormalized && currentNormalized !== savedNormalized
    }, [form.phone, user])

    const googleAccount = Boolean(user?.googleId)

    const updateAddress = (e) => {
        const { name, value } = e.target
        setForm((c) => ({ ...c, address: { ...c.address, [name]: value } }))
    }

    const updatePhoneField = (e) => {
        const val = e.target.value
        setForm((c) => ({ ...c, phone: val }))
        setOtpSent(false)
        setPhoneOtp('')
    }

    const requestPhoneOtp = async () => {
        if (!form.phone) { toast.error('Please enter a phone number'); return }
        setSendingOtp(true)
        try {
            const data = await sendProfilePhoneOtp(form.phone)
            setOtpSent(true)
            setOtpTimer(60)
            toast.success(data.message || 'Verification code sent to your phone')
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSendingOtp(false)
        }
    }

    const submit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const payload = {
                email: form.email,
                phone: form.phone,
                address: form.address,
                phoneOtp: phoneChanged ? phoneOtp : undefined
            }
            await updateProfile(payload)
            toast.success('Profile updated successfully')
            setOtpSent(false)
            setPhoneOtp('')
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className='min-h-screen bg-[#F6F7F2] px-4 py-8 text-[#13231B] sm:px-6 lg:px-8'>
            <div className='mx-auto max-w-2xl'>

                {/* Page Title */}
                <div className='mb-6'>
                    <span className='text-xs font-extrabold uppercase tracking-[0.22em] text-[#2F6B57]'>
                        Account Settings
                    </span>
                    <h1 className='mt-2 font-serif text-3xl font-bold tracking-tight text-[#13231B] sm:text-4xl'>
                        My Profile
                    </h1>
                    <p className='mt-1 text-sm text-[#405148]'>
                        Manage your account information, mobile phone verification, and delivery address.
                    </p>
                </div>

                <form onSubmit={submit} className='space-y-6'>
                    {/* Profile Header Card */}
                    <div className='rounded-2xl border border-[#DDE4DE] bg-white p-5 shadow-xs sm:p-6'>
                        <div className='flex items-center justify-between gap-3 sm:gap-4'>
                            <div className='flex items-center gap-3.5 min-w-0 sm:gap-4'>
                                <span className='grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#13231B] text-xl font-bold text-[#F6F7F2] sm:h-16 sm:w-16'>
                                    {user?.profileImage ? (
                                        <img src={user.profileImage} alt='Profile' className='h-full w-full object-cover' />
                                    ) : initials ? initials : (
                                        <UserRound size={26} />
                                    )}
                                </span>
                                <div className='min-w-0'>
                                    <h2 className='truncate font-serif text-lg font-bold text-[#13231B] sm:text-2xl'>
                                        {user?.firstName} {user?.lastName}
                                    </h2>
                                    <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                                        <span className='rounded-md border border-[#DDE4DE] bg-[#F6F7F2] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>
                                            Customer Account
                                        </span>
                                        {googleAccount && (
                                            <span className='rounded-md border border-[#C9D9CE] bg-[#EDF3EE] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1F4D3E]'>
                                                Google SSO
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type='button'
                                onClick={handleLogout}
                                className='inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#F0CCCC] bg-[#FBEAEA] px-3 py-2 text-xs font-bold text-[#9E3E3E] transition hover:bg-[#F4D6D6] sm:px-4 sm:py-2.5'
                                title='Sign out of your account'
                            >
                                <LogOut size={15} />
                                <span>Sign out</span>
                            </button>
                        </div>
                    </div>

                    {/* Personal Information */}
                    <div className='rounded-xl border border-[#DDE4DE] bg-[#F6F7F2]'>
                        <div className='flex items-center gap-2 border-b border-[#2F6B57] px-6 py-4'>
                            <LockKeyhole size={18} className='text-[#2F6B57]' />
                            <h3 className='font-serif text-lg font-bold text-[#13231B]'>Personal Details</h3>
                        </div>

                        <div className='space-y-4 p-6'>
                            <div className='grid gap-4 sm:grid-cols-2'>
                                <ReadOnlyField label='First Name' value={user?.firstName || ''} />
                                <ReadOnlyField label='Last Name' value={user?.lastName || ''} />
                            </div>

                            <div>
                                <Field
                                    label='Email Address'
                                    type='email'
                                    value={form.email}
                                    onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                                    readOnly={googleAccount}
                                    required={false}
                                    className={googleAccount
                                        ? 'h-10 w-full cursor-not-allowed rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 text-sm text-[#405148]'
                                        : undefined}
                                />
                                {googleAccount && (
                                    <p className='mt-1 text-xs text-[#405148]'>Managed by your Google account.</p>
                                )}
                            </div>

                            <div>
                                <PhoneField label='Mobile Number' name='phone' value={form.phone} onChange={updatePhoneField} placeholder='917 123 4567' help='Changing your number requires OTP verification.' />
                            </div>

                            {/* OTP Verification Block */}
                            {phoneChanged && (
                                <div className='rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] p-4'>
                                    <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                                        <div className='flex items-start gap-3'>
                                            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${otpSent ? 'bg-[#E4F1EA] text-[#216245]' : 'bg-[#F6F7F2] text-[#2F6B57]'}`}>
                                                {otpSent ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
                                            </span>
                                            <div>
                                                <p className='font-semibold text-[#13231B] text-sm'>Verify Mobile Number</p>
                                                <p className='mt-0.5 text-xs text-[#405148]'>
                                                    {otpSent ? (otpTimer > 0 ? `Code sent to ${form.phone}. Resend available in ${otpTimer}s.` : `A verification code was sent to ${form.phone}.`) : 'Request a security code to confirm ownership of this number.'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type='button'
                                            onClick={requestPhoneOtp}
                                            disabled={sendingOtp || (otpSent && otpTimer > 0)}
                                            className='shrink-0 rounded-lg border border-[#DDE4DE] px-3.5 py-1.5 text-xs font-bold text-[#2F6B57] transition hover:bg-[#1F4D3E]/10 disabled:opacity-60'
                                        >
                                            {sendingOtp ? 'Sending...' : otpSent ? (otpTimer > 0 ? `Resend (${otpTimer}s)` : 'Resend OTP') : 'Send Code'}
                                        </button>
                                    </div>

                                    {otpSent && (
                                        <div className='mt-4'>
                                            <Field
                                                label='Six-Digit Verification Code'
                                                inputMode='numeric'
                                                autoComplete='one-time-code'
                                                value={phoneOtp}
                                                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                minLength={6}
                                                maxLength={6}
                                                placeholder='000000'
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Address Section */}
                    <div className='rounded-xl border border-[#DDE4DE] bg-[#F6F7F2]'>
                        <div className='flex items-center gap-2 border-b border-[#2F6B57] px-6 py-4'>
                            <MapPin size={18} className='text-[#2F6B57]' />
                            <h3 className='font-serif text-lg font-bold text-[#13231B]'>Home Address</h3>
                        </div>

                        <div className='space-y-4 p-6'>
                            <Field label='Street / House Number' name='street' value={form.address.street} onChange={updateAddress} placeholder='e.g. 123 Grooming Street' />
                            <div className='grid gap-4 sm:grid-cols-2'>
                                <Field label='Barangay' name='barangay' value={form.address.barangay} onChange={updateAddress} />
                                <Field label='City' name='city' value={form.address.city} onChange={updateAddress} />
                            </div>
                            <Field label='Province' name='province' value={form.address.province} onChange={updateAddress} />
                        </div>
                    </div>

                    {/* Submit Actions */}
                    <div className='flex justify-end'>
                        <button
                            disabled={submitting || (phoneChanged && (!otpSent || phoneOtp.length !== 6))}
                            className='h-10 w-full rounded-lg bg-[#2F6B57] px-8 font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto text-sm'
                        >
                            {submitting ? 'Saving Profile...' : 'Save Profile Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ReadOnlyField({ label, value }) {
    return (
        <label className='block'>
            <FieldLabel>{label}</FieldLabel>
            <input value={value} readOnly className='h-10 w-full cursor-not-allowed rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 text-sm text-[#405148]' />
        </label>
    )
}

function FieldLabel({ children }) {
    return <span className='mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#405148]'>{children}</span>
}

function Field({ label, required = true, className, ...props }) {
    return (
        <label className='block'>
            <FieldLabel>{label}</FieldLabel>
            <input
                required={required}
                className={className || 'h-10 w-full rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 text-sm font-medium text-[#13231B] outline-none transition focus:border-[#2F6B57] focus:ring-2 focus:ring-[#2F6B57]/20 placeholder:text-[#9AA69F]'}
                {...props}
            />
        </label>
    )
}
