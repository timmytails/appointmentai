import {
    createElement,
    useEffect,
    useMemo,
    useState
} from 'react'

import {
    AlertCircle,
    AlertTriangle,
    Ban,
    BarChart3,
    Bell,
    CalendarDays,
    CheckCheck,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    ClipboardList,
    Clock3,
    Image as ImageIcon,
    Inbox,
    LogOut,
    Mail,
    Megaphone,
    Menu,
    MessageSquare,
    Phone,
    RefreshCw,
    Scissors,
    Search,
    Send,
    ShieldAlert,
    Sparkles,
    Trash2,
    UserRound,
    Users,
    UserX,
    X,
    ZoomIn
} from 'lucide-react'

import {
    useNavigate
} from 'react-router-dom'

import toast from 'react-hot-toast'

import {
    adminApi,
    getErrorMessage
} from '../utils/api'

import { useAuth } from '../context/AuthContext'
import { getAccountStatusLabel, mergePersistedCustomerStatus } from '../utils/customerStatus'
import ConfirmModal from '../components/ConfirmModal'
import AdminCancelModal from '../components/AdminCancelModal'

const STATUS_META = {
    pending: {
        label: 'Pending',
        badge: 'bg-[#FFF4DC] text-[#8A5D13] ring-1 ring-[#F0DEB6]'
    },
    confirmed: {
        label: 'Approved',
        badge: 'bg-[#E4F1EA] text-[#216245] ring-1 ring-[#C9E1D3]'
    },
    completed: {
        label: 'Completed',
        badge: 'bg-[#EDF3EE] text-[#405148] ring-1 ring-[#D7E2DA]'
    },
    cancelled: {
        label: 'Cancelled',
        badge: 'bg-[#FBEAEA] text-[#9E3E3E] ring-1 ring-[#F0CCCC]'
    }
}

const NAV_ITEMS = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: BarChart3
    },
    {
        id: 'bookings',
        label: 'Bookings',
        icon: ClipboardList
    },
    {
        id: 'schedule',
        label: 'Schedule',
        icon: CalendarDays
    },
    {
        id: 'messages',
        label: 'Messages',
        icon: Mail
    },
    {
        id: 'customers',
        label: 'Customers',
        icon: Users
    },
    {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3
    },
    {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell
    }
]


const ADMIN_TAB_META = {
    dashboard: { title: 'Operations overview', description: 'See today’s workload, revenue signals, and actions that need attention.' },
    bookings: { title: 'Booking desk', description: 'Review every appointment, update service status, and keep the day moving.' },
    schedule: { title: 'Weekly schedule', description: 'Scan capacity across the week and spot timing conflicts early.' },
    messages: { title: 'Customer messages', description: 'Triage incoming questions and keep customer conversations organized.' },
    customers: { title: 'Customer directory', description: 'Review customer history, pets, spend, and persisted account access.' },
    analytics: { title: 'Business analytics', description: 'Understand service mix, booking performance, and revenue direction.' },
    notifications: { title: 'Customer notices', description: 'Send clear operational updates without changing account permissions.' }
}

const BOOKING_FILTERS = [
    {
        id: '',
        label: 'All Bookings'
    },
    {
        id: 'pending',
        label: 'Pending'
    },
    {
        id: 'confirmed',
        label: 'Approved'
    },
    {
        id: 'completed',
        label: 'Completed'
    },
    {
        id: 'cancelled',
        label: 'Cancelled'
    }
]

const formatPeso = (value) =>
    new Intl.NumberFormat(
        'en-PH',
        {
            style: 'currency',
            currency: 'PHP',
            maximumFractionDigits: 0
        }
    ).format(Number(value) || 0)

const formatDate = (
    value,
    options = {}
) => {
    if (!value) return '—'

    const date =
        /^\d{4}-\d{2}-\d{2}$/.test(
            String(value)
        )
            ? new Date(
                `${value}T12:00:00`
            )
            : new Date(value)

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value)
    }

    return date.toLocaleDateString(
        'en-PH',
        {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            ...options
        }
    )
}

const formatShortDate = (value) =>
    formatDate(value, {
        month: 'short'
    })

const formatTime = (value) => {
    if (!value) return '—'

    const [
        hoursValue,
        minutesValue = '00'
    ] = String(value).split(':')

    const hours = Number(
        hoursValue
    )

    if (
        !Number.isFinite(hours)
    ) {
        return String(value)
    }

    const suffix =
        hours >= 12
            ? 'PM'
            : 'AM'

    const displayHours =
        hours % 12 || 12

    return `${displayHours}:${minutesValue} ${suffix}`
}

const dateKey = (date) => {
    const year =
        date.getFullYear()

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, '0')

    const day =
        String(
            date.getDate()
        ).padStart(2, '0')

    return `${year}-${month}-${day}`
}

const startOfWeek = (
    source = new Date()
) => {
    const date =
        new Date(source)

    const day =
        date.getDay()

    const difference =
        day === 0
            ? -6
            : 1 - day

    date.setDate(
        date.getDate() +
        difference
    )

    date.setHours(
        12,
        0,
        0,
        0
    )

    return date
}

const buildWeek = (anchor) =>
    Array.from(
        {
            length: 7
        },
        (_, index) => {
            const date =
                new Date(anchor)

            date.setDate(
                anchor.getDate() +
                index
            )

            return date
        }
    )

const getOwnerName = (
    appointment
) =>
    appointment?.ownerName ||
    [
        appointment?.user
            ?.firstName,
        appointment?.user
            ?.lastName
    ]
        .filter(Boolean)
        .join(' ') ||
    'Customer'

const getInitials = (
    firstName,
    lastName
) =>
    `${firstName?.[0] || ''}${lastName?.[0] || ''}`
        .toUpperCase() ||
    'C'

const getCustomerAddress = (
    customer
) => {
    const address =
        customer?.address || {}

    return [
        address.street,
        address.barangay
            ? `Brgy. ${address.barangay}`
            : '',
        address.city,
        address.province
    ]
        .filter(Boolean)
        .join(', ') ||
        customer?.homeAddress ||
        'No address provided'
}

export default function Admin() {
    const navigate =
        useNavigate()

    const {
        user,
        logout
    } = useAuth()

    const [
        activeTab,
        setActiveTab
    ] = useState(
        'dashboard'
    )

    const [
        sidebarOpen,
        setSidebarOpen
    ] = useState(false)

    const [
        loading,
        setLoading
    ] = useState(true)

    const [
        refreshing,
        setRefreshing
    ] = useState(false)

    const [
        stats,
        setStats
    ] = useState(null)

    const [
        appointments,
        setAppointments
    ] = useState([])

    const [
        analytics,
        setAnalytics
    ] = useState(null)

    const [
        customers,
        setCustomers
    ] = useState([])

    const [
        contacts,
        setContacts
    ] = useState([])

    const [
        adminNotifications,
        setAdminNotifications
    ] = useState([])

    const [
        notifLoading,
        setNotifLoading
    ] = useState(false)

    const [
        bookingFilter,
        setBookingFilter
    ] = useState('')

    const [
        search,
        setSearch
    ] = useState('')

    const [
        selectedBookingId,
        setSelectedBookingId
    ] = useState(null)

    const [
        updatingId,
        setUpdatingId
    ] = useState(null)

    const [
        cancelModalAppointment,
        setCancelModalAppointment
    ] = useState(null)

    const [
        weekAnchor,
        setWeekAnchor
    ] = useState(
        startOfWeek()
    )

    useEffect(() => {
        if (!user) {
            navigate('/login')
            return
        }

        if (
            user.role !== 'admin'
        ) {
            toast.error(
                'Admin access required'
            )

            navigate('/')
        }
    }, [
        user,
        navigate
    ])

    const loadData = async (
        showRefresh = false
    ) => {
        if (showRefresh) {
            setRefreshing(true)
        } else {
            setLoading(true)
        }

        try {
            const [
                statsResult,
                appointmentsResult,
                analyticsResult,
                customersResult,
                contactsResult,
                notificationsResult
            ] = await Promise.allSettled([
                adminApi.getStats(),
                adminApi.getAppointments({ limit: 100 }),
                adminApi.getAnalytics(),
                adminApi.getUsers(),
                adminApi.getContacts(),
                adminApi.getNotifications()
            ])

            if (statsResult.status === 'fulfilled') {
                setStats(statsResult.value.data.stats || null)
            }
            if (appointmentsResult.status === 'fulfilled') {
                setAppointments(appointmentsResult.value.data.appointments || [])
            }
            if (analyticsResult.status === 'fulfilled') {
                setAnalytics(analyticsResult.value.data.analytics || null)
            }
            if (customersResult.status === 'fulfilled') {
                setCustomers(customersResult.value.data.users || [])
            }
            if (contactsResult.status === 'fulfilled') {
                setContacts(contactsResult.value.data.contacts || [])
            }
            if (notificationsResult.status === 'fulfilled') {
                setAdminNotifications(notificationsResult.value.data.notifications || [])
            }

            const rejected = [statsResult, appointmentsResult, analyticsResult, customersResult, contactsResult].find((r) => r.status === 'rejected')
            if (rejected && showRefresh) {
                toast.error(getErrorMessage(rejected.reason))
            }
        } catch (error) {
            toast.error(
                getErrorMessage(error)
            )
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        if (
            user?.role === 'admin'
        ) {
            queueMicrotask(loadData)
        }
    }, [user])

    const selectedBooking =
        useMemo(
            () =>
                appointments.find(
                    (item) =>
                        item._id ===
                        selectedBookingId
                ) || null,
            [
                appointments,
                selectedBookingId
            ]
        )

    const filteredAppointments =
        useMemo(() => {
            const query =
                search
                    .trim()
                    .toLowerCase()

            return appointments
                .filter(
                    (appointment) =>
                        !bookingFilter ||
                        appointment.status ===
                        bookingFilter
                )
                .filter(
                    (appointment) => {
                        if (!query) {
                            return true
                        }

                        return [
                            appointment.petName,
                            appointment.breed,
                            appointment.service,
                            appointment.haircutStyle,
                            getOwnerName(
                                appointment
                            ),
                            appointment.ownerPhone,
                            appointment.ownerEmail
                        ]
                            .filter(Boolean)
                            .some((value) =>
                                String(value)
                                    .toLowerCase()
                                    .includes(
                                        query
                                    )
                            )
                    }
                )
                .sort(
                    (first, second) =>
                        new Date(
                            second.startAt ||
                            `${second.date}T${second.time}`
                        ) -
                        new Date(
                            first.startAt ||
                            `${first.date}T${first.time}`
                        )
                )
        }, [
            appointments,
            bookingFilter,
            search
        ])

    const today =
        dateKey(new Date())

    const todaysAppointments =
        useMemo(
            () =>
                appointments
                    .filter(
                        (appointment) =>
                            appointment.date ===
                            today
                    )
                    .sort(
                        (first, second) =>
                            String(
                                first.time
                            ).localeCompare(
                                String(
                                    second.time
                                )
                            )
                    ),
            [
                appointments,
                today
            ]
        )

    const pendingAppointments =
        useMemo(
            () =>
                appointments
                    .filter(
                        (appointment) =>
                            appointment.status ===
                            'pending'
                    )
                    .sort(
                        (first, second) =>
                            new Date(
                                first.startAt ||
                                `${first.date}T${first.time}`
                            ) -
                            new Date(
                                second.startAt ||
                                `${second.date}T${second.time}`
                            )
                    ),
            [appointments]
        )

    const monthlyAppointments =
        analytics?.monthlyData ||
        []

    const currentMonthKey =
        `${new Date().getFullYear()}-${String(
            new Date().getMonth() + 1
        ).padStart(2, '0')}`

    const currentMonthData =
        monthlyAppointments.find(
            (item) =>
                item.monthKey ===
                currentMonthKey
        ) ||
        monthlyAppointments[
        monthlyAppointments.length -
        1
        ] ||
        {
            appointments: 0,
            revenue: 0
        }

    const aiPreviewBookings =
        appointments.filter(
            (appointment) =>
                appointment.aiPreviewUsed &&
                appointment.status !==
                'cancelled'
        )

    const eligibleStyleBookings =
        appointments.filter(
            (appointment) =>
                appointment.haircutStyle &&
                appointment.status !==
                'cancelled'
        )

    const aiUsageRate =
        eligibleStyleBookings.length
            ? Math.round(
                (aiPreviewBookings.length /
                    eligibleStyleBookings.length) *
                100
            )
            : 0

    const completedRate =
        appointments.length
            ? Math.round(
                (appointments.filter(
                    (appointment) =>
                        appointment.status ===
                        'completed'
                ).length /
                    appointments.length) *
                100
            )
            : 0

    const handleStatusUpdate =
        async (
            appointment,
            status,
            cancellationReason = ''
        ) => {
            if (
                appointment.status ===
                status
            ) {
                return
            }

            if (
                [
                    'completed',
                    'cancelled'
                ].includes(
                    appointment.status
                )
            ) {
                toast.error(
                    `This booking is already ${STATUS_META[appointment.status]?.label.toLowerCase()}`
                )

                return
            }

            if (status === 'cancelled' && !cancellationReason) {
                setCancelModalAppointment(appointment)
                return
            }

            setUpdatingId(
                appointment._id
            )

            try {
                await adminApi.updateStatus(
                    appointment._id,
                    status,
                    cancellationReason
                )

                toast.success(
                    `Booking marked as ${STATUS_META[status]?.label || status}`
                )

                if (cancelModalAppointment) {
                    setCancelModalAppointment(null)
                }

                await loadData(true)
            } catch (error) {
                toast.error(
                    getErrorMessage(error)
                )
            } finally {
                setUpdatingId(null)
            }
        }

    const handleLogout = () => {
        logout()
        navigate('/')
    }

    const changeTab = (tab) => {
        setActiveTab(tab)
        setSidebarOpen(false)
    }

    const unreadContactsCount = useMemo(() => (contacts || []).filter((c) => c && !c.read).length, [contacts])

    if (loading) {
        return (
            <div className='grid min-h-screen place-items-center bg-[#F6F7F2] text-[#13231B]'>
                <div className='text-center'>
                    <RefreshCw
                        className='mx-auto animate-spin text-[#2F6B57]'
                        size={30}
                    />

                    <p className='mt-3 font-semibold text-[#405148]'>
                        Loading administration data
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className='min-h-screen bg-[#F6F7F2] text-[#13231B] lg:grid lg:grid-cols-[272px_minmax(0,1fr)]'>
            <AdminSidebar
                activeTab={
                    activeTab
                }
                onChange={
                    changeTab
                }
                pendingCount={
                    pendingAppointments.length
                }
                unreadContactsCount={
                    unreadContactsCount
                }
                user={user}
                open={
                    sidebarOpen
                }
                onClose={() =>
                    setSidebarOpen(false)
                }
                onLogout={
                    handleLogout
                }
            />

            <AdminDesktopRail
                activeTab={activeTab}
                onChange={changeTab}
                pendingCount={pendingAppointments.length}
                unreadContactsCount={unreadContactsCount}
                user={user}
                onLogout={handleLogout}
            />

            <div className='min-w-0 min-h-screen'>
                <header className='sticky top-0 z-30 border-b border-[#DDE4DE] bg-white/95 text-[#13231B] backdrop-blur-xl'>
                    <div className='mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8'>
                        <div className='flex min-h-16 items-center justify-between gap-4'>
                            <div className='flex min-w-0 items-center gap-3'>
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className='grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#DDE4DE] bg-white lg:hidden'
                                    aria-label='Open admin navigation'
                                >
                                    <Menu size={20} />
                                </button>
                                <div className='flex items-center gap-2 text-sm'>
                                    <span className='font-bold text-[#13231B] capitalize'>{ADMIN_TAB_META[activeTab]?.title || activeTab}</span>
                                </div>
                            </div>

                            <div className='flex items-center gap-2'>
                                <span className='hidden rounded-xl border border-[#DDE4DE] bg-[#F6F7F2] px-3 py-2 font-mono text-[11px] text-[#68776F] md:inline'>{formatDate(new Date())}</span>
                                {pendingAppointments.length > 0 && (
                                    <span className='hidden items-center gap-1.5 rounded-xl bg-[#FFF4DC] px-3 py-2 text-xs font-extrabold text-[#8A5D13] sm:inline-flex' title='Pending appointments'>
                                        <Clock3 size={13} /> {pendingAppointments.length} pending
                                    </span>
                                )}
                                <button
                                    onClick={() => loadData(true)}
                                    disabled={refreshing}
                                    className='grid h-11 w-11 place-items-center rounded-xl border border-[#DDE4DE] bg-white text-[#405148] transition hover:bg-[#F6F7F2] disabled:opacity-40'
                                    aria-label='Refresh administration data'
                                >
                                    <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className='hidden'
                                >
                                    <LogOut size={15} /> Sign out
                                </button>
                            </div>
                        </div>

                        <nav className='hidden' aria-label='Admin workspace navigation'>
                            {NAV_ITEMS.map(({ id, label, icon }) => {
                                const isActive = activeTab === id
                                const count = id === 'bookings' ? pendingAppointments.length : id === 'messages' ? unreadContactsCount : 0
                                return (
                                    <button
                                        key={id}
                                        onClick={() => changeTab(id)}
                                        className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition ${isActive ? 'bg-[#E8795B] text-[#13231B]' : 'text-[#F6F7F2] hover:bg-[#1F4D3E]'}`}
                                    >
                                        {createElement(icon, { size: 16 })}
                                        {label}
                                        {count > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] ${isActive ? 'bg-[#13231B] text-[#F6F7F2]' : 'bg-[#405148] text-[#F6F7F2]'}`}>{count}</span>}
                                    </button>
                                )
                            })}
                        </nav>
                    </div>
                </header>

                <main className='mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8'>
                    <section className='mb-7 flex flex-col gap-4 rounded-2xl border border-[#DDE4DE] bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between'>
                        <div>
                            <h1 className='font-serif text-3xl font-bold tracking-tight text-[#13231B] sm:text-4xl'>{ADMIN_TAB_META[activeTab]?.title}</h1>
                            <p className='mt-1.5 max-w-2xl text-sm text-[#68776F]'>{ADMIN_TAB_META[activeTab]?.description}</p>
                        </div>
                        <div className='inline-flex self-start sm:self-auto items-center gap-2 rounded-full bg-[#EDF3EE] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#1F4D3E]'>
                            <span className='h-2 w-2 rounded-full bg-[#2F6B57] animate-pulse' /> Live data
                        </div>
                    </section>
                    {activeTab === 'dashboard' && (
                        <DashboardView
                            stats={stats}
                            todaysAppointments={todaysAppointments}
                            pendingAppointments={pendingAppointments}
                            updatingId={updatingId}
                            onStatusUpdate={handleStatusUpdate}
                            onViewBookings={() => changeTab('bookings')}
                            onViewAnalytics={() => changeTab('analytics')}
                            analytics={analytics}
                            appointments={appointments}
                            aiUsageRate={aiUsageRate}
                            completedRate={completedRate}
                        />
                    )}

                    {activeTab ===
                        'bookings' && (
                            <BookingsView
                                appointments={
                                    filteredAppointments
                                }
                                filter={
                                    bookingFilter
                                }
                                onFilter={
                                    setBookingFilter
                                }
                                search={
                                    search
                                }
                                onSearch={
                                    setSearch
                                }
                                selected={
                                    selectedBooking
                                }
                                onSelect={
                                    setSelectedBookingId
                                }
                                updatingId={
                                    updatingId
                                }
                                onStatusUpdate={
                                    handleStatusUpdate
                                }
                            />
                        )}

                    {activeTab ===
                        'schedule' && (
                            <ScheduleView
                                appointments={appointments}
                                weekAnchor={weekAnchor}
                                onStatusUpdate={handleStatusUpdate}
                                updatingId={updatingId}
                                onPrevious={() => {
                                    const next = new Date(weekAnchor)
                                    next.setDate(next.getDate() - 7)
                                    setWeekAnchor(next)
                                }}
                                onNext={() => {
                                    const next = new Date(weekAnchor)
                                    next.setDate(next.getDate() + 7)
                                    setWeekAnchor(next)
                                }}
                                onToday={() => setWeekAnchor(startOfWeek())}
                            />
                        )}

                    {activeTab ===
                        'messages' && (
                            <ContactsView
                                contacts={contacts}
                                onRefresh={() => loadData(true)}
                            />
                        )}

                    {activeTab ===
                        'customers' && (
                            <CustomersView
                                customers={
                                    customers
                                }
                                onRefresh={() => loadData(true)}
                            />
                        )}

                    {activeTab ===
                        'analytics' && (
                            <AnalyticsView
                                analytics={
                                    analytics
                                }
                                currentMonthData={
                                    currentMonthData
                                }
                                appointments={
                                    appointments
                                }
                                aiUsageRate={
                                    aiUsageRate
                                }
                                completedRate={
                                    completedRate
                                }
                            />
                        )}

                    {activeTab === 'notifications' && (
                        <NotificationsView
                            notifications={adminNotifications}
                            customers={customers}
                            loading={notifLoading}
                            onSend={async (payload) => {
                                setNotifLoading(true)
                                try {
                                    await adminApi.createNotification(payload)
                                    toast.success('Notification sent successfully!')
                                    const res = await adminApi.getNotifications()
                                    setAdminNotifications(res.data.notifications || [])
                                } catch (err) {
                                    toast.error(getErrorMessage(err))
                                } finally {
                                    setNotifLoading(false)
                                }
                            }}
                        />
                    )}
                </main>
            </div>

            <AdminCancelModal
                isOpen={Boolean(cancelModalAppointment)}
                appointment={cancelModalAppointment}
                loading={Boolean(updatingId)}
                onConfirm={(reason) => {
                    if (cancelModalAppointment) {
                        handleStatusUpdate(cancelModalAppointment, 'cancelled', reason)
                    }
                }}
                onClose={() => setCancelModalAppointment(null)}
            />
        </div>
    )
}


