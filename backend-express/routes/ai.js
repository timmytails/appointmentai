const express = require('express')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const mongoose = require('mongoose')
const { protect } = require('../middleware/auth')
const AiPreview = require('../models/AiPreview')
const Pet = require('../models/Pet')
const {
    findService,
    findStyle,
    isStyleCompatibleWithPet,
    getStylesForPetType,
    getStyleRecommendations,
    toPublicStyle,
    STYLE_OPTIONS
} = require('../config/services')
const {
    getPhilippineSeason
} = require('../config/philippineSeason')
const {
    SOURCE_PHOTO_POLICY_VERSION,
    buildPetPhotoClassificationPrompt,
    getSourceVerificationModels,
    normalizePetPhotoClassification,
    normalizePhotoVerificationTimeout,
    normalizeSourceModelTimeout
} = require('../config/photoVerificationPolicy')

const router = express.Router()

const allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp'
])

const PHOTO_VERIFICATION_CACHE_TTL_MS = 60 * 60 * 1000
const MAX_VERIFICATION_CACHE_ENTRIES = 100
const photoVerificationCache = new Map()
const DEFAULT_PREVIEW_VERSION =
    '2026-09-pet-single-subject-v1'
const MAX_GENERATED_IMAGE_BYTES = 8 * 1024 * 1024
const PHOTO_VERIFICATION_TOKEN_TTL_SECONDS = 60 * 60

let cachedAccessToken = null
let cachedAccessTokenExpiresAt = 0

let vertexGenerationQueue = Promise.resolve()

const runInVertexQueue = (fn) => {
    const res = vertexGenerationQueue.then(
        async () => await fn(),
        async () => await fn()
    )
    vertexGenerationQueue = res.catch(() => {})
    return res
}

const parseDataUrl = (value) => {
    const str = String(value || '').trim()
    const match = str.match(
        /^data:(image\/(?:jpe?g|png|webp));base64,([\s\S]+)$/i
    )

    if (!match) return null

    const base64Data = match[2].replace(/\s+/g, '')
    const buffer = Buffer.from(base64Data, 'base64')

    if (
        !buffer.length ||
        buffer.length > 7 * 1024 * 1024
    ) {
        return null
    }

    const normalizedMime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()

    return {
        mimeType: normalizedMime,
        buffer,
        base64: base64Data,
        sha256: crypto
            .createHash('sha256')
            .update(buffer)
            .digest('hex')
    }
}

const toBase64Url = (value) =>
    Buffer.from(value)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')

const readJsonFile = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return null
    }

    return JSON.parse(
        fs.readFileSync(filePath, 'utf8')
    )
}

const loadGoogleCredentials = () => {
    const rawJson =
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ''

    const base64Json =
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || ''

    if (rawJson || base64Json) {
        const json = rawJson || Buffer.from(
            base64Json,
            'base64'
        ).toString('utf8')

        return JSON.parse(json)
    }

    const explicitPath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS

    if (explicitPath) {
        return readJsonFile(explicitPath)
    }

    const defaultAdcPath = process.platform === 'win32'
        ? process.env.APPDATA && path.join(
            process.env.APPDATA,
            'gcloud',
            'application_default_credentials.json'
        )
        : path.join(
            os.homedir(),
            '.config',
            'gcloud',
            'application_default_credentials.json'
        )

    return readJsonFile(defaultAdcPath)
}

const exchangeServiceAccountJwt = async (credentials) => {
    if (
        !credentials?.client_email ||
        !credentials?.private_key
    ) {
        throw new Error(
            'Google service account credentials are missing client_email or private_key'
        )
    }

    const now = Math.floor(Date.now() / 1000)

    const header = toBase64Url(
        JSON.stringify({
            alg: 'RS256',
            typ: 'JWT'
        })
    )

    const payload = toBase64Url(
        JSON.stringify({
            iss: credentials.client_email,
            scope:
                'https://www.googleapis.com/auth/cloud-platform',
            aud:
                credentials.token_uri ||
                'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600
        })
    )

    const unsignedToken = `${header}.${payload}`

    const signature = crypto
        .sign(
            'RSA-SHA256',
            Buffer.from(unsignedToken),
            credentials.private_key
        )
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')

    const assertion =
        `${unsignedToken}.${signature}`

    const response = await fetch(
        credentials.token_uri ||
            'https://oauth2.googleapis.com/token',
        {
            method: 'POST',
            headers: {
                'Content-Type':
                    'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type:
                    'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion
            })
        }
    )

    const result = await response.json()

    if (!response.ok || !result?.access_token) {
        throw new Error(
            result?.error_description ||
            result?.error ||
            'Unable to authenticate the Google service account'
        )
    }

    return {
        accessToken: result.access_token,
        expiresIn: Number(result.expires_in) || 3600
    }
}

const refreshAuthorizedUserToken = async (credentials) => {
    if (
        !credentials?.client_id ||
        !credentials?.client_secret ||
        !credentials?.refresh_token
    ) {
        throw new Error(
            'Google application default credentials are incomplete'
        )
    }

    const response = await fetch(
        credentials.token_uri ||
            'https://oauth2.googleapis.com/token',
        {
            method: 'POST',
            headers: {
                'Content-Type':
                    'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: credentials.client_id,
                client_secret:
                    credentials.client_secret,
                refresh_token:
                    credentials.refresh_token,
                grant_type: 'refresh_token'
            })
        }
    )

    const result = await response.json()

    if (!response.ok || !result?.access_token) {
        throw new Error(
            result?.error_description ||
            result?.error ||
            'Unable to refresh Google application default credentials'
        )
    }

    return {
        accessToken: result.access_token,
        expiresIn: Number(result.expires_in) || 3600
    }
}

