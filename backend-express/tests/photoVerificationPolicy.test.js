const test = require('node:test')
const assert = require('node:assert/strict')

const {
    SOURCE_PHOTO_POLICY_VERSION,
    MIN_SPECIES_CONFIDENCE,
    buildPetPhotoClassificationPrompt,
    getSourceVerificationModels,
    normalizePetPhotoClassification,
    normalizePhotoVerificationTimeout,
    normalizeSourceModelTimeout
} = require('../config/photoVerificationPolicy')

test('classifies the image without revealing the selected profile species when no pet is specified', () => {
    const prompt = buildPetPhotoClassificationPrompt()

    assert.equal(
        prompt.includes('The registered pet type is'),
        false
    )
    assert.equal(
        prompt.includes('expert animal species and pet breed verifier'),
        true
    )
})

test('rejects a clear dog photo when the selected profile is a cat', () => {
    const result = normalizePetPhotoClassification({
        classification: {
            detectedAnimal: 'dog',
            clearPet: true,
            confidence: 0.99,
            reason: 'The main animal has visible canine features.'
        },
        expectedPetType: 'cat',
        model: 'test-model'
    })

    assert.equal(result.valid, false)
    assert.equal(result.detectedAnimal, 'dog')
    assert.equal(
        result.policyVersion,
        SOURCE_PHOTO_POLICY_VERSION
    )
})

test('accepts only a clear high-confidence species match', () => {
    const accepted = normalizePetPhotoClassification({
        classification: {
            detectedAnimal: 'cat',
            clearPet: true,
            confidence: 0.98
        },
        expectedPetType: 'cat',
        model: 'test-model'
    })
    const uncertain = normalizePetPhotoClassification({
        classification: {
            detectedAnimal: 'cat',
            clearPet: true,
            confidence:
                MIN_SPECIES_CONFIDENCE - 0.01
        },
        expectedPetType: 'cat',
        model: 'test-model'
    })

    assert.equal(accepted.valid, true)
    assert.equal(uncertain.valid, false)
})

test('caps photo verification at 30 seconds', () => {
    assert.equal(
        normalizePhotoVerificationTimeout(90000),
        30000
    )
    assert.equal(
        normalizePhotoVerificationTimeout(30000),
        30000
    )
})

test('uses fast and stable source-verification models independently of the legacy vision setting', () => {
    assert.deepEqual(
        getSourceVerificationModels(),
        [
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash'
        ]
    )
    assert.equal(normalizeSourceModelTimeout(60000), 15000)
})
