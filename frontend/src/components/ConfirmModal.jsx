import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmModal({
    isOpen,
    title = 'Confirm Action',
    description = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    loading = false,
    onConfirm,
    onClose
}) {
    if (!isOpen) return null

    const isDanger = variant === 'danger'

    return (
        <div
            className='fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#13231B]/40 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto'
            onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
        >
            <div className='w-full max-w-sm overflow-hidden rounded-t-2xl sm:rounded-xl bg-[#F6F7F2] p-5 shadow-lg border border-[#DDE4DE] space-y-4 text-[#13231B] pb-safe sm:pb-5'>
                <div className='flex items-start gap-3'>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${isDanger ? 'bg-[#FBEAEA] text-[#9E3E3E] border border-[#F0CCCC]' : 'bg-[#EDF3EE] text-[#1F4D3E] border border-[#C9D9CE]'}`}>
                        <AlertTriangle size={20} />
                    </span>
                    <div className='min-w-0'>
                        <h3 className='font-serif text-lg font-bold text-[#13231B] leading-snug'>
                            {title}
                        </h3>
                        <p className='mt-1 text-xs text-[#405148] leading-relaxed'>
                            {description}
                        </p>
                    </div>
                </div>

                <div className='flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-[#2F6B57]'>
                    <button
                        type='button'
                        onClick={onClose}
                        disabled={loading}
                        className='w-full sm:w-auto rounded-lg border border-[#DDE4DE] bg-[#F6F7F2] px-4 py-2 text-xs font-bold text-[#405148] text-center transition hover:bg-[#F6F7F2] disabled:opacity-50 whitespace-nowrap shrink-0'
                    >
                        {cancelText}
                    </button>
                    <button
                        type='button'
                        onClick={onConfirm}
                        disabled={loading}
                        className={`w-full sm:w-auto rounded-lg px-4 py-2 text-xs font-bold text-[#F6F7F2] text-center transition disabled:opacity-60 whitespace-nowrap shrink-0 ${
                            isDanger
                                ? 'bg-[#2F6B57] hover:bg-[#1F4D3E]'
                                : 'bg-[#2F6B57] hover:bg-[#1F4D3E]'
                        }`}
                    >
                        {loading ? 'Processing...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}

