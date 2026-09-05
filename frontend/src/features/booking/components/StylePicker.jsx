import { Fragment } from 'react'
import {
    Check,
    CloudRain,
    Image as ImageIcon,
    Loader2,
    RefreshCw,
    Scissors,
    Sparkles,
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
                        const canGenerate = photoReady && preview.status === 'idle' && !generationBusy

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
                                    <span className='relative block w-full shrink-0 overflow-hidden border-b border-[#DDE4DE] bg-[#FAFBF8]'>
                                        {ready ? (
                                            <img
                                                src={formatImageSrc(preview.generatedImage)}
                                                alt={`${style.name} preview on your pet`}
                                                className='h-40 sm:h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105'
                                            />
                                        ) : (
                                            <span className='grid h-40 sm:h-44 w-full place-items-center bg-[#FAFBF8] px-5 text-center text-[#2F6B57]'>
                                                {preview.status === 'generating' ? (
                                                    <span role='status'>
                                                        <Loader2 size={26} className='mx-auto mb-2 animate-spin text-[#1F4D3E]' />
                                                        <span className='text-xs font-semibold text-[#13231B]'>Generating on your pet…</span>
                                                    </span>
                                                ) : failed ? (
                                                    <span>
                                                        <RefreshCw size={24} className='mx-auto mb-2 text-[#9E3E3E]' />
                                                        <span className='text-xs font-semibold text-[#9E3E3E]'>
                                                            {generationBusy
                                                                ? 'Another preview is generating…'
                                                                : preview.error || 'Failed to generate. Select to retry.'}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className='flex flex-col items-center justify-center p-3'>
                                                        <span className='grid h-11 w-11 place-items-center rounded-full bg-[#EDF3EE] text-[#1F4D3E] mx-auto mb-2 group-hover:scale-110 transition-transform'>
                                                            <Sparkles size={20} />
                                                        </span>
                                                        <strong className='text-xs font-bold text-[#13231B]'>
                                                            {!photoReady
                                                                ? 'Upload pet photo first'
                                                                : generationBusy
                                                                    ? 'Queued after active preview'
                                                                    : 'Generate style preview'}
                                                        </strong>
                                                        <span className='text-[10px] text-[#68776F] mt-0.5'>
                                                            Personalized on your uploaded photo
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                        )}

                                        {/* Top Badges */}
                                        <span className='absolute left-3 top-3 flex flex-wrap gap-1.5'>
                                            {recommendation?.rank === 1 ? (
                                                <span className='rounded-full bg-[#13231B] px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[#F6F7F2] shadow-xs'>
                                                    Top suggestion
                                                </span>
                                            ) : recommended ? (
                                                <span className='rounded-full bg-[#2F6B57] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#F6F7F2] shadow-xs'>
                                                    Seasonal pick
                                                </span>
                                            ) : null}
                                        </span>

                                        {ready && (
                                            <span className='absolute bottom-3 right-3 rounded-full bg-white/95 border border-[#DDE4DE] px-2.5 py-1 text-[9px] font-bold text-[#13231B] shadow-sm'>
                                                Your pet
                                            </span>
                                        )}
                                    </span>

                                    {/* Card Content Area */}
                                    <span className='flex flex-1 flex-col justify-between p-4 sm:p-5'>
                                        <div>
                                            {/* Style Title and Selection Badge */}
                                            <span className='flex flex-wrap items-start justify-between gap-2'>
                                                <span className='font-serif text-lg font-bold text-[#13231B] group-hover:text-[#1F4D3E] transition-colors'>
                                                    {style.name}
                                                </span>
                                                <span className='flex flex-wrap items-center gap-1.5'>
                                                    {isMatchForActiveBreed && breed && (
                                                        <span className='inline-flex items-center gap-1 rounded-full bg-[#E4F1EA] px-2.5 py-0.5 text-[9px] font-bold text-[#1F4D3E] border border-[#2F6B57]/20'>
                                                            ✨ Good for {breed}
                                                        </span>
                                                    )}
                                                    {selected && (
                                                        <span className='inline-flex shrink-0 items-center gap-1 rounded-full bg-[#2F6B57] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#F6F7F2] shadow-xs'>
                                                            <Check size={11} />Selected
                                                        </span>
                                                    )}
                                                </span>
                                            </span>

                                            {/* Description */}
                                            <span className='mt-1.5 block text-xs leading-relaxed text-[#405148]'>
                                                {style.description}
                                            </span>

                                            {/* Breed Suitability Callout */}
                                            {(style.breedSuitability || style.suitableBreeds?.length) && (
                                                <span className='mt-3 flex items-start gap-1.5 rounded-xl bg-[#FAFBF8] border border-[#E8EEE9] p-2.5 text-[11px] leading-relaxed text-[#1F4D3E]'>
                                                    <span className='shrink-0 font-bold'>🐾 Good for:</span>
                                                    <span className='font-medium text-[#405148]'>
                                                        {isMatchForActiveBreed && breed ? (
                                                            <span>
                                                                <strong className='text-[#1F4D3E] font-bold'>{breed}</strong>
                                                                {style.breedSuitability ? ` (${style.breedSuitability.replace(/^good for\s*/i, '')})` : ''}
                                                            </span>
                                                        ) : (
                                                            style.breedSuitability || style.suitableBreeds.join(', ')
                                                        )}
                                                    </span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Footer Notes (Reason & Safety) */}
                                        <div className='mt-3 space-y-1.5 pt-2 border-t border-[#DDE4DE]/60'>
                                            {(recommendation?.reason || (recommended && style.seasonReasons?.[currentSeasonKey])) && (
                                                <span className='block text-[11px] leading-5 text-[#2F6B57] font-medium'>
                                                    🌿 {recommendation?.reason || style.seasonReasons?.[currentSeasonKey]}
                                                </span>
                                            )}
                                            {style.coatSafety && (
                                                <span className='block text-[11px] leading-5 text-[#68776F]'>
                                                    🛡️ {style.coatSafety}
                                                </span>
                                            )}
                                        </div>
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
