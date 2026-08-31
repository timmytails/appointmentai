import { useEffect, useMemo, useState } from 'react'
import { Calendar, CalendarDays, ChevronRight, Clock3, Eye, XCircle, Dog, Cat } from 'lucide-react'
import toast from 'react-hot-toast'
import { appointmentsApi, getErrorMessage } from '../utils/api'
import { formatDateLong, formatTimeRange } from '../features/booking/utils/dateTime'
import AppointmentDetailsModal from '../components/AppointmentDetailsModal'
import ConfirmModal from '../components/ConfirmModal'
import RescheduleModal from '../components/RescheduleModal'
import { canEditAppointmentDate } from '../utils/appointmentEditWindow'

const appointmentDate = (appointment, useEnd = false) => {
    const directValue = useEnd ? appointment.endAt : appointment.startAt
    if (directValue) return new Date(directValue)
    const time = useEnd ? (appointment.endTime || appointment.time) : appointment.time
    if (!appointment.date || !time) return new Date(0)
    return new Date(`${appointment.date}T${time}:00+08:00`)
}

const STATUS = {
    confirmed: { pill: 'bg-[#E4F1EA] text-[#216245] border-[#C9E1D3]', bar: 'bg-[#2F6B57]', label: 'Approved' },
    completed: { pill: 'bg-[#EDF3EE] text-[#405148] border-[#D7E2DA]', bar: 'bg-[#7A8880]', label: 'Completed' },
    cancelled: { pill: 'bg-[#FBEAEA] text-[#9E3E3E] border-[#F0CCCC]', bar: 'bg-[#B84A4A]', label: 'Cancelled' },
    pending:   { pill: 'bg-[#FFF4DC] text-[#8A5D13] border-[#F0DEB6]', bar: 'bg-[#C95F47]', label: 'Pending' }
}

