const {
    getPhilippineSeason,
    normalizeSeasonKey
} = require('./philippineSeason')

const SERVICES = [
    {
        id: 'basic-grooming',
        name: 'Basic Grooming',
        description: 'Bath, brush, nail trim, ear cleaning, and blow dry.',
        durationMinutes: 60,
        price: 500,
        supportsAiPreview: false
    },
    {
        id: 'full-grooming',
        name: 'Full Grooming',
        description: 'Basic grooming plus a complete haircut and styling.',
        durationMinutes: 120,
        price: 1200,
        supportsAiPreview: true
    },
    {
        id: 'custom-styling',
        name: 'Custom Styling',
        description: 'A style-focused grooming session based on the selected haircut.',
        durationMinutes: 90,
        price: 1000,
        supportsAiPreview: true
    },
    {
        id: 'bath-blow-dry',
        name: 'Bath & Blow Dry',
        description: 'Deep cleanse shampoo, conditioner, and professional blow dry.',
        durationMinutes: 90,
        price: 800,
        supportsAiPreview: false
    },
    {
        id: 'nail-trimming',
        name: 'Nail Trimming',
        description: 'Safe and careful nail clipping for dogs and cats.',
        durationMinutes: 30,
        price: 200,
        supportsAiPreview: false
    },
    {
        id: 'ear-cleaning',
        name: 'Ear Cleaning',
        description: 'Gentle external ear cleaning to support routine hygiene.',
        durationMinutes: 30,
        price: 250,
        supportsAiPreview: false
    }
]

