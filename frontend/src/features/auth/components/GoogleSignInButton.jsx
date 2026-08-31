import {
    useEffect,
    useRef
} from 'react'

const SCRIPT_ID =
    'google-identity-services'

const loadGoogleScript = () =>
    new Promise((resolve, reject) => {
        if (window.google?.accounts?.id) {
            resolve()
            return
        }

        const existing =
            document.getElementById(
                SCRIPT_ID
            )

        if (existing) {
            existing.addEventListener(
                'load',
                resolve,
                { once: true }
            )

            existing.addEventListener(
                'error',
                reject,
                { once: true }
            )

            return
        }

        const script =
            document.createElement('script')

        script.id = SCRIPT_ID
        script.src =
            'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = resolve
        script.onerror = reject

        document.head.appendChild(script)
    })

export default function GoogleSignInButton({
    onCredential,
    disabled = false,
    text = 'continue_with'
}) {
    const containerRef = useRef(null)
    const wrapperRef = useRef(null)
    const lastWidthRef = useRef(0)

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

    useEffect(() => {
        if (!clientId) {
            return undefined
        }

        let active = true
        let resizeObserver

        const renderGoogleButton = () => {
            if (
                !active ||
                !containerRef.current ||
                !wrapperRef.current ||
                !window.google?.accounts?.id
            ) {
                return
            }

            const availableWidth =
                wrapperRef.current.getBoundingClientRect().width

            const buttonWidth = Math.floor(
                Math.min(400, Math.max(220, availableWidth || 400))
            )

            // Prevent infinite ResizeObserver loop if width hasn't changed
            if (lastWidthRef.current === buttonWidth && containerRef.current.hasChildNodes()) {
                return
            }

            lastWidthRef.current = buttonWidth
            containerRef.current.innerHTML = ''

            window.google.accounts.id.renderButton(
                containerRef.current,
                {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    text,
                    shape: 'pill',
                    logo_alignment: 'left',
                    width: buttonWidth
                }
            )
        }

        loadGoogleScript()
            .then(() => {
                if (!active || !containerRef.current) {
                    return
                }

                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: (response) => {
                        if (response?.credential && !disabled) {
                            onCredential(response.credential)
                        }
                    },
                    ux_mode: 'popup'
                })

                renderGoogleButton()

                if (typeof ResizeObserver !== 'undefined' && wrapperRef.current) {
                    resizeObserver = new ResizeObserver(renderGoogleButton)
                    resizeObserver.observe(wrapperRef.current)
                }
            })
            .catch(() => {
                if (containerRef.current) {
                    containerRef.current.innerHTML = ''
                }
            })

        return () => {
            active = false
            resizeObserver?.disconnect()
        }
    }, [clientId, disabled, onCredential, text])

    if (!clientId) {
        return (
            <div className='w-full rounded-xl border border-dashed border-[#F6F7F2] bg-[#F6F7F2] px-4 py-3 text-center text-xs text-[#2F6B57]'>
                Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in.
            </div>
        )
    }

    return (
        <div
            ref={wrapperRef}
            className={
                disabled
                    ? 'flex h-11 w-full items-center justify-center overflow-hidden rounded-full opacity-60 pointer-events-none'
                    : 'flex h-11 w-full items-center justify-center overflow-hidden rounded-full'
            }
        >
            <div
                ref={containerRef}
                className='flex w-full items-center justify-center'
            />
        </div>
    )
}

