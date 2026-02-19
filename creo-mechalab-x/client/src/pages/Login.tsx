import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Settings } from 'lucide-react';

const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // MOCK LOGIN: Simulate a 1-second delay then redirect
        setTimeout(() => {
            navigate('/dashboard');
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">

                {/* Header / Logo Area */}
                <div className="text-center mb-8">
                    <div className="bg-blue-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Settings className="text-yellow-400 w-10 h-10" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">CREO MechaLabX</h1>
                    <p className="text-slate-500">Mechatronics NC II Trainer</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Username / E-mail</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Enter your ID"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                            <input
                                type="password"
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-900 text-white py-3 rounded font-semibold hover:bg-blue-800 transition flex justify-center"
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : 'Login'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <a href="#" className="text-blue-600 hover:underline">Forgot Password?</a>
                </div>
            </div>
        </div>
    );
};

export default Login;