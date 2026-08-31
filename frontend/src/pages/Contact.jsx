import { createElement, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, Mail, MapPin, Phone, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { contactApi, getErrorMessage } from '../utils/api'
import PhoneField from '../components/PhoneField'

const initialForm = { name: '', email: '', phone: '', message: '' }

export default function Contact() {
    const [form, setForm] = useState(initialForm)
    const [submitting, setSubmitting] = useState(false)

    const validate = () => {
        if (!form.name.trim() || form.name.trim().length < 2) { toast.error('Please enter a valid full name (at least 2 characters)'); return false }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!form.email.trim() || !emailRegex.test(form.email.trim())) { toast.error('Please enter a valid email address'); return false }
        if (!form.phone || form.phone.replace(/\D/g, '').length < 12) { toast.error('Please enter a valid 10-digit mobile number'); return false }
        if (!form.message.trim() || form.message.trim().length < 10) { toast.error('Message must be at least 10 characters long'); return false }
        return true
    }

    const submit = async (event) => {
        event.preventDefault()
        if (!validate()) return
        setSubmitting(true)
        try {
            const { data } = await contactApi.send(form)
            toast.success(data.message || 'Thank you! Your message has been sent successfully.')
            setForm(initialForm)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className='min-h-screen bg-[#F6F7F2] text-[#13231B]'>
            <section className='border-b border-[#DDE4DE] bg-white'>
                <div className='mx-auto grid max-w-[1480px] gap-8 px-5 py-14 sm:px-6 lg:grid-cols-[1fr_.7fr] lg:items-end lg:px-8 lg:py-20'>
                    <div><p className='tt-kicker'>Get in Touch</p><h1 className='mt-4 font-serif text-[clamp(3.2rem,7vw,6rem)] leading-[.92] tracking-[-.04em]'>Questions are easier before the appointment.</h1></div>
                    <p className='max-w-xl text-sm leading-7 text-[#68776F] lg:justify-self-end'>Ask about coat care, handling needs, service selection, or an existing appointment. For a new reservation, use the booking flow so availability stays accurate.</p>
                </div>
            </section>

            <section className='mx-auto grid max-w-[1480px] gap-8 px-5 py-12 sm:px-6 lg:grid-cols-[.72fr_1.28fr] lg:px-8 lg:py-16'>
                <aside>
                    <div className='rounded-[1.75rem] bg-[#13231B] p-6 text-white sm:p-7'>
                        <p className='text-[10px] font-extrabold uppercase tracking-[.16em] text-[#E5B95D]'>Location & Hours</p>
                        <h2 className='mt-3 font-serif text-3xl'>TimmyTails Tangos</h2>
                        <div className='mt-7 divide-y divide-white/10'>
                            <InfoRow icon={MapPin} label='Location' text='Tangos, Baliuag City, Bulacan, Philippines' />
                            <InfoRow icon={Phone} label='Phone' text='+63 975 669 2647' />
                            <InfoRow icon={Mail} label='Email' text='contact@timmytails.com' />
                            <InfoRow icon={Clock3} label='Hours' text='Mon–Sat · 8:00 AM–6:00 PM' />
                        </div>
                        <Link to='/booking' className='mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#F3D58C]'>Need a slot instead? Book here <ArrowRight size={15} /></Link>
                    </div>
                </aside>

                <form onSubmit={submit} className='rounded-[1.75rem] border border-[#DDE4DE] bg-white p-6 sm:p-8'>
                    <div><p className='text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2F6B57]'>Send a message</p><h2 className='mt-2 font-serif text-3xl'>Tell us what you need help with.</h2><p className='mt-2 text-sm text-[#68776F]'>We usually reply within one business day.</p></div>
                    <div className='mt-7 grid gap-5 sm:grid-cols-2'>
                        <Field label='Full name' name='name' placeholder='e.g. Juan dela Cruz' value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <Field label='Email address' name='email' type='email' placeholder='example@gmail.com' value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className='mt-5'><PhoneField label='Mobile phone number' name='phone' value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder='917 123 4567' /></div>
                    <label className='mt-5 block'>
                        <Label>Message</Label>
                        <textarea name='message' value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required minLength={10} maxLength={1000} rows={6} placeholder='Write your inquiry or question here…' className='w-full rounded-xl border border-[#D5DDD7] bg-[#FAFBF8] px-4 py-3 text-sm outline-none transition placeholder:text-[#9AA69F] focus:border-[#2F6B57] focus:ring-4 focus:ring-[#DCE9E0]' />
                        <p className='mt-1 text-right text-[10px] font-bold text-[#8A978F]'>{form.message.length}/1000</p>
                    </label>
                    <button disabled={submitting} className='tt-primary mt-6 px-5 disabled:opacity-60'><Send size={16} />{submitting ? 'Sending message…' : 'Send message'}</button>
                </form>
            </section>
        </div>
    )
}

function InfoRow({ icon, label, text }) {
    return <div className='flex gap-3 py-4 first:pt-0 last:pb-0'><span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/8 text-[#E8795B]'>{createElement(icon, { size: 16 })}</span><div><p className='text-[9px] font-extrabold uppercase tracking-[.13em] text-[#90A49A]'>{label}</p><p className='mt-1 text-sm font-bold text-[#E4EBE7]'>{text}</p></div></div>
}
function Label({ children }) { return <span className='mb-2 block text-xs font-extrabold text-[#405148]'>{children}</span> }
function Field({ label, ...props }) { return <label className='block'><Label>{label}</Label><input required className='h-12 w-full rounded-xl border border-[#D5DDD7] bg-[#FAFBF8] px-4 text-sm outline-none transition placeholder:text-[#9AA69F] focus:border-[#2F6B57] focus:ring-4 focus:ring-[#DCE9E0]' {...props} /></label> }
