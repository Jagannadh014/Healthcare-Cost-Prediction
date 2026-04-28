import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Skeleton from '../components/Skeleton'

export default function AdminDashboard() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const { logout, user } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        try {
            const res = await axios.get('http://localhost:5000/admin/users')
            setUsers(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Admin Header */}
            <header className="bg-gray-900 text-white p-4 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-teal-500 w-8 h-8 rounded flex items-center justify-center font-bold">A</div>
                        <h1 className="text-lg font-semibold tracking-wide">Admin Portal</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">Logged in as {user?.email}</span>
                        <button
                            onClick={() => { logout(); navigate('/admin/login') }}
                            className="bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto w-full p-6 flex-grow">
                <div className="mb-6 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Monitor registered users and inspect prediction activities.
                        </p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <button
                            onClick={() => navigate('/admin/analytics')}
                            className="bg-white border text-gray-600 px-4 py-2 rounded shadow-sm hover:text-teal-600 hover:border-teal-600 transition font-medium text-sm"
                        >
                            📊 View Analytics
                        </button>
                        <div className="text-sm bg-white border px-3 py-2 rounded shadow-sm text-gray-600">
                            Total Users: <strong>{users.length}</strong>
                        </div>
                    </div>
                </div>

                {loading ? <Skeleton rows={5} /> : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b">
                                <tr>
                                    <th className="p-4">User Email</th>
                                    <th className="p-4">User ID</th>
                                    <th className="p-4">Registered On</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-gray-400">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map(u => (
                                        <tr key={u.user_id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="p-4 font-medium text-gray-800">
                                                {u.email}
                                            </td>
                                            <td className="p-4">
                                                <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                                    {u.user_id}
                                                </code>
                                            </td>
                                            <td className="p-4 text-gray-600 text-sm">
                                                {new Date(u.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => navigate(`/admin/users/${u.user_id}`)}
                                                    className="bg-white border border-gray-300 text-gray-700 px-3 py-1 text-xs rounded hover:border-teal-500 hover:text-teal-600 transition-colors shadow-sm font-medium"
                                                >
                                                    View Activity
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    )
}
