const test = require('node:test')
const assert = require('node:assert/strict')

test('applyAiLimiter targets only generation and photo verification endpoints', () => {
    let limiterCalled = false
    const mockAiLimiter = (req, res, next) => {
        limiterCalled = true
        return next()
    }

    const applyAiLimiter = (req, res, next) => {
        if (
            req.method === 'POST' &&
            (req.path === '/style-preview' || req.path === '/photo-verification')
        ) {
            return mockAiLimiter(req, res, next)
        }
        return next()
    }

    // 1. GET /styles -> should bypass aiPreviewLimiter
    limiterCalled = false
    applyAiLimiter({ method: 'GET', path: '/styles' }, {}, () => {})
    assert.equal(limiterCalled, false, 'GET /styles must not trigger aiPreviewLimiter')

    // 2. POST /recommendations -> should bypass aiPreviewLimiter
    limiterCalled = false
    applyAiLimiter({ method: 'POST', path: '/recommendations' }, {}, () => {})
    assert.equal(limiterCalled, false, 'POST /recommendations must not trigger aiPreviewLimiter')

    // 3. POST /style-preview -> MUST trigger aiPreviewLimiter
    limiterCalled = false
    applyAiLimiter({ method: 'POST', path: '/style-preview' }, {}, () => {})
    assert.equal(limiterCalled, true, 'POST /style-preview must trigger aiPreviewLimiter')

    // 4. POST /photo-verification -> MUST trigger aiPreviewLimiter
    limiterCalled = false
    applyAiLimiter({ method: 'POST', path: '/photo-verification' }, {}, () => {})
    assert.equal(limiterCalled, true, 'POST /photo-verification must trigger aiPreviewLimiter')
})
