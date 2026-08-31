const DB_NAME = 'timmytails-ai-preview-cache'
const DB_VERSION = 1
const STORE_NAME = 'previews'
export const SOURCE_PHOTO_POLICY_VERSION =
    'breed-species-v5-strict-check'

const CACHE_VERSION = 'v8-breed-verified-cache'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const openDatabase = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this browser'))
        return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
})

export const hashFile = async (file) => {
    const bytes = await file.arrayBuffer()
    const hash = await crypto.subtle.digest('SHA-256', bytes)

    return Array.from(new Uint8Array(hash))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
}

export const createPreviewCacheKey = ({
    photoHash,
    petType,
    breed,
    styleId,
    seasonKey,
    previewVersion
}) => [
    CACHE_VERSION,
    String(previewVersion || 'default'),
    photoHash,
    String(petType || '').toLowerCase(),
    String(breed || '').trim().toLowerCase(),
    styleId,
    String(seasonKey || '')
].join(':')

export const getCachedPreview = async (key) => {
    if (!key) return null

    try {
        const db = await openDatabase()

        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly')
            const request = transaction.objectStore(STORE_NAME).get(key)

            request.onsuccess = () => {
                const result = request.result || null

                if (
                    result?.cachedAt &&
                    Date.now() - result.cachedAt > CACHE_TTL_MS
                ) {
                    resolve(null)
                    return
                }

                if (result?.generatedImage && typeof result.generatedImage === 'string' && !result.generatedImage.startsWith('data:') && !result.generatedImage.startsWith('http') && !result.generatedImage.startsWith('/')) {
                    result.generatedImage = `data:image/jpeg;base64,${result.generatedImage}`
                }

                resolve(result)
            }
            request.onerror = () => reject(request.error)
            transaction.oncomplete = () => db.close()
        })
    } catch {
        return null
    }
}

export const saveCachedPreview = async (entry) => {
    if (!entry?.key || !entry?.generatedImage) return

    try {
        const db = await openDatabase()

        await new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            transaction.objectStore(STORE_NAME).put({
                ...entry,
                cachedAt: Date.now()
            })

            transaction.oncomplete = resolve
            transaction.onerror = () => reject(transaction.error)
        })

        db.close()
    } catch {
        // Cache failure must never block booking or AI generation.
    }
}
