const isSafeInternalPath = (path) => (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//')
)

export const rememberReturnTo = (path) => {
    if (isSafeInternalPath(path)) {
        sessionStorage.setItem('postLoginReturnTo', path)
    }
}

export const consumeReturnTo = () => {
    const path = sessionStorage.getItem('postLoginReturnTo')
    sessionStorage.removeItem('postLoginReturnTo')
    return isSafeInternalPath(path) ? path : ''
}

export const peekReturnTo = () => {
    const path = sessionStorage.getItem('postLoginReturnTo')
    return isSafeInternalPath(path) ? path : ''
}

export const resolvePostLoginRoute = ({ user, returnTo = '' }) => {
    if (user?.role === 'admin') return '/admin'
    if (!user?.profileCompleted) return '/complete-profile'
    if (isSafeInternalPath(returnTo)) return returnTo
    return '/dashboard'
}
