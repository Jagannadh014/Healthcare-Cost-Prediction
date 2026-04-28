import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Predictor from './pages/Predictor'
import Analytics from './pages/Analytics'
import Feedback from './pages/Feedback'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminUserDetail from './pages/AdminUserDetail'
import AdminAnalytics from './pages/AdminAnalytics'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { BrowserRouter as Router, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

function AppContent() {
  const { user, logout, isAuthenticated, loading, hasRole } = useAuth()
  const [activeTab, setActiveTab] = useState('predictor')
  const [showSignup, setShowSignup] = useState(false)

  // Use useLocation for reactive path changes
  const location = useLocation()
  const path = location.pathname

  // Handle Admin Routes
  if (path.startsWith('/admin')) {
    if (path === '/admin/login') {
      return <AdminLogin />
    }
    // Protected Admin Routes
    if (!isAuthenticated() || !hasRole('admin')) {
      // If trying to access admin dashboard but not logged in as admin, 
      // direct to admin login
      if (isAuthenticated() && !hasRole('admin')) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">You do not have administrative privileges.</p>
            <button onClick={logout} className="px-4 py-2 bg-gray-800 text-white rounded">Logout</button>
          </div>
        )
      }
      return <AdminLogin />
    }

    // Admin is authenticated
    if (path === '/admin/dashboard') {
      return <AdminDashboard />
    }
    if (path === '/admin/analytics') {
      return <AdminAnalytics />
    }
    if (path.startsWith('/admin/users/')) {
      // Extract ID manually since we aren't using a <Route> definition here
      const userId = path.split('/')[3]
      return <AdminUserDetail userIdProp={userId} />
    }
  }

  // Normal User Flow
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated()) {
    if (showSignup) {
      return <Signup onSwitchToLogin={() => setShowSignup(false)} />
    }
    return <Login onSwitchToSignup={() => setShowSignup(true)} />
  }

  const tabs = [
    { id: 'predictor', label: 'Predict Cost' },
    { id: 'feedback', label: 'Submit Feedback' },
    { id: 'analytics', label: 'Analytics & Bias' }
  ]

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar moved to top (Sticky) */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-primary-500/30">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="font-display font-bold text-xl text-slate-900 tracking-tight">Health<span className="text-primary-600">Predict</span></span>
              </div>

              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                                inline-flex items-center px-4 py-2 border-b-2 text-sm font-medium transition-all duration-200
                                ${activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }
                               `}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-sm font-medium text-slate-700">{user?.email}</span>
                <span className="text-xs text-slate-400 capitalize">{user?.role} Account</span>
              </div>

              <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold border-2 border-white shadow-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </div>

              <button
                onClick={logout}
                className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-slate-100"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'predictor' && <Predictor />}
          {activeTab === 'feedback' && <Feedback />}
          {activeTab === 'analytics' && <Analytics />}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-slate-400">
            &copy; 2025 Healthcare Intelligence Systems. All rights reserved. • <a href="#" className="hover:text-primary-600">Privacy</a> • <a href="#" className="hover:text-primary-600">Terms</a>
          </p>
        </div>
      </footer>

      <ToastContainer position="bottom-right" autoClose={4000} theme="colored" className="toastify-custom" />
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}
