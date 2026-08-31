const test = require('node:test')
const assert = require('node:assert/strict')

const {
    getPhilippineSeason,
    normalizeSeasonKey
} = require('../config/philippineSeason')

const dateInMonth = (monthIndex) =>
    new Date(Date.UTC(2026, monthIndex, 15, 4, 0, 0))

test('classifies March through May as hot and dry', () => {
    for (const month of [2, 3, 4]) {
        assert.equal(
            getPhilippineSeason(dateInMonth(month)).key,
            'hot-dry'
        )
    }
})

test('classifies June through November as wet and rainy', () => {
    for (const month of [5, 6, 7, 8, 9, 10]) {
        assert.equal(
            getPhilippineSeason(dateInMonth(month)).key,
            'wet-rainy'
        )
    }
})

test('classifies December through February as cool and dry', () => {
    for (const month of [11, 0, 1]) {
        assert.equal(
            getPhilippineSeason(dateInMonth(month)).key,
            'cool-dry'
        )
    }
})

test('normalizes legacy season values', () => {
    assert.equal(normalizeSeasonKey('rainy'), 'wet-rainy')
    assert.equal(normalizeSeasonKey('summer'), 'hot-dry')
    assert.equal(normalizeSeasonKey('cool dry'), 'cool-dry')
})