function AdminDesktopRail({
    activeTab,
    onChange,
    pendingCount,
    unreadContactsCount,
    user,
    onLogout
}) {
    return (
        <aside className='sticky top-0 hidden h-screen flex-col border-r border-[#274A3B] bg-[#13231B] text-white lg:flex'>
            <div className='flex h-[88px] items-center border-b border-white/10 px-6'>
                <div className='flex items-center gap-3'>
                    <img src='/logo.png' alt='TimmyTails logo' className='h-9 w-9 rounded-full object-cover shadow-xs ring-2 ring-white/20 bg-white' />
                    <div>
                        <p className='font-serif text-2xl font-bold tracking-tight text-white'>TimmyTails</p>
                        <p className='mt-0.5 text-[9px] font-extrabold uppercase tracking-[.18em] text-[#A5B8AC]'>Admin Workspace</p>
                    </div>
                </div>
            </div>

            <div className='px-4 py-5'>
                <p className='px-3 text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7F9387]'>Workspace</p>
                <nav className='mt-3 space-y-1' aria-label='Admin workspace navigation'>
                    {NAV_ITEMS.map(({ id, label, icon }) => {
                        const isActive = activeTab === id
                        const count = id === 'bookings' ? pendingCount : id === 'messages' ? unreadContactsCount : 0
                        return (
                            <button
                                key={id}
                                onClick={() => onChange(id)}
                                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm font-bold transition ${isActive ? 'bg-white text-[#13231B]' : 'text-[#B9C7BF] hover:bg-white/7 hover:text-white'}`}
                            >
                                <span className={`grid h-8 w-8 place-items-center rounded-lg ${isActive ? 'bg-[#EDF3EE] text-[#1F4D3E]' : 'bg-white/6 text-[#9FB0A6]'}`}>{createElement(icon, { size: 15 })}</span>
                                <span className='flex-1'>{label}</span>
                                {count > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px] font-extrabold ${isActive ? 'bg-[#FFF1DE] text-[#9B5A18]' : 'bg-[#E8795B] text-[#13231B]'}`}>{count}</span>}
                            </button>
                        )
                    })}
                </nav>
            </div>

            <div className='mt-auto border-t border-white/10 p-4'>
                <div className='rounded-2xl bg-white/5 p-3.5'>
                    <div className='flex items-center gap-3'>
                        <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#DCE9E0] text-sm font-extrabold text-[#1F4D3E]'>{(user?.firstName?.[0] || 'A').toUpperCase()}</span>
                        <div className='min-w-0 flex-1'>
                            <p className='truncate text-xs font-extrabold text-white'>{user?.firstName || 'Administrator'}</p>
                            <p className='mt-0.5 truncate text-[10px] text-[#91A59A]'>{user?.email || user?.phone}</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className='mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs font-bold text-[#C1CEC7] hover:bg-white/8 hover:text-white'><LogOut size={14} />Sign out</button>
                </div>
            </div>
        </aside>
    )
}

