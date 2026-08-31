import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
    AlertTriangle,
    Ban,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Clock3,
    Scissors,
    WandSparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { aiPreviewApi, appointmentsApi, getErrorMessage, petsApi } from '../utils/api'
import { getPhilippineSeason } from '../utils/season'
import {
    SOURCE_PHOTO_POLICY_VERSION,
    createPreviewCacheKey,
    getCachedPreview,
    hashFile,
    saveCachedPreview
} from '../utils/previewCache'
import AvailabilityCalendar from '../features/booking/components/AvailabilityCalendar'
import TimeSlotGrid from '../features/booking/components/TimeSlotGrid'
import AiPreviewPanel from '../features/booking/components/AiPreviewPanel'
import StylePicker from '../features/booking/components/StylePicker'
import {
    addDays,
    formatDateLong,
    formatTimeRange,
    toDateKey,
    toMonthKey
} from '../features/booking/utils/dateTime'
import { getActivePetId } from '../features/booking/utils/petContext'
import {
    getAutomaticPreviewStyles,
    getNextFailedStyleId
} from '../features/booking/utils/galleryPolicy'

const fallbackServices = [
    { id: 'basic-grooming', name: 'Basic Grooming', description: 'Bath, brush, nail trim, ear cleaning, and blow dry.', durationMinutes: 60, price: 500, supportsAiPreview: false },
    { id: 'full-grooming', name: 'Full Grooming', description: 'Basic grooming plus a complete haircut and styling.', durationMinutes: 120, price: 1200, supportsAiPreview: true },
    { id: 'custom-styling', name: 'Custom Styling', description: 'A style-focused grooming session based on the selected haircut.', durationMinutes: 90, price: 1000, supportsAiPreview: true },
    { id: 'bath-blow-dry', name: 'Bath & Blow Dry', description: 'Deep cleanse, conditioner, and professional blow dry.', durationMinutes: 90, price: 800, supportsAiPreview: false },
    { id: 'nail-trimming', name: 'Nail Trimming', description: 'Safe and careful nail clipping.', durationMinutes: 30, price: 200, supportsAiPreview: false },
    { id: 'ear-cleaning', name: 'Ear Cleaning', description: 'Gentle external ear hygiene service.', durationMinutes: 30, price: 250, supportsAiPreview: false }
]

const emptyPet = {
    name: '',
    type: 'dog',
    breed: '',
    coatType: '',
    notes: '',
    ageMonths: '',
    vaccinated: 'yes'
}


// The frontend displays only these fixed two-hour booking periods.
// The backend must enforce the same periods before saving.
const FIXED_BOOKING_SLOTS = [
    { startTime: '08:00', endTime: '10:00' },
    { startTime: '10:00', endTime: '12:00' },
    { startTime: '12:00', endTime: '14:00' },
    { startTime: '14:00', endTime: '16:00' }
]

const timeToMinutes = (time) => {
    const [hours, minutes] = String(time || '')
        .split(':')
        .map(Number)

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return null
    }

    return hours * 60 + minutes
}

const rangesOverlap = (first, second) => {
    const firstStart = timeToMinutes(first.startTime)
    const firstEnd = timeToMinutes(first.endTime)
    const secondStart = timeToMinutes(second.startTime)
    const secondEnd = timeToMinutes(second.endTime)

    if (
        firstStart === null ||
        firstEnd === null ||
        secondStart === null ||
        secondEnd === null
    ) {
        return false
    }

    return firstStart < secondEnd && firstEnd > secondStart
}

const normalizeFixedSlots = (apiSlots = []) =>
    FIXED_BOOKING_SLOTS.map((fixedSlot) => {
        const exactSlot = apiSlots.find(
            (slot) =>
                slot.startTime === fixedSlot.startTime &&
                slot.endTime === fixedSlot.endTime
        )

        if (exactSlot) {
            return {
                ...fixedSlot,
                ...exactSlot
            }
        }

        const overlappingSlots = apiSlots.filter((slot) =>
            rangesOverlap(fixedSlot, slot)
        )

        const hasBookedConflict = overlappingSlots.some((slot) =>
            ['booked', 'unavailable', 'closed'].includes(slot.status)
        )

        const isPast = overlappingSlots.some(
            (slot) => slot.status === 'past'
        )

        return {
            ...fixedSlot,
            status: isPast
                ? 'past'
                : hasBookedConflict
                    ? 'booked'
                    : 'available'
        }
    })

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(
        new Error('Unable to read the selected image')
    )
    reader.readAsDataURL(file)
})

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const runStyleQueue = async (items, worker) => {
    for (let i = 0; i < items.length; i += 1) {
        if (i > 0) {
            await delay(1500)
        }
        const result = await worker(items[i])

        if (result?.stopQueue) return result
    }

    return { stopQueue: false }
}

