const test = require('node:test')
const assert = require('node:assert/strict')
const aiRouter = require('../routes/ai')

const { buildStylePrompt, DEFAULT_PREVIEW_VERSION } = aiRouter._internal

test('AI style prompt strictly enforces 1 picture only with no before-and-after or duplicate animals', () => {
    const mockStyle = {
        name: 'Puppy Cut',
        generationInstructions: 'Trim coat evenly all over to about 1 inch length, rounded teddy bear face.',
        verificationCriteria: 'Uniform short plush coat, round face shape.',
        coatSafety: 'Keep comfortable length.'
    }
    const mockSeason = { label: 'hot and dry season', key: 'dry' }

    const prompt = buildStylePrompt({
        petType: 'dog',
        breed: 'Shih Tzu',
        style: mockStyle,
        season: mockSeason,
        strictRetry: false
    })

    // Must NOT contain the ambiguous phrasing that triggers diptych / split generation
    assert.equal(
        prompt.includes('before-and-after'),
        false,
        'Prompt must not contain "before-and-after" which causes models to generate side-by-side comparisons'
    )

    // Must contain explicit single-subject composition rules
    assert.match(
        prompt,
        /CRITICAL COMPOSITION REQUIREMENT: Generate exactly ONE single photograph showing ONE single animal/i,
        'Prompt must explicitly require exactly 1 single photo of 1 single animal'
    )

    // Must forbid side-by-side, split-screen, diptych, collage, duplicate pets
    assert.match(
        prompt,
        /STRICT PROHIBITION: Do NOT create a side-by-side image, split screen, dual comparison panels, diptych, collage, dual-frame, montage, grid, twin animals, or duplicate pet/i,
        'Prompt must strictly forbid multi-panel or duplicate pet images'
    )

    // Strict retry mode must reinforce single subject requirement
    const retryPrompt = buildStylePrompt({
        petType: 'dog',
        breed: 'Shih Tzu',
        style: mockStyle,
        season: mockSeason,
        strictRetry: true
    })

    assert.match(
        retryPrompt,
        /CRITICAL RETRY: Output strictly 1 single picture of 1 single animal/i,
        'Retry prompt must reinforce 1 single picture requirement'
    )

    // Verify preview version is bumped
    assert.equal(DEFAULT_PREVIEW_VERSION, '2026-09-pet-single-subject-v1')
})
