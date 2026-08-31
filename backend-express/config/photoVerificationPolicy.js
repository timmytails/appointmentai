const SOURCE_PHOTO_POLICY_VERSION =
    'breed-species-v5-strict-check'

const MIN_SPECIES_CONFIDENCE = 0.75
const MAX_PHOTO_VERIFICATION_TIMEOUT_MS = 30000
const MIN_PHOTO_VERIFICATION_TIMEOUT_MS = 10000
const MAX_SOURCE_MODEL_TIMEOUT_MS = 15000
const MIN_SOURCE_MODEL_TIMEOUT_MS = 5000

const supportedAnimals = new Set([
    'dog',
    'cat',
    'other',
    'unclear'
])

const buildPetPhotoClassificationPrompt = ({
    expectedPetType = '',
    expectedBreed = ''
} = {}) => [
    'You are an expert animal species and pet breed verifier for a salon AI styling system.',
    'Carefully inspect the main animal in the uploaded photo:',
    '1. Identify whether the animal is a dog, cat, other animal, or unclear.',
    '2. Identify the specific breed or breed appearance of the pet.',
    expectedPetType
        ? `3. Expected pet type: "${expectedPetType}"${expectedBreed ? ` with breed: "${expectedBreed}"` : ''}. Check if the photo is a matching animal and compatible with this breed.`
        : '',
    '4. Set clearPet to true if there is a single, clear, recognizable pet subject; set false if blurry, heavily obscured, or multiple pets.',
    '5. Set breedMatch to true if the pet in the photo matches or is reasonably consistent with the expected breed (or mixed-breed containing similar characteristics). Set breedMatch to false if the animal is visibly a completely different breed (e.g. a Labrador/Retriever/Bulldog when Shih Tzu was entered, or a Persian cat when Siamese was entered).',
    '6. In reason, provide a concise explanation. If there is a mismatch, state what was detected vs what was expected.'
].filter(Boolean).join(' ')

const normalizePetPhotoClassification = ({
    classification,
    expectedPetType,
    expectedBreed = '',
    model
}) => {
    const normalizedExpectedType = String(
        expectedPetType || ''
    ).trim().toLowerCase()
    const normalizedExpectedBreed = String(
        expectedBreed || ''
    ).trim()
    const proposedAnimal = String(
        classification?.detectedAnimal || ''
    ).trim().toLowerCase()
    const detectedAnimal = supportedAnimals.has(proposedAnimal)
        ? proposedAnimal
        : 'unclear'
    const detectedBreed = String(
        classification?.detectedBreed || ''
    ).trim()
    const proposedConfidence = Number(classification?.confidence)
    const confidence = Number.isFinite(proposedConfidence)
        ? Math.min(1, Math.max(0, proposedConfidence))
        : 0
    const clearPet = classification?.clearPet === true
    const breedMatch = classification?.breedMatch !== false

    const speciesMatch = detectedAnimal === normalizedExpectedType
    const valid = Boolean(
        ['dog', 'cat'].includes(normalizedExpectedType) &&
        clearPet &&
        confidence >= MIN_SPECIES_CONFIDENCE &&
        speciesMatch &&
        breedMatch
    )

    let reason = String(classification?.reason || '').slice(0, 300)
    if (!valid && !reason) {
        if (!speciesMatch) {
            reason = `This photo appears to show a ${detectedAnimal}, but the selected pet is a ${normalizedExpectedType}.`
        } else if (!breedMatch) {
            reason = `This photo appears to show a ${detectedBreed || 'different breed'}, which does not match the selected ${normalizedExpectedBreed || normalizedExpectedType}.`
        } else if (!clearPet) {
            reason = 'Please upload a clear, focused photo of a single pet.'
        } else {
            reason = `The uploaded image does not clearly match the selected ${normalizedExpectedType}.`
        }
    }

    return {
        valid,
        detectedAnimal,
        detectedBreed,
        breedMatch,
        clearPet,
        confidence,
        reason,
        model,
        policyVersion: SOURCE_PHOTO_POLICY_VERSION
    }
}

const normalizePhotoVerificationTimeout = (value) => {
    const proposed = Number(value)
    const timeout = Number.isFinite(proposed) && proposed > 0
        ? proposed
        : MAX_PHOTO_VERIFICATION_TIMEOUT_MS

    return Math.min(
        MAX_PHOTO_VERIFICATION_TIMEOUT_MS,
        Math.max(MIN_PHOTO_VERIFICATION_TIMEOUT_MS, timeout)
    )
}

const normalizeSourceModelTimeout = (value) => {
    const proposed = Number(value)
    const timeout = Number.isFinite(proposed) && proposed > 0
        ? proposed
        : 12000

    return Math.min(
        MAX_SOURCE_MODEL_TIMEOUT_MS,
        Math.max(MIN_SOURCE_MODEL_TIMEOUT_MS, timeout)
    )
}

const getSourceVerificationModels = ({
    primary,
    fallback
} = {}) => Array.from(new Set([
    String(primary || 'gemini-2.5-flash-lite').trim(),
    String(fallback || 'gemini-2.5-flash').trim()
].filter(Boolean)))

module.exports = {
    SOURCE_PHOTO_POLICY_VERSION,
    MIN_SPECIES_CONFIDENCE,
    buildPetPhotoClassificationPrompt,
    getSourceVerificationModels,
    normalizePetPhotoClassification,
    normalizePhotoVerificationTimeout,
    normalizeSourceModelTimeout
}