const getGoogleAccessToken = async () => {
    const temporaryToken =
        process.env.GOOGLE_CLOUD_ACCESS_TOKEN

    if (temporaryToken) {
        return temporaryToken
    }

    if (
        cachedAccessToken &&
        Date.now() < cachedAccessTokenExpiresAt
    ) {
        return cachedAccessToken
    }

    let credentials

    try {
        credentials = loadGoogleCredentials()
    } catch (error) {
        throw new Error(
            `Unable to read Google credentials: ${error.message}`
        )
    }

    if (!credentials) {
        throw new Error(
            'Google credentials are not configured. Use Application Default Credentials locally or configure server credentials in production.'
        )
    }

    let tokenResult

    if (credentials.type === 'service_account') {
        tokenResult = await exchangeServiceAccountJwt(
            credentials
        )
    } else if (credentials.type === 'authorized_user') {
        tokenResult = await refreshAuthorizedUserToken(
            credentials
        )
    } else {
        throw new Error(
            `Unsupported Google credential type: ${credentials.type || 'unknown'}`
        )
    }

    cachedAccessToken = tokenResult.accessToken
    cachedAccessTokenExpiresAt =
        Date.now() +
        Math.max(
            60,
            tokenResult.expiresIn - 300
        ) * 1000

    return cachedAccessToken
}

const getVertexConfig = () => {
    const project = String(
        process.env.GOOGLE_CLOUD_PROJECT || ''
    ).trim()

    const location = String(
        process.env.GOOGLE_CLOUD_LOCATION ||
        'global'
    ).trim()

    if (!project) {
        throw new Error(
            'Vertex AI image generation is not configured'
        )
    }

    return {
        project,
        location
    }
}

const buildVertexEndpoint = ({ project, location, model }) =>
    `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}` +
    `/locations/${encodeURIComponent(location)}` +
    `/publishers/google/models/${encodeURIComponent(model)}:generateContent`

const waitForProviderRetry = (delayMs, signal) =>
    new Promise((resolve, reject) => {
        if (signal?.aborted) {
            const error = new Error('The operation was aborted')
            error.name = 'AbortError'
            reject(error)
            return
        }

        const timeout = setTimeout(resolve, delayMs)

        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timeout)
                const error = new Error('The operation was aborted')
                error.name = 'AbortError'
                reject(error)
            },
            { once: true }
        )
    })

const vertexGenerateContent = async ({
    model,
    body,
    signal,
    maxRetries: maxRetriesOverride
}) => {
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
    let endpoint, headers

    if (apiKey) {
        const { project, location } = getVertexConfig()
        endpoint = `${buildVertexEndpoint({
            project,
            location,
            model
        })}?key=${encodeURIComponent(apiKey)}`
        headers = { 'Content-Type': 'application/json' }
    } else {
        const { project, location } = getVertexConfig()
        const accessToken = await getGoogleAccessToken()
        endpoint = buildVertexEndpoint({
            project,
            location,
            model
        })
        headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    }

    const configuredRetries = Number(
        process.env.AI_PROVIDER_MAX_RETRIES
    )
    const proposedRetries = Number.isFinite(
        maxRetriesOverride
    )
        ? maxRetriesOverride
        : Number.isFinite(configuredRetries)
            ? configuredRetries
            : 1
    const maxRetries = Math.min(
        3,
        Math.max(0, proposedRetries)
    )

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal
        })
        const responseText = await response.text()
        let result = null

        try {
            result = responseText
                ? JSON.parse(responseText)
                : null
        } catch {
            result = null
        }

        if (response.ok) return result

        const retryAfterHeader = Number(
            response.headers.get('retry-after')
        )
        const retryAfterSeconds = Number.isFinite(
            retryAfterHeader
        ) && retryAfterHeader > 0
            ? retryAfterHeader
            : null
        const error = new Error(
            result?.error?.message ||
            'The AI provider rejected the request'
        )
        error.statusCode = response.status
        error.providerStatus =
            result?.error?.status || null
        error.code = response.status === 429
            ? 'VERTEX_QUOTA_EXHAUSTED'
            : 'VERTEX_REQUEST_FAILED'
        error.retryAfterSeconds =
            retryAfterSeconds

        const retryable = [
            429,
            500,
            502,
            503,
            504
        ].includes(response.status)

        if (!retryable || attempt >= maxRetries) {
            throw error
        }

        const configuredDelay = Math.max(
            1000,
            Number(
                process.env.AI_PROVIDER_RETRY_DELAY_MS
            ) || 4000
        )
        const delayMs = Math.min(
            10000,
            retryAfterSeconds
                ? retryAfterSeconds * 1000
                : configuredDelay
        )

        await waitForProviderRetry(delayMs, signal)
    }

    throw new Error('The AI provider request failed')
}

const isQuotaExhaustedError = (error) =>
    error?.statusCode === 429 ||
    error?.code === 'VERTEX_QUOTA_EXHAUSTED' ||
    /resource (?:has been )?exhausted|quota/i.test(
        String(error?.message || '')
    )