const STYLE_OPTIONS = [
    {
        id: 'puppy-cut',
        name: 'Puppy Cut',
        description: 'A soft, even trim across the entire body for an adorable, low-maintenance look.',
        petTypes: ['dog'],
        coatTypes: ['long', 'medium', 'curly', 'wavy'],
        generationInstructions:
            'Create a clearly uniform medium-short coat across the body, legs, and chest. Shorten and neaten the ears, round the head softly, and keep the muzzle tidy without changing the dog’s facial anatomy.',
        verificationCriteria:
            'The body and legs have a visibly uniform medium-short length, with a softly rounded head, tidier ears, and a neat muzzle.',
        recommendedSeasons: ['hot-dry', 'wet-rainy'],
        seasonReasons: {
            'hot-dry': 'An easy, comfortable everyday trim that keeps your pet feeling cool.',
            'wet-rainy': 'Simple to wash and dry after fun rainy day walks.'
        },
        seasonPriority: { 'hot-dry': 2, 'wet-rainy': 2 },
        coatSafety: 'Keeps your pet looking tidy and cute with gentle coat protection.'
    },
    {
        id: 'teddy-bear-cut',
        name: 'Teddy Bear Cut',
        description: 'A plush, rounded face with soft cheeks for a cute teddy-bear silhouette.',
        petTypes: ['dog'],
        coatTypes: ['long', 'curly', 'wavy'],
        generationInstructions:
            'Create an unmistakably round plush head with fuller rounded cheeks, a tidy rounded muzzle, softly rounded ears, and an even fluffy body and leg length.',
        verificationCriteria:
            'The face has a distinct teddy-bear circle with fuller cheeks and rounded ears, while the body remains evenly plush.',
        recommendedSeasons: ['wet-rainy', 'cool-dry'],
        seasonReasons: {
            'wet-rainy': 'Soft and manageable while keeping a fluffy, cuddly look.',
            'cool-dry': 'Extra cozy and warm for cooler weather.'
        },
        seasonPriority: { 'wet-rainy': 3, 'cool-dry': 1 },
        coatSafety: 'Popular for Poodles, Shih Tzus, and fluffy coat breeds.'
    },
    {
        id: 'summer-cut',
        name: 'Summer Trim',
        description: 'A light, breezy warm-weather trim to keep your dog comfortable all season long.',
        petTypes: ['dog'],
        coatTypes: ['long', 'medium', 'wavy'],
        generationInstructions:
            'Create a noticeably shorter practical body and leg trim while preserving a natural, recognizable head and tail. Do not shave to the skin.',
        verificationCriteria:
            'The body coat is visibly shorter than a Puppy Cut or Natural Trim, but is not shaved to the skin.',
        recommendedSeasons: ['hot-dry'],
        seasonReasons: {
            'hot-dry': 'Helps your pet stay cool and energetic during hot sunny days.'
        },
        seasonPriority: { 'hot-dry': 0 },
        coatSafety: 'Gentle on skin with safe length preserved for sun protection.'
    },
    {
        id: 'asian-fusion-cut',
        name: 'Asian Fusion Cut',
        description: 'A stylish Asian-inspired cut with a rounded head and fuller fluffy legs.',
        petTypes: ['dog'],
        coatTypes: ['long', 'curly', 'wavy'],
        generationInstructions:
            'Create a compact neatly trimmed body, a rounded sculpted head and muzzle, and visibly fuller column-shaped or flared legs.',
        verificationCriteria:
            'The body is compact and neat, the head is rounded, and the legs are visibly fuller and sculpted.',
        recommendedSeasons: ['wet-rainy', 'cool-dry'],
        seasonReasons: {
            'wet-rainy': 'Keeps the body coat short and neat while showing off stylish leg flair.',
            'cool-dry': 'Keeps leg coverage cozy while maintaining a clean body.'
        },
        seasonPriority: { 'wet-rainy': 4, 'cool-dry': 2 },
        coatSafety: 'A fashion-forward choice that makes your pet look camera-ready.'
    },
    {
        id: 'poodle-lamb-cut',
        name: 'Lamb Cut',
        description: 'A classic salon cut with a smooth body and soft, velvety column legs.',
        petTypes: ['dog'],
        coatTypes: ['curly', 'wavy', 'long'],
        generationInstructions:
            'Trim the body coat smooth while leaving fuller, expertly blended leg coat for a velvety lamb silhouette.',
        verificationCriteria:
            'Smooth trimmed body coat with fuller, seamless blended leg furnishings.',
        recommendedSeasons: ['hot-dry', 'cool-dry'],
        seasonReasons: {
            'hot-dry': 'Elegant and comfortable for active dogs in warm weather.',
            'cool-dry': 'Warm leg coverage paired with a tidy body.'
        },
        seasonPriority: { 'hot-dry': 3, 'cool-dry': 3 },
        coatSafety: 'Ideal for Poodles, Bichon Frises, and curly coat pets.'
    },
    {
        id: 'schnauzer-trim',
        name: 'Schnauzer / Terrier Cut',
        description: 'A distinguished trim featuring a classic beard, tidy back, and handsome leg furnishings.',
        petTypes: ['dog'],
        coatTypes: ['wire', 'medium', 'long'],
        generationInstructions:
            'Trim the back smooth, outline a clean chest apron, and preserve a distinctive beard, eyebrows, and leg coat.',
        verificationCriteria:
            'Distinct beard and eyebrow shape with a clean back trim and shaped legs.',
        recommendedSeasons: ['hot-dry', 'cool-dry'],
        seasonReasons: {
            'hot-dry': 'Handsome and sporty for sunny outdoor play.',
            'cool-dry': 'Keeps signature breed charm while staying neat.'
        },
        seasonPriority: { 'hot-dry': 2, 'cool-dry': 2 },
        coatSafety: 'Perfect for Schnauzers, Terriers, and wire-haired dogs.'
    },
    {
        id: 'natural-trim',
        name: 'Natural Trim & Tidy',
        description: 'An outline tidy-up that preserves your dog’s natural coat beauty and length.',
        petTypes: ['dog'],
        coatTypes: ['double', 'long', 'medium', 'short'],
        generationInstructions:
            'Preserve almost all natural coat length and texture. Only clean the outline, remove visibly uneven wisps, and neaten paws.',
        verificationCriteria:
            'Most original coat length remains intact while paw lines and outline look freshly groomed.',
        recommendedSeasons: ['hot-dry', 'wet-rainy', 'cool-dry'],
        seasonReasons: {
            'hot-dry': 'Preserves natural sun protection while keeping paws and coat tidy.',
            'wet-rainy': 'Helps reduce matting and dirt buildup without cutting short.',
            'cool-dry': 'Maintains natural warmth and cozy coat coverage.'
        },
        seasonPriority: { 'hot-dry': 2, 'wet-rainy': 2, 'cool-dry': 1 },
        coatSafety: 'Recommended for double-coated breeds like Huskies, Retrievers & Pomeranians.'
    },
    {
        id: 'comb-cut',
        name: 'Plush Comb Cut',
        description: 'An even, plush trim for cats that keeps a soft medium length without a close clip.',
        petTypes: ['cat'],
        coatTypes: ['long', 'medium'],
        generationInstructions:
            'Create an even medium-short plush coat across the body while preserving a natural head and full tail.',
        verificationCriteria:
            'Even medium-short plush coat fuller than a Lion Cut, with natural head and tail.',
        recommendedSeasons: ['hot-dry', 'wet-rainy'],
        seasonReasons: {
            'hot-dry': 'Keeps long-haired cats comfortable during warm weather.',
            'wet-rainy': 'Makes daily brushing smooth and hassle-free.'
        },
        seasonPriority: { 'hot-dry': 1, 'wet-rainy': 1 },
        coatSafety: 'Soft and comfortable for Persian, Maine Coon, and long-haired cats.'
    },
    {
        id: 'cat-teddy-bear-trim',
        name: 'Fluffy Teddy Bear Cat Trim',
        description: 'A soft, rounded trim with cute cheeks and a cozy, plush body outline.',
        petTypes: ['cat'],
        coatTypes: ['long', 'medium'],
        generationInstructions:
            'Create a plush rounded head with full cheeks, a softly rounded body outline, and neat paws.',
        verificationCriteria:
            'Rounded plush head with full cheeks and a softly shaped fuller body.',
        recommendedSeasons: ['cool-dry'],
        seasonReasons: {
            'cool-dry': 'Keeps your kitty cozy, cuddly, and looking adorable.'
        },
        seasonPriority: { 'cool-dry': 0 },
        coatSafety: 'A popular favorite for healthy long-haired cats.'
    },
    {
        id: 'lion-cut',
        name: 'Lion Cut',
        description: 'A majestic cat style with a close-trimmed body, fluffy mane, and cute tail tuft.',
        petTypes: ['cat'],
        coatTypes: ['long'],
        generationInstructions:
            'Create a closely trimmed body while preserving a full mane around the head, fuller paws, and a tail-tip tuft.',
        verificationCriteria:
            'Visible mane, shorter body coat, fuller lower paws, and tail-tip tuft.',
        recommendedSeasons: ['hot-dry'],
        seasonReasons: {
            'hot-dry': 'Perfect for long-haired cats during peak summer heat.'
        },
        seasonPriority: { 'hot-dry': 1 },
        coatSafety: 'Specialized style for long-haired cats. Our groomers ensure patient, safe handling.'
    },
    {
        id: 'cat-sanitary-trim',
        name: 'Hygiene & Sanitary Trim',
        description: 'A focused hygiene trim around the belly, sanitary areas, and paw pads to keep cats clean and comfortable.',
        petTypes: ['cat'],
        coatTypes: ['short', 'medium', 'long'],
        generationInstructions:
            'Preserve the cat’s full natural body coat and facial shape while neatening the paw pads and hygiene areas cleanly.',
        verificationCriteria:
            'Full natural coat maintained with clean, neat sanitary outline and paw pads.',
        recommendedSeasons: ['hot-dry', 'wet-rainy', 'cool-dry'],
        seasonReasons: {
            'hot-dry': 'Maintains daily cleanliness and paw ventilation in warm weather.',
            'wet-rainy': 'Prevents litter and moisture buildup during humid rainy months.',
            'cool-dry': 'Preserves full body warmth while keeping hygiene areas fresh.'
        },
        seasonPriority: { 'hot-dry': 2, 'wet-rainy': 1, 'cool-dry': 1 },
        coatSafety: 'Ideal for all cat breeds, including short-haired domestic cats and long-haired Persians.'
    }
]

