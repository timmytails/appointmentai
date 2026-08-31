const SEASONS = {
    HOT_DRY: {
        key: 'hot-dry',
        name: 'Hot/Dry Season',
        label: 'Hot/Dry Season',
        months: 'March–May',
        advice:
            'Prioritize comfortable, manageable trims while protecting the pet’s natural coat.',
        weatherContext:
            'Philippines hot and dry season profile'
    },
    WET_RAINY: {
        key: 'wet-rainy',
        name: 'Wet/Rainy Season',
        label: 'Wet/Rainy Season',
        months: 'June–November',
        advice:
            'Choose easy-to-dry styles that help reduce dampness, matting, and mud buildup.',
        weatherContext:
            'Philippines wet and rainy season humidity profile'
    },
    COOL_DRY: {
        key: 'cool-dry',
        name: 'Cool/Dry Season',
        label: 'Cool/Dry Season',
        months: 'December–February',
        advice:
            'Keep a practical amount of coat while maintaining a neat, comfortable shape.',
        weatherContext:
            'Philippines cool and dry season profile'
    }
}

const getManilaMonth = (date = new Date()) => {
    const month = Number(
        new Intl.DateTimeFormat(
            'en-US',
            {
                timeZone: 'Asia/Manila',
                month: 'numeric'
            }
        ).format(date)
    )

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new TypeError('A valid date is required to determine the Philippine season')
    }

    return month
}

const getPhilippineSeason = (date = new Date()) => {
    const month = getManilaMonth(date)

    if (month >= 3 && month <= 5) {
        return { ...SEASONS.HOT_DRY }
    }

    if (month >= 6 && month <= 11) {
        return { ...SEASONS.WET_RAINY }
    }

    return { ...SEASONS.COOL_DRY }
}

const normalizeSeasonKey = (value, fallbackDate = new Date()) => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_\s/]+/g, '-')

    if (
        normalized === 'hot-dry' ||
        normalized === 'hot-season' ||
        normalized === 'summer'
    ) {
        return SEASONS.HOT_DRY.key
    }

    if (
        normalized === 'wet-rainy' ||
        normalized === 'wet' ||
        normalized === 'rainy' ||
        normalized === 'rainy-season'
    ) {
        return SEASONS.WET_RAINY.key
    }

    if (
        normalized === 'cool-dry' ||
        normalized === 'cool' ||
        normalized === 'ber-months'
    ) {
        return SEASONS.COOL_DRY.key
    }

    return getPhilippineSeason(fallbackDate).key
}

module.exports = {
    SEASONS,
    getManilaMonth,
    getPhilippineSeason,
    normalizeSeasonKey
}