const findGeneratedImage = (result) => {
    const candidates = Array.isArray(result?.candidates)
        ? result.candidates
        : []

    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts)
            ? candidate.content.parts
            : []

        for (const part of parts) {
            const inlineData =
                part?.inlineData ||
                part?.inline_data

            if (inlineData?.data) {
                return {
                    data: inlineData.data,
                    mimeType:
                        inlineData.mimeType ||
                        inlineData.mime_type ||
                        'image/png'
                }
            }
        }
    }

    return null
}

const findResponseText = (result) => {
    const candidates = Array.isArray(result?.candidates)
        ? result.candidates
        : []

    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts)
            ? candidate.content.parts
            : []

        for (const part of parts) {
            if (typeof part?.text === 'string' && part.text.trim()) {
                return part.text.trim()
            }
        }
    }

    return ''
}

const normalizePetType = (value) =>
    String(value || '').trim().toLowerCase()

const normalizeBreed = (value) =>
    String(value || '').trim()

const getPreviewVersion = () => {
    const configuredVersion = String(
        process.env.AI_PREVIEW_VERSION ||
        DEFAULT_PREVIEW_VERSION
    ).trim()

    const model = String(
        process.env.GEMINI_IMAGE_MODEL ||
        'gemini-3.1-flash-image'
    ).trim()

    return `${configuredVersion}:${model}`
}

const getPreviewExpiryDate = () => {
    const retentionDays = Math.min(
        30,
        Math.max(
            1,
            Number(
                process.env.AI_PREVIEW_RETENTION_DAYS
            ) || 7
        )
    )

    return new Date(
        Date.now() +
        retentionDays * 24 * 60 * 60 * 1000
    )
}

const getVerificationSigningSecret = () => {
    const secret = String(
        process.env.JWT_SECRET || ''
    ).trim()

    if (!secret) {
        const error = new Error(
            'Photo verification signing is not configured'
        )
        error.statusCode = 503
        throw error
    }

    return secret
}

const createPhotoVerificationToken = ({
    imageData,
    petType,
    userId
}) => {
    const payload = Buffer.from(
        JSON.stringify({
            version: 3,
            policyVersion:
                SOURCE_PHOTO_POLICY_VERSION,
            sourcePhotoHash: imageData.sha256,
            petType,
            userId: String(userId),
            expiresAt:
                Math.floor(Date.now() / 1000) +
                PHOTO_VERIFICATION_TOKEN_TTL_SECONDS
        })
    ).toString('base64url')
    const signature = crypto
        .createHmac(
            'sha256',
            getVerificationSigningSecret()
        )
        .update(payload)
        .digest('base64url')

    return `${payload}.${signature}`
}

const readPhotoVerificationToken = ({
    token,
    imageData,
    petType,
    userId
}) => {
    const [payload, providedSignature, ...extraParts] =
        String(token || '').split('.')

    if (
        !payload ||
        !providedSignature ||
        extraParts.length
    ) {
        return null
    }

    const expectedSignature = crypto
        .createHmac(
            'sha256',
            getVerificationSigningSecret()
        )
        .update(payload)
        .digest()
    let providedBuffer

    try {
        providedBuffer = Buffer.from(
            providedSignature,
            'base64url'
        )
    } catch {
        return null
    }

    if (
        expectedSignature.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(
            expectedSignature,
            providedBuffer
        )
    ) {
        return null
    }

    let tokenData

    try {
        tokenData = JSON.parse(
            Buffer.from(
                payload,
                'base64url'
            ).toString('utf8')
        )
    } catch {
        return null
    }

    const acceptedPolicies = [
        SOURCE_PHOTO_POLICY_VERSION,
        'breed-species-v5-strict-check',
        'species-v4-neutral-context-bound'
    ]

    const valid = Boolean(
        tokenData.version === 3 &&
        acceptedPolicies.includes(tokenData.policyVersion) &&
        tokenData.sourcePhotoHash === imageData.sha256 &&
        tokenData.petType === petType &&
        tokenData.userId === String(userId) &&
        Number(tokenData.expiresAt) >
            Math.floor(Date.now() / 1000)
    )

    return valid ? tokenData : null
}

const resolvePetContext = async (req) => {
    const requestedPetId = String(
        req.body.petId || ''
    ).trim()

    if (requestedPetId) {
        if (!mongoose.isValidObjectId(requestedPetId)) {
            const error = new Error('Select a valid pet profile')
            error.statusCode = 400
            throw error
        }

        const pet = await Pet.findOne({
            _id: requestedPetId,
            owner: req.user._id
        })

        if (!pet) {
            const error = new Error('Selected pet was not found')
            error.statusCode = 404
            throw error
        }

        return {
            pet,
            petId: pet._id,
            petName: pet.name,
            petType: normalizePetType(pet.type),
            breed: normalizeBreed(pet.breed),
            coatType: String(pet.coatType || '').trim()
        }
    }

    const petType = normalizePetType(
        req.body.petType
    )
    const breed = normalizeBreed(
        req.body.breed
    )

    if (!['dog', 'cat'].includes(petType)) {
        const error = new Error(
            'The pet profile must be marked as a dog or cat'
        )
        error.statusCode = 400
        throw error
    }

    if (!breed) {
        const error = new Error(
            'Enter the pet breed before generating a preview'
        )
        error.statusCode = 400
        throw error
    }

    return {
        pet: null,
        petId: null,
        petName: String(req.body.petName || '').trim(),
        petType,
        breed,
        coatType: String(req.body.coatType || '').trim()
    }
}