const findService = (idOrName) => SERVICES.find(
    (service) => service.id === idOrName || service.name === idOrName
)

const findStyle = (idOrName) => STYLE_OPTIONS.find(
    (style) => style.id === idOrName || style.name === idOrName
)

const normalizePetType = (value) =>
    String(value || '').trim().toLowerCase()

const isStyleCompatibleWithPet = (style, petType) => {
    if (!style) return false

    const normalizedType = normalizePetType(petType)

    return ['dog', 'cat'].includes(normalizedType) &&
        Array.isArray(style.petTypes) &&
        style.petTypes.includes(normalizedType)
}

const getStylesForPetType = (petType) => {
    const normalizedType = normalizePetType(petType)

    if (!['dog', 'cat'].includes(normalizedType)) {
        return []
    }

    return STYLE_OPTIONS.filter((style) =>
        isStyleCompatibleWithPet(style, normalizedType)
    )
}

const toPublicStyle = (style) => {
    if (!style) return null

    const {
        generationInstructions,
        verificationCriteria,
        seasonReasons,
        ...publicStyle
    } = style

    return publicStyle
}

const getSeasonReason = ({ petType, seasonKey }) => {
    if (petType === 'cat') {
        if (seasonKey === 'wet-rainy') {
            return 'Suggested to help keep a cat’s coat tidy and easier to maintain during humid, rainy months.'
        }

        if (seasonKey === 'hot-dry') {
            return 'Suggested for practical coat care during hotter Philippine months.'
        }

        return 'Suggested to keep the coat neat without removing unnecessary length during cooler months.'
    }

    if (seasonKey === 'wet-rainy') {
        return 'Suggested for easier drying and coat maintenance during the wet and rainy season.'
    }

    if (seasonKey === 'hot-dry') {
        return 'Suggested as a comfortable, manageable option during the hot and dry season.'
    }

    return 'Suggested as a neat style that keeps practical coat coverage during the cool and dry season.'
}