export default function Booking() {
    const { user, refreshUser } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (refreshUser) refreshUser()
    }, [refreshUser])
    const season = getPhilippineSeason()
    const today = useMemo(() => new Date(), [])
    const minDate = useMemo(() => toDateKey(today), [today])
    const maxDate = useMemo(() => toDateKey(addDays(today, 90)), [today])

    const [services, setServices] = useState(fallbackServices)
    const [styles, setStyles] = useState([])
    const [stylesLoading, setStylesLoading] = useState(false)
    const [previewVersion, setPreviewVersion] = useState('')
    const [recommendations, setRecommendations] = useState([])
    const [recommendationsLoading, setRecommendationsLoading] = useState(false)
    const [recommendationsReady, setRecommendationsReady] = useState(false)
    const [pets, setPets] = useState([])
    const [petMode, setPetMode] = useState('existing')
    const [selectedPetId, setSelectedPetId] = useState('')
    const [newPet, setNewPet] = useState(emptyPet)
    const [selectedServiceId, setSelectedServiceId] = useState('')
    const [selectedStyleId, setSelectedStyleId] = useState('')
    const [photoDataUrl, setPhotoDataUrl] = useState('')
    const [photoPreview, setPhotoPreview] = useState('')
    const [stylePreviews, setStylePreviews] = useState({})
    const [generatedPreview, setGeneratedPreview] = useState('')
    const [generatedPreviewMeta, setGeneratedPreviewMeta] = useState(null)
    const [previewFromCache, setPreviewFromCache] = useState(false)
    const [photoHash, setPhotoHash] = useState('')
    const [consent, setConsent] = useState(false)
    const [verificationStatus, setVerificationStatus] = useState('idle')
    const [verificationError, setVerificationError] = useState('')
    const [galleryGenerating, setGalleryGenerating] = useState(false)
    const [galleryMessage, setGalleryMessage] = useState('')
    const [monthKey, setMonthKey] = useState(toMonthKey(today))
    const [monthStatuses, setMonthStatuses] = useState({})
    const [calendarLoading, setCalendarLoading] = useState(false)
    const [selectedDate, setSelectedDate] = useState('')
    const [slots, setSlots] = useState([])
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [selectedTime, setSelectedTime] = useState('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [booked, setBooked] = useState(null)
    const [mobileStep, setMobileStep] = useState(1)
    const galleryRunIdRef = useRef(0)
    const galleryBusyRef = useRef(false)
    const startedGalleryKeyRef = useRef('')
    const photoVerificationTokenRef = useRef('')

    const selectedService = services.find((service) => service.id === selectedServiceId)
    const selectedPet = pets.find((pet) => pet._id === selectedPetId)
    const activePet = petMode === 'existing' ? selectedPet : newPet
    const activePetId = getActivePetId(petMode, selectedPet)
    const activePetAge = activePet?.ageMonths !== undefined && activePet?.ageMonths !== '' ? Number(activePet.ageMonths) : null
    const isPetTooYoung = activePetAge !== null && !isNaN(activePetAge) && activePetAge < 3
    const isPetNotVaccinated = activePet?.vaccinated === false || activePet?.vaccinated === 'no' || activePet?.vaccinated === 'false'
    const activePetType = String(activePet?.type || '').toLowerCase()
    const compatibleStyles = styles.filter((style) =>
        Array.isArray(style.petTypes) &&
        style.petTypes.includes(activePetType)
    )
    const selectedStyle = compatibleStyles.find((style) => style.id === selectedStyleId)
    const selectedSlot = slots.find((slot) => slot.startTime === selectedTime)
    const aiEnabled = Boolean(selectedService?.supportsAiPreview)

    useEffect(() => {
        Promise.allSettled([
            appointmentsApi.getServices(),
            petsApi.getMine()
        ]).then(([servicesResult, petsResult]) => {
            if (servicesResult.status === 'fulfilled' && servicesResult.value.data?.services?.length) {
                setServices(servicesResult.value.data.services)
            }
            if (petsResult.status === 'fulfilled') {
                const loadedPets = petsResult.value.data?.pets || []
                setPets(loadedPets)
                if (loadedPets.length) {
                    setSelectedPetId(loadedPets[0]._id)
                } else {
                    setPetMode('new')
                }
            }
        })
    }, [])

    useEffect(() => {
        const reqServiceId = location.state?.serviceId || new URLSearchParams(location.search).get('service')
        const reqServiceName = location.state?.serviceName
        if (reqServiceId || reqServiceName) {
            const matched = services.find((s) =>
                (reqServiceId && s.id === reqServiceId) ||
                (reqServiceName && s.name.toLowerCase() === reqServiceName.toLowerCase())
            )
            if (matched) {
                setSelectedServiceId(matched.id)
            }
        }
    }, [location.state, location.search, services])

    useEffect(() => {
        const petType = String(
            activePet?.type || ''
        ).toLowerCase()

        if (!['dog', 'cat'].includes(petType)) {
            return
        }

        let active = true
        queueMicrotask(() => {
            if (active) setStylesLoading(true)
        })

        aiPreviewApi.getStyles(petType)
            .then(({ data }) => {
                if (!active) return
                setStyles(data.styles || [])
                setPreviewVersion(
                    data.previewVersion || 'default'
                )
            })
            .catch((error) => {
                if (!active) return
                setStyles([])
                toast.error(getErrorMessage(error))
            })
            .finally(() => {
                if (active) setStylesLoading(false)
            })

        return () => {
            active = false
        }
    }, [activePet?.type])

    // Auto-load saved pet photo if available on selected pet profile
    useEffect(() => {
        if (activePet?.photoUrl) {
            setPhotoPreview(activePet.photoUrl)
            setPhotoDataUrl(activePet.photoUrl)
            setPhotoHash(`pet-profile-${activePet._id || activePet.name}-${String(activePet.photoUrl).slice(-20)}`)
            setConsent(true)
        } else {
            setPhotoPreview('')
            setPhotoDataUrl('')
            setPhotoHash('')
            setConsent(false)
        }
    }, [activePet?._id, activePet?.photoUrl, petMode])

    useEffect(() => {
        if (!aiEnabled || !selectedService?.id) {
            setRecommendations([])
            setRecommendationsReady(false)
            return
        }

        let active = true
        queueMicrotask(() => {
            if (!active) return
            setRecommendationsLoading(true)
            setRecommendationsReady(false)
        })

        aiPreviewApi.getRecommendations({
            serviceId: selectedService.id,
            petId: activePetId || undefined,
            petName: activePet?.name || 'Pet',
            petType: activePet?.type || 'dog',
            breed: activePet?.breed || (activePet?.type === 'cat' ? 'Domestic Shorthair' : 'Shih Tzu'),
            coatType: activePet?.coatType || '',
            season: season.key
        }).then(({ data }) => {
            if (!active) return
            const recs = Array.isArray(data.recommendations) && data.recommendations.length
                ? data.recommendations
                : compatibleStyles.slice(0, 2).map((s, idx) => ({ id: s.id, rank: idx + 1, reason: s.description }))
            setRecommendations(recs)
        }).catch(() => {
            if (!active) return
            setRecommendations(compatibleStyles.slice(0, 2).map((s, idx) => ({ id: s.id, rank: idx + 1, reason: s.description })))
        }).finally(() => {
            if (active) {
                setRecommendationsLoading(false)
                setRecommendationsReady(true)
            }
        })

        return () => { active = false }
    }, [aiEnabled, activePet?.name, activePet?.breed, activePet?.type, activePet?.coatType, activePetId, selectedService?.id, season.key, compatibleStyles.length])

    useEffect(() => {
        if (!selectedServiceId) {
            return
        }

        queueMicrotask(() => setCalendarLoading(true))
        appointmentsApi.getMonthAvailability(monthKey, selectedServiceId)
            .then(({ data }) => {
                const map = Object.fromEntries((data.dates || []).map((item) => [item.date, item.status]))
                setMonthStatuses(map)
            })
            .catch((error) => {
                setMonthStatuses({})
                toast.error(getErrorMessage(error))
            })
            .finally(() => setCalendarLoading(false))
    }, [monthKey, selectedServiceId])

    useEffect(() => {
        if (!selectedDate || !selectedServiceId) {
            return
        }

        let active = true

        queueMicrotask(() => {
            if (active) setSlotsLoading(true)
        })

        appointmentsApi
            .getAvailability(selectedDate, selectedServiceId)
            .then(({ data }) => {
                if (!active) return

                const fixedSlots = normalizeFixedSlots(
                    Array.isArray(data?.slots)
                        ? data.slots
                        : []
                )

                setSlots(fixedSlots)
            })
            .catch((error) => {
                if (!active) return

                setSlots([])
                toast.error(getErrorMessage(error))
            })
            .finally(() => {
                if (active) {
                    setSlotsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [selectedDate, selectedServiceId])

    useEffect(() => () => {
        if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    }, [photoPreview])

    const resetStyleGallery = ({ clearPhoto = false } = {}) => {
        galleryRunIdRef.current += 1
        startedGalleryKeyRef.current = ''
        photoVerificationTokenRef.current = ''
        setStylePreviews({})
        setSelectedStyleId('')
        setGeneratedPreview('')
        setGeneratedPreviewMeta(null)
        setPreviewFromCache(false)
        setVerificationStatus('idle')
        setVerificationError('')
        setGalleryGenerating(false)
        setGalleryMessage('')

        if (clearPhoto) {
            setPhotoDataUrl('')
            setPhotoPreview('')
            setPhotoHash('')
        }
    }

    const resetForPetChange = () => {
        setRecommendations([])
        setRecommendationsReady(false)
        if (activePet?.photoUrl) {
            resetStyleGallery({ clearPhoto: false })
            setPhotoPreview(activePet.photoUrl)
            setPhotoDataUrl(activePet.photoUrl)
            setPhotoHash(`pet-profile-${activePet._id || activePet.name}-${String(activePet.photoUrl).slice(-20)}`)
            setConsent(true)
        } else {
            setConsent(false)
            resetStyleGallery({ clearPhoto: true })
        }
    }

    const selectService = (serviceId) => {
        setSelectedServiceId(serviceId)
        setSelectedDate('')
        setSelectedTime('')
        setSlots([])
        setRecommendations([])
        setRecommendationsReady(false)

        if (activePet?.photoUrl) {
            resetStyleGallery({ clearPhoto: false })
            setPhotoPreview((prev) => prev || activePet.photoUrl)
            setPhotoDataUrl((prev) => prev || activePet.photoUrl)
            setPhotoHash((prev) => prev || `pet-profile-${activePet._id || activePet.name}-${String(activePet.photoUrl).slice(-20)}`)
            setConsent(true)
        } else {
            setConsent(false)
            resetStyleGallery({ clearPhoto: true })
        }
    }

    const selectStyle = (styleId) => {
        const stylePreview = stylePreviews[styleId]

        if (
            stylePreview?.status !== 'ready' ||
            !stylePreview.generatedImage
        ) {
            return
        }

        setSelectedStyleId(styleId)
        setGeneratedPreview(
            stylePreview.generatedImage
        )
        setGeneratedPreviewMeta({
            previewId:
                stylePreview.previewId || null,
            model: stylePreview.model || null,
            previewVersion:
                stylePreview.previewVersion ||
                previewVersion,
            sourcePhotoHash:
                stylePreview.sourcePhotoHash ||
                photoHash,
            verification:
                stylePreview.verification || null,
            fidelityCheck:
                stylePreview.fidelityCheck || null,
            season: stylePreview.season || {
                key: season.key,
                label: season.label
            },
            styleId,
            styleName:
                stylePreview.styleName ||
                compatibleStyles.find(
                    (style) => style.id === styleId
                )?.name
        })
        setPreviewFromCache(
            Boolean(stylePreview.fromCache)
        )
    }

    const handlePhoto = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Upload a JPG, PNG, or WEBP image')
            event.target.value = ''
            return
        }

        if (file.size > 7 * 1024 * 1024) {
            toast.error('The photo must be 7 MB or smaller')
            event.target.value = ''
            return
        }

        if (photoPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(photoPreview)
        }

        resetStyleGallery()
        setPhotoPreview(URL.createObjectURL(file))
        setPhotoDataUrl('')
        setPhotoHash('')

        try {
            const [dataUrl, hash] = await Promise.all([
                fileToDataUrl(file),
                hashFile(file)
            ])
            setPhotoDataUrl(dataUrl)
            setPhotoHash(hash)
        } catch {
            toast.error('Unable to prepare this pet photo')
        }
    }

    const handleConsentChange = (value) => {
        setConsent(value)

        if (!value) {
            resetStyleGallery()
        }
    }

    const buildStyleCacheKey = (styleId) =>
        createPreviewCacheKey({
            photoHash,
            petType: activePet.type,
            breed: activePet.breed,
            styleId,
            seasonKey: season.key,
            previewVersion
        })

    const setStylePreviewForRun = (
        runId,
        styleId,
        value
    ) => {
        if (galleryRunIdRef.current !== runId) return

        setStylePreviews((current) => ({
            ...current,
            [styleId]: {
                ...(current[styleId] || {}),
                ...value
            }
        }))
    }

    const getCommonPreviewPayload = () => ({
        petPhotoDataUrl: photoDataUrl,
        serviceId: selectedService.id,
        petId: activePetId,
        petName: activePet.name,
        petType: activePet.type || 'dog',
        breed: activePet.breed,
        coatType: activePet.coatType || '',
        consent: true
    })

    const createStylePreview = async ({
        style,
        verificationToken,
        runId
    }) => {
        setStylePreviewForRun(
            runId,
            style.id,
            { status: 'generating', error: '' }
        )

        try {
            const { data } = await aiPreviewApi.generate({
                ...getCommonPreviewPayload(),
                styleId: style.id,
                photoVerificationToken:
                    verificationToken
            })
            const preview = data.preview
            const entry = {
                status: 'ready',
                generatedImage:
                    preview.generatedImage,
                previewId:
                    preview.previewId || null,
                model: preview.model || null,
                previewVersion:
                    preview.previewVersion ||
                    previewVersion,
                sourcePhotoHash:
                    preview.sourcePhotoHash ||
                    photoHash,
                verification:
                    preview.verification || null,
                fidelityCheck:
                    preview.fidelityCheck || null,
                season: preview.season || {
                    key: season.key,
                    label: season.label
                },
                styleId: preview.styleId,
                styleName: preview.styleName,
                fromCache: false,
                error: ''
            }

            setStylePreviewForRun(
                runId,
                style.id,
                entry
            )

            await saveCachedPreview({
                key: buildStyleCacheKey(style.id),
                ...entry,
                petType: activePet.type || 'dog',
                breed: activePet.breed
            })

            return {
                success: true,
                stopQueue: false
            }
        } catch (error) {
            const errorCode =
                error?.response?.data?.code || ''
            const errorMessage =
                getErrorMessage(error)

            if (
                errorCode ===
                'PHOTO_VERIFICATION_EXPIRED'
            ) {
                photoVerificationTokenRef.current = ''
            }

            setStylePreviewForRun(
                runId,
                style.id,
                {
                    status: 'error',
                    error: errorMessage,
                    errorCode
                }
            )

            return {
                success: false,
                stopQueue: false,
                error: errorMessage,
                errorCode
            }
        }
    }

    const startPersonalizedGallery = async (
        onlyStyleIds = null
    ) => {
        if (galleryBusyRef.current) {
            if (onlyStyleIds) {
                toast('Please wait for the current preview to finish')
            }
            return
        }

        const targetStyles = onlyStyleIds
            ? compatibleStyles.filter((style) =>
                onlyStyleIds.includes(style.id)
            )
            : compatibleStyles

        if (!targetStyles.length) return

        galleryBusyRef.current = true
        const runId = galleryRunIdRef.current + 1
        galleryRunIdRef.current = runId
        setGalleryGenerating(true)
        setGalleryMessage(
            'Loading saved style examples…'
        )

        if (!onlyStyleIds) {
            setSelectedStyleId('')
            setGeneratedPreview('')
            setGeneratedPreviewMeta(null)
            setPreviewFromCache(false)
            setStylePreviews(
                Object.fromEntries(
                    targetStyles.map((style) => [
                        style.id,
                        { status: 'idle' }
                    ])
                )
            )
        } else {
            setStylePreviews((current) => ({
                ...current,
                ...Object.fromEntries(
                    targetStyles.map((style) => [
                        style.id,
                        { status: 'queued' }
                    ])
                )
            }))
        }

        try {
            let verificationToken =
                photoVerificationTokenRef.current

            if (!verificationToken) {
                setVerificationStatus('checking')
                setVerificationError('')
                setGalleryMessage(
                    'Checking your pet photo once…'
                )

                const { data } =
                    await aiPreviewApi.verifyPhoto(
                        getCommonPreviewPayload()
                    )

                if (galleryRunIdRef.current !== runId) return

                const photoVerification =
                    data?.photoVerification
                const sourceCheck =
                    photoVerification?.verification
                const expectedPetType = String(
                    activePet.type || ''
                ).toLowerCase()

                if (
                    sourceCheck?.policyVersion !==
                        SOURCE_PHOTO_POLICY_VERSION
                ) {
                    throw new Error(
                        'The running backend still uses an older pet-photo verifier. Restart the updated backend, then upload the photo again.'
                    )
                }

                if (
                    sourceCheck?.valid !== true ||
                    sourceCheck?.detectedAnimal !==
                        expectedPetType
                ) {
                    const detected = sourceCheck?.detectedAnimal
                    const reason = sourceCheck?.reason || ''
                    let message = `This photo does not pass the ${expectedPetType} verification.`
                    if (detected === 'cat' && expectedPetType === 'dog') {
                        message = 'This photo appears to show a cat. Please upload a clear photo of the selected dog.'
                    } else if (detected === 'dog' && expectedPetType === 'cat') {
                        message = 'This photo appears to show a dog. Please upload a clear photo of the selected cat.'
                    } else if (reason) {
                        message = `${message} ${reason}`
                    }
                    throw new Error(message)
                }

                verificationToken =
                    photoVerification.token
                photoVerificationTokenRef.current =
                    verificationToken
                setVerificationStatus('verified')
                setVerificationError('')
            }

            const cachedResults = await Promise.all(
                targetStyles.map(async (style) => ({
                    style,
                    cached: await getCachedPreview(
                        buildStyleCacheKey(style.id)
                    )
                }))
            )

            if (galleryRunIdRef.current !== runId) return

            const stylesToGenerate = []

            cachedResults.forEach(({ style, cached }) => {
                if (cached?.generatedImage && !onlyStyleIds) {
                    setStylePreviewForRun(
                        runId,
                        style.id,
                        {
                            ...cached,
                            status: 'ready',
                            fromCache: true,
                            error: ''
                        }
                    )
                } else {
                    stylesToGenerate.push(style)
                }
            })

            const stylesForRun =
                getAutomaticPreviewStyles({
                    stylesToGenerate,
                    recommendations,
                    manualRequest:
                        Boolean(onlyStyleIds)
                })

            if (!stylesForRun.length) {
                setGalleryMessage('')
                return
            }

            setGalleryMessage(
                onlyStyleIds
                    ? 'Creating your selected style…'
                    : 'Creating the top seasonal suggestion…'
            )
            const queueResult = await runStyleQueue(
                stylesForRun,
                (style) => createStylePreview({
                    style,
                    verificationToken,
                    runId
                })
            )

            if (queueResult.stopQueue) {
                const pausedMessage =
                    queueResult.error ||
                    'AI capacity is temporarily exhausted. Try unfinished styles again in a few minutes.'

                setStylePreviews((current) =>
                    Object.fromEntries(
                        Object.entries(current).map(
                            ([styleId, entry]) => [
                                styleId,
                                entry.status === 'queued'
                                    ? {
                                        ...entry,
                                        status: 'error',
                                        error: pausedMessage,
                                        errorCode:
                                            'AI_QUOTA_EXHAUSTED'
                                    }
                                    : entry
                            ]
                        )
                    )
                )
                toast.error(pausedMessage)
            }
        } catch (error) {
            if (galleryRunIdRef.current !== runId) return

            const errorMessage = getErrorMessage(error)
            setVerificationStatus('error')
            setVerificationError(errorMessage)
            setStylePreviews((current) =>
                Object.fromEntries(
                    Object.entries(current).map(
                        ([styleId, entry]) => [
                            styleId,
                            entry.status === 'ready'
                                ? entry
                                : {
                                    ...entry,
                                    status: 'error',
                                    error: errorMessage
                                }
                        ]
                    )
                )
            )
            toast.error(errorMessage)
        } finally {
            galleryBusyRef.current = false

            if (galleryRunIdRef.current === runId) {
                setGalleryGenerating(false)
                setGalleryMessage('')
            }
        }
    }

    const retryStylePreview = (styleId) => {
        if (galleryBusyRef.current) return
        startPersonalizedGallery([styleId])
    }

    const retryFailedStylePreviews = () => {
        if (galleryBusyRef.current) return

        const nextStyleId = getNextFailedStyleId({
            stylePreviews,
            recommendations
        })

        if (nextStyleId) {
            startPersonalizedGallery([nextStyleId])
        }
    }

    const galleryInputKey = (
        aiEnabled &&
        consent &&
        photoDataUrl &&
        photoHash &&
        previewVersion &&
        compatibleStyles.length &&
        !stylesLoading &&
        recommendationsReady
    )
        ? [
            selectedService.id,
            activePetId || activePet.name,
            activePet.type,
            activePet.breed,
            activePet.coatType || '',
            photoHash,
            previewVersion,
            compatibleStyles.map((style) => style.id).join(',')
        ].join('|')
        : ''
    const hasStyleFailures = Object.values(
        stylePreviews
    ).some((preview) => preview.status === 'error')

    /* The gallery runner is deliberately keyed by the complete, stable input
       signature. Adding its render-local function identity would restart the
       paid generation workflow after every preview-state update. */
    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        if (
            !galleryInputKey ||
            startedGalleryKeyRef.current === galleryInputKey
        ) {
            return
        }

        startedGalleryKeyRef.current = galleryInputKey
        queueMicrotask(() => {
            if (
                startedGalleryKeyRef.current === galleryInputKey
            ) {
                startPersonalizedGallery()
            }
        })
    }, [galleryInputKey])
    /* eslint-enable react-hooks/exhaustive-deps */

    // Auto-select top recommendation or first ready style preview into sidebar
    useEffect(() => {
        if (selectedStyleId) return

        const topRecommendationId = recommendations[0]?.id
        if (topRecommendationId && stylePreviews[topRecommendationId]?.status === 'ready' && stylePreviews[topRecommendationId]?.generatedImage) {
            selectStyle(topRecommendationId)
            return
        }

        const firstReadyEntry = Object.entries(stylePreviews).find(
            ([, entry]) => entry?.status === 'ready' && entry?.generatedImage
        )
        if (firstReadyEntry) {
            selectStyle(firstReadyEntry[0])
        }
    }, [stylePreviews, recommendations, selectedStyleId])

    const validate = () => {
        if (!selectedService) return { message: 'Please select a grooming service', sectionId: 'booking-section-1' }
        if (!activePet?.name || !activePet?.breed || !activePet?.type) return { message: 'Please complete the pet information', sectionId: 'booking-section-1' }
        if (isPetTooYoung) return { message: 'Pets must be at least 3 months old to be booked', sectionId: 'booking-section-1' }
        if (isPetNotVaccinated) return { message: 'Pets must be fully vaccinated to proceed', sectionId: 'booking-section-1' }
        if (aiEnabled && !selectedStyle) return { message: 'Please select a haircut style preview', sectionId: 'booking-section-2' }
        if (!selectedDate || !selectedSlot) return { message: 'Please select an available date and time slot', sectionId: 'booking-section-3' }
        if (!user?.phone) return { message: 'Complete your profile with a phone number', sectionId: null }
        return null
    }

    const scrollToSection = (sectionId, targetStep = null) => {
        if (targetStep) {
            setMobileStep(targetStep)
        } else if (sectionId === 'booking-section-1') {
            setMobileStep(1)
        } else if (sectionId === 'booking-section-2') {
            setMobileStep(2)
        } else if (sectionId === 'booking-section-3') {
            setMobileStep(3)
        }
        window.scrollTo({ top: 0, behavior: 'smooth' })
        if (!sectionId) return
        setTimeout(() => {
            const el = document.getElementById(sectionId)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }, 100)
    }

    const validateStep1 = () => {
        if (user?.accountStatus === 'booking_blocked' || user?.accountStatus === 'banned') {
            toast.error(user.accountStatus === 'banned'
                ? 'Your customer account has been permanently suspended.'
                : `Your booking access is currently blocked by salon administration. ${user.statusReason || ''}`
            )
            return false
        }
        if (!selectedService) { toast.error('Please select a grooming service'); return false }
        if (!activePet?.name || !activePet?.breed || !activePet?.type) { toast.error('Please complete the pet information'); return false }
        if (isPetTooYoung) { toast.error('Pets must be at least 3 months old to be booked'); return false }
        if (isPetNotVaccinated) { toast.error('Pets must be fully vaccinated to proceed'); return false }
        return true
    }

    const validateStep2 = () => {
        if (user?.accountStatus === 'booking_blocked' || user?.accountStatus === 'banned') {
            toast.error('Your booking privileges are currently blocked by salon administration.')
            return false
        }
        if (aiEnabled && !selectedStyle) { toast.error('Please select a haircut style preview'); return false }
        return true
    }

    const validateStep3 = () => {
        if (user?.accountStatus === 'booking_blocked' || user?.accountStatus === 'banned') {
            toast.error('Your booking privileges are currently blocked by salon administration.')
            return false
        }
        if (!selectedDate || !selectedSlot) { toast.error('Please select an available date and time slot'); return false }
        return true
    }

    const submitBooking = async () => {
        if (user?.accountStatus === 'booking_blocked' || user?.accountStatus === 'banned') {
            toast.error(user.accountStatus === 'banned'
                ? 'Your customer account has been permanently suspended.'
                : `Your booking privileges are currently blocked by salon administration. ${user.statusReason || ''}`
            )
            return
        }
        const error = validate()
        if (error) {
            toast.error(error.message)
            scrollToSection(error.sectionId)
            return
        }

        setSubmitting(true)
        try {
            let petId = activePetId || ''
            let petRecord = petMode === 'existing'
                ? selectedPet
                : null
            if (petMode === 'new') {
                const { data } = await petsApi.create(newPet)
                petRecord = data.pet
                petId = data.pet._id
                setPets((current) => [data.pet, ...current])
                setSelectedPetId(data.pet._id)
            }

            const { data } = await appointmentsApi.create({
                petId,
                petName: petRecord?.name || activePet.name,
                petType: petRecord?.type || activePet.type,
                breed: petRecord?.breed || activePet.breed,
                petAgeMonths: activePet?.ageMonths !== undefined && activePet?.ageMonths !== '' ? Number(activePet.ageMonths) : null,
                vaccinated: activePet?.vaccinated !== false && activePet?.vaccinated !== 'no' && activePet?.vaccinated !== 'false',
                serviceId: selectedService.id,
                haircutStyle: selectedStyle?.id || null,
                aiPreviewUsed: Boolean(generatedPreview),
                aiPreviewId: generatedPreviewMeta?.previewId || null,
                aiPreviewImage: generatedPreviewMeta?.previewId
                    ? null
                    : generatedPreview || null,
                aiPreviewModel: generatedPreviewMeta?.model || null,
                aiPreviewSourceHash: generatedPreviewMeta?.sourcePhotoHash || photoHash || null,
                date: selectedDate,
                time: selectedTime,
                ownerName: `${user.firstName} ${user.lastName}`.trim(),
                ownerEmail: user.email || '',
                ownerPhone: user.phone,
                ownerAddress: user.homeAddress || '',
                notes
            })

            setBooked(data.appointment)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    if (booked) {
        return (
            <div className='min-h-screen bg-[#F6F7F2] px-4 py-12 text-[#13231B] sm:px-6 lg:px-8'>
                <div className='mx-auto max-w-xl rounded-[2rem] border border-[#DDE4DE] bg-white p-7 text-center shadow-xs sm:p-10 space-y-6'>
                    <span className='mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#EDF3EE] text-[#1F4D3E]'>
                        <Check size={30} strokeWidth={2.5} />
                    </span>
                    <div>
                        <h1 className='font-serif text-3xl font-bold tracking-tight text-[#13231B] sm:text-4xl'>Appointment Confirmed</h1>
                        <p className='mt-1.5 text-sm text-[#68776F]'>Your grooming appointment has been received and scheduled.</p>
                    </div>

                    <div className='rounded-2xl border border-[#DDE4DE] bg-[#FAFBF8] p-5 text-left space-y-1'>
                        <SummaryRow label='Pet' value={`${booked.petName} (${booked.breed})`} />
                        <SummaryRow label='Service' value={booked.service} />
                        {booked.haircutStyle && <SummaryRow label='Style' value={booked.haircutStyle} />}
                        <SummaryRow label='Date' value={formatDateLong(booked.date)} />
                        <SummaryRow label='Time' value={formatTimeRange(booked.time, booked.endTime)} />
                        <SummaryRow label='Total' value={`₱${Number(booked.price).toLocaleString('en-PH')}`} strong />
                    </div>

                    {/* Arrival Policy Notice Banner */}
                    <div className='rounded-2xl border border-[#F0DEB6] bg-[#FFF9EC] p-4 text-left flex items-start gap-3.5 text-[#6E4A0D] shadow-xs'>
                        <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF0D1] text-[#8A5D13]'>
                            <Clock size={17} />
                        </span>
                        <div className='text-xs leading-relaxed'>
                            <p className='font-bold text-[#8A5D13] text-sm'>Arrival Guideline</p>
                            <p className='mt-0.5 text-[#6E4A0D]'>Please arrive <strong>5–10 minutes before</strong> your scheduled appointment time.</p>
                            <p className='mt-1 text-[11px] font-semibold text-[#8A5D13]/90'>Late arrival beyond 10 minutes may result in cancellation to respect other reserved slots.</p>
                        </div>
                    </div>

                    <div className='flex flex-col justify-center gap-3 sm:flex-row pt-2'>
                        <button onClick={() => navigate('/appointments')} className='rounded-xl bg-[#1F4D3E] px-6 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#13231B]'>
                            View Appointments
                        </button>
                        <button onClick={() => navigate('/dashboard')} className='rounded-xl border border-[#DDE4DE] bg-white px-6 py-3 text-sm font-bold text-[#405148] transition hover:bg-[#F6F7F2]'>
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className='min-h-screen bg-[#F6F7F2] px-4 py-6 pb-28 text-[#13231B] sm:px-6 sm:py-8 lg:px-8 lg:pb-12'>
            <div className='mx-auto max-w-7xl'>
                <div className='mb-7 rounded-[1.75rem] border border-[#DDE4DE] bg-white p-6 shadow-xs sm:p-8'>
                    <h1 className='font-serif text-3xl font-bold tracking-tight text-[#13231B] sm:text-4xl lg:text-5xl'>
                        Book a Grooming Appointment
                    </h1>
                    <p className='mt-2 max-w-2xl text-sm leading-6 text-[#68776F] sm:text-base'>
                        Select your service, pet profile, haircut style preview, and schedule date.
                    </p>
                </div>

                {/* Account Enforcement Status Banner */}
                {user?.accountStatus === 'warned' && (
                    <div className='mb-6 rounded-2xl border border-[#F0DEB6] bg-[#FFF4DC] p-4 text-xs text-[#6E4A0D] flex items-start gap-3 shadow-xs'>
                        <AlertTriangle className='h-5 w-5 shrink-0 text-[#13231B] mt-0.5' />
                        <div className='space-y-1'>
                            <p className='font-bold text-[#13231B] text-sm'>Account Policy Notice</p>
                            <p className='text-[#13231B] leading-relaxed'>
                                {user.warningMessage || user.statusReason || 'You have received a formal warning regarding multiple booking cancellations or no-show policy violations. Please attend scheduled appointments on time.'}
                            </p>
                        </div>
                    </div>
                )}

                {(user?.accountStatus === 'booking_blocked' || user?.accountStatus === 'banned') && (
                    <div className='mb-6 rounded-2xl border border-[#F0CCCC] bg-[#FBEAEA] p-5 text-xs text-[#7F3333] flex items-start gap-3 shadow-md'>
                        <Ban className='h-6 w-6 shrink-0 text-[#9E3E3E] mt-0.5' />
                        <div className='space-y-1.5'>
                            <p className='font-bold text-[#7F3333] text-base'>Booking Privileges Suspended</p>
                            <p className='text-[#7F3333] leading-relaxed text-sm'>
                                {user.statusReason || user.warningMessage || 'Your customer account has been blocked from scheduling new grooming appointments by salon administration due to repeated cancellations or policy violations.'}
                            </p>
                            <p className='text-xs font-semibold text-[#7F3333] pt-1'>
                                If you believe this is an error, please contact TimmyTails salon support at +63 975 669 2647.
                            </p>
                        </div>
                    </div>
                )}

                {/* Stepper Progress Header */}
                <div className='mb-6 rounded-[1.5rem] border border-[#DDE4DE] bg-white p-3.5 shadow-sm'>
                    {/* Mobile Progress Bar */}
                    <div className='mb-2 flex items-center justify-between text-xs font-bold text-[#2F6B57] lg:hidden'>
                        <span>Step {mobileStep} of {aiEnabled ? '4' : '3'}</span>
                        <span className='truncate max-w-[200px] text-right'>
                            {mobileStep === 1 ? '1. Pet & Service' : mobileStep === 2 ? '2. AI Cut Preview' : mobileStep === 3 ? '3. Date & Schedule' : '4. Review & Confirm'}
                        </span>
                    </div>
                    <div className='h-1.5 w-full rounded-full bg-[#F6F7F2] lg:hidden mb-3 overflow-hidden border border-[#F6F7F2]'>
                        <div
                            className='h-full bg-[#2F6B57] transition-all duration-300 rounded-full'
                            style={{ width: `${(mobileStep / (aiEnabled ? 4 : 3)) * 100}%` }}
                        />
                    </div>

                    <div className='grid grid-cols-4 gap-1 sm:gap-2'>
                        <button type='button' onClick={() => scrollToSection('booking-section-1', 1)} className={`flex items-center justify-center sm:justify-start gap-1 sm:gap-2 rounded-lg p-1.5 sm:p-2.5 text-[11px] sm:text-xs font-bold transition min-w-0 ${mobileStep === 1 ? 'bg-[#2F6B57] text-[#F6F7F2] shadow-xs' : selectedService && activePet?.name ? 'bg-[#E4F1EA] text-[#216245]'  : 'bg-[#F6F7F2] text-[#405148]'}`}>
                            <span className={`grid h-4 w-4 sm:h-5 sm:w-5 shrink-0 place-items-center rounded-full text-[9px] sm:text-[10px] font-bold ${mobileStep === 1 ? 'bg-[#F6F7F2] text-[#2F6B57]' : selectedService && activePet?.name ? 'bg-[#216245] text-white' : 'bg-[#F6F7F2] text-[#405148]'}`}>
                                {selectedService && activePet?.name ? <Check size={10} /> : '1'}
                            </span>
                            <span className='sm:hidden font-bold'>Pet</span>
                            <span className='hidden sm:inline truncate'>1. Pet &amp; Service</span>
                        </button>

                        <button type='button' onClick={() => scrollToSection('booking-section-2', 2)} className={`flex items-center justify-center sm:justify-start gap-1 sm:gap-2 rounded-lg p-1.5 sm:p-2.5 text-[11px] sm:text-xs font-bold transition min-w-0 ${mobileStep === 2 ? 'bg-[#2F6B57] text-[#F6F7F2] shadow-xs' : selectedStyle ? 'bg-[#E4F1EA] text-[#216245]'  : 'bg-[#F6F7F2] text-[#405148]'}`}>
                            <span className={`grid h-4 w-4 sm:h-5 sm:w-5 shrink-0 place-items-center rounded-full text-[9px] sm:text-[10px] font-bold ${mobileStep === 2 ? 'bg-[#F6F7F2] text-[#2F6B57]' : selectedStyle ? 'bg-[#216245] text-white' : 'bg-[#F6F7F2] text-[#405148]'}`}>
                                {selectedStyle ? <Check size={10} /> : '2'}
                            </span>
                            <span className='sm:hidden font-bold'>Style</span>
                            <span className='hidden sm:inline truncate'>2. AI Cut Preview</span>
                        </button>

                        <button type='button' onClick={() => scrollToSection('booking-section-3', 3)} className={`flex items-center justify-center sm:justify-start gap-1 sm:gap-2 rounded-lg p-1.5 sm:p-2.5 text-[11px] sm:text-xs font-bold transition min-w-0 ${mobileStep === 3 ? 'bg-[#2F6B57] text-[#F6F7F2] shadow-xs' : selectedDate && selectedSlot ? 'bg-[#E4F1EA] text-[#216245]'  : 'bg-[#F6F7F2] text-[#405148]'}`}>
                            <span className={`grid h-4 w-4 sm:h-5 sm:w-5 shrink-0 place-items-center rounded-full text-[9px] sm:text-[10px] font-bold ${mobileStep === 3 ? 'bg-[#F6F7F2] text-[#2F6B57]' : selectedDate && selectedSlot ? 'bg-[#216245] text-white' : 'bg-[#F6F7F2] text-[#405148]'}`}>
                                {selectedDate && selectedSlot ? <Check size={10} /> : '3'}
                            </span>
                            <span className='sm:hidden font-bold'>Date</span>
                            <span className='hidden sm:inline truncate'>3. Date &amp; Schedule</span>
                        </button>

                        <button type='button' onClick={() => scrollToSection('booking-section-4', 4)} className={`flex items-center justify-center sm:justify-start gap-1 sm:gap-2 rounded-lg p-1.5 sm:p-2.5 text-[11px] sm:text-xs font-bold transition min-w-0 ${mobileStep === 4 ? 'bg-[#2F6B57] text-[#F6F7F2] shadow-xs' : validate() === null ? 'bg-[#E4F1EA] text-[#216245]'  : 'bg-[#F6F7F2] text-[#405148]'}`}>
                            <span className={`grid h-4 w-4 sm:h-5 sm:w-5 shrink-0 place-items-center rounded-full text-[9px] sm:text-[10px] font-bold ${mobileStep === 4 ? 'bg-[#F6F7F2] text-[#2F6B57]' : validate() === null ? 'bg-[#216245] text-white' : 'bg-[#F6F7F2] text-[#405148]'}`}>
                                4
                            </span>
                            <span className='sm:hidden font-bold'>Review</span>
                            <span className='hidden sm:inline truncate'>4. Confirmation</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className='grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]'>
                    
                    {/* Left Forms Container */}
                    <div className='space-y-6'>
                        
                        {/* Section 1: Service and Pet (Visible on Desktop OR when mobileStep === 1) */}
                        <div className={mobileStep === 1 ? 'block' : 'hidden lg:block'}>
                            <Section id='booking-section-1' number='1' title='Service and Pet' description='Select a grooming service and the pet receiving treatment.' icon={<Scissors size={18} className='text-[#2F6B57]' />}>
                                <div className='grid gap-3 md:grid-cols-2'>
                                    {services.map((service) => {
                                        const selected = selectedServiceId === service.id
                                        return (
                                            <button key={service.id} type='button' onClick={() => selectService(service.id)} aria-pressed={selected} className={`rounded-xl border p-4 text-left transition ${selected ? 'border-[#2F6B57] bg-[#EDF3EE] ring-2 ring-[#2F6B57]/20 shadow-xs' : 'border-[#DDE4DE] bg-white hover:border-[#B8C7BE] hover:shadow-xs'}`}>
                                                <div className='flex items-start justify-between gap-3'>
                                                    <div><h3 className='font-serif text-lg font-bold text-[#13231B]'>{service.name}</h3><p className='mt-1 text-xs leading-relaxed text-[#405148]'>{service.description}</p></div>
                                                    {selected && <span className='grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#1F4D3E] text-white'><Check size={14} /></span>}
                                                </div>
                                                <div className='mt-3 flex items-center justify-between text-xs'><span className='font-bold text-[#1F4D3E] text-sm'>₱{service.price.toLocaleString('en-PH')}</span><span className='flex items-center gap-1 text-[#405148]'><Clock3 size={13} />{service.durationMinutes} min</span></div>
                                                {service.supportsAiPreview && <p className='mt-2 text-[11px] font-bold text-[#2F6B57]'>AI Style Preview Available</p>}
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className='my-6 h-px bg-[#E5EAE6]' />
                                <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                                    <div><h3 className='font-serif text-lg font-bold text-[#13231B]'>Pet Profile</h3><p className='mt-0.5 text-xs text-[#405148]'>Choose a saved pet or enter details for a new companion.</p></div>
                                    <div className='inline-flex rounded-xl bg-[#EDF3EE] p-1 border border-[#DDE4DE]'>
                                        <button type='button' onClick={() => { setPetMode('existing'); resetForPetChange() }} disabled={!pets.length} className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${petMode === 'existing' ? 'bg-[#1F4D3E] text-white shadow-xs' : 'text-[#405148] hover:text-[#13231B]'} disabled:opacity-40`}>Saved Pets</button>
                                        <button type='button' onClick={() => { setPetMode('new'); resetForPetChange() }} className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${petMode === 'new' ? 'bg-[#1F4D3E] text-white shadow-xs' : 'text-[#405148] hover:text-[#13231B]'}`}>New Pet</button>
                                    </div>
                                </div>

                                {petMode === 'existing' ? (
                                    <div className='grid gap-3 sm:grid-cols-2'>
                                        {pets.map((pet) => {
                                            const petAge = pet.ageMonths !== undefined && pet.ageMonths !== '' ? Number(pet.ageMonths) : null
                                            const tooYoung = petAge !== null && petAge < 3
                                            const unvax = pet.vaccinated === false || pet.vaccinated === 'no' || pet.vaccinated === 'false'
                                            const selected = selectedPetId === pet._id
                                            return (
                                                <button key={pet._id} type='button' onClick={() => { setSelectedPetId(pet._id); resetForPetChange() }} aria-pressed={selected} className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${selected ? 'border-[#2F6B57] bg-[#EDF3EE] ring-2 ring-[#2F6B57]/20 shadow-xs' : 'border-[#DDE4DE] bg-white hover:border-[#B8C7BE] hover:shadow-xs'}`}>
                                                    <span className='grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] text-[#13231B]'>
                                                        {pet.photoUrl ? (
                                                            <img src={pet.photoUrl} alt={pet.name} className='h-full w-full object-cover' />
                                                        ) : (
                                                            <span className='font-serif font-bold text-lg text-[#1F4D3E]'>{pet.name[0]?.toUpperCase()}</span>
                                                        )}
                                                    </span>
                                                    <div className='min-w-0 flex-1'>
                                                        <p className='font-serif text-base font-bold text-[#13231B] truncate'>{pet.name}</p>
                                                        <p className='mt-0.5 text-xs text-[#405148]'>{pet.type === 'cat' ? 'Cat' : 'Dog'} · {pet.breed}{petAge !== null ? ` · ${petAge} mo` : ''}</p>
                                                        {pet.coatType && <p className='mt-1 text-[11px] text-[#2F6B57]'>{pet.coatType}</p>}
                                                        {(tooYoung || unvax) && (
                                                            <div className='mt-2 flex flex-wrap gap-1'>
                                                                {tooYoung && <span className='rounded bg-[#FFF4DC] border border-[#F0DEB6] px-2 py-0.5 text-[10px] font-bold text-[#8A5D13]'>&lt; 3 Months</span>}
                                                                {unvax && <span className='rounded bg-[#FBEAEA] border border-[#F0CCCC] px-2 py-0.5 text-[10px] font-bold text-[#9E3E3E]'>Unvaccinated</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {selected && <span className='grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#1F4D3E] text-white'><Check size={12} /></span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className='grid gap-4 sm:grid-cols-2'>
                                        <Input label='PET NAME' value={newPet.name} onChange={(value) => { setNewPet({ ...newPet, name: value }); resetForPetChange() }} />
                                        <label className='block'>
                                            <Label>PET TYPE</Label>
                                            <select value={newPet.type} onChange={(event) => { setNewPet({ ...newPet, type: event.target.value }); resetForPetChange() }} className='h-11 w-full rounded-lg border border-[#DDE4DE] bg-white px-3.5 text-sm outline-none focus:border-[#2F6B57]'>
                                                <option value='dog'>Dog</option>
                                                <option value='cat'>Cat</option>
                                            </select>
                                        </label>
                                        <Input label='BREED' value={newPet.breed} onChange={(value) => { setNewPet({ ...newPet, breed: value }); resetForPetChange() }} />
                                        <Input label='COAT TYPE (OPTIONAL)' value={newPet.coatType} onChange={(value) => { setNewPet({ ...newPet, coatType: value }); resetForPetChange() }} placeholder='Long, short, double coat' />
                                        <Input label='PET AGE (MONTHS)' type='number' min='0' value={newPet.ageMonths} onChange={(value) => { setNewPet({ ...newPet, ageMonths: value }); resetForPetChange() }} placeholder='e.g. 6' />
                                        <label className='block'>
                                            <Label>IS PET FULLY VACCINATED?</Label>
                                            <select value={newPet.vaccinated} onChange={(event) => { setNewPet({ ...newPet, vaccinated: event.target.value }); resetForPetChange() }} className='h-11 w-full rounded-lg border border-[#DDE4DE] bg-white px-3.5 text-sm outline-none focus:border-[#2F6B57]'>
                                                <option value='yes'>Yes - Fully Vaccinated</option>
                                                <option value='no'>No - Not Vaccinated</option>
                                            </select>
                                        </label>
                                        <label className='block sm:col-span-2'>
                                            <Label>PET NOTES (OPTIONAL)</Label>
                                            <textarea value={newPet.notes} onChange={(event) => setNewPet({ ...newPet, notes: event.target.value })} rows={2} className='w-full rounded-lg border border-[#DDE4DE] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#2F6B57]' />
                                        </label>
                                    </div>
                                )}

                                {isPetTooYoung && (
                                    <div className='mt-4 flex items-start gap-3 rounded-xl border border-[#F0DEB6] bg-[#FFF4DC] p-3.5 text-[#6E4A0D] shadow-xs'>
                                        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-[#8A5D13]' />
                                        <div>
                                            <h4 className='font-bold text-xs text-[#8A5D13] uppercase tracking-wide'>Notice</h4>
                                            <p className='mt-0.5 text-xs leading-relaxed'>
                                                Pets must be at least 3 months old to be booked for grooming services.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {!isPetTooYoung && isPetNotVaccinated && (
                                    <div className='mt-4 flex items-start gap-3 rounded-xl border border-[#F0CCCC] bg-[#FBEAEA] p-3.5 text-[#7F3333]'>
                                        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-[#9E3E3E]' />
                                        <div>
                                            <h4 className='font-bold text-xs text-[#7F3333] uppercase tracking-wide'>Vaccination Required</h4>
                                            <p className='mt-0.5 text-xs text-[#7F3333] leading-relaxed'>
                                                Pets must be fully vaccinated prior to their grooming visit.
                                            </p>
                                        </div>
                                    </div>
                                )}

                            </Section>
                        </div>

                        {/* Section 2: Style and Preview (Visible on Desktop OR when mobileStep === 2) */}
                        <div className={mobileStep === 2 ? 'block' : 'hidden lg:block'}>
                            <Section id='booking-section-2' number='2' title='Style and Preview' description={aiEnabled ? 'Upload one pet photo, compare styles, and choose a haircut reference.' : 'Style preview is available for Full Grooming and Custom Styling.'} icon={<WandSparkles size={18} className='text-[#2F6B57]' />} disabled={!selectedService || !activePet?.name || !activePet?.breed || isPetTooYoung || isPetNotVaccinated}>
                                {!aiEnabled ? (
                                    <div className='rounded-lg border border-[#DDE4DE] bg-white p-4 text-xs text-[#405148]'>The selected service does not require a haircut preview. Proceed to schedule selection.</div>
                                ) : (
                                    <AiPreviewPanel
                                        season={season}
                                        photoPreview={photoPreview}
                                        onPhotoChange={handlePhoto}
                                        generatedPreview={generatedPreview}
                                        selectedStyleName={selectedStyle?.name || ''}
                                        previewFromCache={previewFromCache}
                                        consent={consent}
                                        onConsentChange={handleConsentChange}
                                        verificationStatus={verificationStatus}
                                        verificationError={verificationError}
                                        onStartGeneration={() => startPersonalizedGallery()}
                                        galleryGenerating={galleryGenerating}
                                        galleryMessage={galleryMessage}
                                        hasFailures={hasStyleFailures}
                                        onRetryFailures={retryFailedStylePreviews}
                                        onRegenerateSelected={() => selectedStyleId && retryStylePreview(selectedStyleId)}
                                    >
                                        <StylePicker
                                            styles={compatibleStyles}
                                            recommendations={recommendations}
                                            stylePreviews={stylePreviews}
                                            selectedStyleId={selectedStyleId}
                                            onSelect={selectStyle}
                                            onRetry={retryStylePreview}
                                            petType={activePet?.type}
                                            photoReady={Boolean(photoDataUrl && consent)}
                                            loading={stylesLoading || recommendationsLoading}
                                            generationBusy={galleryGenerating}
                                        />
                                    </AiPreviewPanel>
                                )}

                                {/* Step 2 Mobile Controls */}
                                <div className='mt-4 pt-3 border-t border-[#DDE4DE] flex items-center justify-between lg:hidden'>
                                    <button
                                        type='button'
                                        onClick={() => { setMobileStep(1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                                        className='inline-flex items-center gap-1 rounded-lg border border-[#DDE4DE] bg-white px-3 py-1.5 text-xs font-bold text-[#405148]'
                                    >
                                        <ChevronLeft size={14} />
                                        <span>Back to Pet &amp; Service</span>
                                    </button>
                                </div>
                            </Section>
                        </div>

                        {/* Section 3: Schedule (Visible on Desktop OR when mobileStep === 3) */}
                        <div className={mobileStep === 3 ? 'block' : 'hidden lg:block'}>
                            <Section id='booking-section-3' number='3' title='Schedule' description='Pick an available date and a guaranteed 2-hour window.' icon={<CalendarDays size={18} className='text-[#2F6B57]' />} disabled={!selectedService || !activePet?.name || !activePet?.breed || isPetTooYoung || isPetNotVaccinated || (aiEnabled && !selectedStyle)}>
                                <div className='grid gap-5 xl:grid-cols-[1fr_1fr]'>
                                    <AvailabilityCalendar
                                        monthKey={monthKey}
                                        selectedDate={selectedDate}
                                        statuses={monthStatuses}
                                        onMonthChange={(key) => { setMonthKey(key); setSelectedDate(''); setSelectedTime(''); setSlots([]) }}
                                        onSelect={(date) => { setSelectedDate(date); setSelectedTime(''); setSlots([]) }}
                                        minDate={minDate}
                                        maxDate={maxDate}
                                        loading={calendarLoading}
                                    />
                                    <div>
                                        <h3 className='mb-3 font-serif text-lg font-bold text-[#13231B]'>{selectedDate ? formatDateLong(selectedDate) : 'Available Time Slots'}</h3>
                                        <TimeSlotGrid slots={slots} selectedTime={selectedTime} onSelect={setSelectedTime} loading={slotsLoading} />
                                    </div>
                                </div>

                                <div className='my-6 h-px bg-[#E5EAE6]' />
                                <label className='block'>
                                    <Label>Notes for Groomer (Optional)</Label>
                                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={500} placeholder='Special handling, skin sensitivities, coat preferences, etc.' className='w-full rounded-lg border border-[#DDE4DE] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#2F6B57]' />
                                </label>
                                <p className='mt-1 text-right text-[11px] font-medium text-[#2F6B57]'>{notes.length}/500</p>

                                {/* Step 3 Mobile Controls */}
                                <div className='mt-4 pt-3 border-t border-[#DDE4DE] flex items-center justify-between lg:hidden'>
                                    <button
                                        type='button'
                                        onClick={() => { setMobileStep(aiEnabled ? 2 : 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                                        className='inline-flex items-center gap-1 rounded-lg border border-[#DDE4DE] bg-white px-3 py-1.5 text-xs font-bold text-[#405148]'
                                    >
                                        <ChevronLeft size={14} />
                                        <span>Back</span>
                                    </button>
                                </div>
                            </Section>
                        </div>

                        {/* Step 4 Mobile Final Summary View (Visible ONLY on mobileStep === 4) */}
                        {mobileStep === 4 && (
                            <div className='block lg:hidden rounded-xl border border-[#DDE4DE] bg-white p-6 shadow-xs space-y-6'>
                                <div className='flex items-center gap-2.5 border-b border-[#DDE4DE] pb-4'>
                                    <span className='grid h-8 w-8 place-items-center rounded-lg bg-[#13231B] font-mono text-xs font-bold text-[#F6F7F2]'>4</span>
                                    <div>
                                        <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>Review &amp; Confirm</p>
                                        <h2 className='font-serif text-xl font-bold text-[#13231B]'>Appointment Summary</h2>
                                    </div>
                                </div>

                                <div className='space-y-1.5 rounded-xl border border-[#DDE4DE] bg-white p-4'>
                                    <SummaryRow label='Pet' value={activePet?.name || 'Not selected'} />
                                    <SummaryRow label='Breed' value={activePet?.breed || 'Not selected'} />
                                    <SummaryRow label='Service' value={selectedService?.name || 'Not selected'} />
                                    {aiEnabled && <SummaryRow label='Style' value={selectedStyle?.name || 'Not selected'} />}
                                    {aiEnabled && generatedPreview && <SummaryRow label='Style Preview' value='Ready' />}
                                    <SummaryRow label='Date' value={selectedDate ? formatDateLong(selectedDate) : 'Not selected'} />
                                    <SummaryRow label='Time' value={selectedSlot ? formatTimeRange(selectedSlot.startTime, selectedSlot.endTime) : 'Not selected'} />
                                    <SummaryRow label='Total Amount' value={`₱${Number(selectedService?.price || 0).toLocaleString('en-PH')}`} strong />
                                </div>

                                {/* Arrival Notice */}
                                <div className='rounded-2xl border border-[#F0DEB6] bg-[#FFF4DC] p-4 text-xs text-[#6E4A0D] flex items-start gap-3 shadow-xs'>
                                    <Clock className='mt-0.5 h-4 w-4 shrink-0 text-[#13231B]' />
                                    <div>
                                        <p className='font-bold text-[#13231B] mb-0.5'>Salon Arrival Policy:</p>
                                        <p className='leading-relaxed text-[#13231B]/90'>Please arrive <strong>5–10 minutes before</strong> your appointment time. Late arrival beyond 10 minutes will automatically cancel your booking.</p>
                                    </div>
                                </div>

                                <div className='flex items-center justify-between gap-3 pt-2'>
                                    <button
                                        type='button'
                                        onClick={() => { setMobileStep(3); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                                        className='inline-flex items-center gap-1.5 rounded-xl border border-[#DDE4DE] bg-white px-4 py-3 text-xs font-bold text-[#405148]'
                                    >
                                        <ChevronLeft size={16} />
                                        <span>Back to Schedule</span>
                                    </button>
                                    <button
                                        onClick={submitBooking}
                                        disabled={submitting}
                                        className='inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2F6B57] px-6 py-3 font-bold text-[#F6F7F2] shadow-xs transition hover:bg-[#1F4D3E] active:scale-[0.98] disabled:opacity-50'
                                    >
                                        <span>{submitting ? 'Saving...' : 'Confirm Booking'}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desktop Booking Summary Sidebar (Visible ONLY on Desktop lg:block) */}
                    <aside className='sticky top-24 hidden rounded-[1.5rem] border border-[#DDE4DE] bg-white p-6 shadow-sm lg:block'>
                        <div className='flex items-center gap-2.5'>
                            <span className='grid h-7 w-7 place-items-center rounded-lg bg-[#13231B] font-mono text-xs font-bold text-[#F6F7F2]'>4</span>
                            <div><p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>Review</p><h2 className='font-serif text-xl font-bold text-[#13231B]'>Booking Summary</h2></div>
                        </div>
                        <div className='mt-5 space-y-1'>
                            <SummaryRow label='Pet' value={activePet?.name || 'Not selected'} />
                            <SummaryRow label='Breed' value={activePet?.breed || 'Not selected'} />
                            <SummaryRow label='Service' value={selectedService?.name || 'Not selected'} />
                            {aiEnabled && <SummaryRow label='Style' value={selectedStyle?.name || 'Not selected'} />}
                            {aiEnabled && generatedPreview && <SummaryRow label='Style Preview' value='Ready' />}
                            <SummaryRow label='Date' value={selectedDate ? formatDateLong(selectedDate) : 'Not selected'} />
                            <SummaryRow label='Time' value={selectedSlot ? formatTimeRange(selectedSlot.startTime, selectedSlot.endTime) : 'Not selected'} />
                        </div>
                        <div className='my-5 h-px bg-[#E5EAE6]' />
                        <div className='flex items-end justify-between'><span className='font-serif text-lg font-bold text-[#13231B]'>Total Amount</span><span className='font-serif text-2xl font-bold text-[#2F6B57]'>₱{Number(selectedService?.price || 0).toLocaleString('en-PH')}</span></div>
                        <button onClick={submitBooking} disabled={submitting} className='mt-6 hidden w-full rounded-lg bg-[#2F6B57] px-5 py-3.5 font-bold text-[#F6F7F2] shadow-xs transition hover:bg-[#1F4D3E] disabled:opacity-50 lg:block'>{submitting ? 'Saving appointment...' : 'Confirm Booking'}</button>
                    </aside>
                </div>
            </div>

            {/* Mobile Floating Sticky Summary Bar (Visible only on steps 1..3) */}
            {mobileStep < 4 && (
                <div className='fixed bottom-16 left-0 right-0 z-30 px-3 pb-2 pt-1 lg:hidden pointer-events-none'>
                    <div className='pointer-events-auto mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-[#DDE4DE] bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-md'>
                        <div className='min-w-0 flex-1'>
                            <p className='text-[10px] font-bold uppercase tracking-wider text-[#2F6B57] truncate'>
                                {selectedService?.name || 'Grooming'} {selectedStyle ? `• ${selectedStyle.name}` : ''}
                            </p>
                            <p className='font-serif text-base font-bold text-[#13231B] leading-tight'>
                                ₱{Number(selectedService?.price || 0).toLocaleString('en-PH')}
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                if (mobileStep === 1 && validateStep1()) {
                                    setMobileStep(aiEnabled ? 2 : 3)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                } else if (mobileStep === 2 && validateStep2()) {
                                    setMobileStep(3)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                } else if (mobileStep === 3 && validateStep3()) {
                                    setMobileStep(4)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                }
                            }}
                            className='inline-flex items-center justify-center gap-1 rounded-lg bg-[#2F6B57] px-4 py-2 text-xs font-bold text-[#F6F7F2] shadow-xs transition hover:bg-[#1F4D3E] active:scale-[0.98] shrink-0'
                        >
                            <span>Next Step</span>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function Section({ id, number, title, description, icon, disabled = false, children }) {
    return (
        <section id={id} className={`rounded-[1.5rem] border border-[#DDE4DE] bg-white p-5 shadow-sm transition-all duration-300 sm:p-6 ${disabled ? 'pointer-events-none opacity-45' : ''}`}>
            <div className='mb-5 flex items-start gap-3.5'>
                <span className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F6F7F2] border border-[#F6F7F2] font-mono text-xs font-bold text-[#2F6B57]'>{number}</span>
                <div className='flex-1'><div className='flex items-center gap-2'>{icon}<h2 className='font-serif text-xl font-bold text-[#13231B]'>{title}</h2></div><p className='mt-1 text-xs leading-relaxed text-[#405148]'>{description}</p></div>
            </div>
            {children}
        </section>
    )
}

function Label({ children }) {
    return <span className='mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#405148]'>{children}</span>
}

function Input({ label, value, onChange, ...props }) {
    return <label className='block'><Label>{label}</Label><input value={value} onChange={(event) => onChange(event.target.value)} className='h-11 w-full rounded-lg border border-[#DDE4DE] bg-white px-3.5 text-sm outline-none transition focus:border-[#2F6B57] placeholder:text-[#E8795B]' {...props} /></label>
}

function SummaryRow({ label, value, strong = false }) {
    return (
        <div className='flex items-start justify-between gap-4 border-b border-[#E5EAE6] py-2.5 last:border-0'>
            <span className='text-xs font-medium text-[#68776F]'>{label}</span>
            <span className={`text-right text-xs ${strong ? 'font-serif text-base font-bold text-[#1F4D3E]' : 'font-bold text-[#13231B]'}`}>{value}</span>
        </div>
    )
}
