import test from 'node:test'
import assert from 'node:assert/strict'

import {
    getAutomaticPreviewStyles,
    getNextFailedStyleId
} from '../src/features/booking/utils/galleryPolicy.js'

const styles = [
    { id: 'comb-cut' },
    { id: 'natural-trim' },
    { id: 'lion-cut' },
    { id: 'teddy-bear-trim' }
]

test('automatically generates only the top seasonal suggestion', () => {
    const result = getAutomaticPreviewStyles({
        stylesToGenerate: styles,
        recommendations: [
            { id: 'comb-cut', rank: 1 },
            { id: 'natural-trim', rank: 2 }
        ]
    })

    assert.deepEqual(result, [styles[0]])
})

test('manual generation runs only the explicitly requested styles', () => {
    const requestedStyles = [styles[2]]
    const result = getAutomaticPreviewStyles({
        stylesToGenerate: requestedStyles,
        recommendations: [],
        manualRequest: true
    })

    assert.deepEqual(result, requestedStyles)
})

test('does not regenerate another style when the top suggestion is cached', () => {
    const result = getAutomaticPreviewStyles({
        stylesToGenerate: styles.slice(1),
        recommendations: [
            { id: 'comb-cut', rank: 1 },
            { id: 'natural-trim', rank: 2 }
        ]
    })

    assert.deepEqual(result, [])
})

test('global retry selects only one failed style and prefers the top suggestion', () => {
    const result = getNextFailedStyleId({
        stylePreviews: {
            'natural-trim': { status: 'error' },
            'comb-cut': { status: 'error' },
            'lion-cut': { status: 'error' }
        },
        recommendations: [
            { id: 'comb-cut', rank: 1 },
            { id: 'natural-trim', rank: 2 }
        ]
    })

    assert.equal(result, 'comb-cut')
})