function AdminSidebar({
    activeTab,
    onChange,
    pendingCount,
    unreadContactsCount,
    user,
    open,
    onClose,
    onLogout
}) {
    return (
        <>
            {open && (
                <button
                    type='button'
                    onClick={onClose}
                    className='fixed inset-0 z-40 bg-[#13231B]/60 backdrop-blur-xs lg:hidden'
                    aria-label='Close navigation overlay'
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col bg-[#13231B] text-[#F6F7F2] transition-transform duration-200 lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Header Brand */}
                <div className='flex h-16 items-center justify-between border-b border-[#1F4D3E] px-5'>
                    <div className='flex items-center gap-2.5'>
                        <img src='/logo.png' alt='TimmyTails logo' className='h-8 w-8 rounded-full object-cover shadow-xs ring-1 ring-white/20 bg-white' />
                        <div>
                            <p className='font-serif text-lg font-bold tracking-tight text-[#F6F7F2]'>TimmyTails</p>
                            <p className='text-[10px] font-bold uppercase tracking-widest text-[#2F6B57]'>Admin Portal</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className='grid h-8 w-8 place-items-center rounded-lg text-[#F6F7F2] hover:bg-[#13231B] hover:text-[#F6F7F2] lg:hidden'
                        aria-label='Close navigation'
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation Menu */}
                <nav className='flex-1 space-y-1 px-3 py-4'>
                    {NAV_ITEMS.map(({ id, label, icon }) => {
                        const isActive = activeTab === id
                        return (
                            <button
                                key={id}
                                onClick={() => onChange(id)}
                                className={`group relative flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold transition ${
                                    isActive
                                        ? 'bg-[#13231B] text-[#F6F7F2]'
                                        : 'text-[#F6F7F2] hover:bg-[#13231B]/60 hover:text-[#F6F7F2]'
                                }`}
                            >
                                {isActive && (
                                    <span className='absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#2F6B57]' />
                                )}
                                {createElement(icon, { size: 16 })}
                                <span className='flex-1'>{label}</span>
                                {id === 'bookings' && pendingCount > 0 && (
                                    <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2F6B57] px-1.5 text-[10px] font-bold text-[#F6F7F2]'>
                                        {pendingCount}
                                    </span>
                                )}
                                {id === 'messages' && unreadContactsCount > 0 && (
                                    <span className='inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2F6B57] px-1.5 text-[10px] font-bold text-[#F6F7F2]'>
                                        {unreadContactsCount}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </nav>

                {/* Admin Profile Footer */}
                <div className='border-t border-[#1F4D3E] p-4'>
                    <div className='mb-3 flex items-center gap-3'>
                        <span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#13231B] text-sm font-bold text-[#F6F7F2] border border-[#1F4D3E]'>
                            {(user?.firstName?.[0] || 'A').toUpperCase()}
                        </span>
                        <div className='min-w-0'>
                            <p className='truncate text-xs font-bold text-[#F6F7F2]'>{user?.firstName || 'Admin'}</p>
                            <p className='truncate text-[10px] text-[#F6F7F2]'>{user?.email || user?.phone}</p>
                        </div>
                    </div>
                    <button
                        onClick={onLogout}
                        className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#F6F7F2] hover:bg-[#13231B] hover:text-[#F6F7F2]'
                    >
                        <LogOut size={15} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>
        </>
    )
}

function DashboardView({
    stats,
    todaysAppointments,
    pendingAppointments,
    updatingId,
    onStatusUpdate,
    onViewBookings,
    onViewAnalytics,
    analytics,
    appointments = [],
    aiUsageRate = 0,
    completedRate = 0
}) {
    const confirmedToday = todaysAppointments.filter((item) => item.status === 'confirmed').length

    const serviceCounts = useMemo(() => {
        const counts = {}
        appointments.forEach((a) => {
            if (a.service) {
                counts[a.service] = (counts[a.service] || 0) + 1
            }
        })
        const total = appointments.length || 1
        return Object.entries(counts)
            .map(([name, count]) => ({
                name,
                count,
                pct: Math.round((count / total) * 100)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
    }, [appointments])

    return (
        <div className='space-y-6'>
            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <MetricCard
                    icon={CalendarDays}
                    value={stats?.todayAppointments ?? todaysAppointments.length}
                    label="Today's Appointments"
                    tone='orange'
                />
                <MetricCard
                    icon={Clock3}
                    value={stats?.pendingAppointments ?? pendingAppointments.length}
                    label='Pending Approval'
                    tone='amber'
                />
                <MetricCard
                    icon={CheckCircle2}
                    value={confirmedToday}
                    label='Approved Today'
                    tone='blue'
                />
                <MetricCard
                    icon={CircleDollarSign}
                    value={formatPeso(stats?.todayRevenue)}
                    label="Today's Revenue"
                    tone='green'
                    compact
                />
            </div>

            {/* Analytics Executive Summary Grid */}
            <div className='grid gap-6 lg:grid-cols-2'>
                {/* Revenue & Top Services Card */}
                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-5 shadow-xs'>
                    <div className='mb-4 flex items-center justify-between border-b border-[#DDE4DE] pb-3'>
                        <div className='flex items-center gap-2'>
                            <BarChart3 size={18} className='text-[#2F6B57]' />
                            <h2 className='font-serif text-base font-bold text-[#13231B]'>Revenue &amp; Demand Summary</h2>
                        </div>
                        <button
                            type='button'
                            onClick={onViewAnalytics}
                            className='text-xs font-bold text-[#2F6B57] transition hover:underline'
                        >
                            Full Analytics →
                        </button>
                    </div>

                    <div className='mb-4 grid grid-cols-2 gap-3'>
                        <div className='rounded-xl border border-[#DDE4DE] bg-white p-3.5'>
                            <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>Total All-Time Revenue</p>
                            <p className='mt-1 font-serif text-xl font-bold text-[#2F6B57]'>{formatPeso(stats?.totalRevenue || analytics?.totalRevenue || 0)}</p>
                        </div>
                        <div className='rounded-xl border border-[#DDE4DE] bg-white p-3.5'>
                            <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>AI Preview Adoption</p>
                            <p className='mt-1 font-serif text-xl font-bold text-[#13231B]'>{aiUsageRate}%</p>
                        </div>
                    </div>

                    <div>
                        <p className='mb-2 text-[11px] font-bold uppercase tracking-wider text-[#2F6B57]'>Top Booked Services</p>
                        {serviceCounts.length ? (
                            <div className='space-y-2.5'>
                                {serviceCounts.map((svc) => (
                                    <div key={svc.name} className='space-y-1'>
                                        <div className='flex justify-between text-xs font-semibold text-[#13231B]'>
                                            <span>{svc.name}</span>
                                            <span className='text-[#405148]'>{svc.count} bookings ({svc.pct}%)</span>
                                        </div>
                                        <div className='h-2 w-full overflow-hidden rounded-full bg-[#F6F7F2] border border-[#F6F7F2]'>
                                            <div
                                                className='h-full bg-[#2F6B57] transition-all duration-500 rounded-full'
                                                style={{ width: `${Math.max(svc.pct, 8)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className='text-xs italic text-[#2F6B57]'>No booking service breakdown available yet.</p>
                        )}
                    </div>
                </div>

                {/* Operations & Performance Card */}
                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-5 shadow-xs'>
                    <div className='mb-4 flex items-center justify-between border-b border-[#DDE4DE] pb-3'>
                        <div className='flex items-center gap-2'>
                            <ClipboardList size={18} className='text-[#13231B]' />
                            <h2 className='font-serif text-base font-bold text-[#13231B]'>Operations &amp; Completion</h2>
                        </div>
                        <span className='rounded-full border border-[#C9E1D3] bg-[#E4F1EA] px-2.5 py-0.5 text-[11px] font-bold text-[#216245]'>
                            {completedRate}% Completion Rate
                        </span>
                    </div>

                    <div className='mb-4 grid grid-cols-2 gap-3'>
                        <div className='rounded-xl border border-[#DDE4DE] bg-white p-3.5'>
                            <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>Total Customer Bookings</p>
                            <p className='mt-1 font-serif text-xl font-bold text-[#13231B]'>{appointments.length}</p>
                        </div>
                        <div className='rounded-xl border border-[#DDE4DE] bg-white p-3.5'>
                            <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>Active / Approved</p>
                            <p className='mt-1 font-serif text-xl font-bold text-[#13231B]'>
                                {appointments.filter((a) => ['confirmed', 'completed'].includes(a.status)).length}
                            </p>
                        </div>
                    </div>

                    <div className='rounded-xl border border-[#DDE4DE] bg-white p-3.5'>
                        <div className='mb-1 flex items-center gap-2 text-xs font-bold text-[#13231B]'>
                            <Scissors size={14} className='text-[#2F6B57]' />
                            <span>AI Haircut Style Insights</span>
                        </div>
                        <p className='text-xs leading-relaxed text-[#405148]'>
                            {aiUsageRate > 0
                                ? `${aiUsageRate}% of style haircut bookings utilized the AI Preview generator prior to scheduling.`
                                : 'Haircut style previews allow clients to visualize grooming styles before visiting the salon.'}
                        </p>
                    </div>
                </div>
            </div>

            <section className='overflow-hidden rounded-2xl border border-[#DDE4DE] bg-white shadow-xs'>
                <div className='flex items-center justify-between border-b border-[#DDE4DE] px-5 py-4'>
                    <div>
                        <h2 className='font-serif text-lg font-bold'>Today&apos;s Schedule</h2>
                        <p className='mt-0.5 text-xs text-[#2F6B57]'>{formatDate(new Date())}</p>
                    </div>
                    <button
                        onClick={onViewBookings}
                        className='rounded-lg border border-[#F6F7F2] px-3 py-1.5 text-xs font-semibold text-[#2F6B57] transition hover:bg-[#F6F7F2]'
                    >
                        View all →
                    </button>
                </div>

                {todaysAppointments.length ? (
                    <div>
                        {todaysAppointments.map((appointment) => (
                            <ScheduleRow key={appointment._id} appointment={appointment} />
                        ))}
                    </div>
                ) : (
                    <EmptyPanel icon={CalendarDays} message='No appointments scheduled for today.' />
                )}
            </section>

            <section className='overflow-hidden rounded-2xl border border-[#DDE4DE] bg-white shadow-xs'>
                <div className='flex items-center justify-between border-b border-[#DDE4DE] px-5 py-4'>
                    <div className='flex items-center gap-2.5'>
                        <span className='grid h-8 w-8 place-items-center rounded-xl bg-[#FFF4DC] text-[#8A5D13]'>
                            <Clock3 size={16} />
                        </span>
                        <div>
                            <h2 className='font-serif text-lg font-bold text-[#13231B]'>Pending Approvals</h2>
                            <p className='text-xs text-[#68776F]'>{pendingAppointments.length} booking{pendingAppointments.length !== 1 ? 's' : ''} awaiting review</p>
                        </div>
                    </div>
                </div>

                <div className='space-y-2 p-4'>
                    {pendingAppointments.length ? (
                        pendingAppointments.slice(0, 6).map((appointment) => (
                            <div
                                key={appointment._id}
                                className='flex flex-col gap-3 rounded-xl border border-[#DDE4DE] bg-[#FAFBF8] p-4 shadow-xs transition hover:border-[#B8C7BE] sm:flex-row sm:items-center'
                            >
                                <PetAvatar appointment={appointment} />

                                <div className='min-w-0 flex-1'>
                                    <div className='flex flex-wrap items-center gap-1.5'>
                                        <p className='font-bold text-[#13231B]'>{appointment.petName}</p>
                                        <span className='text-[#2F6B57]'>·</span>
                                        <p className='text-sm text-[#405148]'>{getOwnerName(appointment)}</p>
                                    </div>
                                    <p className='mt-1 text-xs text-[#2F6B57]'>
                                        {appointment.service} · {formatDate(appointment.date)} · {formatTime(appointment.time)}
                                    </p>
                                    {appointment.notes && (
                                        <p className='mt-1 truncate text-xs italic text-[#13231B]'>&ldquo;{appointment.notes}&rdquo;</p>
                                    )}
                                </div>

                                <div className='flex shrink-0 gap-2'>
                                    <button
                                        disabled={updatingId === appointment._id}
                                        onClick={() => onStatusUpdate(appointment, 'confirmed')}
                                        className='rounded-lg bg-[#1F4D3E] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#13231B] disabled:opacity-50'
                                    >
                                        Approve
                                    </button>
                                    <button
                                        disabled={updatingId === appointment._id}
                                        onClick={() => onStatusUpdate(appointment, 'cancelled')}
                                        className='rounded-lg border border-[#F0CCCC] bg-[#FBEAEA] px-4 py-2 text-xs font-bold text-[#9E3E3E] transition hover:bg-[#F6DADA] disabled:opacity-50'
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className='flex items-center gap-3 rounded-xl border border-[#DDE4DE] bg-[#FAFBF8] p-4 text-xs font-semibold text-[#68776F]'>
                            <CheckCircle2 size={17} className='text-[#2F6B57]' />
                            <span>All bookings have been reviewed. No pending approvals.</span>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}

function MetricCard({
    icon,
    value,
    label,
    tone,
    compact = false
}) {
    const config = {
        orange: { iconColor: 'text-[#1F4D3E]', bg: 'bg-[#EDF3EE]', bar: 'bg-[#1F4D3E]' },
        amber:  { iconColor: 'text-[#C95F47]', bg: 'bg-[#FDF0ED]', bar: 'bg-[#C95F47]' },
        blue:   { iconColor: 'text-[#2F6B57]', bg: 'bg-[#E3EEE8]', bar: 'bg-[#2F6B57]' },
        green:  { iconColor: 'text-[#1F4D3E]', bg: 'bg-[#EDF3EE]', bar: 'bg-[#1F4D3E]' }
    }
    const c = config[tone] || config.orange

    return (
        <div className='relative overflow-hidden rounded-2xl border border-[#DDE4DE] bg-white p-5 shadow-xs transition hover:shadow-sm'>
            <span className={`absolute left-0 top-0 h-full w-1 ${c.bar}`} />
            <div className={`mb-3 inline-grid h-10 w-10 place-items-center rounded-xl ${c.bg}`}>
                {createElement(icon, { size: 20, className: c.iconColor })}
            </div>
            <p className={`font-serif font-bold ${compact ? 'text-2xl' : 'text-3xl'} tracking-tight text-[#13231B]`}>
                {value}
            </p>
            <p className='mt-1 text-xs font-semibold text-[#68776F]'>{label}</p>
        </div>
    )
}

function ScheduleRow({ appointment }) {
    return (
        <div className='flex items-center gap-4 border-b border-[#DDE4DE] px-5 py-3.5 last:border-b-0 hover:bg-[#F6F7F2]'>
            <PetAvatar appointment={appointment} />

            <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                    <p className='text-sm font-bold text-[#13231B]'>{appointment.petName}</p>
                    <span className='text-xs text-[#2F6B57]'>{getOwnerName(appointment)}</span>
                    <StatusBadge status={appointment.status} />
                </div>
                <p className='mt-0.5 text-xs text-[#2F6B57]'>
                    {appointment.service}{appointment.haircutStyle ? ` · ${appointment.haircutStyle}` : ''}
                </p>
            </div>

            <div className='shrink-0 text-right'>
                <p className='font-mono text-sm font-semibold text-[#2F6B57]'>{formatTime(appointment.time)}</p>
                {appointment.endTime && (
                    <p className='text-[10px] text-[#2F6B57]'>→ {formatTime(appointment.endTime)}</p>
                )}
            </div>
        </div>
    )
}

function BookingsView({
    appointments,
    filter,
    onFilter,
    search,
    onSearch,
    selected,
    onSelect,
    updatingId,
    onStatusUpdate
}) {
    return (
        <div className='space-y-4'>
            {/* Filter Tabs and Search Bar */}
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-[#DDE4DE] bg-white p-1 shadow-xs w-full sm:w-auto'>
                    {BOOKING_FILTERS.map((item) => (
                        <button
                            key={item.id || 'all'}
                            onClick={() => onFilter(item.id)}
                            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                                filter === item.id
                                    ? 'bg-[#13231B] text-white shadow-xs'
                                    : 'text-[#405148] hover:bg-[#F6F7F2]'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <label className='relative block w-full sm:w-72'>
                    <Search size={15} className='absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2F6B57]' />
                    <input
                        value={search}
                        onChange={(event) => onSearch(event.target.value)}
                        placeholder='Search pet, customer, service...'
                        className='h-10 w-full rounded-xl border border-[#DDE4DE] bg-white pl-9 pr-4 text-xs font-medium shadow-xs outline-none transition focus:border-[#2F6B57] focus:ring-1 focus:ring-[#2F6B57]/20'
                    />
                </label>
            </div>

            {/* Full-width Bookings List */}
            <div className='space-y-3'>
                {appointments.length ? (
                    appointments.map((appointment) => (
                        <button
                            key={appointment._id}
                            onClick={() => onSelect(appointment._id)}
                            className='group flex w-full flex-col gap-4 rounded-2xl border border-[#DDE4DE] bg-white p-4 sm:p-5 text-left shadow-xs transition hover:border-[#2F6B57] hover:shadow-sm md:flex-row md:items-center md:justify-between'
                        >
                            <div className='flex items-center gap-4 min-w-0'>
                                <PetAvatar appointment={appointment} large />
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <p className='font-serif text-lg font-bold text-[#13231B]'>{appointment.petName}</p>
                                        <span className='text-xs text-[#68776F]'>({appointment.breed})</span>
                                        <StatusBadge status={appointment.status} />
                                    </div>
                                    <p className='mt-1 text-xs font-medium text-[#405148]'>
                                        Customer: <strong className='text-[#13231B]'>{getOwnerName(appointment)}</strong>
                                        {appointment.ownerPhone && <span> · {appointment.ownerPhone}</span>}
                                    </p>
                                </div>
                            </div>

                            <div className='flex items-center justify-between gap-6 border-t border-[#E5EAE6] pt-3 md:border-0 md:pt-0 md:justify-end'>
                                <div className='text-left md:text-right'>
                                    <p className='text-xs font-bold text-[#13231B]'>
                                        {appointment.service}{appointment.haircutStyle ? ` · ${appointment.haircutStyle}` : ''}
                                    </p>
                                    <p className='mt-0.5 font-mono text-[11px] text-[#68776F]'>
                                        {formatDate(appointment.date)} · {formatTime(appointment.time)}{appointment.endTime ? ` – ${formatTime(appointment.endTime)}` : ''}
                                    </p>
                                </div>

                                <div className='text-right shrink-0'>
                                    <p className='font-serif text-base font-bold text-[#13231B]'>{formatPeso(appointment.price)}</p>
                                    <span className='mt-1 inline-flex items-center gap-1 text-xs font-extrabold text-[#2F6B57] group-hover:underline'>
                                        View details →
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))
                ) : (
                    <EmptyPanel icon={ClipboardList} message='No bookings match the selected filter.' />
                )}
            </div>

            {/* Modal Popup for Full Booking Details & Actions */}
            {selected && (
                <BookingDetailModal
                    appointment={selected}
                    updating={updatingId === selected._id}
                    onStatusUpdate={onStatusUpdate}
                    onClose={() => onSelect(null)}
                />
            )}
        </div>
    )
}

function BookingDetailModal({
    appointment,
    updating,
    onStatusUpdate,
    onClose
}) {
    const [preview, setPreview] = useState(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewError, setPreviewError] = useState('')
    const [previewOpen, setPreviewOpen] = useState(false)

    useEffect(() => {
        let active = true

        queueMicrotask(() => {
            if (!active) return
            setPreview(null)
            setPreviewError('')
            setPreviewOpen(false)
            setPreviewLoading(Boolean(appointment?.aiPreviewUsed))
        })

        if (!appointment?.aiPreviewUsed) {
            return () => { active = false }
        }

        adminApi.getAppointmentPreview(appointment._id)
            .then(({ data }) => {
                if (!active) return
                setPreview(data.preview || null)
            })
            .catch((error) => {
                if (!active) return
                setPreviewError(getErrorMessage(error))
            })
            .finally(() => {
                if (active) setPreviewLoading(false)
            })

        return () => { active = false }
    }, [appointment?._id, appointment?.aiPreviewUsed])

    const statusActions = ['pending', 'confirmed', 'completed', 'cancelled']

    return (
        <div
            className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13231B]/50 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto'
            onClick={(e) => { if (e.target === e.currentTarget && !updating) onClose() }}
        >
            <div className='relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-[#DDE4DE] p-6 sm:p-7 shadow-2xl space-y-6 text-[#13231B] my-auto'>
                {/* Modal Header */}
                <div className='flex items-center justify-between border-b border-[#DDE4DE] pb-4'>
                    <div className='flex items-center gap-3.5'>
                        <PetAvatar appointment={appointment} large />
                        <div>
                            <div className='flex items-center gap-2'>
                                <h2 className='font-serif text-2xl font-bold text-[#13231B]'>{appointment.petName}</h2>
                                <StatusBadge status={appointment.status} />
                            </div>
                            <p className='text-xs text-[#68776F] font-medium'>{appointment.breed} · {appointment.petType === 'cat' ? 'Cat' : 'Dog'}</p>
                        </div>
                    </div>

                    <button
                        type='button'
                        onClick={onClose}
                        className='grid h-9 w-9 place-items-center rounded-xl border border-[#DDE4DE] bg-[#FAFBF8] text-[#13231B] transition hover:bg-[#F6F7F2]'
                        aria-label='Close modal'
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 2-Column Info Grid */}
                <div className='grid gap-4 sm:grid-cols-2'>
                    {/* Customer Information */}
                    <div className='rounded-2xl border border-[#DDE4DE] bg-[#FAFBF8] p-4 space-y-2.5 text-xs'>
                        <p className='font-bold uppercase tracking-wider text-[10px] text-[#2F6B57]'>Customer Information</p>
                        <DetailRow label='Name' value={getOwnerName(appointment)} />
                        <DetailRow label='Phone' value={appointment.ownerPhone || '—'} />
                        <DetailRow label='Email' value={appointment.ownerEmail || '—'} />
                        {appointment.ownerAddress && <DetailRow label='Address' value={appointment.ownerAddress} />}
                    </div>

                    {/* Booking Details */}
                    <div className='rounded-2xl border border-[#DDE4DE] bg-[#FAFBF8] p-4 space-y-2.5 text-xs'>
                        <p className='font-bold uppercase tracking-wider text-[10px] text-[#2F6B57]'>Booking Information</p>
                        <DetailRow label='Service' value={appointment.service} />
                        <DetailRow label='Hairstyle' value={appointment.haircutStyle || 'Standard'} />
                        <DetailRow label='Date' value={formatDate(appointment.date)} />
                        <DetailRow label='Time' value={`${formatTime(appointment.time)}${appointment.endTime ? ` – ${formatTime(appointment.endTime)}` : ''}`} />
                        <DetailRow label='Total Price' value={formatPeso(appointment.price)} />
                        <DetailRow label='AI Preview' value={appointment.aiPreviewUsed ? 'Used' : 'Not used'} />
                    </div>
                </div>

                {/* AI Grooming Reference Image */}
                {appointment.aiPreviewUsed && (
                    <div className='rounded-2xl border border-[#DDE4DE] bg-[#FAFBF8] p-4'>
                        <div className='flex items-center justify-between gap-3 mb-2'>
                            <div>
                                <p className='font-mono text-[10px] uppercase tracking-wider text-[#2F6B57] font-bold'>
                                    Grooming Reference
                                </p>
                                <p className='text-sm font-bold text-[#13231B]'>
                                    {appointment.haircutStyle || 'Selected style'}
                                </p>
                            </div>
                            {preview && (
                                <span className='rounded-full bg-[#EDF3EE] px-2.5 py-1 text-[10px] font-bold text-[#1F4D3E]'>
                                    {preview.seasonLabel || 'AI preview'}
                                </span>
                            )}
                        </div>

                        {previewLoading ? (
                            <div className='grid h-48 place-items-center rounded-xl bg-white text-xs font-semibold text-[#68776F] border border-[#DDE4DE]'>
                                Loading saved preview...
                            </div>
                        ) : preview?.image ? (
                            <button
                                type='button'
                                onClick={() => setPreviewOpen(true)}
                                className='group relative block w-full overflow-hidden rounded-xl border border-[#DDE4DE] bg-white'
                                title='Enlarge grooming preview'
                            >
                                <img
                                    src={preview.image}
                                    alt={`${appointment.petName} ${appointment.haircutStyle || ''} grooming preview`}
                                    className='h-52 w-full object-contain transition group-hover:scale-[1.01]'
                                />
                                <span className='absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-[#13231B] px-3 py-1.5 text-xs font-semibold text-white shadow-sm'>
                                    <ZoomIn size={14} /> Enlarge
                                </span>
                            </button>
                        ) : (
                            <div className='rounded-xl border border-dashed border-[#DDE4DE] bg-white p-4 text-center text-xs leading-5 text-[#68776F]'>
                                <ImageIcon size={22} className='mx-auto mb-1.5 text-[#A6B1AA]' />
                                {previewError || 'No AI preview image available for this booking.'}
                            </div>
                        )}
                        <p className='mt-2 text-[11px] leading-relaxed text-[#68776F]'>
                            Use this customer-selected AI preview as visual reference. Confirm coat and safety suitability upon visit.
                        </p>
                    </div>
                )}

                {/* Notes */}
                {appointment.notes && (
                    <div className='rounded-2xl border border-[#DDE4DE] bg-[#FAFBF8] p-4 text-xs'>
                        <p className='font-bold uppercase tracking-wider text-[10px] text-[#2F6B57]'>Client Notes</p>
                        <p className='mt-1 text-sm text-[#405148] italic'>&ldquo;{appointment.notes}&rdquo;</p>
                    </div>
                )}

                {/* Cancellation Reason if cancelled */}
                {appointment.status === 'cancelled' && appointment.cancellationReason && (
                    <div className='rounded-2xl border border-[#F0CCCC] bg-[#FBEAEA] p-4 text-xs text-[#7F3333]'>
                        <p className='font-bold uppercase tracking-wider text-[10px] text-[#9E3E3E]'>Cancellation Reason</p>
                        <p className='mt-1 text-sm font-semibold'>{appointment.cancellationReason}</p>
                    </div>
                )}

                {/* Update Status Actions */}
                <div className='border-t border-[#DDE4DE] pt-4'>
                    <p className='text-xs font-bold uppercase tracking-wider text-[#2F6B57] mb-2.5'>Update Booking Status</p>
                    <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
                        {[
                            { key: 'pending', label: 'Set Pending', activeLabel: 'Pending' },
                            { key: 'confirmed', label: 'Approve', activeLabel: 'Approved' },
                            { key: 'completed', label: 'Complete', activeLabel: 'Completed' },
                            { key: 'cancelled', label: 'Cancel', activeLabel: 'Cancelled' }
                        ].map(({ key, label, activeLabel }) => {
                            const isCurrent = appointment.status === key
                            return (
                                <button
                                    key={key}
                                    disabled={updating || isCurrent}
                                    onClick={() => onStatusUpdate(appointment, key)}
                                    className={`rounded-xl px-3.5 py-2.5 text-xs font-bold transition text-center ${
                                        isCurrent
                                            ? 'bg-[#13231B] text-white shadow-xs cursor-default'
                                            : 'border border-[#DDE4DE] bg-white text-[#405148] hover:bg-[#FAFBF8] hover:border-[#1F4D3E] hover:text-[#1F4D3E] active:scale-[0.98]'
                                    } disabled:opacity-85`}
                                >
                                    {isCurrent ? `✓ ${activeLabel}` : label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className='flex justify-end pt-2 border-t border-[#DDE4DE]'>
                    <button
                        type='button'
                        onClick={onClose}
                        className='rounded-xl border border-[#DDE4DE] bg-white px-5 py-2.5 text-xs font-bold text-[#405148] transition hover:bg-[#F6F7F2]'
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Enlarge Preview Image Modal */}
            {previewOpen && preview?.image && (
                <div
                    className='fixed inset-0 z-[100] flex items-center justify-center bg-[#13231B]/70 p-4'
                    onClick={() => setPreviewOpen(false)}
                >
                    <div
                        className='relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white p-4 shadow-2xl sm:p-6'
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type='button'
                            onClick={() => setPreviewOpen(false)}
                            className='absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full bg-[#FAFBF8] border border-[#DDE4DE] text-[#13231B] shadow-md hover:bg-[#F6F7F2]'
                            aria-label='Close enlarged preview'
                        >
                            <X size={20} />
                        </button>
                        <div className='pr-12'>
                            <p className='font-serif text-2xl font-bold'>
                                {appointment.petName} — {appointment.haircutStyle || 'Grooming preview'}
                            </p>
                            <p className='text-xs text-[#68776F]'>{appointment.service} · {formatDate(appointment.date)}</p>
                        </div>
                        <div className='mt-4 overflow-hidden rounded-2xl bg-[#FAFBF8] p-2'>
                            <img
                                src={preview.image}
                                alt={`${appointment.petName} preview`}
                                className='max-h-[65vh] w-full rounded-xl object-contain'
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ScheduleView({
    appointments,
    weekAnchor,
    onPrevious,
    onNext,
    onToday,
    onStatusUpdate,
    updatingId
}) {
    const [selectedAppointmentSelection, setSelectedAppointment] = useState(null)
    const [previewState, setPreviewState] = useState({ appointmentId: null, image: null })
    const [enlargedImage, setEnlargedImage] = useState(null)

    const [statusFilter, setStatusFilter] = useState('all')

    const week = buildWeek(weekAnchor)

    const hours = [
        '08:00',
        '10:00',
        '12:00',
        '14:00'
    ]

    const totalCount = appointments.filter((a) => a.status !== 'cancelled').length
    const approvedCount = appointments.filter((a) => ['confirmed', 'completed'].includes(a.status)).length
    const pendingCount = appointments.filter((a) => a.status === 'pending').length

    const activeAppointments = appointments.filter((appointment) => {
        if (appointment.status === 'cancelled') return false
        if (statusFilter === 'confirmed') return ['confirmed', 'completed'].includes(appointment.status)
        if (statusFilter === 'pending') return appointment.status === 'pending'
        return true
    })

    const selectedAppointment = selectedAppointmentSelection?._id
        ? appointments.find((appointment) => appointment._id === selectedAppointmentSelection._id) || selectedAppointmentSelection
        : null

    const expectsAiPreview = Boolean(
        selectedAppointment?.aiPreviewUsed || selectedAppointment?.haircutStyle
    )

    useEffect(() => {
        const appointmentId = selectedAppointment?._id
        if (!appointmentId || !expectsAiPreview) return undefined

        let cancelled = false
        adminApi.getAppointmentPreview(appointmentId)
            .then(({ data }) => {
                if (!cancelled) {
                    setPreviewState({
                        appointmentId,
                        image: data?.preview?.image || null
                    })
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPreviewState({ appointmentId, image: null })
                }
            })

        return () => {
            cancelled = true
        }
    }, [selectedAppointment?._id, expectsAiPreview])

    const fetchedAiPreview = previewState.appointmentId === selectedAppointment?._id
        ? previewState.image
        : null
    const fetchingPreview = Boolean(
        selectedAppointment?._id && expectsAiPreview && previewState.appointmentId !== selectedAppointment._id
    )
    const aiPreviewImg = fetchedAiPreview || selectedAppointment?.generatedImagePreviewUrl || selectedAppointment?.previewImage || selectedAppointment?.aiPreviewImage

    return (
        <section className='overflow-hidden rounded-2xl border border-[#DDE4DE] bg-white shadow-xs'>
            <div className='flex flex-col gap-3 border-b border-[#DDE4DE] px-5 py-4 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <h2 className='font-serif text-lg font-bold'>Weekly Schedule</h2>
                    <p className='mt-0.5 text-xs text-[#2F6B57]'>
                        {formatDate(week[0])} – {formatDate(week[6])}
                    </p>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                    {/* Status Filter Buttons */}
                    <div className='flex items-center gap-0.5 rounded-xl border border-[#DDE4DE] bg-white p-1'>
                        <button
                            type='button'
                            onClick={() => setStatusFilter('all')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                statusFilter === 'all'
                                    ? 'bg-[#13231B] text-[#F6F7F2] shadow-xs'
                                    : 'text-[#405148] hover:bg-[#F6F7F2]'
                            }`}
                        >
                            All · {totalCount}
                        </button>
                        <button
                            type='button'
                            onClick={() => setStatusFilter('confirmed')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                statusFilter === 'confirmed'
                                    ? 'bg-[#1F4D3E] text-[#F6F7F2] shadow-xs'
                                    : 'text-[#405148] hover:bg-[#F6F7F2]'
                            }`}
                        >
                            Approved · {approvedCount}
                        </button>
                        <button
                            type='button'
                            onClick={() => setStatusFilter('pending')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                statusFilter === 'pending'
                                    ? 'bg-[#E8795B] text-[#F6F7F2] shadow-xs'
                                    : 'text-[#405148] hover:bg-[#F6F7F2]'
                            }`}
                        >
                            Pending · {pendingCount}
                        </button>
                    </div>

                    <div className='flex items-center gap-1'>
                        <button
                            onClick={onPrevious}
                            className='grid h-8 w-8 place-items-center rounded-lg border border-[#DDE4DE] bg-white text-[#405148] transition hover:bg-[#F6F7F2]'
                            aria-label='Previous week'
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={onToday}
                            className='h-8 rounded-lg border border-[#DDE4DE] bg-white px-3 text-xs font-bold text-[#405148] transition hover:bg-[#F6F7F2]'
                        >
                            Today
                        </button>
                        <button
                            onClick={onNext}
                            className='grid h-8 w-8 place-items-center rounded-lg border border-[#DDE4DE] bg-white text-[#405148] transition hover:bg-[#F6F7F2]'
                            aria-label='Next week'
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className='overflow-x-auto'>
                <div className='min-w-[1050px]'>
                    <div className='grid grid-cols-[110px_repeat(7,minmax(130px,1fr))]'>
                        <div className='border-b border-r border-[#DDE4DE] bg-[#F6F7F2] p-3 font-mono text-xs uppercase text-[#2F6B57]'>
                            Time
                        </div>

                        {week.map((date) => (
                            <div
                                key={dateKey(date)}
                                className={`border-b border-r border-[#DDE4DE] p-3 text-center last:border-r-0 ${dateKey(date) === dateKey(new Date()) ? 'bg-[#F6F7F2]' : 'bg-[#F6F7F2]'}`}
                            >
                                <p className='text-xs text-[#2F6B57]'>
                                    {date.toLocaleDateString('en-PH', { weekday: 'short' })}
                                </p>

                                <p className='font-serif text-lg font-bold'>
                                    {date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                        ))}

                        {hours.flatMap((hour) => [
                            <div
                                key={`time-${hour}`}
                                className='min-h-[86px] border-b border-r border-[#DDE4DE] bg-[#F6F7F2] p-3 font-mono text-xs text-[#2F6B57]'
                            >
                                {formatTime(hour)}
                            </div>,

                            ...week.map((date) => {
                                const key = dateKey(date)

                                const items = activeAppointments.filter(
                                    (appointment) =>
                                        appointment.date === key &&
                                        appointment.time?.slice(0, 2) === hour.slice(0, 2)
                                )

                                return (
                                    <div
                                        key={`${key}-${hour}`}
                                        className='min-h-[86px] border-b border-r border-[#DDE4DE] p-2 last:border-r-0'
                                    >
                                        {items.map((appointment) => {
                                            const displayImg = appointment.pet?.photoUrl || appointment.petPhotoUrl || appointment.photoUrl || appointment.generatedImagePreviewUrl || appointment.previewImage || appointment.aiPreviewImage
                                            return (
                                                <button
                                                    key={appointment._id}
                                                    type='button'
                                                    onClick={() => setSelectedAppointment(appointment)}
                                                    className='mb-1.5 w-full rounded-xl border border-[#DDE4DE] bg-white p-2 text-left text-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2F6B57] hover:bg-[#F6F7F2] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2F6B57]'
                                                    title='Click to view appointment details'
                                                >
                                                    <div className='flex items-center gap-2'>
                                                        {displayImg ? (
                                                            <img
                                                                src={displayImg}
                                                                alt={appointment.petName}
                                                                className='h-8 w-8 shrink-0 rounded-lg border border-[#F6F7F2] object-cover bg-[#F6F7F2]'
                                                            />
                                                        ) : (
                                                            <div className='grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#DDE4DE] bg-white text-[#2F6B57] font-bold text-[10px]'>
                                                                {appointment.petName?.[0] || 'P'}
                                                            </div>
                                                        )}
                                                        <div className='min-w-0 flex-1'>
                                                            <div className='flex items-center justify-between gap-1'>
                                                                <p className='truncate font-bold text-[#13231B]'>
                                                                    {appointment.petName}
                                                                </p>
                                                                <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${appointment.status === 'confirmed' ? 'bg-[#1F4D3E]' : appointment.status === 'completed' ? 'bg-[#405148]' : 'bg-[#E8795B]'}`} />
                                                            </div>

                                                            <p className='truncate text-[10px] text-[#2F6B57]'>
                                                                {appointment.service}
                                                            </p>

                                                            <p className='font-mono text-[9px] font-bold text-[#2F6B57]'>
                                                                {formatTime(appointment.time)}
                                                                {appointment.endTime ? `–${formatTime(appointment.endTime)}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )
                            })
                        ])}
                    </div>
                </div>
            </div>

            {/* Appointment Details Modal */}
            {selectedAppointment && (
                <div
                    className='fixed inset-0 z-50 flex items-center justify-center bg-[#13231B]/60 p-4 backdrop-blur-sm'
                    onClick={() => setSelectedAppointment(null)}
                >
                    <div
                        className='relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#F6F7F2] p-6 shadow-2xl sm:p-8'
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className='flex items-start justify-between gap-4 border-b border-[#DDE4DE] pb-5'>
                            <div>
                                <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_META[selectedAppointment.status]?.badge || 'bg-[#F6F7F2] text-[#13231B]'}`}>
                                    {STATUS_META[selectedAppointment.status]?.label || selectedAppointment.status}
                                </span>
                                <h3 className='mt-2 font-serif text-3xl font-bold text-[#13231B]'>
                                    {selectedAppointment.petName}’s Appointment
                                </h3>
                                <p className='mt-1 text-xs text-[#2F6B57]'>
                                    ID: <span className='font-mono'>{selectedAppointment._id}</span>
                                </p>
                            </div>

                            <button
                                type='button'
                                onClick={() => setSelectedAppointment(null)}
                                className='grid h-10 w-10 place-items-center rounded-full bg-[#F6F7F2] text-[#405148] transition hover:bg-[#F6F7F2]'
                                aria-label='Close details'
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className='mt-6 space-y-6'>
                            {/* Grid Info */}
                            <div className='grid gap-4 sm:grid-cols-2'>
                                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-4 space-y-2'>
                                    <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57] flex items-center gap-1.5'>
                                        <Scissors size={14} /> Pet Information
                                    </p>
                                    <p className='text-sm font-bold text-[#13231B]'>{selectedAppointment.petName}</p>
                                    <p className='text-xs text-[#2F6B57]'>Breed: <span className='font-semibold text-[#13231B]'>{selectedAppointment.breed || selectedAppointment.petBreed || 'N/A'}</span></p>
                                    {selectedAppointment.petType && <p className='text-xs text-[#2F6B57]'>Species: <span className='font-semibold text-[#13231B]'>{selectedAppointment.petType}</span></p>}
                                </div>

                                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-4 space-y-2'>
                                    <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57] flex items-center gap-1.5'>
                                        <UserRound size={14} /> Customer Contact
                                    </p>
                                    <p className='text-sm font-bold text-[#13231B]'>{getOwnerName(selectedAppointment)}</p>
                                    <p className='text-xs text-[#2F6B57]'>Phone: <span className='font-semibold text-[#13231B]'>{selectedAppointment.ownerPhone || selectedAppointment.phone || 'N/A'}</span></p>
                                    <p className='text-xs text-[#2F6B57] truncate'>Email: <span className='font-semibold text-[#13231B]'>{selectedAppointment.ownerEmail || selectedAppointment.email || 'N/A'}</span></p>
                                </div>
                            </div>

                            {/* Service & Schedule */}
                            <div className='rounded-2xl border border-[#DDE4DE] bg-white p-4 space-y-3'>
                                <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57] flex items-center gap-1.5'>
                                    <Scissors size={14} /> Grooming Details
                                </p>
                                <div className='grid grid-cols-2 gap-3 text-xs'>
                                    <div>
                                        <p className='text-[#2F6B57]'>Service</p>
                                        <p className='font-bold text-[#13231B] text-sm mt-0.5'>{selectedAppointment.service}</p>
                                    </div>
                                    <div>
                                        <p className='text-[#2F6B57]'>Price</p>
                                        <p className='font-serif font-bold text-[#2F6B57] text-base mt-0.5'>{formatPeso(selectedAppointment.amount || selectedAppointment.price || 1200)}</p>
                                    </div>
                                    <div>
                                        <p className='text-[#2F6B57]'>Date</p>
                                        <p className='font-semibold text-[#13231B] mt-0.5'>{formatDate(selectedAppointment.date)}</p>
                                    </div>
                                    <div>
                                        <p className='text-[#2F6B57]'>Time Slot</p>
                                        <p className='font-mono font-semibold text-[#13231B] mt-0.5'>
                                            {formatTime(selectedAppointment.time)}
                                            {selectedAppointment.endTime ? `–${formatTime(selectedAppointment.endTime)}` : ''}
                                        </p>
                                    </div>
                                </div>

                                {selectedAppointment.haircutStyle && (
                                    <div className='flex items-center justify-between gap-4 border-t border-[#DDE4DE] pt-3'>
                                        <div>
                                            <p className='text-xs text-[#2F6B57]'>Selected Haircut Style:</p>
                                            <p className='font-semibold text-[#2F6B57] text-sm mt-0.5'>{selectedAppointment.haircutStyle}</p>
                                            {aiPreviewImg && (
                                                <span className='mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#13231B] bg-[#F6F7F2] px-2.5 py-0.5 rounded-full'>
                                                    AI Preview Attached
                                                </span>
                                            )}
                                        </div>

                                        {aiPreviewImg ? (
                                            <div
                                                className='group relative cursor-pointer overflow-hidden rounded-xl border border-[#DDE4DE] bg-white shadow-sm transition hover:scale-105'
                                                onClick={() => setEnlargedImage(aiPreviewImg)}
                                                title='Click to enlarge AI haircut preview'
                                            >
                                                <img
                                                    src={aiPreviewImg}
                                                    alt={`AI Style preview for ${selectedAppointment.haircutStyle}`}
                                                    className='h-16 w-16 object-cover'
                                                />
                                                <span className='absolute inset-0 flex items-center justify-center bg-[#13231B]/40 text-[#F6F7F2] opacity-0 transition group-hover:opacity-100'>
                                                    <ZoomIn size={14} />
                                                </span>
                                            </div>
                                        ) : fetchingPreview ? (
                                            <div className='flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-[#B8C7BE] bg-white text-[#2F6B57]'>
                                                <RefreshCw size={14} className='animate-spin' />
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            {selectedAppointment.notes && (
                                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-4'>
                                    <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>Notes for Groomer</p>
                                    <p className='mt-1.5 text-xs text-[#405148] leading-relaxed'>{selectedAppointment.notes}</p>
                                </div>
                            )}

                            {/* AI Style Preview Image */}
                            {(selectedAppointment.generatedImagePreviewUrl || selectedAppointment.previewImage || selectedAppointment.aiPreviewImage) && (
                                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-4'>
                                    <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57] mb-2 flex items-center gap-1.5'>
                                        <ImageIcon size={14} /> AI Grooming Preview Reference
                                    </p>
                                    <div className='relative overflow-hidden rounded-xl border border-[#DDE4DE] bg-white'>
                                        <img
                                            src={selectedAppointment.generatedImagePreviewUrl || selectedAppointment.previewImage || selectedAppointment.aiPreviewImage}
                                            alt={`AI Style preview for ${selectedAppointment.petName}`}
                                            className='max-h-64 w-full object-contain cursor-pointer transition hover:scale-[1.02]'
                                            onClick={() => setEnlargedImage(selectedAppointment.generatedImagePreviewUrl || selectedAppointment.previewImage || selectedAppointment.aiPreviewImage)}
                                        />
                                        <button
                                            type='button'
                                            onClick={() => setEnlargedImage(selectedAppointment.generatedImagePreviewUrl || selectedAppointment.previewImage || selectedAppointment.aiPreviewImage)}
                                            className='absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-[#13231B]/70 px-3 py-1 text-[10px] font-bold text-[#F6F7F2] backdrop-blur-sm'
                                        >
                                            <ZoomIn size={12} /> Click to Enlarge
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Actions / Status Update */}
                            {onStatusUpdate && (
                                <div className='border-t border-[#DDE4DE] pt-4'>
                                    <p className='text-xs font-bold text-[#2F6B57] mb-3'>Update Appointment Status:</p>
                                    <div className='grid grid-cols-3 gap-2'>
                                        <button
                                            type='button'
                                            disabled={updatingId === selectedAppointment._id || selectedAppointment.status === 'confirmed'}
                                            onClick={() => onStatusUpdate(selectedAppointment, 'confirmed')}
                                            className={`rounded-xl px-3 py-2.5 text-xs font-bold transition disabled:opacity-50 ${selectedAppointment.status === 'confirmed' ? 'bg-[#1F4D3E] text-[#F6F7F2]' : 'border border-[#DDE4DE] bg-white text-[#1F4D3E] hover:bg-[#F6F7F2]'}`}
                                        >
                                            Approve
                                        </button>

                                        <button
                                            type='button'
                                            disabled={updatingId === selectedAppointment._id || selectedAppointment.status === 'completed'}
                                            onClick={() => onStatusUpdate(selectedAppointment, 'completed')}
                                            className={`rounded-xl px-3 py-2.5 text-xs font-bold transition disabled:opacity-50 ${selectedAppointment.status === 'completed' ? 'bg-[#13231B] text-[#F6F7F2]' : 'border border-[#DDE4DE] bg-white text-[#13231B] hover:bg-[#F6F7F2]'}`}
                                        >
                                            Complete
                                        </button>

                                        <button
                                            type='button'
                                            disabled={updatingId === selectedAppointment._id || selectedAppointment.status === 'cancelled'}
                                            onClick={() => onStatusUpdate(selectedAppointment, 'cancelled')}
                                            className={`rounded-xl px-3 py-2.5 text-xs font-bold transition disabled:opacity-50 ${selectedAppointment.status === 'cancelled' ? 'bg-[#2F6B57] text-[#F6F7F2]' : 'border border-[#DDE4DE] bg-white text-[#2F6B57] hover:bg-[#F6F7F2]'}`}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Enlarged Image Zoom Overlay */}
            {enlargedImage && (
                <div
                    className='fixed inset-0 z-[100] flex items-center justify-center bg-[#13231B]/80 p-4 backdrop-blur-md'
                    onClick={() => setEnlargedImage(null)}
                >
                    <div className='relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl bg-[#F6F7F2] p-4 shadow-2xl'>
                        <button
                            type='button'
                            onClick={() => setEnlargedImage(null)}
                            className='absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-[#13231B]/60 text-[#F6F7F2] shadow-md hover:bg-[#13231B]'
                        >
                            <X size={20} />
                        </button>
                        <img src={enlargedImage} alt='Enlarged Preview' className='max-h-[80vh] w-full object-contain rounded-2xl' />
                    </div>
                </div>
            )}
        </section>
    )
}

function CustomerStatusBadge({ status, reason }) {
    const normalized = status || 'active'
    const config = {
        active: { label: 'Active', icon: CheckCircle2, className: 'border border-[#C9E1D3] bg-[#E4F1EA] text-[#216245]' },
        warned: { label: 'Warned', icon: AlertTriangle, className: 'border border-[#F0DEB6] bg-[#FFF4DC] text-[#8A5D13]' },
        booking_blocked: { label: 'Booking blocked', icon: Ban, className: 'border border-[#F2D2C8] bg-[#FBE9E4] text-[#A84D39]' },
        banned: { label: 'Banned', icon: ShieldAlert, className: 'border border-[#F0CCCC] bg-[#FBEAEA] text-[#9E3E3E]' }
    }[normalized] || { label: 'Active', icon: CheckCircle2, className: 'border border-[#C9E1D3] bg-[#E4F1EA] text-[#216245]' }

    const Icon = config.icon
    return (
        <span title={reason || config.label} className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-extrabold ${config.className}`}>
            <Icon size={12} /> {config.label}
        </span>
    )
}

function CustomerActionModal({ isOpen, customer, loading, onConfirm, onClose }) {
    const [action, setAction] = useState(
        customer?.accountStatus && customer.accountStatus !== 'active'
            ? customer.accountStatus
            : 'warned'
    )
    const [presetReason, setPresetReason] = useState('Multiple booking cancellations / No-show policy')
    const [customReason, setCustomReason] = useState(customer?.statusReason || '')

    if (!isOpen || !customer) return null

    const actions = [
        { id: 'warned', label: 'Issue warning', detail: 'Keep access open', icon: AlertTriangle },
        { id: 'booking_blocked', label: 'Block booking', detail: 'Stop new appointments', icon: Ban },
        { id: 'banned', label: 'Ban account', detail: 'Block account access', icon: ShieldAlert },
        { id: 'active', label: 'Restore active', detail: 'Clear restrictions', icon: CheckCircle2 }
    ]

    const handleSave = () => {
        const finalReason = action === 'active'
            ? ''
            : presetReason === 'Other (custom reason)'
                ? customReason.trim()
                : `${presetReason}${customReason.trim() ? `: ${customReason.trim()}` : ''}`

        onConfirm(customer._id, {
            accountStatus: action,
            statusReason: finalReason,
            warningMessage: action === 'active' ? '' : (customReason.trim() || presetReason)
        })
    }

    return (
        <div className='fixed inset-0 z-50 grid place-items-center bg-[#13231B]/70 p-4' role='presentation'>
            <button type='button' className='absolute inset-0' onClick={loading ? undefined : onClose} aria-label='Close customer status dialog' />
            <div className='relative z-10 w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-[#DDE4DE] bg-white shadow-2xl' role='dialog' aria-modal='true' aria-labelledby='customer-status-title'>
                <div className='grid gap-5 border-b border-[#DDE4DE] p-5 sm:grid-cols-[1fr_auto] sm:items-start sm:p-6'>
                    <div>
                        <p className='text-[11px] font-extrabold uppercase tracking-[.16em] text-[#405148]'>Account access</p>
                        <h3 id='customer-status-title' className='mt-1 font-serif text-2xl font-bold text-[#13231B]'>Manage {customer.firstName} {customer.lastName}</h3>
                        <div className='mt-3 flex flex-wrap items-center gap-2'>
                            <CustomerStatusBadge status={customer.accountStatus} reason={customer.statusReason} />
                            <span className='text-xs font-semibold text-[#405148]'>{customer.email || customer.phone || 'No contact detail'}</span>
                        </div>
                    </div>
                    <button type='button' onClick={onClose} disabled={loading} className='grid h-11 w-11 place-items-center rounded-xl border border-[#DDE4DE] bg-white text-[#13231B]' aria-label='Close dialog'>
                        <X size={19} />
                    </button>
                </div>

                <div className='space-y-6 p-5 sm:p-6'>
                    <fieldset>
                        <legend className='text-sm font-extrabold text-[#13231B]'>Choose account status</legend>
                        <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                            {actions.map(({ id, label, detail, icon }) => {
                                const Icon = icon
                                const selected = action === id
                                return (
                                    <button
                                        key={id}
                                        type='button'
                                        onClick={() => setAction(id)}
                                        aria-pressed={selected}
                                        className={`flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-[#1F4D3E] bg-[#EDF3EE] text-[#13231B]' : 'border-[#DDE4DE] bg-white text-[#405148] hover:border-[#B8C7BE] hover:bg-[#FAFBF8]'}`}
                                    >
                                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? 'bg-[#1F4D3E] text-white' : 'bg-[#EDF3EE] text-[#1F4D3E]'}`}><Icon size={18} /></span>
                                        <span>
                                            <span className='block text-sm font-extrabold'>{label}</span>
                                            <span className='block text-xs font-semibold opacity-80'>{detail}</span>
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </fieldset>

                    {action !== 'active' && (
                        <div className='grid gap-4 sm:grid-cols-2'>
                            <label className='block'>
                                <span className='text-sm font-extrabold text-[#13231B]'>Reason category</span>
                                <select
                                    value={presetReason}
                                    onChange={(event) => setPresetReason(event.target.value)}
                                    className='mt-2 min-h-12 w-full rounded-xl border border-[#DDE4DE] bg-white px-3 text-sm font-semibold text-[#13231B]'
                                >
                                    <option value='Multiple booking cancellations / No-show policy'>Multiple cancellations / no-show</option>
                                    <option value='Excessive last-minute schedule changes'>Last-minute schedule changes</option>
                                    <option value='Uncooperative pet handling or policy refusal'>Handling or policy refusal</option>
                                    <option value='Payment issues / Unpaid grooming balance'>Payment issue / unpaid balance</option>
                                    <option value='Other (custom reason)'>Other (custom reason)</option>
                                </select>
                            </label>

                            <label className='block'>
                                <span className='text-sm font-extrabold text-[#13231B]'>Customer-facing note</span>
                                <textarea
                                    value={customReason}
                                    onChange={(event) => setCustomReason(event.target.value)}
                                    rows={3}
                                    placeholder='Add concise context for the customer'
                                    className='mt-2 w-full rounded-xl border border-[#DDE4DE] bg-white px-3 py-3 text-sm text-[#13231B] placeholder:text-[#8A978F]'
                                />
                            </label>
                        </div>
                    )}

                    <div className='rounded-2xl border border-[#C9D9CE] bg-[#EDF3EE] p-4 text-sm leading-6 text-[#405148]'>
                        <strong className='text-[#1F4D3E]'>Persistence rule:</strong> this action is complete only after the server confirms the new status was committed. Notifications are sent as communication and do not determine account access.
                    </div>
                </div>

                <div className='flex flex-col-reverse gap-2 border-t border-[#DDE4DE] p-5 sm:flex-row sm:justify-end sm:p-6'>
                    <button type='button' onClick={onClose} disabled={loading} className='min-h-11 rounded-xl border border-[#1F4D3E] px-4 font-bold text-[#1F4D3E] disabled:opacity-50'>Cancel</button>
                    <button type='button' onClick={handleSave} disabled={loading} className='tt-primary px-5 disabled:opacity-50'>
                        {loading ? <RefreshCw size={16} className='animate-spin' /> : <CheckCheck size={16} />}
                        {loading ? 'Saving…' : 'Save persisted status'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function CustomersView({ customers, onRefresh }) {
    const [query, setQuery] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [actionModalOpen, setActionModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [persistedOverrides, setPersistedOverrides] = useState({})

    const customerList = useMemo(() => (customers || []).map((customer) => {
        const persisted = persistedOverrides[customer._id]
        return persisted ? mergePersistedCustomerStatus(customer, persisted) : customer
    }), [customers, persistedOverrides])

    const handleApplyStatus = async (userId, data) => {
        setSubmitting(true)
        try {
            const response = await adminApi.updateCustomerStatus(userId, data)
            const persistedUser = response.data?.user

            if (!persistedUser || persistedUser.accountStatus !== data.accountStatus) {
                throw new Error('The server did not confirm the requested account status')
            }

            setPersistedOverrides((previous) => ({
                ...previous,
                [userId]: persistedUser
            }))

            toast.success(`Customer status updated: ${getAccountStatusLabel(persistedUser.accountStatus)}`)
            setActionModalOpen(false)
            setSelectedCustomer(null)
            if (onRefresh) await onRefresh()
        } catch (err) {
            toast.error(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    const filtered = useMemo(() => {
        const normalized = query.trim().toLowerCase()
        if (!normalized) return customerList

        return customerList.filter((customer) => [
            customer.firstName,
            customer.lastName,
            customer.email,
            customer.phone,
            customer.accountStatus,
            ...(customer.pets || []).flatMap((pet) => [pet.name, pet.breed])
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized)))
    }, [customerList, query])

    const statusCounts = useMemo(() => customerList.reduce((counts, customer) => {
        const status = customer.accountStatus || 'active'
        counts[status] = (counts[status] || 0) + 1
        return counts
    }, { active: 0, warned: 0, booking_blocked: 0, banned: 0 }), [customerList])

    return (
        <section className='space-y-5'>
            {actionModalOpen && selectedCustomer && (
                <CustomerActionModal
                    key={`${selectedCustomer._id}-${selectedCustomer.accountStatus || 'active'}`}
                    isOpen
                    customer={selectedCustomer}
                    loading={submitting}
                    onConfirm={handleApplyStatus}
                    onClose={() => {
                        setActionModalOpen(false)
                        setSelectedCustomer(null)
                    }}
                />
            )}

            <div className='grid overflow-hidden rounded-[1.5rem] border border-[#DDE4DE] bg-white sm:grid-cols-2 xl:grid-cols-4'>
                {[
                    ['Active', statusCounts.active, 'active'],
                    ['Warned', statusCounts.warned, 'warned'],
                    ['Booking blocked', statusCounts.booking_blocked, 'booking_blocked'],
                    ['Banned', statusCounts.banned, 'banned']
                ].map(([label, value, status]) => (
                    <div key={status} className='border-b border-[#E5EAE6] p-5 last:border-b-0 sm:border-r sm:border-[#E5EAE6] sm:last:border-r-0 xl:border-b-0'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <p className='text-[10px] font-extrabold uppercase tracking-[.13em] text-[#7A8880]'>{label}</p>
                                <p className='mt-2 font-serif text-3xl font-bold'>{value}</p>
                            </div>
                            <CustomerStatusBadge status={status} />
                        </div>
                    </div>
                ))}
            </div>

            <div className='flex flex-col gap-4 rounded-[1.5rem] border border-[#DDE4DE] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5'>
                <div>
                    <h2 className='font-serif text-2xl font-bold'>Customer records</h2>
                    <p className='mt-1 text-sm font-semibold text-[#405148]'>{filtered.length} of {customerList.length} customers shown</p>
                </div>
                <label className='relative block w-full sm:max-w-md'>
                    <Search size={17} className='absolute left-3.5 top-1/2 -translate-y-1/2 text-[#405148]' />
                    <span className='sr-only'>Search customers</span>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder='Search name, contact, pet, or status'
                        className='min-h-12 w-full rounded-xl border border-[#DDE4DE] bg-[#FAFBF8] pl-10 pr-4 text-sm font-semibold text-[#13231B] placeholder:text-[#405148]'
                    />
                </label>
            </div>

            {filtered.length ? (
                <div className='grid gap-3'>
                    {filtered.map((customer) => (
                        <article key={customer._id} className='grid gap-5 rounded-[1.5rem] border border-[#DDE4DE] bg-white p-5 transition hover:border-[#B8C7BE] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'>
                            <div className='flex min-w-0 gap-4'>
                                <span className='grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EDF3EE] font-serif font-bold text-[#1F4D3E]'>{getInitials(customer.firstName, customer.lastName)}</span>
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <h3 className='font-serif text-lg font-bold'>{customer.firstName} {customer.lastName}</h3>
                                        <CustomerStatusBadge status={customer.accountStatus} reason={customer.statusReason} />
                                    </div>
                                    <p className='mt-1 text-sm font-semibold text-[#405148]'>{customer.email || 'No email'} · {customer.phone || 'No phone'}</p>
                                    <p className='mt-1 text-xs leading-5 text-[#405148]'>{getCustomerAddress(customer)}</p>

                                    {customer.accountStatus && customer.accountStatus !== 'active' && customer.statusReason && (
                                        <p className='mt-3 max-w-2xl rounded-xl border border-[#F0DEB6] bg-[#FFF4DC] px-3 py-2 text-xs font-bold leading-5 text-[#6E4A0D]'>
                                            Status note: {customer.statusReason}
                                        </p>
                                    )}

                                    <div className='mt-3 flex flex-wrap gap-2'>
                                        {(customer.pets || []).length ? customer.pets.map((pet) => (
                                            <span key={pet._id} className='rounded-full border border-[#DDE4DE] bg-[#F6F7F2] px-3 py-1 text-xs font-bold text-[#405148]'>{pet.name} · {pet.breed}</span>
                                        )) : <span className='text-xs font-semibold text-[#405148]'>No saved pet profiles</span>}
                                    </div>
                                </div>
                            </div>

                            <div className='grid gap-4 border-t border-[#E5EAE6] pt-4 sm:grid-cols-[1fr_auto] sm:items-center lg:min-w-[420px] lg:border-l lg:border-[#E5EAE6] lg:border-t-0 lg:pl-6 lg:pt-0'>
                                <dl className='grid grid-cols-3 gap-3'>
                                    <div><dt className='text-[10px] font-extrabold uppercase tracking-wider text-[#405148]'>Bookings</dt><dd className='mt-1 font-serif text-lg font-bold'>{customer.visits || 0}</dd></div>
                                    <div><dt className='text-[10px] font-extrabold uppercase tracking-wider text-[#405148]'>Spend</dt><dd className='mt-1 font-serif text-lg font-bold'>{formatPeso(customer.totalSpend)}</dd></div>
                                    <div><dt className='text-[10px] font-extrabold uppercase tracking-wider text-[#405148]'>Last visit</dt><dd className='mt-1 font-serif text-sm font-bold'>{formatShortDate(customer.lastVisit)}</dd></div>
                                </dl>
                                <button
                                    type='button'
                                    onClick={() => {
                                        setSelectedCustomer(customer)
                                        setActionModalOpen(true)
                                    }}
                                    className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#13231B] px-4 text-sm font-extrabold text-[#F6F7F2] transition hover:bg-[#1F4D3E]'
                                >
                                    <UserX size={16} /> Manage access
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <EmptyPanel message='No customer records match your search.' />
            )}
        </section>
    )
}

function AnalyticsView({
    analytics,
    currentMonthData,
    appointments,
    aiUsageRate,
    completedRate
}) {
    const monthlyData =
        analytics?.monthlyData ||
        []

    const serviceDistribution =
        analytics?.serviceDistribution ||
        []

    const maxAppointments =
        Math.max(
            1,
            ...monthlyData.map(
                (item) =>
                    item.appointments ||
                    0
            )
        )

    const maxRevenue =
        Math.max(
            1,
            ...monthlyData.map(
                (item) =>
                    item.revenue ||
                    0
            )
        )

    const styleUsage =
        useMemo(() => {
            const counts = {}

            appointments
                .filter(
                    (appointment) =>
                        appointment.haircutStyle &&
                        appointment.status !==
                        'cancelled'
                )
                .forEach(
                    (appointment) => {
                        const style =
                            appointment.haircutStyle

                        if (
                            !counts[
                            style
                            ]
                        ) {
                            counts[
                                style
                            ] = {
                                total: 0,
                                preview: 0
                            }
                        }

                        counts[
                            style
                        ].total += 1

                        if (
                            appointment.aiPreviewUsed
                        ) {
                            counts[
                                style
                            ].preview += 1
                        }
                    }
                )

            return Object.entries(
                counts
            )
                .map(
                    ([
                        style,
                        values
                    ]) => ({
                        style,
                        ...values,
                        rate:
                            values.total
                                ? Math.round(
                                    (values.preview /
                                        values.total) *
                                    100
                                )
                                : 0
                    })
                )
                .sort(
                    (first, second) =>
                        second.total -
                        first.total
                )
                .slice(0, 6)
        }, [appointments])

    const totalAppointments =
        currentMonthData
            ?.appointments || 0

    return (
        <div className='space-y-5'>
            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <MetricCard
                    icon={
                        ClipboardList
                    }
                    value={
                        totalAppointments
                    }
                    label='Appointments This Month'
                    tone='orange'
                />

                <MetricCard
                    icon={
                        CircleDollarSign
                    }
                    value={formatPeso(
                        currentMonthData
                            ?.revenue
                    )}
                    label='Monthly Revenue'
                    tone='green'
                    compact
                />

                <MetricCard
                    icon={Sparkles}
                    value={`${aiUsageRate}%`}
                    label='AI Preview Usage'
                    tone='blue'
                />

                <MetricCard
                    icon={
                        CheckCircle2
                    }
                    value={`${completedRate}%`}
                    label='Completed Booking Rate'
                    tone='amber'
                />
            </div>

            <div className='grid gap-5 xl:grid-cols-2'>
                <ChartCard title='Monthly Appointments'>
                    <div className='flex h-64 items-end gap-3 pt-6'>
                        {monthlyData.map(
                            (item) => (
                                <div
                                    key={
                                        item.monthKey
                                    }
                                    className='flex min-w-0 flex-1 flex-col items-center justify-end'
                                >
                                    <span className='mb-2 text-xs font-semibold'>
                                        {
                                            item.appointments
                                        }
                                    </span>

                                    <div
                                        className='w-full max-w-16 rounded-t-md bg-[#2F6B57]'
                                        style={{
                                            height: `${Math.max(
                                                8,
                                                ((item.appointments ||
                                                    0) /
                                                    maxAppointments) *
                                                180
                                            )}px`
                                        }}
                                    />

                                    <span className='mt-2 text-xs text-[#2F6B57]'>
                                        {
                                            item.month
                                        }
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                </ChartCard>

                <ChartCard title='Monthly Revenue'>
                    <RevenueLineChart
                        data={
                            monthlyData
                        }
                        max={
                            maxRevenue
                        }
                    />
                </ChartCard>

                <ChartCard title='Service Breakdown'>
                    <ServiceBreakdown
                        items={
                            serviceDistribution
                        }
                    />
                </ChartCard>

                <ChartCard title='AI Style Preview Usage'>
                    <div className='space-y-4'>
                        {styleUsage.length ? (
                            styleUsage.map(
                                (item) => (
                                    <div
                                        key={
                                            item.style
                                        }
                                    >
                                        <div className='mb-1.5 flex items-center justify-between gap-3 text-sm'>
                                            <span className='font-semibold'>
                                                {
                                                    item.style
                                                }
                                            </span>

                                            <span className='font-mono text-xs text-[#2F6B57]'>
                                                {
                                                    item.rate
                                                }
                                                % used ·{' '}
                                                {
                                                    item.total
                                                }{' '}
                                                bookings
                                            </span>
                                        </div>

                                        <div className='h-2 overflow-hidden rounded-full bg-[#F6F7F2]'>
                                            <div
                                                className='h-full rounded-full bg-[#2F6B57]'
                                                style={{
                                                    width: `${item.rate}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            )
                        ) : (
                            <EmptyPanel message='No hairstyle bookings are available yet.' />
                        )}
                    </div>

                    <div className='mt-6 grid grid-cols-2 gap-3'>
                        <div className='rounded-xl bg-[#F6F7F2] p-4 text-center'>
                            <p className='font-serif text-2xl font-bold text-[#13231B]'>
                                {
                                    appointments.filter(
                                        (
                                            appointment
                                        ) =>
                                            appointment.aiPreviewUsed
                                    ).length
                                }
                            </p>

                            <p className='mt-1 text-xs text-[#2F6B57]'>
                                AI previews booked
                            </p>
                        </div>

                        <div className='rounded-xl bg-[#F6F7F2] p-4 text-center'>
                            <p className='font-serif text-2xl font-bold text-[#2F6B57]'>
                                {
                                    appointments.filter(
                                        (
                                            appointment
                                        ) =>
                                            appointment.haircutStyle
                                    ).length
                                }
                            </p>

                            <p className='mt-1 text-xs text-[#2F6B57]'>
                                Style bookings
                            </p>
                        </div>
                    </div>
                </ChartCard>
            </div>
        </div>
    )
}

function ChartCard({
    title,
    children
}) {
    return (
        <section className='rounded-2xl border border-[#DDE4DE] bg-white p-5'>
            <h2 className='font-serif text-xl font-bold'>
                {title}
            </h2>

            <div className='mt-4'>
                {children}
            </div>
        </section>
    )
}

function RevenueLineChart({
    data,
    max
}) {
    const width = 600
    const height = 230
    const padding = 26

    const points =
        data.map(
            (item, index) => {
                const x =
                    data.length <= 1
                        ? width / 2
                        : padding +
                        (index /
                            (data.length -
                                1)) *
                        (width -
                            padding * 2)

                const y =
                    height -
                    padding -
                    ((item.revenue ||
                        0) /
                        max) *
                    (height -
                        padding * 2)

                return {
                    x,
                    y,
                    item
                }
            }
        )

    const path =
        points
            .map(
                (point, index) =>
                    `${index ? 'L' : 'M'} ${point.x} ${point.y}`
            )
            .join(' ')

    return (
        <div>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className='h-60 w-full overflow-visible'
                role='img'
                aria-label='Monthly revenue line chart'
            >
                {[0.25, 0.5, 0.75].map(
                    (ratio) => (
                        <line
                            key={
                                ratio
                            }
                            x1={
                                padding
                            }
                            x2={
                                width -
                                padding
                            }
                            y1={
                                height *
                                ratio
                            }
                            y2={
                                height *
                                ratio
                            }
                            stroke='#F6F7F2'
                            strokeWidth='1'
                        />
                    )
                )}

                <path
                    d={path}
                    fill='none'
                    stroke='#13231B'
                    strokeWidth='4'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />

                {points.map(
                    (point) => (
                        <g
                            key={
                                point.item
                                    .monthKey
                            }
                        >
                            <circle
                                cx={
                                    point.x
                                }
                                cy={
                                    point.y
                                }
                                r='5'
                                fill='#13231B'
                            />

                            <text
                                x={
                                    point.x
                                }
                                y={
                                    height -
                                    4
                                }
                                textAnchor='middle'
                                fontSize='12'
                                fill='#2F6B57'
                            >
                                {
                                    point.item
                                        .month
                                }
                            </text>
                        </g>
                    )
                )}
            </svg>

            <p className='text-center text-xs text-[#2F6B57]'>
                Highest visible month:{' '}
                {formatPeso(max)}
            </p>
        </div>
    )
}

function ServiceBreakdown({
    items
}) {
    const colors = [
        '#2F6B57',
        '#13231B',
        '#E8795B',
        '#2F6B57',
        '#F6F7F2',
        '#2F6B57'
    ]

    const segments =
        items.reduce(
            (
                result,
                item,
                index
            ) => {
                const start =
                    result.total

                const end =
                    start +
                    (item.percentage ||
                        0)

                return {
                    total: end,
                    values: [
                        ...result.values,
                        `${colors[index % colors.length]} ${start}% ${end}%`
                    ]
                }
            },
            {
                total: 0,
                values: []
            }
        ).values

    return (
        <div className='flex flex-col items-center gap-6 sm:flex-row sm:items-start'>
            <div
                className='relative h-52 w-52 shrink-0 rounded-full'
                style={{
                    background:
                        segments.length
                            ? `conic-gradient(${segments.join(', ')})`
                            : '#F6F7F2'
                }}
            >
                <div className='absolute inset-12 rounded-full bg-[#F6F7F2]' />
            </div>

            <div className='grid flex-1 gap-3'>
                {items.length ? (
                    items.map(
                        (
                            item,
                            index
                        ) => (
                            <div
                                key={
                                    item.name
                                }
                                className='flex items-center justify-between gap-3 text-sm'
                            >
                                <span className='flex items-center gap-2'>
                                    <span
                                        className='h-3 w-3 rounded-full'
                                        style={{
                                            background:
                                                colors[
                                                index %
                                                colors.length
                                                ]
                                        }}
                                    />

                                    {
                                        item.name
                                    }
                                </span>

                                <span className='font-semibold'>
                                    {
                                        item.percentage
                                    }
                                    %
                                </span>
                            </div>
                        )
                    )
                ) : (
                    <p className='text-sm text-[#2F6B57]'>
                        No service data available.
                    </p>
                )}
            </div>
        </div>
    )
}

function PetAvatar({
    appointment,
    large = false
}) {
    const photo =
        appointment?.pet?.photoUrl ||
        appointment?.petPhotoUrl ||
        appointment?.petPhoto ||
        ''

    const size =
        large
            ? 'h-14 w-14 rounded-xl text-lg'
            : 'h-10 w-10 rounded-lg text-sm'

    if (photo) {
        return (
            <img
                src={photo}
                alt={appointment?.petName || 'Pet'}
                className={`${size} shrink-0 border border-[#F6F7F2] object-cover`}
            />
        )
    }

    return (
        <span
            className={`grid ${size} shrink-0 place-items-center border border-[#DDE4DE] bg-white font-serif font-bold text-[#13231B]`}
        >
            {(appointment?.petName?.[0] || 'P').toUpperCase()}
        </span>
    )
}

function StatusBadge({ status }) {
    const meta = STATUS_META[status] || STATUS_META.pending
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${meta.badge}`}>
            {meta.label}
        </span>
    )
}

function DetailRow({ label, value }) {
    return (
        <div className='flex items-start justify-between gap-4 py-1'>
            <dt className='text-xs text-[#2F6B57]'>{label}</dt>
            <dd className='max-w-[230px] text-right text-sm font-semibold text-[#13231B]'>{value}</dd>
        </div>
    )
}

function EmptyPanel({ icon, message }) {
    return (
        <div className='flex flex-col items-center justify-center gap-2.5 p-10 text-center'>
            {icon && (
                <div className='grid h-12 w-12 place-items-center rounded-2xl bg-[#EDF3EE] text-[#1F4D3E]'>
                    {createElement(icon, { size: 22 })}
                </div>
            )}
            <p className='text-sm font-semibold text-[#68776F]'>{message}</p>
        </div>
    )
}

function ContactsView({ contacts = [], onRefresh }) {
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedContact, setSelectedContact] = useState(null)
    const [deletingId, setDeletingId] = useState(null)
    const [markingId, setMarkingId] = useState(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState(null)

    const safeContacts = useMemo(() => (Array.isArray(contacts) ? contacts : []), [contacts])

    const filteredContacts = useMemo(() => {
        return safeContacts
            .filter((c) => {
                if (!c) return false
                if (filter === 'unread' && c.read) return false
                if (filter === 'read' && !c.read) return false

                if (!search.trim()) return true
                const q = search.toLowerCase()
                return (
                    c.name?.toLowerCase().includes(q) ||
                    c.email?.toLowerCase().includes(q) ||
                    c.phone?.toLowerCase().includes(q) ||
                    c.message?.toLowerCase().includes(q)
                )
            })
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    }, [safeContacts, filter, search])

    const handleMarkAsRead = async (id) => {
        setMarkingId(id)
        try {
            await adminApi.markContactRead(id)
            toast.success('Marked message as read')
            if (selectedContact?._id === id) {
                setSelectedContact((prev) => (prev ? { ...prev, read: true } : null))
            }
            onRefresh?.()
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setMarkingId(null)
        }
    }

    const handleDelete = async (id) => {
        setDeletingId(id)
        try {
            await adminApi.deleteContact(id)
            toast.success('Deleted contact message')
            if (selectedContact?._id === id) {
                setSelectedContact(null)
            }
            setConfirmDeleteId(null)
            onRefresh?.()
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setDeletingId(null)
        }
    }

    const unreadCount = safeContacts.filter((c) => c && !c.read).length

    return (
        <div className='space-y-6'>
            {/* Header Metrics */}
            <div className='grid gap-4 sm:grid-cols-3'>
                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-5 shadow-sm'>
                    <div className='flex items-center justify-between'>
                        <p className='text-xs font-bold uppercase tracking-wider text-[#2F6B57]'>Total Messages</p>
                        <span className='grid h-9 w-9 place-items-center rounded-xl bg-[#F6F7F2] text-[#13231B]'>
                            <Mail size={18} />
                        </span>
                    </div>
                    <p className='mt-2 font-serif text-3xl font-bold text-[#13231B]'>{safeContacts.length}</p>
                </div>

                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-5 shadow-sm'>
                    <div className='flex items-center justify-between'>
                        <p className='text-xs font-bold uppercase tracking-wider text-[#2F6B57]'>Unread Messages</p>
                        <span className='grid h-9 w-9 place-items-center rounded-xl bg-[#F6F7F2] text-[#2F6B57]'>
                            <MessageSquare size={18} />
                        </span>
                    </div>
                    <p className='mt-2 font-serif text-3xl font-bold text-[#2F6B57]'>{unreadCount}</p>
                </div>

                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-5 shadow-sm'>
                    <div className='flex items-center justify-between'>
                        <p className='text-xs font-bold uppercase tracking-wider text-[#2F6B57]'>Read & Replied</p>
                        <span className='grid h-9 w-9 place-items-center rounded-xl bg-[#F6F7F2] text-[#13231B]'>
                            <CheckCheck size={18} />
                        </span>
                    </div>
                    <p className='mt-2 font-serif text-3xl font-bold text-[#13231B]'>{safeContacts.length - unreadCount}</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='flex items-center gap-1.5 rounded-xl border border-[#DDE4DE] bg-white p-1 shadow-sm'>
                    <button
                        type='button'
                        onClick={() => setFilter('all')}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${filter === 'all' ? 'bg-[#13231B] text-[#F6F7F2]' : 'text-[#405148] hover:bg-[#F6F7F2]'}`}
                    >
                        All ({safeContacts.length})
                    </button>
                    <button
                        type='button'
                        onClick={() => setFilter('unread')}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${filter === 'unread' ? 'bg-[#2F6B57] text-[#F6F7F2]' : 'text-[#405148] hover:bg-[#F6F7F2]'}`}
                    >
                        Unread ({unreadCount})
                    </button>
                    <button
                        type='button'
                        onClick={() => setFilter('read')}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${filter === 'read' ? 'bg-[#13231B] text-[#F6F7F2]' : 'text-[#405148] hover:bg-[#F6F7F2]'}`}
                    >
                        Read ({safeContacts.length - unreadCount})
                    </button>
                </div>

                <div className='relative min-w-[240px]'>
                    <Search size={15} className='absolute left-3.5 top-1/2 -translate-y-1/2 text-[#2F6B57]' />
                    <input
                        type='text'
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder='Search name, email, message...'
                        className='w-full rounded-xl border border-[#DDE4DE] bg-white py-2 pl-9 pr-4 text-xs shadow-sm focus:border-[#2F6B57] focus:outline-none focus:ring-1 focus:ring-[#2F6B57]'
                    />
                </div>
            </div>

            {/* Main Content Grid: Messages List + Detailed View */}
            <div className='grid gap-6 lg:grid-cols-12'>
                <div className='space-y-3 lg:col-span-5'>
                    {filteredContacts.length === 0 ? (
                        <div className='rounded-2xl border border-dashed border-[#B8C7BE] bg-white p-8 text-center'>
                            <Inbox size={32} className='mx-auto mb-2 text-[#2F6B57]' />
                            <p className='font-bold text-[#13231B]'>No messages found</p>
                            <p className='mt-1 text-xs text-[#2F6B57]'>
                                {search ? 'Try adjusting your search query' : 'No contact form submissions received yet.'}
                            </p>
                        </div>
                    ) : (
                        filteredContacts.map((contact) => {
                            const isSelected = selectedContact?._id === contact._id
                            return (
                                <button
                                    key={contact._id}
                                    type='button'
                                    onClick={() => {
                                        setSelectedContact(contact)
                                        if (!contact.read) {
                                            handleMarkAsRead(contact._id)
                                        }
                                    }}
                                    className={`w-full rounded-2xl border p-4 text-left transition ${
                                        isSelected
                                            ? 'border-[#2F6B57] bg-[#EDF3EE] shadow-sm'
                                            : !contact.read
                                            ? 'border-[#DDE4DE] bg-white shadow-xs hover:border-[#2F6B57]'
                                            : 'border-[#DDE4DE] bg-white hover:border-[#B8C7BE]'
                                    }`}
                                >
                                    <div className='flex items-start justify-between gap-2'>
                                        <div>
                                            <p className='font-bold text-[#13231B] text-sm flex items-center gap-2'>
                                                {contact.name}
                                                {!contact.read && (
                                                    <span className='h-2 w-2 rounded-full bg-[#2F6B57]' title='Unread message' />
                                                )}
                                            </p>
                                            <p className='text-xs text-[#68776F] mt-0.5'>{contact.email}</p>
                                        </div>

                                        <span className='font-mono text-[11px] text-[#7A8880] shrink-0'>
                                            {new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>

                                    <p className='mt-2.5 line-clamp-2 text-xs text-[#405148] leading-relaxed'>
                                        {contact.message}
                                    </p>
                                </button>
                            )
                        })
                    )}
                </div>

                {/* Selected Contact Message Detail View */}
                <div className='lg:col-span-7'>
                    {selectedContact ? (
                        <div className='sticky top-20 rounded-2xl border border-[#DDE4DE] bg-white p-6 shadow-sm space-y-6'>
                            <div className='flex items-start justify-between gap-4 border-b border-[#DDE4DE] pb-5'>
                                <div>
                                    <div className='flex items-center gap-2'>
                                        <h3 className='font-serif text-2xl font-bold text-[#13231B]'>{selectedContact.name}</h3>
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                                selectedContact.read ? 'bg-[#F6F7F2] text-[#13231B]' : 'bg-[#F6F7F2] text-[#2F6B57]'
                                            }`}
                                        >
                                            {selectedContact.read ? 'Read' : 'Unread'}
                                        </span>
                                    </div>

                                    <p className='mt-1 text-xs text-[#2F6B57]'>
                                        Received on {new Date(selectedContact.createdAt).toLocaleString()}
                                    </p>
                                </div>

                                <div className='flex items-center gap-2'>
                                    <button
                                        type='button'
                                        onClick={() => setConfirmDeleteId(selectedContact._id)}
                                        disabled={deletingId === selectedContact._id}
                                        className='grid h-9 w-9 place-items-center rounded-xl border border-[#F0CCCC] bg-[#FBEAEA] text-[#9E3E3E] transition hover:bg-[#F6DADA] disabled:opacity-50'
                                        title='Delete message'
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Contact Details Card */}
                            <div className='grid gap-3 sm:grid-cols-2 rounded-xl border border-[#DDE4DE] bg-white p-4 text-xs'>
                                <div>
                                    <p className='text-[#2F6B57] font-bold uppercase tracking-wider text-[10px]'>Email Address</p>
                                    <a
                                        href={`mailto:${selectedContact.email}`}
                                        className='mt-1 block font-semibold text-[#2F6B57] hover:underline truncate'
                                    >
                                        {selectedContact.email}
                                    </a>
                                </div>

                                {selectedContact.phone && (
                                    <div>
                                        <p className='text-[#2F6B57] font-bold uppercase tracking-wider text-[10px] flex items-center gap-1'>
                                            <Phone size={11} /> Phone Number
                                        </p>
                                        <a
                                            href={`tel:${selectedContact.phone}`}
                                            className='mt-1 block font-mono font-semibold text-[#13231B] hover:underline'
                                        >
                                            {selectedContact.phone}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Message Body */}
                            <div>
                                <p className='text-xs font-bold uppercase tracking-wider text-[#2F6B57] mb-2'>Message Content</p>
                                <div className='rounded-xl border border-[#DDE4DE] bg-white p-4 text-sm text-[#13231B] leading-relaxed whitespace-pre-wrap'>
                                    {selectedContact.message}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className='flex items-center justify-between border-t border-[#DDE4DE] pt-4'>
                                <a
                                    href={`mailto:${selectedContact.email}?subject=Re:%20Timmy%20Tails%20Inquiry`}
                                    className='inline-flex items-center gap-2 rounded-xl bg-[#13231B] px-4 py-2.5 text-xs font-bold text-[#F6F7F2] shadow-sm transition hover:bg-[#13231B]'
                                >
                                    <Mail size={14} /> Reply via Email
                                </a>

                                {!selectedContact.read && (
                                    <button
                                        type='button'
                                        onClick={() => handleMarkAsRead(selectedContact._id)}
                                        disabled={markingId === selectedContact._id}
                                        className='inline-flex items-center gap-1.5 rounded-xl border border-[#DDE4DE] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#405148] transition hover:bg-[#F6F7F2]'
                                    >
                                        <CheckCheck size={14} /> Mark as Read
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className='rounded-2xl border border-dashed border-[#DDE4DE] bg-white p-12 text-center shadow-xs'>
                            <div className='mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#EDF3EE] text-[#1F4D3E]'>
                                <Mail size={22} />
                            </div>
                            <h4 className='font-serif text-xl font-bold text-[#13231B]'>Select a Message</h4>
                            <p className='mt-1 text-xs text-[#68776F] max-w-xs mx-auto'>
                                Click on any contact submission on the left side to read full details and reply.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={Boolean(confirmDeleteId)}
                title='Delete Contact Message'
                description='Are you sure you want to delete this contact submission message? This action cannot be undone.'
                confirmText='Yes, Delete Message'
                cancelText='Keep Message'
                variant='danger'
                loading={Boolean(deletingId)}
                onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                onClose={() => setConfirmDeleteId(null)}
            />
        </div>
    )
}

// ─────────────────────────────────────────────────────────
// NOTIFICATIONS VIEW
// ─────────────────────────────────────────────────────────
function NotificationsView({ notifications, customers, loading, onSend }) {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [audience, setAudience] = useState('all-users')
    const [targetUserId, setTargetUserId] = useState('')
    const [sending, setSending] = useState(false)
    const [search, setSearch] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!title.trim() || !message.trim()) {
            return
        }
        if (audience === 'user' && !targetUserId) {
            return
        }
        setSending(true)
        try {
            await onSend({
                title: title.trim(),
                message: message.trim(),
                audience,
                ...(audience === 'user' ? { targetUserId } : {})
            })
            setTitle('')
            setMessage('')
            setTargetUserId('')
        } finally {
            setSending(false)
        }
    }

    const filtered = (notifications || []).filter((n) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
            n.title?.toLowerCase().includes(q) ||
            n.message?.toLowerCase().includes(q)
        )
    })

    const broadcastCount = (notifications || []).filter((n) => n.audience === 'all-users').length
    const targetedCount = (notifications || []).filter((n) => n.audience === 'user').length

    function timeAgo(dateStr) {
        if (!dateStr) return 'Unknown date'
        const date = new Date(dateStr)
        if (Number.isNaN(date.getTime())) return 'Unknown date'
        return date.toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    return (
        <div className='space-y-6'>
            {/* Page header */}
            <div className='flex items-center gap-3 border-b border-[#DDE4DE] pb-4'>
                <span className='grid h-10 w-10 place-items-center rounded-xl bg-[#13231B] text-[#F6F7F2]'>
                    <Bell size={20} />
                </span>
                <div>
                    <h2 className='font-serif text-2xl font-bold text-[#13231B]'>Notifications</h2>
                    <p className='text-xs text-[#2F6B57]'>Compose and send notifications to customers</p>
                </div>
            </div>

            {/* Stats row */}
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                <div className='rounded-xl border border-[#DDE4DE] bg-white p-4'>
                    <p className='text-2xl font-bold text-[#13231B]'>{(notifications || []).length}</p>
                    <p className='text-xs font-medium text-[#2F6B57]'>Total Sent</p>
                </div>
                <div className='rounded-xl border border-[#DDE4DE] bg-white p-4'>
                    <p className='text-2xl font-bold text-[#13231B]'>{broadcastCount}</p>
                    <p className='text-xs font-medium text-[#2F6B57]'>Broadcasts</p>
                </div>
                <div className='rounded-xl border border-[#DDE4DE] bg-white p-4'>
                    <p className='text-2xl font-bold text-[#2F6B57]'>{targetedCount}</p>
                    <p className='text-xs font-medium text-[#2F6B57]'>Targeted</p>
                </div>
            </div>

            <div className='grid gap-6 lg:grid-cols-5'>
                {/* ── Compose Form ── */}
                <div className='lg:col-span-2'>
                    <div className='rounded-2xl border border-[#DDE4DE] bg-white shadow-sm'>
                        <div className='border-b border-[#DDE4DE] px-5 py-4'>
                            <div className='flex items-center gap-2'>
                                <Megaphone size={16} className='text-[#2F6B57]' />
                                <h3 className='font-bold text-[#13231B]'>Send Notification</h3>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className='space-y-4 p-5'>
                            {/* Audience toggle */}
                            <div>
                                <label className='mb-1.5 block text-xs font-bold text-[#405148]'>Send To</label>
                                <div className='flex gap-2'>
                                    <button
                                        type='button'
                                        onClick={() => { setAudience('all-users'); setTargetUserId('') }}
                                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                                            audience === 'all-users'
                                                ? 'border-[#13231B] bg-[#13231B] text-[#F6F7F2]'
                                                : 'border-[#F6F7F2] bg-[#F6F7F2] text-[#405148] hover:border-[#13231B]'
                                        }`}
                                    >
                                        <Users size={13} />
                                        All Users
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => setAudience('user')}
                                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition ${
                                            audience === 'user'
                                                ? 'border-[#2F6B57] bg-[#2F6B57] text-[#F6F7F2]'
                                                : 'border-[#F6F7F2] bg-[#F6F7F2] text-[#405148] hover:border-[#2F6B57]'
                                        }`}
                                    >
                                        <UserRound size={13} />
                                        Specific User
                                    </button>
                                </div>
                            </div>

                            {/* Target user selector */}
                            {audience === 'user' && (
                                <div>
                                    <label className='mb-1.5 block text-xs font-bold text-[#405148]'>Select Customer</label>
                                    <select
                                        value={targetUserId}
                                        onChange={(e) => setTargetUserId(e.target.value)}
                                        required
                                        className='w-full rounded-lg border border-[#DDE4DE] bg-white px-3 py-2.5 text-xs font-medium text-[#13231B] focus:border-[#2F6B57] focus:outline-none'
                                    >
                                        <option value=''>— Choose a customer —</option>
                                        {(customers || []).map((c) => (
                                            <option key={c._id} value={c._id}>
                                                {c.firstName} {c.lastName} ({c.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Title */}
                            <div>
                                <label className='mb-1.5 block text-xs font-bold text-[#405148]'>
                                    Title <span className='text-[#2F6B57]'>*</span>
                                </label>
                                <input
                                    type='text'
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    maxLength={120}
                                    placeholder='e.g. Shop Holiday Hours'
                                    required
                                    className='w-full rounded-lg border border-[#F6F7F2] px-3 py-2.5 text-xs text-[#13231B] placeholder-[#F6F7F2] focus:border-[#2F6B57] focus:outline-none'
                                />
                                <p className='mt-1 text-right text-[10px] text-[#F6F7F2]'>{title.length}/120</p>
                            </div>

                            {/* Message */}
                            <div>
                                <label className='mb-1.5 block text-xs font-bold text-[#405148]'>
                                    Message <span className='text-[#2F6B57]'>*</span>
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    maxLength={1000}
                                    rows={5}
                                    placeholder='Write your notification message here…'
                                    required
                                    className='w-full resize-none rounded-lg border border-[#F6F7F2] px-3 py-2.5 text-xs text-[#13231B] placeholder-[#F6F7F2] focus:border-[#2F6B57] focus:outline-none'
                                />
                                <p className='mt-1 text-right text-[10px] text-[#F6F7F2]'>{message.length}/1000</p>
                            </div>

                            {/* Preview */}
                            {(title || message) && (
                                <div className='rounded-xl border border-dashed border-[#B8C7BE] bg-white p-3'>
                                    <p className='mb-1 text-[10px] font-bold uppercase tracking-wider text-[#F6F7F2]'>Preview</p>
                                    <p className='text-xs font-bold text-[#13231B]'>{title || '—'}</p>
                                    <p className='mt-0.5 text-xs text-[#405148]'>{message || '—'}</p>
                                </div>
                            )}

                            <button
                                type='submit'
                                disabled={sending || loading || !title.trim() || !message.trim() || (audience === 'user' && !targetUserId)}
                                className='flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F6B57] py-3 text-xs font-bold text-[#F6F7F2] shadow-sm transition hover:bg-[#1F4D3E] disabled:cursor-not-allowed disabled:opacity-50'
                            >
                                {sending ? (
                                    <>
                                        <span className='h-4 w-4 animate-spin rounded-full border-2 border-[#2F6B57]/30 border-t-[#F6F7F2]' />
                                        Sending…
                                    </>
                                ) : (
                                    <>
                                        <Send size={13} />
                                        {audience === 'all-users' ? 'Send to All Users' : 'Send to User'}
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* ── Sent History ── */}
                <div className='lg:col-span-3'>
                    <div className='rounded-2xl border border-[#DDE4DE] bg-white shadow-sm'>
                        <div className='flex items-center justify-between border-b border-[#DDE4DE] px-5 py-4'>
                            <div className='flex items-center gap-2'>
                                <Bell size={15} className='text-[#13231B]' />
                                <h3 className='font-bold text-[#13231B]'>Sent History</h3>
                                <span className='rounded-full bg-[#F6F7F2] px-2 py-0.5 text-[10px] font-bold text-[#2F6B57]'>
                                    {(notifications || []).length}
                                </span>
                            </div>
                            {/* Search */}
                            <div className='relative'>
                                <Search size={13} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-[#F6F7F2]' />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder='Search…'
                                    className='rounded-lg border border-[#DDE4DE] bg-white py-1.5 pl-7 pr-3 text-xs text-[#13231B] focus:border-[#2F6B57] focus:outline-none w-36'
                                />
                            </div>
                        </div>

                        <div className='max-h-[520px] overflow-y-auto divide-y divide-[#F6F7F2]'>
                            {filtered.length === 0 ? (
                                <div className='flex flex-col items-center gap-3 py-14 text-[#2F6B57]'>
                                    <Bell size={32} strokeWidth={1.5} />
                                    <p className='text-sm font-medium'>No notifications sent yet</p>
                                    <p className='text-xs text-[#F6F7F2]'>Use the form on the left to send one</p>
                                </div>
                            ) : (
                                filtered.map((n) => (
                                    <div key={n._id} className='flex items-start gap-3 px-5 py-4 hover:bg-[#F6F7F2]'>
                                        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                                            n.audience === 'all-users'
                                                ? 'bg-[#F6F7F2] text-[#13231B]'
                                                : 'bg-[#F6F7F2] text-[#2F6B57]'
                                        }`}>
                                            {n.audience === 'all-users' ? <Megaphone size={14} /> : <UserRound size={14} />}
                                        </span>
                                        <div className='flex-1 min-w-0'>
                                            <div className='flex items-start justify-between gap-2'>
                                                <p className='text-xs font-bold text-[#13231B] leading-snug'>{n.title}</p>
                                                <span className='shrink-0 text-[10px] text-[#F6F7F2] whitespace-nowrap'>{timeAgo(n.createdAt)}</span>
                                            </div>
                                            <p className='mt-0.5 text-xs text-[#405148] leading-relaxed line-clamp-2'>{n.message}</p>
                                            <div className='mt-1.5 flex items-center gap-2'>
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                    n.audience === 'all-users'
                                                        ? 'bg-[#F6F7F2] text-[#13231B]'
                                                        : 'bg-[#F6F7F2] text-[#2F6B57]'
                                                }`}>
                                                    {n.audience === 'all-users' ? <Users size={9} /> : <UserRound size={9} />}
                                                    {n.audience === 'all-users' ? 'Broadcast' : 'Targeted'}
                                                </span>
                                                {n.readBy?.length > 0 && (
                                                    <span className='inline-flex items-center gap-1 rounded-full bg-[#F6F7F2] px-2 py-0.5 text-[10px] font-bold text-[#1F4D3E]'>
                                                        <CheckCheck size={9} />
                                                        {n.readBy.length} read
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
