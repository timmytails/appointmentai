const test = require('node:test')
const assert = require('node:assert/strict')

const {
    STYLE_OPTIONS,
    findStyle,
    getStylesForPetType,
    getStyleRecommendations,
    isStyleCompatibleWithPet,
    toPublicStyle
} = require('../config/services')

test('defines a distinct generation and verification target for every style', () => {
    STYLE_OPTIONS.forEach((style) => {
        assert.equal(
            typeof style.generationInstructions,
            'string'
        )
        assert.equal(
            style.generationInstructions.length > 40,
            true
        )
        assert.equal(
            typeof style.verificationCriteria,
            'string'
        )
        assert.equal(
            style.verificationCriteria.length > 40,
            true
        )
    })

    assert.notEqual(
        findStyle('puppy-cut').verificationCriteria,
        findStyle('natural-trim').verificationCriteria
    )
})

test('keeps internal AI instructions out of the public style catalog', () => {
    const publicStyle = toPublicStyle(
        findStyle('puppy-cut')
    )

    assert.equal(
        Object.hasOwn(
            publicStyle,
            'generationInstructions'
        ),
        false
    )
    assert.equal(
        Object.hasOwn(
            publicStyle,
            'verificationCriteria'
        ),
        false
    )
    assert.equal(
        Object.hasOwn(
            publicStyle,
            'seasonReasons'
        ),
        false
    )
})

test('keeps dog-only styles away from cats', () => {
    const catStyleIds = getStylesForPetType('cat').map((style) => style.id)

    assert.deepEqual(catStyleIds.sort(), [
        'cat-sanitary-trim',
        'cat-teddy-bear-trim',
        'comb-cut',
        'lion-cut'
    ])
    assert.equal(isStyleCompatibleWithPet(findStyle('puppy-cut'), 'cat'), false)
    assert.equal(isStyleCompatibleWithPet(findStyle('natural-trim'), 'cat'), false)
})

test('makes every cat clip style cat-only', () => {
    const catClipStyleIds = [
        'lion-cut',
        'comb-cut',
        'cat-teddy-bear-trim',
        'cat-sanitary-trim'
    ]

    catClipStyleIds.forEach((styleId) => {
        const style = findStyle(styleId)

        assert.equal(
            isStyleCompatibleWithPet(style, 'cat'),
            true
        )
        assert.equal(
            isStyleCompatibleWithPet(style, 'dog'),
            false
        )
    })
})

test('ranks Summer Cut first for a non-double-coated dog in hot months', () => {
    const recommendations = getStyleRecommendations({
        petType: 'dog',
        coatType: 'short',
        season: 'hot-dry'
    })

    assert.equal(recommendations[0].id, 'summer-cut')
    assert.equal(recommendations[0].rank, 1)
})

test('keeps Summer Cut selectable but suggests it only in hot months', () => {
    const hotRecommendations = getStyleRecommendations({
        petType: 'dog',
        coatType: 'medium',
        season: 'hot-dry'
    }).map((style) => style.id)
    const wetRecommendations = getStyleRecommendations({
        petType: 'dog',
        coatType: 'medium',
        season: 'wet-rainy'
    }).map((style) => style.id)
    const coolRecommendations = getStyleRecommendations({
        petType: 'dog',
        coatType: 'medium',
        season: 'cool-dry'
    }).map((style) => style.id)

    assert.equal(hotRecommendations.includes('summer-cut'), true)
    assert.equal(wetRecommendations.includes('summer-cut'), false)
    assert.equal(coolRecommendations.includes('summer-cut'), false)
})

test('uses rainy-season recommendations for dogs', () => {
    const recommendations = getStyleRecommendations({
        petType: 'dog',
        coatType: 'long',
        season: 'wet-rainy'
    }).map((style) => style.id)

    assert.deepEqual(recommendations, [
        'natural-trim',
        'puppy-cut',
        'teddy-bear-cut'
    ])
})

test('uses cool-season recommendations for dogs', () => {
    const recommendations = getStyleRecommendations({
        petType: 'dog',
        coatType: 'curly',
        season: 'cool-dry'
    }).map((style) => style.id)

    assert.deepEqual(recommendations, [
        'natural-trim',
        'teddy-bear-cut',
        'asian-fusion-cut'
    ])
})

test('changes cat recommendations by season', () => {
    const hotRecommendations =
        getStyleRecommendations({
            petType: 'cat',
            coatType: 'long',
            season: 'hot-dry'
        }).map((style) => style.id)
    const wetRecommendations =
        getStyleRecommendations({
            petType: 'cat',
            coatType: 'long',
            season: 'wet-rainy'
        }).map((style) => style.id)
    const coolRecommendations =
        getStyleRecommendations({
            petType: 'cat',
            coatType: 'long',
            season: 'cool-dry'
        }).map((style) => style.id)

    assert.deepEqual(hotRecommendations, [
        'lion-cut',
        'comb-cut',
        'cat-sanitary-trim'
    ])
    assert.deepEqual(wetRecommendations, [
        'cat-sanitary-trim',
        'comb-cut'
    ])
    assert.deepEqual(coolRecommendations, [
        'cat-teddy-bear-trim',
        'cat-sanitary-trim'
    ])
})

test('does not suggest clip-heavy styles for a short-haired cat', () => {
    const seasons = [
        'hot-dry',
        'wet-rainy',
        'cool-dry'
    ]

    seasons.forEach((season) => {
        const recommendationIds =
            getStyleRecommendations({
                petType: 'cat',
                coatType: 'short',
                season
            }).map((style) => style.id)

        assert.deepEqual(recommendationIds, [
            'cat-sanitary-trim'
        ])
    })
})

test('does not prioritize aggressive short cuts for a double coat', () => {
    const recommendations = getStyleRecommendations({
        petType: 'dog',
        coatType: 'double coat',
        season: 'hot-dry'
    })

    assert.equal(recommendations[0].id, 'natural-trim')
    assert.equal(recommendations.some((style) => style.id === 'summer-cut'), false)
})
