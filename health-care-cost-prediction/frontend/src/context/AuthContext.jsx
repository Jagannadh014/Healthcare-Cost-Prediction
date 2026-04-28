import React, { createContext, useState, useContext, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(null)
    const [loading, setLoading] = useState(true)

    // Load token and user from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('healthcare_token')
        const storedUser = localStorage.getItem('healthcare_user')

        if (storedToken && storedUser) {
            setToken(storedToken)
            setUser(JSON.parse(storedUser))
            // Set default axios header
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
        }
        setLoading(false)
    }, [])

    const login = async (email, password) => {
        try {
            const res = await axios.post('http://localhost:5000/auth/login', {
                email,
                password
            })

            const { token: newToken, user: newUser } = res.data

            // Store in state
            setToken(newToken)
            setUser(newUser)

            // Store in localStorage
            localStorage.setItem('healthcare_token', newToken)
            localStorage.setItem('healthcare_user', JSON.stringify(newUser))

            // Set default axios header
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`

            return { success: true, user: newUser }
        } catch (err) {
            const errorMsg = err?.response?.data?.error || err.message
            return { success: false, error: errorMsg }
        }
    }

    const adminLogin = async (email, password) => {
        try {
            const res = await axios.post('http://localhost:5000/admin/login', {
                email,
                password
            })

            const { token: newToken, user: newUser } = res.data

            setToken(newToken)
            setUser(newUser)

            localStorage.setItem('healthcare_token', newToken)
            localStorage.setItem('healthcare_user', JSON.stringify(newUser))

            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`

            return { success: true, user: newUser }
        } catch (err) {
            const errorMsg = err?.response?.data?.error || err.message
            return { success: false, error: errorMsg }
        }
    }

    const register = async (email, password, role = 'user') => {
        try {
            const res = await axios.post('http://localhost:5000/auth/register', {
                email,
                password,
                role
            })

            // Don't auto-login after registration
            // User will be redirected to login page
            return { success: true, message: 'Account created successfully' }
        } catch (err) {
            const errorMsg = err?.response?.data?.error || err.message
            return { success: false, error: errorMsg }
        }
    }

    const logout = () => {
        setToken(null)
        setUser(null)
        localStorage.removeItem('healthcare_token')
        localStorage.removeItem('healthcare_user')
        delete axios.defaults.headers.common['Authorization']
    }

    const isAuthenticated = () => {
        return !!token && !!user
    }

    const hasRole = (role) => {
        return user?.role === role
    }

    const value = {
        user,
        token,
        loading,
        login,
        adminLogin,
        register,
        logout,
        isAuthenticated,
        hasRole
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
