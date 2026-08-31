const getManilaMonth = (date = new Date()) => Number(
    new Intl.DateTimeFormat(
        'en-US',
        {
            timeZone: 'Asia/Manila',
            month: 'numeric'
        }
    ).format(date)
)

export const getPhilippineSeason = (date = new Date()) => {
    const month = getManilaMonth(date)

    if (month >= 3 && month <= 5) {
        return {
            key: 'hot-dry',
            name: 'Hot/Dry Season',
            label: 'Hot/Dry Season',
            months: 'March–May',
            advice: 'Comfortable, manageable trims are recommended while protecting the natural coat.',
            weatherContext: 'Philippines hot and dry season profile'
        }
    }

    if (month >= 6 && month <= 11) {
        return {
            key: 'wet-rainy',
            name: 'Wet/Rainy Season',
            label: 'Wet/Rainy Season',
            months: 'June–November',
            advice: 'Easy-to-dry styles can help reduce dampness, matting, and mud buildup.',
            weatherContext: 'Philippines wet and rainy season humidity profile'
        }
    }

    return {
        key: 'cool-dry',
        name: 'Cool/Dry Season',
        label: 'Cool/Dry Season',
        months: 'December–February',
        advice: 'Keep practical coat coverage while maintaining a neat and comfortable shape.',
        weatherContext: 'Philippines cool and dry season profile'
    }
}