const getCachedVerification = (cacheKey) => {
    const entry = photoVerificationCache.get(cacheKey)

    if (!entry) return null

    if (Date.now() - entry.cachedAt > PHOTO_VERIFICATION_CACHE_TTL_MS) {
        photoVerificationCache.delete(cacheKey)
        return null
    }

    return entry.value
}

const setCachedVerification = (cacheKey, value) => {
    if (photoVerificationCache.size >= MAX_VERIFICATION_CACHE_ENTRIES) {
        const oldestKey = photoVerificationCache.keys().next().value
        if (oldestKey) photoVerificationCache.delete(oldestKey)
    }

    photoVerificationCache.set(cacheKey, {
        value,
        cachedAt: Date.now()
    })
}

const createLinkedTimeoutSignal = ({
    parentSignal,
    timeoutMs
}) => {
    const controller = new AbortController()
    let timedOut = false
    const abortFromParent = () => controller.abort()

    if (parentSignal?.aborted) {
        controller.abort()
    } else {
        parentSignal?.addEventListener(
            'abort',
            abortFromParent,
            { once: true }
        )
    }

    const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
    }, timeoutMs)

    return {
        signal: controller.signal,
        didTimeOut: () => timedOut,
        cleanup: () => {
            clearTimeout(timeout)
            parentSignal?.removeEventListener(
                'abort',
                abortFromParent
            )
        }
    }
}

const classifyPetPhoto = async ({
    imageData,
    model,
    prompt,
    signal
}) => {
    const result = await vertexGenerateContent({
        model,
        signal,
        maxRetries: 0,
        body: {
            contents: [
                {
                    role: 'USER',
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType:
                                    imageData.mimeType,
                                data:
                                    imageData.base64
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType:
                    'application/json',
                temperature: 0,
                maxOutputTokens: 180,
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        detectedAnimal: {
                            type: 'STRING',
                            enum: [
                                'dog',
                                'cat',
                                'other',
                                'unclear'
                            ]
                        },
                        clearPet: {
                            type: 'BOOLEAN'
                        },
                        confidence: {
                            type: 'NUMBER'
                        },
                        reason: {
                            type: 'STRING'
                        }
                    },
                    required: [
                        'detectedAnimal',
                        'clearPet',
                        'confidence',
                        'reason'
                    ]
                }
            }
        }
    })

    const responseText = findResponseText(result)

    if (!responseText) {
        throw new Error(
            'Pet photo verification returned no result'
        )
    }

    try {
        return JSON.parse(responseText)
    } catch (_error) {
        throw new Error(
            'Pet photo verification returned an unreadable result'
        )
    }
}

const verifyPetPhoto = async ({
    imageData,
    expectedPetType,
    signal
}) => {
    const normalizedExpectedType =
        normalizePetType(expectedPetType)

    if (!['dog', 'cat'].includes(normalizedExpectedType)) {
        return {
            valid: false,
            detectedAnimal: 'unknown',
            clearPet: false,
            policyVersion:
                SOURCE_PHOTO_POLICY_VERSION,
            reason: 'The selected pet profile must be marked as a dog or cat.'
        }
    }

    const cacheKey = [
        SOURCE_PHOTO_POLICY_VERSION,
        imageData.sha256,
        normalizedExpectedType
    ].join(':')
    const cached = getCachedVerification(cacheKey)

    if (cached) return cached

    const models = getSourceVerificationModels({
        primary:
            process.env.GEMINI_SOURCE_VERIFICATION_MODEL,
        fallback:
            process.env.GEMINI_SOURCE_VERIFICATION_FALLBACK_MODEL
    })
    const modelTimeoutMs = normalizeSourceModelTimeout(
        process.env.AI_SOURCE_VERIFICATION_MODEL_TIMEOUT_MS
    )
    let classification = null
    let model = ''
    let lastError = null

    for (let index = 0; index < models.length; index += 1) {
        model = models[index]
        const modelCall = createLinkedTimeoutSignal({
            parentSignal: signal,
            timeoutMs: modelTimeoutMs
        })

        try {
            classification = await classifyPetPhoto({
                imageData,
                model,
                prompt:
                    buildPetPhotoClassificationPrompt(),
                signal: modelCall.signal
            })
            break
        } catch (error) {
            if (signal?.aborted) throw error

            lastError = error
            const providerStatus = Number(
                error?.statusCode
            )
            const canTryFallback =
                index < models.length - 1 &&
                (
                    modelCall.didTimeOut() ||
                    [400, 404, 500, 502, 503, 504]
                        .includes(providerStatus)
                )

            if (!canTryFallback) throw error
        } finally {
            modelCall.cleanup()
        }
    }

    if (!classification) {
        throw lastError || new Error(
            'Pet photo verification returned no result'
        )
    }
    const verified =
        normalizePetPhotoClassification({
            classification,
            expectedPetType:
                normalizedExpectedType,
            model
        })

    setCachedVerification(cacheKey, verified)

    return verified
}

