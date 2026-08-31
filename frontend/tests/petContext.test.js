import test from 'node:test'
import assert from 'node:assert/strict'

import {
    getActivePetId
} from '../src/features/booking/utils/petContext.js'

test('uses the selected database pet only in Saved Pet mode', () => {
    const savedDog = {
        _id: 'saved-dog-id',
        type: 'dog'
    }

    assert.equal(
        getActivePetId('existing', savedDog),
        'saved-dog-id'
    )
})

test('does not leak a saved dog ID into a new cat request', () => {
    const savedDog = {
        _id: 'saved-dog-id',
        type: 'dog'
    }

    assert.equal(
        getActivePetId('new', savedDog),
        null
    )
})
