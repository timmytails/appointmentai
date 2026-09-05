export const getAutomaticPreviewStyles = ({
    stylesToGenerate = [],
    recommendations = [],
    manualRequest = false
}) => {
    if (manualRequest) return stylesToGenerate

    const topRecommendationId = recommendations[0]?.id
    if (!topRecommendationId) return []

    const topStyle = stylesToGenerate.find(
        (style) => style.id === topRecommendationId
    )

    return topStyle ? [topStyle] : []
}

export const getNextFailedStyleId = ({
    stylePreviews = {},
    recommendations = []
}) => {
    const failedIds = Object.entries(stylePreviews)
        .filter(([, preview]) =>
            preview.status === 'error'
        )
        .map(([styleId]) => styleId)
    const topRecommendationId =
        recommendations[0]?.id

    return failedIds.includes(topRecommendationId)
        ? topRecommendationId
        : failedIds[0] || null
}