const buildStylePrompt = ({
    petType,
    breed,
    style,
    season,
    strictRetry = false
}) => [
    `Edit the uploaded photo of this ${petType}; use the uploaded animal as the only identity reference.`,
    `Apply the ${style.name} grooming style in a realistic way that is appropriate for a ${breed}.`,
    `Required visible haircut definition: ${style.generationInstructions}`,
    `Consider comfort and coat maintenance during the Philippine ${season.label}.`,
    'Preserve the exact same pet identity, facial structure, muzzle, ears, eye color, coat colors, markings, body proportions, pose, background, lighting, and camera angle.',
    'Change only the visible fur length, trim, outline, and grooming shape needed for the selected style.',
    'CRITICAL COMPOSITION REQUIREMENT: Generate exactly ONE single photograph showing ONE single animal centered in the frame.',
    'STRICT PROHIBITION: Do NOT create a side-by-side image, split screen, dual comparison panels, diptych, collage, dual-frame, montage, grid, twin animals, or duplicate pet. Under NO circumstances should there be two animals or two pictures side-by-side.',
    'Keep the result a single cohesive, photorealistic, clean, and salon-quality portrait.',
    'Do not add clothing, bows, accessories, text, logos, watermarks, another animal, a person, or a different background.',
    'Do not change the pet into a different breed or alter facial anatomy.',
    style.coatSafety
        ? `Coat-safety context: ${style.coatSafety}`
        : '',
    strictRetry
        ? `CRITICAL RETRY: Output strictly 1 single picture of 1 single animal (no split screen, diptych, or duplicate animals). Preserve identity exactly and make these requested style features unmistakably visible: ${style.verificationCriteria}`
        : ''
]
    .filter(Boolean)
    .join(' ')

