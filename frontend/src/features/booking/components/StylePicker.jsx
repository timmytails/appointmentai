import { Fragment } from 'react'
import {
    Check,
    Image as ImageIcon,
    Loader2,
    RefreshCw,
    Sparkles
} from 'lucide-react'

const formatImageSrc = (src) => {
    if (!src) return ''
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
        return src
    }
    return `data:image/png;base64,${src}`
}

export default function StylePicker({
    styles = [],
    recommendations = [],
    stylePreviews = {},
    selectedStyleId,
    onSelect,
    onRetry,
    petType,
    photoReady,
    loading,
    generationBusy
}) {
    const normalizedPetType = String(petType || 'dog').toLowerCase()
    const petLabel = normalizedPetType === 'cat' ? 'cat' : 'dog'

    const recommendationsById = new Map(
        recommendations.map((item) => [item.id, item])
    )
    const stylesById = new Map(
        styles.map((style) => [style.id, style])
    )

    // Recommended styles: use backend recommendations if available, else derive top 3 styles
    let recommendedStyles = recommendations
        .map((item) => stylesById.get(item.id))
        .filter(Boolean)

    if (!recommendedStyles.length && styles.length) {
        // Fallback to top styles matching pet type
        const seasonalIds = ['natural-trim', 'puppy-cut', 'teddy-bear-cut', 'comb-cut', 'cat-sanitary-trim', 'cat-teddy-bear-trim']
        const matched = styles.filter((s) => seasonalIds.includes(s.id))
        recommendedStyles = matched.length >= 2 ? matched.slice(0, 3) : styles.slice(0, 3)
    }

    const recommendedIds = new Set(
        recommendedStyles.map((style) => style.id)
    )

    // All other catalog styles
    const moreStyles = styles
        .filter((style) => !recommendedIds.has(style.id))
        .sort((first, second) =>
            first.name.localeCompare(second.name)
        )

    const renderStyleCard = (style, index, isRecommended = false) => {
        const selected = selectedStyleId === style.id
        const recommendation = recommendationsById.get(style.id)
        const preview = stylePreviews[style.id] || { status: 'idle' }
        const ready = preview.status === 'ready' && preview.generatedImage
        const failed = preview.status === 'error'
        const canGenerate = photoReady && preview.status === 'idle' && !generationBusy

        // Badge rank
        const isTopSuggestion = isRecommended && (recommendation?.rank === 1 || index === 0)

        return (
            <Fragment key={style.id}>
                <button
                    type='button'
                    onClick={() => (ready ? onSelect(style.id) : onRetry(style.id))}
                    disabled={
                        (!ready && !failed && !canGenerate) ||
                        ((failed || canGenerate) && generationBusy)
                    }
                    aria-pressed={selected}
                    aria-label={
                        failed
                            ? `Retry ${style.name} preview`
                            : ready
                                ? `Select ${style.name}`
                                : canGenerate
                                    ? `Generate ${style.name} preview`
                                    : `${style.name} preview is not ready`
                    }
                    className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left align-top transition-all duration-300 transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6B57] focus-visible:ring-offset-2 disabled:cursor-wait ${
                        selected
                            ? 'border-[#2F6B57] bg-[#F2F7F4] ring-2 ring-[#2F6B57]/30 shadow-md -translate-y-1'
                            : 'border-[#E5DCD1] bg-[#FBF9F5] hover:-translate-y-1 hover:border-[#C88968] hover:shadow-md'
                    }`}
                >
                    {/* Card Media Area */}
                    <span className='relative block w-full shrink-0 overflow-hidden bg-[#F3EFEA]'>
                        {ready ? (
                            <img
                                src={formatImageSrc(preview.generatedImage)}
                                alt={`${style.name} generated on the uploaded pet`}
                                className='h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105'
                            />
                        ) : (
                            <span className='grid h-44 w-full place-items-center bg-[#F3EFEA] px-5 text-center text-[#6E5545]'>
                                {preview.status === 'generating' ? (
                                    <span role='status'>
                                        <Loader2 size={26} className='mx-auto mb-2 animate-spin text-[#2F6B57]' />
                                        <span className='text-xs font-semibold text-[#201711]'>Creating this style on your pet…</span>
                                    </span>
                                ) : failed ? (
                                    <span>
                                        <RefreshCw size={24} className='mx-auto mb-2 text-[#9E3E3E]' />
                                        <span className='text-xs font-semibold text-[#9E3E3E]'>
                                            {generationBusy
                                                ? 'Another preview is being created. Please wait.'
                                                : preview.error || 'Couldn’t create this style. Click to retry.'}
                                        </span>
                                    </span>
                                ) : (
                                    <span>
                                        <ImageIcon size={26} className='mx-auto mb-2 text-[#9E8575]' />
                                        <span className='text-xs font-semibold text-[#7A6455]'>
                                            {!photoReady
                                                ? 'Upload your pet’s photo first'
                                                : generationBusy
                                                    ? 'Available after current preview'
                                                    : 'Generate preview'}
                                        </span>
                                    </span>
                                )}
                            </span>
                        )}

                        {/* Top Badges */}
                        {isRecommended && (
                            <span className='absolute left-3 top-3 inline-flex items-center rounded-full bg-[#1A1613]/90 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm'>
                                {isTopSuggestion ? 'TOP SUGGESTION' : 'SUGGESTION'}
                            </span>
                        )}

                        {/* Your Pet Badge */}
                        {ready && (
                            <span className='absolute bottom-3 right-3 rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-bold text-[#201711] shadow-sm'>
                                Your pet
                            </span>
                        )}
                    </span>

                    {/* Card Content Area */}
                    <span className='flex w-full flex-1 flex-col justify-between p-4 bg-white'>
                        <div>
                            <span className='flex items-start justify-between gap-2'>
                                <span className='font-serif text-lg font-bold text-[#201711]'>{style.name}</span>
                                {selected && (
                                    <span className='inline-flex shrink-0 items-center gap-1 rounded-full bg-[#2F6B57] px-2 py-0.5 text-[10px] font-bold text-white'>
                                        <Check size={11} />SELECTED
                                    </span>
                                )}
                            </span>
                            <span className='mt-1 block text-xs leading-5 text-[#6E5545]'>{style.description}</span>
                        </div>

                        {(recommendation?.reason || style.seasonReasons?.['wet-rainy'] || style.seasonReasons?.['hot-dry']) && (
                            <span className='mt-3 block border-t border-[#EDE5DA] pt-2 text-[11px] leading-relaxed text-[#7A6455]'>
                                {recommendation?.reason || style.seasonReasons?.['wet-rainy'] || style.seasonReasons?.['hot-dry']}
                            </span>
                        )}
                    </span>
                </button>

                {selected && ready && (
                    <div className='col-span-full overflow-hidden rounded-2xl border border-[#E5DCD1] bg-white xl:hidden'>
                        <div className='flex items-center justify-between gap-3 border-b border-[#E5DCD1] px-4 py-3'>
                            <div>
                                <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-[#2F6B57]'>Selected preview</p>
                                <p className='font-serif text-lg font-bold text-[#201711]'>{style.name}</p>
                            </div>
                            <span className='grid h-8 w-8 place-items-center rounded-full bg-[#F3EFEA] text-[#201711]'>
                                <Check size={16} />
                            </span>
                        </div>
                        <img
                            src={formatImageSrc(preview.generatedImage)}
                            alt={`Selected ${style.name} preview on the uploaded pet`}
                            className='max-h-[28rem] w-full object-contain'
                        />
                    </div>
                )}
            </Fragment>
        )
    }

    return (
        <div className='space-y-8'>
            <div>
                <h3 className='font-serif text-2xl font-bold text-[#201711]'>Choose your pet’s style</h3>
                <p className='mt-1 text-sm text-[#6E5545]'>Recommended images are created first. Every displayed style is suitable for the selected {petLabel}.</p>
                {loading && (
                    <p className='mt-2 text-xs font-semibold text-[#2F6B57]' role='status'>Preparing style choices…</p>
                )}
            </div>

            {styles.length ? (
                <>
                    {/* SECTION 1: Recommended for this season */}
                    {recommendedStyles.length > 0 && (
                        <section className='space-y-3.5'>
                            <div className='flex items-start gap-2.5'>
                                <span className='mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#2F6B57] text-white'>
                                    <Sparkles size={14} />
                                </span>
                                <div>
                                    <h4 className='font-serif text-lg font-bold text-[#201711]'>Recommended for this season</h4>
                                    <p className='text-xs text-[#6E5545]'>These personalized previews are generated first using your uploaded pet photo.</p>
                                </div>
                            </div>

                            <div className='grid items-stretch gap-4 sm:grid-cols-2'>
                                {recommendedStyles.map((style, index) => renderStyleCard(style, index, true))}
                            </div>
                        </section>
                    )}

                    {/* SECTION 2: More styles for your pet */}
                    {moreStyles.length > 0 && (
                        <section className='space-y-3.5 pt-4'>
                            <div>
                                <h4 className='font-serif text-lg font-bold text-[#201711]'>More styles for your {petLabel}</h4>
                                <p className='text-xs text-[#6E5545]'>Select any compatible style to generate its personalized preview on demand.</p>
                            </div>

                            <div className='grid items-stretch gap-4 sm:grid-cols-2'>
                                {moreStyles.map((style, index) => renderStyleCard(style, index, false))}
                            </div>
                        </section>
                    )}
                </>
            ) : (
                <div className='rounded-2xl border border-[#E5DCD1] bg-white p-6 text-sm text-[#6E5545]'>
                    No compatible styles are available for this pet.
                </div>
            )}
        </div>
    )
}
