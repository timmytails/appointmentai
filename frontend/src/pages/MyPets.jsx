import { useEffect, useState } from 'react'
import { Camera, Dog, Cat, Pencil, Plus, Trash2, X, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { getErrorMessage, petsApi } from '../utils/api'
import ConfirmModal from '../components/ConfirmModal'

const emptyPet = {
    name: '',
    type: 'dog',
    breed: '',
    coatType: '',
    notes: '',
    ageMonths: '',
    vaccinated: 'yes',
    photoUrl: ''
}

export default function MyPets() {
    const [pets, setPets] = useState([])
    const [form, setForm] = useState(emptyPet)
    const [editingId, setEditingId] = useState('')
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [confirmDeletePet, setConfirmDeletePet] = useState(null)
    const [deleting, setDeleting] = useState(false)

    const loadPets = () =>
        petsApi.getMine()
            .then(({ data }) => setPets(data.pets || []))
            .finally(() => setLoading(false))

    useEffect(() => { loadPets() }, [])

    const openNew = () => {
        setEditingId('')
        setForm(emptyPet)
        setOpen(true)
    }

    const openEdit = (pet) => {
        setEditingId(pet._id)
        setForm({
            name: pet.name,
            type: pet.type,
            breed: pet.breed,
            coatType: pet.coatType || '',
            notes: pet.notes || '',
            ageMonths: pet.ageMonths !== undefined && pet.ageMonths !== null ? String(pet.ageMonths) : '',
            vaccinated: pet.vaccinated === false ? 'no' : 'yes',
            photoUrl: pet.photoUrl || ''
        })
        setOpen(true)
    }

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 8 * 1024 * 1024) {
            toast.error('Image must be under 8 MB')
            return
        }
        const reader = new FileReader()
        reader.onloadend = () => {
            setForm((prev) => ({ ...prev, photoUrl: reader.result }))
        }
        reader.readAsDataURL(file)
    }

    const save = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            if (editingId) await petsApi.update(editingId, form)
            else await petsApi.create(form)
            toast.success(editingId ? 'Pet updated successfully' : 'Pet added successfully')
            setOpen(false)
            await loadPets()
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSaving(false)
        }
    }

    const handleConfirmDelete = async () => {
        if (!confirmDeletePet) return
        setDeleting(true)
        try {
            await petsApi.remove(confirmDeletePet._id)
            setPets((c) => c.filter((p) => p._id !== confirmDeletePet._id))
            toast.success('Pet profile removed successfully')
            setConfirmDeletePet(null)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className='min-h-screen bg-[#F6F7F2] px-4 py-10 text-[#13231B] sm:px-6 lg:px-8'>
            <div className='mx-auto max-w-7xl'>

                {/* Page Header */}
                <section className='mb-10 overflow-hidden rounded-[2rem] bg-[#13231B] text-white shadow-[0_24px_70px_rgba(19,35,27,0.10)]'>
                    <div className='grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-10 lg:py-10'>
                        <div className='max-w-2xl'>
                            <h1 className='font-serif text-4xl font-bold tracking-tight sm:text-5xl'>Profiles built around each pet.</h1>
                            <p className='mt-4 max-w-xl text-sm leading-6 text-[#DCE9E0] sm:text-base'>
                                Keep coat, vaccination, age, notes, and photos in one place so every grooming visit starts with the right context.
                            </p>
                        </div>
                        <button
                            onClick={openNew}
                            className='inline-flex items-center justify-center gap-2 self-start rounded-full bg-[#E8795B] px-5 py-3 text-sm font-extrabold text-[#13231B] transition hover:-translate-y-0.5 hover:bg-[#F08A6D] lg:self-auto'
                        >
                            <Plus size={18} />
                            <span>Add a pet</span>
                        </button>
                    </div>
                </section>

                {/* Main Pets Grid */}
                {loading ? (
                    <div className='rounded-xl border border-[#DDE4DE] bg-white p-12 text-center text-sm font-medium text-[#405148]'>
                        Loading pet profiles...
                    </div>
                ) : (
                    <div className='grid gap-5 md:grid-cols-2'>
                        {pets.map((pet) => (
                            <article
                                key={pet._id}
                                className='group relative flex min-h-[220px] flex-col overflow-hidden rounded-[1.75rem] border border-[#DDE4DE] bg-white p-6 shadow-[0_14px_45px_rgba(19,35,27,0.05)] transition hover:-translate-y-0.5 hover:border-[#B8C9BD]'
                            >
                                <div className='flex items-start gap-4'>
                                    {/* Prominent Pet Profile Picture */}
                                    <div className='relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem] border border-[#DDE4DE] bg-[#EDF3EE]'>
                                        {pet.photoUrl ? (
                                            <img
                                                src={pet.photoUrl}
                                                alt={pet.name}
                                                className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                                            />
                                        ) : (
                                            <div className='flex h-full w-full flex-col items-center justify-center text-[#2F6B57]'>
                                                {pet.type === 'cat' ? <Cat size={28} /> : <Dog size={28} />}
                                                <span className='mt-0.5 text-[9px] font-semibold uppercase tracking-wider'>No Photo</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Pet Info */}
                                    <div className='min-w-0 flex-1'>
                                        <div className='flex items-center justify-between gap-2'>
                                            <span className='inline-block rounded bg-[#F6F7F2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2F6B57]'>
                                                {pet.type === 'cat' ? 'Cat' : 'Dog'}
                                            </span>
                                            <div className='flex items-center gap-1.5'>
                                                <button
                                                    onClick={() => openEdit(pet)}
                                                    className='grid h-8 w-8 place-items-center rounded-lg border border-[#DDE4DE] bg-white text-[#405148] transition hover:bg-[#F6F7F2] hover:text-[#13231B]'
                                                    title='Edit Pet Profile'
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeletePet(pet)}
                                                    className='grid h-8 w-8 place-items-center rounded-lg border border-[#F0CCCC] bg-[#FBEAEA] text-[#9E3E3E] transition hover:bg-[#F4D6D6]'
                                                    title='Remove Pet'
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        <h2 className='mt-1 truncate font-serif text-xl font-bold text-[#13231B]'>
                                            {pet.name}
                                        </h2>
                                        <p className='truncate text-xs font-medium text-[#405148]'>
                                            {pet.breed}
                                        </p>
                                    </div>
                                </div>

                                {/* Pet Specs & Badges */}
                                <div className='mt-4 flex flex-wrap gap-2 text-xs'>
                                    {pet.coatType && (
                                        <span className='rounded-md border border-[#DDE4DE] bg-[#F6F7F2] px-2.5 py-1 font-medium text-[#13231B]'>
                                            Coat: <span className='font-semibold'>{pet.coatType}</span>
                                        </span>
                                    )}
                                    {pet.ageMonths !== undefined && pet.ageMonths !== null && (
                                        <span className='rounded-md border border-[#DDE4DE] bg-[#F6F7F2] px-2.5 py-1 font-medium text-[#13231B]'>
                                            {pet.ageMonths} mo old
                                        </span>
                                    )}
                                    <span className={`rounded-md px-2.5 py-1 font-medium ${pet.vaccinated === false ? 'bg-[#FBEAEA] text-[#9E3E3E] border border-[#F0CCCC]' : 'bg-[#E4F1EA] text-[#216245] border border-[#C9E1D3]'}`}>
                                        {pet.vaccinated === false ? 'Unvaccinated' : 'Fully Vaccinated'}
                                    </span>
                                </div>

                                {pet.notes && (
                                    <div className='mt-3 rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3 py-2 text-xs leading-relaxed text-[#405148]'>
                                        <span className='font-semibold text-[#13231B]'>Notes: </span>
                                        {pet.notes}
                                    </div>
                                )}
                            </article>
                        ))}

                        {/* Empty State */}
                        {!pets.length && (
                            <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2F6B57] bg-[#F6F7F2] p-12 text-center md:col-span-2'>
                                <div className='grid h-14 w-14 place-items-center rounded-full bg-[#F6F7F2] text-[#2F6B57]'>
                                    <Dog size={28} />
                                </div>
                                <h2 className='mt-4 font-serif text-xl font-bold text-[#13231B]'>No Pet Profiles Saved</h2>
                                <p className='mt-1 max-w-sm text-sm text-[#405148]'>
                                    Add your pets to upload their pictures and book grooming appointments effortlessly.
                                </p>
                                <button
                                    onClick={openNew}
                                    className='mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2F6B57] px-5 py-2.5 text-xs font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E]'
                                >
                                    <Plus size={15} />
                                    <span>Add Your First Pet</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Pet Form Modal */}
            {open && (
                <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#13231B]/40 backdrop-blur-xs overflow-y-auto'>
                    <form
                        onSubmit={save}
                        className='relative w-full max-w-lg rounded-t-2xl sm:rounded-xl border border-[#DDE4DE] bg-white p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto pb-safe'
                    >
                        <div className='mb-6 flex items-center justify-between border-b border-[#2F6B57] pb-4'>
                            <h2 className='font-serif text-xl font-bold text-[#13231B]'>
                                {editingId ? 'Edit Pet Profile' : 'Add New Pet'}
                            </h2>
                            <button
                                type='button'
                                onClick={() => setOpen(false)}
                                className='grid h-8 w-8 place-items-center rounded-lg border border-[#DDE4DE] text-[#405148] transition hover:bg-[#F6F7F2] hover:text-[#13231B]'
                            >
                                <X size={17} />
                            </button>
                        </div>

                        {/* Pet Photo Upload Header */}
                        <div className='mb-6 flex items-center gap-4 rounded-xl border border-[#DDE4DE] bg-white p-4'>
                            <div className='relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem] border border-[#DDE4DE] bg-[#EDF3EE]'>
                                {form.photoUrl ? (
                                    <img src={form.photoUrl} alt='Pet preview' className='h-full w-full object-cover' />
                                ) : (
                                    <div className='flex h-full w-full items-center justify-center text-[#F6F7F2]'>
                                        <Camera size={24} />
                                    </div>
                                )}
                            </div>
                            <div className='flex-1'>
                                <label className='inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 py-2 text-xs font-bold text-[#13231B] transition hover:border-[#2F6B57] hover:text-[#2F6B57]'>
                                    <Upload size={14} />
                                    <span>{form.photoUrl ? 'Change Pet Photo' : 'Upload Pet Photo'}</span>
                                    <input
                                        type='file'
                                        accept='image/*'
                                        onChange={handlePhotoChange}
                                        className='hidden'
                                    />
                                </label>
                                <p className='mt-1 text-[11px] text-[#405148]'>
                                    Official picture for your pet. JPG, PNG or WEBP up to 8MB.
                                </p>
                            </div>
                        </div>

                        <div className='space-y-4'>
                            <div className='grid gap-4 sm:grid-cols-2'>
                                <Field label='Pet Name' placeholder='e.g. Milo' value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                                <label className='block'>
                                    <FieldLabel>Pet Type</FieldLabel>
                                    <select
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        className='h-10 w-full rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 text-sm outline-none transition focus:border-[#2F6B57] focus:ring-2 focus:ring-[#2F6B57]/20'
                                    >
                                        <option value='dog'>Dog</option>
                                        <option value='cat'>Cat</option>
                                    </select>
                                </label>
                            </div>

                            <div className='grid gap-4 sm:grid-cols-2'>
                                <Field label='Breed' placeholder='e.g. Shih Tzu, Golden Retriever' value={form.breed} onChange={(v) => setForm({ ...form, breed: v })} />
                                <Field label='Coat Type (Optional)' placeholder='e.g. Double coat, Long hair' value={form.coatType} onChange={(v) => setForm({ ...form, coatType: v })} required={false} />
                            </div>

                            <div className='grid gap-4 sm:grid-cols-2'>
                                <Field label='Age (Months)' type='number' min='0' placeholder='e.g. 12' value={form.ageMonths} onChange={(v) => setForm({ ...form, ageMonths: v })} required={false} />
                                <label className='block'>
                                    <FieldLabel>Vaccination Status</FieldLabel>
                                    <select
                                        value={form.vaccinated}
                                        onChange={(e) => setForm({ ...form, vaccinated: e.target.value })}
                                        className='h-10 w-full rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 text-sm outline-none transition focus:border-[#2F6B57] focus:ring-2 focus:ring-[#2F6B57]/20'
                                    >
                                        <option value='yes'>Yes - Fully Vaccinated</option>
                                        <option value='no'>No - Not Fully Vaccinated</option>
                                    </select>
                                </label>
                            </div>

                            <label className='block'>
                                <FieldLabel>Care Notes / Special Instructions (Optional)</FieldLabel>
                                <textarea
                                    value={form.notes}
                                    placeholder='e.g. Sensitive skin, prefers low blow-dry speed'
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    rows={3}
                                    className='w-full rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#2F6B57] focus:ring-2 focus:ring-[#2F6B57]/20 placeholder:text-[#9AA69F]'
                                />
                            </label>
                        </div>

                        <div className='mt-6 flex items-center justify-end gap-3 border-t border-[#2F6B57] pt-4'>
                            <button
                                type='button'
                                onClick={() => setOpen(false)}
                                className='rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-4 py-2 text-xs font-bold text-[#405148] transition hover:bg-[#F6F7F2]'
                            >
                                Cancel
                            </button>
                            <button
                                disabled={saving}
                                className='rounded-lg bg-[#2F6B57] px-5 py-2 text-xs font-bold text-[#F6F7F2] transition hover:bg-[#1F4D3E] disabled:opacity-60'
                            >
                                {saving ? 'Saving Profile...' : 'Save Pet Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <ConfirmModal
                isOpen={Boolean(confirmDeletePet)}
                title='Delete Pet Profile'
                description={confirmDeletePet
                    ? `Are you sure you want to remove ${confirmDeletePet.name}? This will remove the pet profile from your account.`
                    : ''}
                confirmText='Delete Pet'
                cancelText='Keep Pet'
                variant='danger'
                loading={deleting}
                onConfirm={handleConfirmDelete}
                onClose={() => setConfirmDeletePet(null)}
            />
        </div>
    )
}

function FieldLabel({ children }) {
    return <span className='mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#405148]'>{children}</span>
}

function Field({ label, value, onChange, placeholder, required = true, ...props }) {
    return (
        <label className='block'>
            <FieldLabel>{label}</FieldLabel>
            <input
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className='h-10 w-full rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-3.5 text-sm font-medium text-[#13231B] outline-none transition focus:border-[#2F6B57] focus:ring-2 focus:ring-[#2F6B57]/20 placeholder:text-[#9AA69F]'
                {...props}
            />
        </label>
    )
}