const getStyleRecommendations = ({
    petType = 'dog',
    coatType = '',
    season
} = {}) => {
    const normalizedType = normalizePetType(petType)
    const normalizedCoat = String(coatType || '').trim().toLowerCase()
    const seasonKey = normalizeSeasonKey(
        season || getPhilippineSeason().key
    )
    const hasDoubleCoat = normalizedCoat.includes('double')
    const hasShortCoat = normalizedCoat.includes('short')

    return getStylesForPetType(normalizedType)
        .filter((style) =>
            !Array.isArray(style.recommendedSeasons) ||
            style.recommendedSeasons.includes(seasonKey)
        )
        .filter((style) => !(
            normalizedType === 'dog' &&
            hasDoubleCoat &&
            ['summer-cut', 'puppy-cut'].includes(style.id)
        ))
        .filter((style) => !(
            normalizedType === 'cat' &&
            hasShortCoat &&
            [
                'lion-cut',
                'comb-cut',
                'cat-teddy-bear-trim'
            ].includes(style.id)
        ))
        .map((style) => {
            let priority = Number(
                style.seasonPriority?.[seasonKey] ?? 99
            )

            return {
                ...style,
                priority
            }
        })
        .sort((first, second) =>
            first.priority - second.priority ||
            first.name.localeCompare(second.name)
        )
        .slice(0, 3)
        .map((style, index) => {
            let reason =
                style.seasonReasons?.[seasonKey] ||
                getSeasonReason({
                    petType: normalizedType,
                    seasonKey
                })

            if (
                normalizedType === 'dog' &&
                hasDoubleCoat
            ) {
                reason =
                    '🛡️ Perfectly safe for your pet’s double coat! Keeps their natural fur soft and healthy.'
            }

            if (
                normalizedType === 'cat' &&
                style.id === 'lion-cut'
            ) {
                reason = '🦁 A royal favorite for long-haired cats! Keeps your kitty feeling cool and comfortable.'
            }

            const {
                priority,
                generationInstructions,
                verificationCriteria,
                seasonReasons,
                ...publicStyle
            } = style

            return {
                ...publicStyle,
                rank: index + 1,
                reason,
                seasonKey
            }
        })
}

module.exports = {
    SERVICES,
    STYLE_OPTIONS,
    findService,
    findStyle,
    isStyleCompatibleWithPet,
    getStylesForPetType,
    toPublicStyle,
    getStyleRecommendations
}
