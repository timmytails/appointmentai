export const getActivePetId = (petMode, selectedPet) =>
    petMode === 'existing'
        ? selectedPet?._id || null
        : null
