import { Fragment } from 'react'
import {
    Check,
    CloudRain,
    Image as ImageIcon,
    Loader2,
    RefreshCw,
    Scissors,
    SunMedium,
    Wind
} from 'lucide-react'

const formatImageSrc = (src) => {
    if (!src) return ''
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
        return src
    }
    return `data:image/png;base64,${src}`
}

export default function StylePicker({
    styles,
    recommendations,
    stylePreviews,
    selectedStyleId,
    onSelect,
    onRetry,
    petType,
    breed,
    season,
    photoReady,
    loading,
    generationBusy
}) {
    const normalizedPetType = String(petType || 'dog').toLowerCase()
    const currentSeasonKey = season?.key || 'wet-rainy'
    const currentSeasonLabel = season?.label || 'Wet and rainy season'

    const SeasonIcon = currentSeasonKey === 'hot-dry'
        ? SunMedium
        : currentSeasonKey === 'wet-rainy'
            ? CloudRain
            : Wind

    const recommendationsById = new Map(
        recommendations.map((item) => [item.id, item])
    )
    const stylesById = new Map(
        styles.map((style) => [style.id, style])
    )

    // 1. If backend recommendations exist, use them
    let recommendedStyles = recommendations
        .map((item) => stylesById.get(item.id))
        .filter(Boolean)

    // 2. If recommendations from backend is empty (e.g. initial load or network),
    // always fall back to styles that are marked for the current season!
    if (!recommendedStyles.length && styles.length) {
        recommendedStyles = styles.filter((style) =>
            Array.isArray(style.recommendedSeasons) &&
            style.recommendedSeasons.includes(currentSeasonKey)
        )
    }

    const recommendedIds = new Set(
        recommendedStyles.map((style) => style.id)
    )

    // 3. Other available styles for this pet type
    const moreStyles = styles
        .filter((style) => !recommendedIds.has(style.id))
        .sort((first, second) =>
            first.name.localeCompare(second.name)
        )

    const renderStyleGroup = ({
        title,
        badge,
        description,
        groupStyles,
        recommended = false
    }) => {
        if (!groupStyles.length) return null

        return (
            <section className='space-y-4'>
                <div className='flex items-start justify-between gap-3 border-b border-[#DDE4DE]/80 pb-3'>
                    <div className='flex items-start gap-3'>
                        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${recommended ? 'bg-[#EDF3EE] text-[#1F4D3E] border-[#2F6B57]/30' : 'bg-white text-[#405148] border-[#DDE4DE]'}`}>
                            {recommended ? <SeasonIcon size={18} /> : <Scissors size={18} />}
                        </span>
                        <div>
                            <div className='flex flex-wrap items-center gap-2'>
                                <h4 className='font-serif text-lg font-bold text-[#13231B]'>{title}</h4>
                                {badge && (
                                    <span className='rounded-full bg-[#EDF3EE] border border-[#2F6B57]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#1F4D3E]'>
                                        {badge}
                                    </span>
                                )}
                            </div>
                            <p className='mt-0.5 text-xs leading-5 text-[#405148]'>{description}</p>
                        </div>
                    </div>
                </div>

                <div className='grid items-stretch gap-4 sm:grid-cols-2'>
                    {groupStyles.map((style) => {
                        const selected = selectedStyleId === style.id
                        const recommendation = recommendationsById.get(style.id)
                        const activeBreedClean = String(breed || '').trim().toLowerCase()
                        const isMatchForActiveBreed = Boolean(
                            activeBreedClean && (
                                (Array.isArray(style.suitableBreeds) && style.suitableBreeds.some((b) => {
                                    const bLower = b.toLowerCase()
                                    return activeBreedClean.includes(bLower) || bLower.includes(activeBreedClean)
                                })) ||
                                String(style.breedSuitability || '').toLowerCase().includes(activeBreedClean) ||
                                String(style.coatSafety || '').toLowerCase().includes(activeBreedClean)
                            )
                        )
                        const preview = stylePreviews[style.id] || { status: 'idle' }
                        const ready = preview.status === 'ready' && preview.generatedImage
                        const failed = preview.status === 'error'
                        const rawSuitability = style.breedSuitability || (Array.isArray(style.suitableBreeds) ? style.suitableBreeds.join(', ') : '')
                        const cleanSuitability = String(rawSuitability || '')
                            .replace(/^(Good for|Recommended for|Popular for|Ideal for|Perfect for)\s*/i, '')
                            .trim()
                        const seasonalReason = recommendation?.reason || (recommended ? style.seasonReasons?.[currentSeasonKey] : null)

                        return (
                            <Fragment key={style.id}>
                                <button
                                    type='button'
                                    onClick={() => ready
                                        ? onSelect(style.id)
                                        : onRetry(style.id)}
                                    disabled={
                                        (!ready && !failed && !canGenerate) ||
                                        ((failed || canGenerate) && generationBusy)
                                    }
                                    aria-pressed={selected}
                                    aria-label={failed
                                        ? `Retry ${style.name} preview`
                                        : ready
                                            ? `Select ${style.name}`
                                            : canGenerate
                                                ? `Generate ${style.name} preview`
                                                : `${style.name} preview is not ready`}
                                    className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left align-top transition-all duration-300 transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6B57] focus-visible:ring-offset-2 disabled:cursor-wait ${
                                        selected
                                            ? 'border-[#2F6B57] bg-white ring-2 ring-[#2F6B57]/30 shadow-md -translate-y-1'
                                            : 'border-[#DDE4DE] bg-white hover:border-[#2F6B57] hover:shadow-md hover:-translate-y-1'
                                    }`}
                                >
                                    {/* Card Top Image / Preview Container */}
                                    <span className='relative block w-full shrink-0 overflow-hidden border-b border-[#DDE4DE] bg-[#F9FAF8]'>
                                        {ready ? (
                                            <img
                                                src={formatImageSrc(preview.generatedImage)}
                                                alt={`${style.name} preview on your pet`}
                                                className='h-40 sm:h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105'
                                            />
                                        ) : (
                                            <span className='grid h-40 sm:h-44 w-full place-items-center bg-[#F9FAF8] px-4 text-center'>
                                                {preview.status === 'generating' ? (
                                                    <span role='status'>
                                                        <Loader2 size={22} className='mx-auto mb-2 animate-spin text-[#1F4D3E]' />
                                                        <span className='text-xs font-semibold text-[#14231B] block'>Generating on your pet…</span>
                                                        <span className='text-[11px] text-[#607368] mt-0.5 block'>Personalized preview in progress</span>
                                                    </span>
                                                ) : failed ? (
                                                    <span>
                                                        <RefreshCw size={20} className='mx-auto mb-1.5 text-[#9E3E3E]' />
                                                        <span className='text-xs font-semibold text-[#9E3E3E] block'>
                                                            {generationBusy
                                                                ? 'Preview waiting in queue…'
                                                                : 'Preview unavailable'}
                                                        </span>
                                                        <span className='text-[11px] text-[#9E3E3E]/80 mt-0.5 block'>
                                                            {generationBusy ? 'Starts automatically' : 'Tap card to retry'}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className='flex flex-col items-center justify-center p-3'>
                                                        <ImageIcon size={22} className='text-[#8B9D92] mb-1.5 stroke-[1.5]' />
                                                        <strong className='text-xs font-semibold text-[#14231B]'>
                                                            {!photoReady
                                                                ? 'Add pet photo above'
                                                                : generationBusy
                                                                    ? 'Queued for preview'
                                                                    : 'Generate style preview'}
                                                        </strong>
                                                        <span className='text-[11px] text-[#607368] mt-0.5'>
                                                            {!photoReady
                                                                ? 'Upload photo to see previews'
                                                                : generationBusy
                                                                    ? 'Generates after current card'
                                                                    : 'Tap to see this cut on your pet'}
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                        )}

                                        {/* Top Badges */}
                                        <span className='absolute left-3 top-3 flex flex-wrap gap-1.5'>
                                            {recommendation?.rank === 1 ? (
                                                <span className='rounded-md bg-[#13231B] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs'>
                                                    Top suggestion
                                                </span>
                                            ) : recommended ? (
                                                <span className='rounded-md bg-[#2F6B57] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs'>
                                                    Seasonal pick
                                                </span>
                                            ) : null}
                                        </span>

                                        {ready && (
                                            <span className='absolute bottom-2.5 right-2.5 rounded bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-white shadow-xs'>
                                                Your pet
                                            </span>
                                        )}
                                    </span>

                                    {/* Card Content Area */}
                                    <span className='flex flex-1 flex-col justify-between p-4 sm:p-5'>
                                        <div>
                                            {/* Style Title and Breed Tag */}
                                            <span className='flex flex-wrap items-start justify-between gap-2'>
                                                <span className='font-serif text-lg font-bold text-[#14231B] group-hover:text-[#1F4D3E] transition-colors'>
                                                    {style.name}
                                                </span>
                                                <span className='flex flex-wrap items-center gap-1.5'>
                                                    {isMatchForActiveBreed && breed && (
                                                        <span className='inline-flex items-center rounded-md bg-[#EBF3EE] px-2 py-0.5 text-[11px] font-semibold text-[#1E4B3D] border border-[#CCE0D3]'>
                                                            Ideal for {breed}
                                                        </span>
                                                    )}
                                                    {selected && (
                                                        <span className='inline-flex shrink-0 items-center gap-1 rounded bg-[#2F6B57] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs'>
                                                            <Check size={11} /> Selected
                                                        </span>
                                                    )}
                                                </span>
                                            </span>

                                            {/* Description */}
                                            <span className='mt-1.5 block text-xs leading-relaxed text-[#4A5D52]'>
                                                {style.description}
                                            </span>

                                            {/* Breed Suitability */}
                                            {cleanSuitability && (
                                                <span className='mt-3 block text-xs leading-snug text-[#4A5D52]'>
                                                    <strong className='font-semibold text-[#183023]'>Suited for:</strong> {cleanSuitability}
                                                </span>
                                            )}
                                        </div>

                                        {/* Seasonal Benefit */}
                                        {seasonalReason && (
                                            <div className='mt-3 rounded-lg bg-[#F3F7F4] border border-[#DEEAE2] px-3 py-2 text-[11px] leading-relaxed text-[#234D3B]'>
                                                <span className='font-semibold text-[#143224]'>Seasonal benefit:</span> {seasonalReason}
                                            </div>
                                        )}
                                    </span>
                                </button>

                                {/* Expanded selected image preview on mobile */}
                                {selected && ready && (
                                    <div className='col-span-full overflow-hidden rounded-2xl border border-[#DDE4DE] bg-white xl:hidden shadow-sm'>
                                        <div className='flex items-center justify-between gap-3 border-b border-[#DDE4DE] px-4 py-3 bg-[#FAFBF8]'>
                                            <div>
                                                <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-[#2F6B57]'>Selected preview</p>
                                                <p className='font-serif text-lg font-bold text-[#13231B]'>{style.name}</p>
                                            </div>
                                            <span className='grid h-8 w-8 place-items-center rounded-full bg-[#2F6B57] text-white'>
                                                <Check size={16} />
                                            </span>
                                        </div>
                                        <img
                                            src={formatImageSrc(preview.generatedImage)}
                                            alt={`Selected ${style.name} preview on your pet`}
                                            className='max-h-[28rem] w-full object-contain p-2'
                                        />
                                    </div>
                                )}
                            </Fragment>
                        )
                    })}
                </div>
            </section>
        )
    }

    return (
        <div className='space-y-8'>
            <div className='flex flex-wrap items-end justify-between gap-3'>
                <div>
                    <h3 className='font-serif text-xl font-bold text-[#13231B]'>Choose your pet’s style</h3>
                    <p className='mt-1 text-xs sm:text-sm text-[#405148]'>
                        Seasonal recommendations are curated for current weather conditions. Generate any other style on demand.
                    </p>
                </div>
                {loading && (
                    <span className='text-xs font-semibold text-[#2F6B57] inline-flex items-center gap-1.5' role='status'>
                        <Loader2 size={13} className='animate-spin' />
                        <span>Updating choices…</span>
                    </span>
                )}
            </div>

            {styles.length ? (
                <div className='space-y-8'>
                    {/* Section 1: Seasonal Recommendations */}
                    {renderStyleGroup({
                        title: `Recommended for ${currentSeasonLabel}`,
                        badge: 'Current season',
                        description: `Best suited for coat comfort, ventilation, and easy grooming during the Philippine ${currentSeasonLabel.toLowerCase()}. The top suggestion generates first.`,
                        groupStyles: recommendedStyles,
                        recommended: true
                    })}

                    {/* Visual Divider Between Seasonal and Other Styles */}
                    {moreStyles.length > 0 && (
                        <div className='relative py-2'>
                            <div className='absolute inset-0 flex items-center' aria-hidden='true'>
                                <div className='w-full border-t border-[#DDE4DE]' />
                            </div>
                            <div className='relative flex justify-center'>
                                <span className='rounded-full border border-[#DDE4DE] bg-[#FAFBF8] px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[#68776F] shadow-2xs'>
                                    Other Available Cuts
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Section 2: All Other Styles */}
                    {moreStyles.length > 0 && renderStyleGroup({
                        title: `More styles for your ${normalizedPetType}`,
                        description: 'Select any compatible haircut to generate its personalized preview on demand.',
                        groupStyles: moreStyles,
                        recommended: false
                    })}
                </div>
            ) : (
                <div className='rounded-2xl border border-[#DDE4DE] bg-white p-6 text-sm text-[#405148] text-center'>
                    No compatible styles are available for this pet type.
                </div>
            )}
        </div>
    )
}
