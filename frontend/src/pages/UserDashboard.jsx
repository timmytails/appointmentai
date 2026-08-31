import { createElement, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    AlertTriangle, ArrowRight, Ban, CalendarDays, Cat, ChevronRight, Clock3,
    Dog, Eye, Plus, Settings, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { appointmentsApi, getErrorMessage, petsApi } from '../utils/api'
import { formatDateLong, formatTimeRange } from '../features/booking/utils/dateTime'
import AppointmentDetailsModal from '../components/AppointmentDetailsModal'
import ConfirmModal from '../components/ConfirmModal'
import RescheduleModal from '../components/RescheduleModal'

const appointmentDate = (appointment, useEnd = false) => {
    const directValue = useEnd ? appointment.endAt : appointment.startAt
    if (directValue) return new Date(directValue)
    const time = useEnd ? (appointment.endTime || appointment.time) : appointment.time
    if (!appointment.date || !time) return new Date(0)
    return new Date(`${appointment.date}T${time}:00+08:00`)
}

const STATUS_STYLES = {
    confirmed: { pill: 'bg-[#E4F1EA] text-[#216245] border-[#C9E1D3]' },
    completed: { pill: 'bg-[#EDF3EE] text-[#405148] border-[#D7E2DA]' },
    cancelled: { pill: 'bg-[#FBEAEA] text-[#9E3E3E] border-[#F0CCCC]' },
    pending: { pill: 'bg-[#FFF4DC] text-[#8A5D13] border-[#F0DEB6]' }
}

export default function UserDashboard() {
    const { user, refreshUser } = useAuth()
    const [appointments, setAppointments] = useState([])
    const [pets, setPets] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [confirmCancelAppointment, setConfirmCancelAppointment] = useState(null)
    const [rescheduleAppointment, setRescheduleAppointment] = useState(null)
    const [cancelling, setCancelling] = useState(false)

    useEffect(() => {
        if (refreshUser) refreshUser()
    }, [refreshUser])

    useEffect(() => {
        if (user?.accountStatus === 'banned') {
            localStorage.removeItem('token')
            const msg = encodeURIComponent(user.statusReason || 'Your customer account has been suspended by salon administration.')
            if (window.location.pathname !== '/login') window.location.href = `/login?reason=banned&msg=${msg}`
        }
    }, [user])

    const loadData = () => {
        Promise.all([appointmentsApi.getMy(), petsApi.getMine()])
            .then(([ar, pr]) => {
                setAppointments(ar.data.appointments || [])
                setPets(pr.data.pets || [])
            })
            .catch((err) => {
                if (err.response?.status === 403) {
                    localStorage.removeItem('token')
                    const msg = encodeURIComponent(err.response?.data?.message || 'Your customer account has been suspended by salon administration.')
                    window.location.href = `/login?reason=banned&msg=${msg}`
                }
            })
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadData() }, [])

    const handleConfirmCancel = async () => {
        if (!confirmCancelAppointment) return
        setCancelling(true)
        try {
            await appointmentsApi.cancel(confirmCancelAppointment._id)
            toast.success('Appointment cancelled successfully')
            setConfirmCancelAppointment(null)
            await loadData()
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setCancelling(false)
        }
    }

    const upcoming = useMemo(() => appointments
        .filter((a) => ['pending', 'confirmed'].includes(a.status) && appointmentDate(a, true) >= new Date())
        .sort((a, b) => appointmentDate(a) - appointmentDate(b)), [appointments])

    const completedCount = appointments.filter((a) => a.status === 'completed').length
    const nextAppointment = upcoming[0]

    return (
        <div className='min-h-screen bg-[#F6F7F2] text-[#13231B]'>
            <div className='mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10'>
                <section className='grid gap-5 lg:grid-cols-[1fr_380px]'>
                    <div className='flex min-h-[300px] flex-col justify-between rounded-[2rem] bg-[#13231B] p-6 text-white sm:p-8 lg:p-10'>
                        <div className='flex items-start justify-between gap-6'>
                            <div>
                                <h1 className='max-w-2xl font-serif text-4xl leading-[.98] tracking-[-.02em] sm:text-5xl'>Good to see you, {user.firstName}.</h1>
                                <p className='mt-4 max-w-xl text-sm leading-7 text-[#BFCBC4]'>Everything for your pets and grooming visits, without digging through messages or forms.</p>
                            </div>
                            <Link to='/profile' className='grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 text-[#D7E1DB] hover:bg-white/10' aria-label='Profile settings'><Settings size={18} /></Link>
                        </div>
                        <div className='mt-10 flex flex-col gap-3 sm:flex-row sm:items-center'>
                            <Link to='/booking' className='inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E8795B] px-5 text-sm font-extrabold text-[#13231B] transition hover:bg-[#F18B70]'><Plus size={17} />Book a new visit</Link>
                            <Link to='/appointments' className='inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-extrabold text-white hover:bg-white/10'>View appointments <ArrowRight size={16} /></Link>
                        </div>
                    </div>

                    <aside className='rounded-[2rem] border border-[#DDE4DE] bg-white p-6 sm:p-7'>
                        <p className='text-[10px] font-extrabold uppercase tracking-[.16em] text-[#2F6B57]'>Next on your calendar</p>
                        {loading ? (
                            <div className='mt-8 h-32 animate-pulse rounded-2xl bg-[#EDF3EE]' />
                        ) : nextAppointment ? (
                            <button onClick={() => setSelectedAppointment(nextAppointment)} className='mt-7 w-full text-left'>
                                <div className='flex items-center justify-between gap-3'>
                                    <StatusPill status={nextAppointment.status} />
                                    <Eye size={17} className='text-[#7B8981]' />
                                </div>
                                <p className='mt-6 font-serif text-3xl leading-none'>{nextAppointment.petName}</p>
                                <p className='mt-2 text-sm font-bold text-[#405148]'>{nextAppointment.service}</p>
                                <div className='mt-5 grid gap-2 border-t border-[#E5EAE6] pt-4 text-xs font-bold text-[#68776F]'>
                                    <span className='inline-flex items-center gap-2'><CalendarDays size={14} className='text-[#2F6B57]' />{formatDateLong(nextAppointment.date)}</span>
                                    <span className='inline-flex items-center gap-2'><Clock3 size={14} className='text-[#2F6B57]' />{formatTimeRange(nextAppointment.time, nextAppointment.endTime)}</span>
                                </div>
                            </button>
                        ) : (
                            <div className='mt-8'>
                                <span className='grid h-12 w-12 place-items-center rounded-2xl bg-[#EDF3EE] text-[#2F6B57]'><CalendarDays size={21} /></span>
                                <p className='mt-5 font-serif text-2xl'>Nothing booked yet.</p>
                                <p className='mt-2 text-sm leading-6 text-[#68776F]'>Your next appointment will appear here once reserved.</p>
                            </div>
                        )}
                    </aside>
                </section>

                {user?.accountStatus === 'warned' && (
                    <div className='mt-5 flex items-start gap-3 rounded-2xl border border-[#E8D5A8] bg-[#FFF6E3] p-5 text-sm text-[#6E4A0D]'>
                        <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0' />
                        <div><p className='font-extrabold'>Account policy notice</p><p className='mt-1 leading-6'>{user.warningMessage || user.statusReason || 'You have received a formal warning regarding multiple booking cancellations or no-show policy violations. Please attend scheduled appointments on time.'}</p></div>
                    </div>
                )}

                {(user?.accountStatus === 'booking_blocked' || user?.accountStatus === 'banned') && (
                    <div className='mt-5 flex items-start gap-3 rounded-2xl border border-[#F0CCCC] bg-[#FBEAEA] p-5 text-sm text-[#7F3333]'>
                        <Ban className='mt-0.5 h-5 w-5 shrink-0' />
                        <div><p className='font-extrabold'>Booking privileges suspended</p><p className='mt-1 leading-6'>{user.statusReason || user.warningMessage || 'Your customer account has been blocked from scheduling new grooming appointments by salon administration.'}</p><p className='mt-2 text-xs font-bold'>Contact TimmyTails support at +63 975 669 2647 for assistance.</p></div>
                    </div>
                )}

                <section className='mt-5 grid gap-3 sm:grid-cols-3'>
                    <Metric label='Upcoming' value={upcoming.length} icon={CalendarDays} />
                    <Metric label='Saved pets' value={pets.length} icon={Dog} />
                    <Metric label='Completed visits' value={completedCount} icon={Sparkles} />
                </section>

                <div className='mt-10 grid gap-10 xl:grid-cols-[1.3fr_.7fr]'>
                    <section>
                        <SectionHeading icon={CalendarDays} title='Upcoming appointments' to='/appointments' action='See all visits' />
                        {loading ? (
                            <LoadingCard text='Loading your schedule…' />
                        ) : upcoming.length ? (
                            <div className='mt-4 overflow-hidden rounded-[1.5rem] border border-[#DDE4DE] bg-white'>
                                {upcoming.slice(0, 4).map((a, index) => {
                                    const petPhoto = a.pet?.photoUrl || a.photoUrl || pets.find((p) => p.name?.toLowerCase() === a.petName?.toLowerCase())?.photoUrl
                                    return (
                                        <button
                                            key={a._id}
                                            onClick={() => setSelectedAppointment(a)}
                                            className={`group grid w-full gap-4 p-5 text-left transition hover:bg-[#FAFBF8] sm:grid-cols-[64px_1fr_auto] sm:items-center ${index ? 'border-t border-[#E5EAE6]' : ''}`}
                                        >
                                            <div className='h-14 w-14 overflow-hidden rounded-2xl bg-[#EDF3EE]'>
                                                {petPhoto ? <img src={petPhoto} alt={a.petName} className='h-full w-full object-cover' /> : <div className='grid h-full w-full place-items-center text-[#2F6B57]'>{a.petType === 'cat' ? <Cat size={21} /> : <Dog size={21} />}</div>}
                                            </div>
                                            <div className='min-w-0'>
                                                <div className='flex flex-wrap items-center gap-2'><h3 className='font-serif text-xl'>{a.petName}</h3><StatusPill status={a.status} /></div>
                                                <p className='mt-1 truncate text-xs font-bold text-[#68776F]'>{a.service}{a.haircutStyle ? ` · ${a.haircutStyle}` : ''}</p>
                                                <p className='mt-2 text-xs font-extrabold text-[#2F6B57]'>{formatDateLong(a.date)} <span className='mx-1 text-[#B3BDB7]'>•</span> {formatTimeRange(a.time, a.endTime)}</p>
                                            </div>
                                            <div className='flex items-center justify-between gap-4 border-t border-[#EEF1EE] pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right'>
                                                <p className='font-serif text-xl'>₱{Number(a.price).toLocaleString('en-PH')}</p>
                                                <span className='mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#6D7B73] group-hover:text-[#1F4D3E]'>Details <ChevronRight size={13} /></span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : <EmptyAppointments />}
                    </section>

                    <section>
                        <SectionHeading icon={Dog} title='Your pets' to='/my-pets' action='Manage pets' />
                        <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1'>
                            {pets.slice(0, 4).map((pet) => (
                                <Link key={pet._id} to='/my-pets' className='group flex items-center gap-4 rounded-2xl border border-[#DDE4DE] bg-white p-4 transition hover:border-[#B9CAC0]'>
                                    <div className='h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#EDF3EE]'>
                                        {pet.photoUrl ? <img src={pet.photoUrl} alt={pet.name} className='h-full w-full object-cover' /> : <div className='grid h-full w-full place-items-center text-[#2F6B57]'>{pet.type === 'cat' ? <Cat size={21} /> : <Dog size={21} />}</div>}
                                    </div>
                                    <div className='min-w-0 flex-1'><h3 className='truncate font-serif text-lg'>{pet.name}</h3><p className='mt-1 truncate text-xs font-semibold text-[#7A8880]'>{pet.type === 'cat' ? 'Cat' : 'Dog'} · {pet.breed}</p></div>
                                    <ChevronRight size={16} className='text-[#A6B1AA] group-hover:text-[#2F6B57]' />
                                </Link>
                            ))}
                            <Link to='/my-pets' className='flex min-h-[82px] items-center justify-center gap-2 rounded-2xl border border-dashed border-[#B8C7BE] bg-[#EDF3EE]/60 text-xs font-extrabold text-[#1F4D3E] hover:bg-[#EDF3EE]'><Plus size={15} />Add another pet</Link>
                        </div>
                    </section>
                </div>
            </div>

            {selectedAppointment && <AppointmentDetailsModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} onCancel={(a) => setConfirmCancelAppointment(a)} onReschedule={(a) => setRescheduleAppointment(a)} />}
            <RescheduleModal isOpen={Boolean(rescheduleAppointment)} appointment={rescheduleAppointment} onClose={() => setRescheduleAppointment(null)} onSuccess={() => loadData()} />
            <ConfirmModal
                isOpen={Boolean(confirmCancelAppointment)}
                title='Cancel Appointment'
                description={confirmCancelAppointment ? `Are you sure you want to cancel the ${confirmCancelAppointment.service} appointment for ${confirmCancelAppointment.petName}?` : ''}
                confirmText='Cancel Appointment'
                cancelText='Keep Booking'
                variant='danger'
                loading={cancelling}
                onConfirm={handleConfirmCancel}
                onClose={() => setConfirmCancelAppointment(null)}
            />
        </div>
    )
}

function Metric({ icon, label, value }) {
    return (
        <div className='flex items-center gap-4 rounded-2xl border border-[#DDE4DE] bg-white px-5 py-4 shadow-xs transition hover:shadow-sm'>
            <span className='grid h-10 w-10 place-items-center rounded-xl bg-[#EDF3EE] text-[#1F4D3E]'>{createElement(icon, { size: 18 })}</span>
            <div><p className='font-serif text-2xl font-bold leading-none text-[#13231B]'>{value}</p><p className='mt-1 text-[10px] font-extrabold uppercase tracking-[.11em] text-[#68776F]'>{label}</p></div>
        </div>
    )
}

function SectionHeading({ title, to, action }) {
    return (
        <div className='flex items-center justify-between gap-4'>
            <h2 className='font-serif text-2xl font-bold tracking-tight text-[#13231B] sm:text-3xl'>{title}</h2>
            <Link to={to} className='inline-flex items-center gap-1 text-xs font-extrabold text-[#2F6B57] transition hover:underline'>{action}<ChevronRight size={14} /></Link>
        </div>
    )
}

function StatusPill({ status }) {
    const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
    const label = status === 'confirmed' ? 'Approved' : status === 'completed' ? 'Completed' : status === 'cancelled' ? 'Cancelled' : 'Pending'
    return <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.09em] ${s.pill}`}>{label}</span>
}

function LoadingCard({ text }) {
    return <div className='mt-4 rounded-[1.5rem] border border-[#DDE4DE] bg-white p-8 text-center text-sm font-semibold text-[#68776F]'>{text}</div>
}

function EmptyAppointments() {
    return (
        <div className='mt-4 rounded-[1.5rem] border border-dashed border-[#B8C7BE] bg-white p-9 text-center'>
            <div className='mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#EDF3EE] text-[#2F6B57]'><CalendarDays size={22} /></div>
            <h3 className='mt-4 font-serif text-2xl'>No upcoming appointments</h3>
            <p className='mx-auto mt-2 max-w-sm text-sm leading-6 text-[#68776F]'>When you schedule a grooming visit, it will appear here with its status and time.</p>
            <Link to='/booking' className='tt-primary mt-5'><Plus size={15} />Book an appointment</Link>
        </div>
    )
}