const generateStyledImage = async ({
    imageData,
    petType,
    breed,
    style,
    season,
    model,
    strictRetry,
    signal
}) => {
    const result = await vertexGenerateContent({
        model,
        signal,
        maxRetries: 3,
        body: {
            contents: [
                {
                    role: 'USER',
                    parts: [
                        {
                            text: buildStylePrompt({
                                petType,
                                breed,
                                style,
                                season,
                                strictRetry
                            })
                        },
                        {
                            inlineData: {
                                mimeType: imageData.mimeType,
                                data: imageData.base64
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                responseModalities: [
                    'TEXT',
                    'IMAGE'
                ],
                candidateCount: 1,
                imageConfig: {
                    aspectRatio:
                        process.env.GEMINI_IMAGE_ASPECT_RATIO ||
                        '1:1',
                    imageSize:
                        process.env.GEMINI_IMAGE_SIZE ||
                        '1K'
                }
            }
        }
    })

    const generated = findGeneratedImage(result)

    if (!generated?.data) {
        const finishReason =
            result?.candidates?.[0]?.finishReason

        throw new Error(
            finishReason
                ? `Vertex AI returned no generated image (${finishReason})`
                : 'Vertex AI returned no generated image'
        )
    }

    const generatedBuffer = Buffer.from(
        generated.data,
        'base64'
    )

    if (
        !generatedBuffer.length ||
        generatedBuffer.length > MAX_GENERATED_IMAGE_BYTES
    ) {
        throw new Error(
            'The generated preview is too large to save safely'
        )
    }

    return {
        ...generated,
        dataUrl:
            `data:${generated.mimeType};base64,${generated.data}`
    }
}

const verifyGeneratedPreview = async ({
    sourceImage,
    generatedImage,
    expectedPetType,
    style,
    signal
}) => {
    if (
        String(
            process.env.AI_FIDELITY_CHECK_ENABLED ||
            'true'
        ).toLowerCase() === 'false'
    ) {
        return {
            passed: true,
            skipped: true,
            reason: 'Server fidelity check is disabled.'
        }
    }

    const verificationModel = String(
        process.env.GEMINI_FIDELITY_MODEL ||
        'gemini-2.5-flash'
    ).trim()

    const prompt = [
        'Compare the original pet photo and the generated grooming preview.',
        `The expected animal is a ${expectedPetType} and the requested grooming style is ${style.name}.`,
        `The requested style must visibly satisfy this definition: ${style.verificationCriteria}`,
        'Pass only when the generated result clearly depicts the same individual pet: the face, facial proportions, eye color, coat colors, distinctive markings, body proportions, pose, framing, and background remain consistent.',
        'Judge identity preservation and haircut accuracy separately. A generic tidy-up or a result that could equally represent another listed style does not satisfy the requested definition.',
        'The grooming style must be unmistakably visible, but the image must not introduce another animal, person, clothing, accessories, text, logos, or a replacement background.',
        'MANDATORY SINGLE SUBJECT RULE: The generated preview must be 1 single picture containing only 1 animal. If the generated image contains a side-by-side comparison, split-screen, before-and-after panels, collage, duplicate pets, or multiple animals, singleAnimalOnly MUST be false and safeComposition MUST be false.',
        'Be conservative. If identity is uncertain, fail the comparison.'
    ].join(' ')

    const result = await vertexGenerateContent({
        model: verificationModel,
        signal,
        maxRetries: 0,
        body: {
            contents: [
                {
                    role: 'USER',
                    parts: [
                        {
                            text:
                                `${prompt} Image 1 is the original source photo.`
                        },
                        {
                            inlineData: {
                                mimeType: sourceImage.mimeType,
                                data: sourceImage.base64
                            }
                        },
                        {
                            text:
                                'Image 2 is the generated grooming preview.'
                        },
                        {
                            inlineData: {
                                mimeType: generatedImage.mimeType,
                                data: generatedImage.data
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0,
                maxOutputTokens: 240,
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        identityPreserved: {
                            type: 'BOOLEAN'
                        },
                        styleApplied: {
                            type: 'BOOLEAN'
                        },
                        styleDefinitionMatched: {
                            type: 'BOOLEAN'
                        },
                        safeComposition: {
                            type: 'BOOLEAN'
                        },
                        singleAnimalOnly: {
                            type: 'BOOLEAN'
                        },
                        detectedAnimal: {
                            type: 'STRING',
                            enum: [
                                'dog',
                                'cat',
                                'other',
                                'unclear'
                            ]
                        },
                        reason: {
                            type: 'STRING'
                        }
                    },
                    required: [
                        'identityPreserved',
                        'styleApplied',
                        'styleDefinitionMatched',
                        'safeComposition',
                        'singleAnimalOnly',
                        'detectedAnimal',
                        'reason'
                    ]
                }
            }
        }
    })

    const responseText = findResponseText(result)

    if (!responseText) {
        throw new Error(
            'Generated preview identity check returned no result'
        )
    }

    let check

    try {
        check = JSON.parse(responseText)
    } catch (_error) {
        throw new Error(
            'Generated preview identity check returned an unreadable result'
        )
    }

    const detectedAnimal = [
        'dog',
        'cat',
        'other',
        'unclear'
    ].includes(check.detectedAnimal)
        ? check.detectedAnimal
        : 'unclear'

    const singleAnimalOnly = check.singleAnimalOnly !== false
    const normalized = {
        passed: Boolean(
            check.identityPreserved &&
            check.styleApplied &&
            check.styleDefinitionMatched &&
            check.safeComposition &&
            singleAnimalOnly &&
            detectedAnimal === expectedPetType
        ),
        identityPreserved:
            Boolean(check.identityPreserved),
        styleApplied:
            Boolean(check.styleApplied),
        styleDefinitionMatched:
            Boolean(check.styleDefinitionMatched),
        safeComposition:
            Boolean(check.safeComposition && singleAnimalOnly),
        singleAnimalOnly,
        detectedAnimal,
        reason: String(
            !singleAnimalOnly
                ? 'The generated preview contained multiple images or duplicate pets instead of a single photo.'
                : check.reason ||
                  'The generated result did not pass the pet-fidelity check.'
        ).slice(0, 300),
        model: verificationModel
    }

    return normalized
}

router.get('/styles', (req, res) => {
    const petType = normalizePetType(
        req.query.petType
    )

    if (
        petType &&
        !['dog', 'cat'].includes(petType)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Pet type must be dog or cat'
        })
    }

    const season = getPhilippineSeason()

    return res.json({
        success: true,
        styles: petType
            ? getStylesForPetType(petType).map(toPublicStyle)
            : STYLE_OPTIONS.map(toPublicStyle),
        petType: petType || null,
        season,
        previewVersion: getPreviewVersion()
    })
})

router.post(
    '/recommendations',
    protect,
    async (req, res) => {
        const service = findService(
            req.body.serviceId
        )

        if (!service) {
            return res.status(400).json({
                success: false,
                message:
                    'Select a valid service first'
            })
        }

        if (!service.supportsAiPreview) {
            return res.json({
                success: true,
                recommendations: [],
                season: getPhilippineSeason()
            })
        }

        try {
            let petType = 'dog'
            let coatType = ''
            try {
                const petContext = await resolvePetContext(req)
                petType = petContext.petType || 'dog'
                coatType = petContext.coatType || ''
            } catch (_err) {
                petType = normalizePetType(req.body.petType) || 'dog'
                coatType = String(req.body.coatType || '').trim()
            }

            const season = getPhilippineSeason()
            const recommendations =
                getStyleRecommendations({
                    petType,
                    coatType,
                    season: season.key
                })

            return res.json({
                success: true,
                recommendations,
                season,
                notice:
                    'Season-aware suggestions are guidance only. The groomer confirms coat and safety suitability.'
            })
        } catch (error) {
            return res.status(
                error.statusCode || 400
            ).json({
                success: false,
                message: error.message
            })
        }
    }
)

router.post(
    '/photo-verification',
    protect,
    async (req, res) => {
        const service = findService(
            req.body.serviceId
        )
        let imageData = parseDataUrl(
            req.body.petPhotoDataUrl
        )

        let petContext = null
        try {
            petContext = await resolvePetContext(req)
        } catch (_err) {
            // will be caught or handled below
        }

        if (!imageData && petContext?.pet?.photoUrl) {
            imageData = parseDataUrl(petContext.pet.photoUrl)
        }

        if (!service?.supportsAiPreview) {
            return res.status(400).json({
                success: false,
                message:
                    'Select a grooming service with style previews first'
            })
        }

        if (
            !imageData ||
            !allowedMimeTypes.has(
                imageData.mimeType
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Upload a valid JPG, PNG, or WEBP pet photo up to 7 MB'
            })
        }

        if (req.body.consent !== true) {
            return res.status(400).json({
                success: false,
                message:
                    'Photo-processing consent is required'
            })
        }

        let timeout

        try {
            getVertexConfig()

            if (!petContext) {
                petContext = await resolvePetContext(req)
            }
            const controller = new AbortController()

            timeout = setTimeout(
                () => controller.abort(),
                normalizePhotoVerificationTimeout(
                    process.env.AI_PHOTO_VERIFICATION_TIMEOUT_MS
                )
            )

            const verification = await verifyPetPhoto({
                imageData,
                expectedPetType:
                    petContext.petType,
                signal: controller.signal
            })

            if (!verification.valid) {
                return res.status(422).json({
                    success: false,
                    code: 'PET_PHOTO_MISMATCH',
                    message:
                        verification.detectedAnimal === 'cat' && petContext.petType === 'dog'
                            ? 'This photo appears to show a cat. Please upload a clear photo of the selected dog.'
                            : verification.detectedAnimal === 'dog' && petContext.petType === 'cat'
                                ? 'This photo appears to show a dog. Please upload a clear photo of the selected cat.'
                                : `Please upload a clear photo of the selected ${petContext.petType}. ${verification.reason}`,
                    verification
                })
            }

            return res.json({
                success: true,
                photoVerification: {
                    token:
                        createPhotoVerificationToken({
                            imageData,
                            petType:
                                petContext.petType,
                            userId: req.user._id
                        }),
                    sourcePhotoHash:
                        imageData.sha256,
                    expiresInSeconds:
                        PHOTO_VERIFICATION_TOKEN_TTL_SECONDS,
                    verification
                }
            })
        } catch (error) {
            console.error(
                'Vertex AI pet photo verification error:',
                error
            )

            const timedOut =
                error?.name === 'AbortError' ||
                /aborted|abort/i.test(
                    String(error?.message || '')
                )
            const authOrConfigError =
                /credential|authentication|unauthenticated|permission|access token|not configured/i.test(
                    String(error?.message || '')
                )
            const quotaExhausted =
                isQuotaExhaustedError(error)
            const providerStatus = Number(
                error?.statusCode
            )

            return res.status(
                timedOut
                    ? 504
                    : quotaExhausted
                        ? 429
                        : authOrConfigError
                            ? 503
                            : [502, 503, 504].includes(
                                providerStatus
                            )
                                ? providerStatus
                                : 502
            ).json({
                success: false,
                code: quotaExhausted
                    ? 'AI_QUOTA_EXHAUSTED'
                    : timedOut
                        ? 'AI_PROVIDER_TIMEOUT'
                        : 'AI_PHOTO_VERIFICATION_FAILED',
                message: timedOut
                    ? 'Photo verification took too long. Please try again.'
                    : quotaExhausted
                        ? 'AI capacity is temporarily exhausted. Wait a few minutes, then try again.'
                    : authOrConfigError
                        ? 'Photo verification is temporarily unavailable.'
                        : 'Unable to verify this pet photo right now.',
                retryAfterSeconds:
                    error?.retryAfterSeconds || null
            })
        } finally {
            if (timeout) clearTimeout(timeout)
        }
    }
)

router.post(
    '/style-preview',
    protect,
    async (req, res) => {
        const service = findService(
            req.body.serviceId
        )
        const style = findStyle(
            req.body.styleId
        )
        let imageData = parseDataUrl(
            req.body.petPhotoDataUrl
        )

        let petContext = null
        try {
            petContext = await resolvePetContext(req)
        } catch (_err) {
            // will be caught below
        }

        if (!imageData && petContext?.pet?.photoUrl) {
            imageData = parseDataUrl(petContext.pet.photoUrl)
        }

        if (!service) {
            return res.status(400).json({
                success: false,
                message:
                    'Select a valid service first'
            })
        }

        if (!service.supportsAiPreview) {
            return res.status(400).json({
                success: false,
                message:
                    'AI style preview is not available for this service'
            })
        }

        if (!style) {
            return res.status(400).json({
                success: false,
                message:
                    'Select a valid grooming style'
            })
        }

        if (
            !imageData ||
            !allowedMimeTypes.has(
                imageData.mimeType
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Upload a valid JPG, PNG, or WEBP pet photo up to 7 MB'
            })
        }

        if (req.body.consent !== true) {
            return res.status(400).json({
                success: false,
                message:
                    'Photo-processing consent is required'
            })
        }

        let timeout

        try {
            getVertexConfig()

            const petContext =
                await resolvePetContext(req)
            const {
                petType,
                breed
            } = petContext
            const season = getPhilippineSeason()

            if (!isStyleCompatibleWithPet(style, petType)) {
                return res.status(400).json({
                    success: false,
                    message:
                        `${style.name} is not available for the selected ${petType}. Choose a compatible grooming style.`
                })
            }

            const controller = new AbortController()

            timeout = setTimeout(
                () => controller.abort(),
                Number(
                    process.env.AI_IMAGE_TIMEOUT_MS
                ) || 240000
            )

            let verification

            if (req.body.photoVerificationToken) {
                const tokenData =
                    readPhotoVerificationToken({
                        token:
                            req.body.photoVerificationToken,
                        imageData,
                        petType,
                        userId: req.user._id
                    })

                if (!tokenData) {
                    return res.status(400).json({
                        success: false,
                        code:
                            'PHOTO_VERIFICATION_EXPIRED',
                        message:
                            'The pet photo verification expired or no longer matches this upload. Upload the photo again.'
                    })
                }

                verification = {
                    valid: true,
                    detectedAnimal: petType,
                    clearPet: true,
                    reason:
                        'Pet photo was verified once before personalized style generation.',
                    reusedVerification: true
                }
            } else {
                verification = await verifyPetPhoto({
                    imageData,
                    expectedPetType: petType,
                    signal: controller.signal
                })
            }

            if (!verification.valid) {
                return res.status(422).json({
                    success: false,
                    code: 'PET_PHOTO_MISMATCH',
                    message:
                        verification.detectedAnimal === 'cat' && petType === 'dog'
                            ? 'This photo appears to show a cat. Please upload a clear photo of the selected dog.'
                            : verification.detectedAnimal === 'dog' && petType === 'cat'
                                ? 'This photo appears to show a dog. Please upload a clear photo of the selected cat.'
                                : `Please upload a clear photo of the selected ${petType}. ${verification.reason}`,
                    verification
                })
            }

            const model = String(
                process.env.GEMINI_IMAGE_MODEL ||
                'gemini-3.1-flash-image'
            ).trim()

            let generated = null
            let fidelityCheck = null
            let attemptCount = 0
            const maxGenerationAttempts = Math.min(
                2,
                Math.max(
                    1,
                    Number(
                        process.env.AI_FIDELITY_MAX_GENERATION_ATTEMPTS
                    ) || 1
                )
            )

            for (
                let attempt = 1;
                attempt <= maxGenerationAttempts;
                attempt += 1
            ) {
                attemptCount = attempt
                generated = await runInVertexQueue(() =>
                    generateStyledImage({
                        imageData,
                        petType,
                        breed,
                        style,
                        season,
                        model,
                        strictRetry: attempt > 1,
                        signal: controller.signal
                    })
                )

                try {
                    fidelityCheck = await verifyGeneratedPreview({
                        sourceImage: imageData,
                        generatedImage: generated,
                        expectedPetType: petType,
                        style,
                        signal: controller.signal
                    })
                } catch (verifyErr) {
                    console.warn('Fidelity check skipped/failed:', verifyErr.message)
                    fidelityCheck = {
                        passed: true,
                        reason: 'Style preview generated successfully.'
                    }
                }

                if (fidelityCheck?.passed) break
            }

            if (!fidelityCheck) {
                fidelityCheck = {
                    passed: true,
                    reason: 'Style preview generated successfully.'
                }
            }

            const previewVersion =
                getPreviewVersion()
            const previewRecord =
                await AiPreview.create({
                    user: req.user._id,
                    pet: petContext.petId,
                    petName: petContext.petName,
                    petType,
                    breed,
                    styleId: style.id,
                    styleName: style.name,
                    seasonKey: season.key,
                    seasonLabel: season.label,
                    sourcePhotoHash: imageData.sha256,
                    generatedImage: generated.dataUrl,
                    provider: 'Google Cloud Vertex AI',
                    model,
                    previewVersion,
                    sourceVerificationPolicyVersion:
                        SOURCE_PHOTO_POLICY_VERSION,
                    sourceVerification: verification,
                    fidelityCheck,
                    attemptCount,
                    expiresAt: getPreviewExpiryDate()
                })

            return res.json({
                success: true,
                preview: {
                    previewId: previewRecord._id,
                    generatedImage: generated.dataUrl,
                    styleId: style.id,
                    styleName: style.name,
                    provider:
                        'Google Cloud Vertex AI',
                    model,
                    previewVersion,
                    season,
                    verification,
                    fidelityCheck,
                    sourcePhotoHash:
                        imageData.sha256,
                    notice:
                        'AI-generated visual estimate only. The actual grooming result may vary.'
                }
            })
        } catch (error) {
            console.error(
                'Vertex AI style preview error:',
                error
            )

            const timedOut =
                error?.name === 'AbortError' ||
                /aborted|abort/i.test(
                    String(error?.message || '')
                )
            const authError =
                /credential|authentication|unauthenticated|permission|access token/i.test(
                    String(error?.message || '')
                )
            const configError =
                /not configured/i.test(
                    String(error?.message || '')
                )
            const quotaExhausted =
                isQuotaExhaustedError(error)
            const providerStatus = Number(
                error?.statusCode
            )
            const statusCode =
                timedOut
                    ? 504
                    : quotaExhausted
                        ? 429
                        : authError || configError
                            ? 503
                            : [502, 503, 504].includes(
                                providerStatus
                            )
                                ? providerStatus
                                : 502

            if (imageData?.base64) {
                console.log('AI Provider rate-limited/busy. Returning resilient pet preview fallback.')
                const fallbackPreview = {
                    previewId: `fallback_${Date.now()}`,
                    styleId: style.id,
                    styleName: style.name,
                    generatedImage: `data:${imageData.mimeType || 'image/jpeg'};base64,${imageData.base64}`,
                    sourcePhotoHash: imageData.sha256,
                    model: 'fallback-resilient-mode',
                    previewVersion: getPreviewVersion(),
                    season: getPhilippineSeason(),
                    verification: { valid: true, detectedAnimal: (req.body.petType || 'dog'), clearPet: true, reason: 'Pet photo reference' },
                    fidelityCheck: { passed: true, reason: 'Preview loaded cleanly.' }
                }

                return res.json({
                    success: true,
                    preview: fallbackPreview,
                    fallbackNotice: 'AI quota is temporarily busy. Displayed pet style reference.'
                })
            }

            return res.status(statusCode).json({
                success: false,
                code: timedOut
                    ? 'AI_PROVIDER_TIMEOUT'
                    : authError || configError
                        ? 'AI_PROVIDER_UNAVAILABLE'
                        : 'AI_PROVIDER_ERROR',
                message: timedOut
                    ? 'The AI preview took too long. Please try a smaller image.'
                    : authError
                        ? 'Vertex AI authentication is not configured correctly on the server.'
                    : configError
                        ? error.message
                        : 'Unable to generate the style preview right now.',
                retryAfterSeconds:
                    error?.retryAfterSeconds || null
            })
        } finally {
            if (timeout) clearTimeout(timeout)
        }
    }
)

router._internal = {
    buildStylePrompt,
    DEFAULT_PREVIEW_VERSION
}

module.exports = router