export default function Appointments() {
    const [appointments, setAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedAppointment, setSelectedAppointment] = useState(null)
    const [confirmCancelAppointment, setConfirmCancelAppointment] = useState(null)
    const [cancelling, setCancelling] = useState(false)
    const [rescheduleAppointment, setRescheduleAppointment] = useState(null)

    const load = () =>
        appointmentsApi.getMy()
            .then(({ data }) => setAppointments(data.appointments || []))
            .finally(() => setLoading(false))

    useEffect(() => { load() }, [])

    const upcoming = useMemo(() =>
        appointments
            .filter((a) => ['pending', 'confirmed'].includes(a.status) && appointmentDate(a, true) >= new Date())
            .sort((a, b) => appointmentDate(a) - appointmentDate(b)),
        [appointments]
    )
    const history = useMemo(() =>
        appointments
            .filter((a) => !upcoming.some((u) => u._id === a._id))
            .sort((a, b) => appointmentDate(b) - appointmentDate(a)),
        [appointments, upcoming]
    )

    const handleConfirmCancel = async () => {
        if (!confirmCancelAppointment) return
        setCancelling(true)
        try {
            await appointmentsApi.cancel(confirmCancelAppointment._id)
            toast.success('Appointment cancelled successfully')
            setConfirmCancelAppointment(null)
            await load()
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setCancelling(false)
        }
    }

    return (
        <div className='min-h-screen bg-[#F6F7F2] px-4 py-8 text-[#13231B] sm:px-6 lg:px-8'>
            <div className='mx-auto max-w-6xl'>

                {/* Page Header */}
                <section className='mb-10 grid gap-6 rounded-[2rem] border border-[#DDE4DE] bg-white p-6 shadow-[0_18px_55px_rgba(19,35,27,0.06)] sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end'>
                    <div className='max-w-2xl'>
                        <h1 className='font-serif text-4xl font-bold tracking-tight text-[#13231B] sm:text-5xl'>Your grooming calendar, at a glance.</h1>
                        <p className='mt-4 max-w-xl text-sm leading-6 text-[#405148] sm:text-base'>Review what is coming up, make time changes while they are available, and keep a clean record of previous visits.</p>
                    </div>
                    <div className='grid grid-cols-2 gap-2 rounded-2xl bg-[#EDF3EE] p-2 text-center'>
                        <div className='rounded-xl bg-white px-5 py-3'><strong className='block text-2xl text-[#13231B]'>{upcoming.length}</strong><span className='text-[11px] font-bold uppercase tracking-wider text-[#405148]'>Upcoming</span></div>
                        <div className='px-5 py-3'><strong className='block text-2xl text-[#13231B]'>{history.length}</strong><span className='text-[11px] font-bold uppercase tracking-wider text-[#405148]'>History</span></div>
                    </div>
                </section>

                {loading ? (
                    <div className='rounded-xl border border-[#DDE4DE] bg-white p-12 text-center text-sm font-medium text-[#405148]'>
                        Loading your grooming appointments...
                    </div>
                ) : (
                    <div className='space-y-10'>
                        {/* Upcoming */}
                        <section>
                            <SectionHeader title='Upcoming Sessions' count={upcoming.length} />
                            <div className='mt-4 space-y-4'>
                                {upcoming.length ? upcoming.map((a) => (
                                    <AppointmentCard
                                        key={a._id}
                                        appointment={a}
                                        onClick={() => setSelectedAppointment(a)}
                                        onCancel={() => setConfirmCancelAppointment(a)}
                                        onReschedule={() => setRescheduleAppointment(a)}
                                    />
                                )) : <EmptyCard text='No upcoming grooming sessions scheduled.' />}
                            </div>
                        </section>

                        {/* History */}
                        <section>
                            <SectionHeader title='Past & Cancelled Visits' count={history.length} />
                            <div className='mt-4 space-y-4'>
                                {history.length ? history.map((a) => (
                                    <AppointmentCard
                                        key={a._id}
                                        appointment={a}
                                        onClick={() => setSelectedAppointment(a)}
                                    />
                                )) : <EmptyCard text='No past grooming visits recorded.' />}
                            </div>
                        </section>
                    </div>
                )}
            </div>

            {selectedAppointment && (
                <AppointmentDetailsModal
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    onCancel={(a) => setConfirmCancelAppointment(a)}
                    onReschedule={(a) => setRescheduleAppointment(a)}
                />
            )}

            <RescheduleModal
                isOpen={Boolean(rescheduleAppointment)}
                appointment={rescheduleAppointment}
                onClose={() => setRescheduleAppointment(null)}
                onSuccess={() => load()}
            />

            <ConfirmModal
                isOpen={Boolean(confirmCancelAppointment)}
                title='Cancel Appointment'
                description={confirmCancelAppointment
                    ? `Are you sure you want to cancel the ${confirmCancelAppointment.service} appointment for ${confirmCancelAppointment.petName}?`
                    : ''}
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

function SectionHeader({ title, count }) {
    return (
        <div className='flex items-end justify-between gap-3 border-b border-[#DDE4DE] pb-3'>
            <h2 className='font-serif text-2xl font-bold text-[#13231B]'>{title}</h2>
            {count > 0 && (
                <span className='rounded-md bg-[#2F6B57]/10 px-2.5 py-0.5 text-xs font-bold text-[#2F6B57]'>
                    {count}
                </span>
            )}
        </div>
    )
}

function AppointmentCard({ appointment: a, onClick, onCancel, onReschedule }) {
    const isEditable = canEditAppointmentDate(a)
    const s = STATUS[a.status] ?? STATUS.pending
    const petPhoto = a.pet?.photoUrl || a.petPhotoUrl || a.photoUrl

    return (
        <article
            onClick={onClick}
            className='group relative cursor-pointer overflow-hidden rounded-[1.5rem] border border-[#DDE4DE] bg-white p-5 shadow-[0_10px_36px_rgba(19,35,27,0.04)] transition hover:-translate-y-0.5 hover:border-[#B8C9BD] sm:p-6'
        >
            <div className='flex flex-col justify-between gap-5 sm:flex-row sm:items-center'>
                <div className='flex items-start gap-4'>
                    {/* Pet Image Display */}
                    <div className='h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#DDE4DE] bg-[#EDF3EE]'>
                        {petPhoto ? (
                            <img src={petPhoto} alt={a.petName} className='h-full w-full object-cover' />
                        ) : (
                            <div className='flex h-full w-full items-center justify-center text-[#2F6B57]'>
                                {a.petType === 'cat' ? <Cat size={26} /> : <Dog size={26} />}
                            </div>
                        )}
                    </div>

                    <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-2.5'>
                            <h3 className='font-serif text-xl font-bold text-[#13231B] transition-colors group-hover:text-[#2F6B57]'>
                                {a.petName}
                            </h3>
                            <span className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${s.pill}`}>
                                {s.label}
                            </span>
                        </div>
                        <p className='mt-0.5 text-sm font-medium text-[#405148]'>
                            {a.service}{a.haircutStyle ? ` · Style: ${a.haircutStyle}` : ''}
                        </p>
                        <div className='mt-2 flex flex-wrap gap-4 text-xs font-bold text-[#2F6B57]'>
                            <span className='flex items-center gap-1.5'>
                                <CalendarDays size={14} />
                                {formatDateLong(a.date)}
                            </span>
                            <span className='flex items-center gap-1.5 font-semibold text-[#405148]'>
                                <Clock3 size={14} />
                                {formatTimeRange(a.time, a.endTime)}
                            </span>
                        </div>
                        {a.status === 'cancelled' && a.cancellationReason && (
                            <p className='mt-2.5 rounded-lg border border-[#F0CCCC] bg-[#FBEAEA] px-3 py-2 text-xs font-medium text-[#7F3333]'>
                                Reason: {a.cancellationReason}
                            </p>
                        )}
                    </div>
                </div>

                <div className='flex flex-col gap-3 border-t border-[#DDE4DE] pt-4 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0'>
                    <div className='flex items-center justify-between sm:justify-end w-full sm:w-auto'>
                        <span className='text-xs text-[#405148] sm:hidden font-medium'>Total Amount</span>
                        <span className='font-serif text-2xl font-bold text-[#13231B]'>
                            ₱{Number(a.price).toLocaleString('en-PH')}
                        </span>
                    </div>
                    <div className='flex items-center gap-2 justify-end w-full sm:w-auto'>
                        {onReschedule && isEditable && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onReschedule() }}
                                className='inline-flex flex-1 sm:flex-initial justify-center items-center gap-1.5 rounded-lg border border-[#E8795B] bg-[#E8795B] px-3.5 py-2 text-xs font-bold text-[#13231B] transition hover:bg-[#E8795B] whitespace-nowrap min-w-0'
                            >
                                <Calendar size={14} className='shrink-0' />
                                <span className='whitespace-nowrap'>Edit Date</span>
                            </button>
                        )}
                        {onCancel && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onCancel() }}
                                className='inline-flex flex-1 sm:flex-initial justify-center items-center gap-1.5 rounded-lg border border-[#F0CCCC] bg-[#FBEAEA] px-3.5 py-2 text-xs font-bold text-[#9E3E3E] transition hover:bg-[#F4D6D6] whitespace-nowrap min-w-0'
                            >
                                <XCircle size={14} className='shrink-0' />
                                <span className='whitespace-nowrap'>Cancel</span>
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onClick && onClick() }}
                            className='inline-flex flex-1 sm:flex-initial justify-center items-center gap-1.5 rounded-lg bg-[#2F6B57] px-3.5 py-2 text-xs font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E] whitespace-nowrap min-w-0'
                        >
                            <Eye size={14} className='shrink-0' />
                            <span className='whitespace-nowrap'>Details</span>
                            <ChevronRight size={14} className='shrink-0' />
                        </button>
                    </div>
                </div>
            </div>
        </article>
    )
}

function EmptyCard({ text }) {
    return (
        <div className='rounded-2xl border border-dashed border-[#C9D9CE] bg-white px-8 py-12 text-center shadow-xs'>
            <div className='mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#EDF3EE] text-[#1F4D3E]'>
                <CalendarDays size={22} />
            </div>
            <p className='mt-3 text-sm font-semibold text-[#68776F]'>{text}</p>
        </div>
    )
}
