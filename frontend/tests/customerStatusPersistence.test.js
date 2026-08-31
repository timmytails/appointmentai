import test from 'node:test'
import assert from 'node:assert/strict'

import {
    getAccountStatusLabel,
    mergePersistedCustomerStatus,
    normalizeAccountStatus
} from '../src/utils/customerStatus.js'

test('persisted banned API response survives the UI merge used after admin updates', () => {
    const current = {
        _id: 'customer-1',
        firstName: 'Sample',
        accountStatus: 'active'
    }

    const apiResponse = {
        _id: 'customer-1',
        accountStatus: 'banned',
        statusReason: 'Repeated policy violations',
        statusUpdatedAt: '2026-08-27T12:00:00.000Z'
    }

    const rendered = mergePersistedCustomerStatus(current, apiResponse)

    assert.equal(rendered.accountStatus, 'banned')
    assert.equal(getAccountStatusLabel(rendered.accountStatus), 'Banned')
    assert.equal(rendered.statusReason, 'Repeated policy violations')
})

test('refresh data renders persisted banned status without notification inference', () => {
    const refreshedApiCustomer = { accountStatus: 'banned' }
    assert.equal(normalizeAccountStatus(refreshedApiCustomer.accountStatus), 'banned')
    assert.equal(getAccountStatusLabel(refreshedApiCustomer.accountStatus), 'Banned')
})
