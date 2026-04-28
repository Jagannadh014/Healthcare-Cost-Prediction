import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { motion } from 'framer-motion'
import clsx from 'clsx'

export default function Login({ onSwitchToSignup }) {
    const { login } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!email || !password) {
            toast.error('Email and password are required')
            return
        }

        setLoading(true)

        try {
            const result = await login(email, password)

            if (result.success) {
                toast.success(`Welcome back, ${result.user.email}!`)
                // App.jsx will handle redirect
            } else {
                toast.error(result.error)
            }
        } catch (err) {
            toast.error('Login failed: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Panel - Visual (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 to-accent-600/20 z-10"></div>
                {/* Abstract Shapes */}
                <div className="absolute top-0 left-0 w-full h-full opacity-30">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-500 blur-[100px]"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-500 blur-[100px]"></div>
                </div>

                <div className="relative z-20 flex flex-col justify-center px-12 text-white">
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl mb-6">
                            <svg className="w-6 h-6 text-accent-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-4xl font-display font-bold mb-4 leading-tight">
                            Healthcare Intelligence <br />
                            <span className="text-accent-300">Simplified.</span>
                        </h1>
                        <p className="text-slate-300 text-lg max-w-md leading-relaxed">
                            Experience the next generation of AI-powered cost prediction.
                            Transparent, accurate, and secure.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center space-x-3 text-slate-300">
                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-accent-500/20 text-accent-300">✓</span>
                            <span>Uncertainty Quantification</span>
                        </div>
                        <div className="flex items-center space-x-3 text-slate-300">
                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-accent-500/20 text-accent-300">✓</span>
                            <span>Interactive Simulations</span>
                        </div>
                        <div className="flex items-center space-x-3 text-slate-300">
                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-accent-500/20 text-accent-300">✓</span>
                            <span>Real-time Analytics</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12">
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-sm"
                >
                    <div className="mb-8">
                        <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Welcome back</h2>
                        <p className="text-slate-500">Please enter your details to sign in.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="field-wrap">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                className="input-primary"
                                disabled={loading}
                            />
                        </div>

                        <div className="field-wrap">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="input-primary"
                                disabled={loading}
                            />
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center">
                                <input type="checkbox" id="remember" className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                <label htmlFor="remember" className="ml-2 text-slate-500">Remember me</label>
                            </div>
                            <a href="#" className="font-medium text-primary-600 hover:text-primary-500">Forgot password?</a>
                        </div>

                        <motion.button
                            type="submit"
                            whileTap={{ scale: 0.98 }}
                            className={clsx(
                                'w-full btn bg-primary-600 text-black hover:bg-primary-700 shadow-lg shadow-primary-500/30 flex justify-center items-center',
                                loading && 'opacity-80 cursor-wait'
                            )}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </>
                            ) : 'Sign in'}
                        </motion.button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-slate-500">or continue with</span>
                            </div>
                        </div>

                        <button type="button" className="w-full btn btn-secondary flex items-center justify-center">
                            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm">
                        <span className="text-slate-500">Don't have an account? </span>
                        <button onClick={onSwitchToSignup} className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
                            Sign up for free
                        </button>
                    </div>
                </motion.div>

                {/* Admin Link Footer */}
                <div className="absolute bottom-6 w-full lg:w-1/2 right-0 text-center">
                    <a href="/admin/login" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Staff Login</a>
                </div>
            </div>
        </div>
    )
}
