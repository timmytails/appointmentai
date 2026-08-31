const test = require('node:test')
const assert = require('node:assert/strict')

const {
    buildStatusUpdate,
    normalizeAccountStatus,
    persistAccountStatus
} = require('../services/accountStatus')

test('buildStatusUpdate clears enforcement text when restoring active', () => {
    const update = buildStatusUpdate({
        accountStatus: 'active',
        statusReason: 'old reason',
        warningMessage: 'old warning'
    })

    assert.equal(update.accountStatus, 'active')
    assert.equal(update.statusReason, '')
    assert.equal(update.warningMessage, '')
    assert.ok(update.statusUpdatedAt instanceof Date)
})

test('persistAccountStatus commits banned state and returns the persisted record', async () => {
    const store = {
        _id: 'customer-1',
        accountStatus: 'active',
        statusReason: '',
        warningMessage: ''
    }

    const FakeUser = {
        async findByIdAndUpdate(id, update, options) {
            assert.equal(id, 'customer-1')
            assert.equal(options.new, true)
            assert.equal(options.runValidators, true)
            Object.assign(store, update.$set)
            return { ...store }
        }
    }

    const persisted = await persistAccountStatus(FakeUser, 'customer-1', {
        accountStatus: 'banned',
        statusReason: 'Repeated policy violations'
    })

    assert.equal(store.accountStatus, 'banned')
    assert.equal(store.statusReason, 'Repeated policy violations')
    assert.equal(persisted.accountStatus, 'banned')
    assert.equal(normalizeAccountStatus(persisted.accountStatus), 'banned')
})

test('persistAccountStatus rejects invalid states before a database write', async () => {
    let called = false
    const FakeUser = {
        async findByIdAndUpdate() {
            called = true
            return null
        }
    }

    await assert.rejects(
        persistAccountStatus(FakeUser, 'customer-1', { accountStatus: 'disabled' }),
        /Invalid account status option/
    )
    assert.equal(called, false)
})
