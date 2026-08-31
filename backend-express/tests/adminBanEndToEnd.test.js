const test = require('node:test')
const assert = require('node:assert/strict')

const {
    persistAccountStatus,
    toAccountStatusResponse
} = require('../services/accountStatus')

test('ban survives database commit -> API response -> UI refresh/render contract', async () => {
    const database = {
        _id: 'customer-42',
        firstName: 'Taylor',
        lastName: 'Petowner',
        accountStatus: 'active',
        statusReason: '',
        warningMessage: ''
    }

    const FakeUser = {
        async findByIdAndUpdate(_id, update) {
            Object.assign(database, update.$set)
            return { ...database }
        }
    }

    // 1. Database write used by PATCH /api/admin/users/:id/status.
    const persisted = await persistAccountStatus(FakeUser, database._id, {
        accountStatus: 'banned',
        statusReason: 'Repeated policy violations'
    })
    assert.equal(database.accountStatus, 'banned')

    // 2. API response serialization used by the PATCH response.
    const apiUser = toAccountStatusResponse(persisted)
    assert.equal(apiUser.accountStatus, 'banned')

    // 3. Front-end merge + badge label used after the PATCH and again after refresh.
    const { mergePersistedCustomerStatus, getAccountStatusLabel } = await import('../../frontend/src/utils/customerStatus.js')
    const renderedCustomer = mergePersistedCustomerStatus({ _id: database._id, accountStatus: 'active' }, apiUser)

    assert.equal(renderedCustomer.accountStatus, 'banned')
    assert.equal(getAccountStatusLabel(renderedCustomer.accountStatus), 'Banned')
})
