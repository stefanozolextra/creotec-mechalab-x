/* SECTION: IMPORTS 
   - USE: Standard React hooks, navigation tools, and UI icons from Lucide.
   - KEYPOINT: PageTransition is the motion wrapper that prevents the "white flash" on entry.
*/
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Settings, Eye, EyeOff } from 'lucide-react'; // Restored Eye icons
import PageTransition from '../components/PageTransition';
import { requestJson } from '../api/http';
import { setAuthSession, type AuthRole } from '../utils/auth';

type LoginResponse = {
    token: string;
    role: AuthRole;
    sub: number;
    account_id: number;
    trainee_id: number | null;
};

const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false); // Restored Toggle State

    /* SECTION: LOGIN LOGIC 
        - USE: Handles authentication via colleague's setAuthRole utility.
    */
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || !password.trim()) {
            setError('Email and password are required.');
            return;
        }

        setError('');
        setLoading(true);

        try {
            const auth = await requestJson<LoginResponse>('/api/auth/login', {
                method: 'POST',
                body: {
                    email: normalizedEmail,
                    password,
                },
            });

            if (!Number.isInteger(auth.account_id) || auth.account_id < 1) {
                throw new Error('Invalid account identity from login response.');
            }
            if (
                auth.role === 'trainee' &&
                (!Number.isInteger(auth.trainee_id) || Number(auth.trainee_id) < 1)
            ) {
                throw new Error('Invalid trainee identity from login response.');
            }

            setAuthSession({
                role: auth.role,
                token: auth.token,
                account_id: auth.account_id,
                trainee_id: auth.trainee_id,
            });
            navigate(auth.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
        } catch (err) {
            const message = err instanceof Error && err.message ? err.message : 'Login failed.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageTransition>
            {/* Restored 'select-none' to prevent ugly text highlighting */}
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 select-none">
                <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">

                    <div className="text-center mb-8">
                        <div className="bg-blue-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Settings aria-hidden="true" className="text-yellow-400 w-10 h-10" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">CREO MechaLabX</h1>
                        <p className="text-slate-500">TESDA NC II Trainer</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6" aria-busy={loading}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Username / E-mail</label>
                            <div className="relative">
                                {/* Restored 'pointer-events-none' on icon */}
                                <User aria-hidden="true" className="absolute left-3 top-3 text-slate-400 w-5 h-5 pointer-events-none" />
                                <input
                                    id="email"
                                    name="email"
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none select-text"
                                    placeholder="Enter your e-mail"
                                    autoComplete="username"
                                    disabled={loading}
                                    required
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={error ? 'login-error' : undefined}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                            <div className="relative">
                                <Lock aria-hidden="true" className="absolute left-3 top-3 text-slate-400 w-5 h-5 pointer-events-none" />
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"} // Restored Toggle Logic
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none select-text"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    disabled={loading}
                                    required
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={error ? 'login-error' : undefined}
                                />
                                {/* Restored Eye Toggle Button */}
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition outline-none"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p id="login-error" className="text-sm font-medium text-red-600" role="alert">{error}</p>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-blue-900 text-white py-3 rounded font-semibold hover:bg-blue-800 transition flex justify-center"
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Login'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <button type="button" className="text-blue-600 hover:underline">Forgot Password?</button>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default Login;
