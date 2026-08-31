import { Link } from 'react-router-dom'

const sections = [
    {
        title: '1. Information We Collect',
        content: (
            <>
                <p>We collect information that you provide when you register an account, upload a pet photo, book an appointment, or contact customer support.</p>
                <ul className='mt-3 space-y-2 list-disc pl-5 text-[#405148]'>
                    <li>Name, email address, and verified mobile number</li>
                    <li>Account credentials and profile settings</li>
                    <li>Pet information, including pet photo uploads, breed, age, and care instructions</li>
                    <li>Appointment history, selected grooming service, and date/time schedules</li>
                    <li>Messages, feedback, and customer inquiry submissions</li>
                </ul>
            </>
        )
    },
    {
        title: '2. How We Use Your Information',
        content: (
            <>
                <p>We use collected data solely for legitimate salon service operations, including:</p>
                <ul className='mt-3 space-y-2 list-disc pl-5 text-[#405148]'>
                    <li>Managing your TimmyTails account and pet profiles</li>
                    <li>Processing, confirming, rescheduling, or cancelling grooming appointments</li>
                    <li>Sending OTP verification codes, booking reminders, and schedule updates</li>
                    <li>Generating visual hairstyle previews based on submitted pet photos</li>
                    <li>Responding to customer care inquiries and support requests</li>
                    <li>Maintaining system security and service quality</li>
                </ul>
            </>
        )
    },
    {
        title: '3. Service Communications & OTP',
        content: (
            <p>
                We send security verification OTPs, booking status confirmations, and appointment notifications to the verified mobile number attached to your account.
            </p>
        )
    },
    {
        title: '4. Information Protection',
        content: (
            <p>
                We do not sell or rent your personal information. Data access is restricted strictly to authorized TimmyTails personnel and essential infrastructure providers required to operate our service.
            </p>
        )
    },
    {
        title: '5. Contact Information',
        content: (
            <>
                <p>For questions or requests regarding your personal data, contact us via:</p>
                <div className='mt-3 space-y-1 text-sm font-medium text-[#13231B]'>
                    <p>Phone: +63 975 669 2647</p>
                    <p>Address: Baliuag City, Bulacan, Philippines</p>
                    <p>
                        Online Form:{' '}
                        <Link to='/contact' className='font-bold text-[#2F6B57] hover:underline'>
                            Contact Us
                        </Link>
                    </p>
                </div>
            </>
        )
    }
]

export default function PrivacyPolicy() {
    return (
        <div className='min-h-screen bg-[#F6F7F2] px-4 py-12 text-[#13231B] sm:px-6 lg:px-8'>
            <div className='mx-auto max-w-4xl'>
                <div className='mb-8 border-b border-[#2F6B57] pb-6 text-center sm:text-left'>
                    <span className='inline-block rounded-md bg-[#2F6B57]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#2F6B57]'>
                        Legal &amp; Governance
                    </span>
                    <h1 className='mt-2 font-serif text-3xl font-bold tracking-tight text-[#13231B] sm:text-4xl'>
                        Privacy Policy
                    </h1>
                    <p className='mt-1 text-sm text-[#405148]'>
                        Effective date: August 2026
                    </p>
                </div>

                <div className='rounded-xl border border-[#DDE4DE] bg-white p-6 sm:p-10 space-y-8'>
                    <p className='text-sm leading-relaxed text-[#405148] border-b border-[#2F6B57] pb-6'>
                        TimmyTails respects your privacy. This policy explains what information we collect, how it is handled, and your choices when using our pet grooming appointment platform.
                    </p>

                    <div className='space-y-8'>
                        {sections.map(({ title, content }) => (
                            <section key={title} className='border-b border-[#2F6B57] pb-6 last:border-0 last:pb-0'>
                                <h2 className='font-serif text-xl font-bold text-[#13231B] mb-3'>{title}</h2>
                                <div className='text-sm leading-relaxed text-[#405148]'>{content}</div>
                            </section>
                        ))}
                    </div>

                    <div className='rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] p-4 text-xs text-[#405148]'>
                        Updates to this Privacy Policy will be published directly on this page with an updated effective date.
                    </div>
                </div>
            </div>
        </div>
    )
}
