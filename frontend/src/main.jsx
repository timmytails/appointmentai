import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <App />
            <Toaster
                position='top-right'
                toastOptions={{
                    duration: 4000,
                    style: {
                        borderRadius: '12px',
                        border: '1px solid #F6F7F2',
                        background: '#F6F7F2',
                        color: '#13231B',
                        fontWeight: 600
                    },
                    success: { iconTheme: { primary: '#13231B', secondary: '#F6F7F2' } },
                    error: { iconTheme: { primary: '#2F6B57', secondary: '#F6F7F2' } }
                }}
            />
        </AuthProvider>
    </React.StrictMode>
)
