/* SECTION: IMPORTS 
   - USE: Standard React hooks, navigation tools, and UI icons from Lucide.
   - [cite_start]KEYPOINT: PageTransition is the motion wrapper that prevents the "white flash" on entry[cite: 104].
*/
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Settings } from 'lucide-react';
import PageTransition from '../components/PageTransition';

const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    /* SECTION: LOGIN LOGIC (MOCK)
       - USE: Simulates the authentication process.
       - HOW IT WORKS: Prevents page reload, triggers a 'Loading' state, and redirects to Dashboard after 800ms.
       - [cite_start]EDIT: Replace the setTimeout with an actual API call to your MySQL backend later[cite: 33, 40].
    */
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            navigate('/dashboard');
        }, 800);
    };

    return (
        /* SECTION: ANIMATION WRAPPER
           - [cite_start]USE: Encapsulates the entire view to provide a fluid "Morph" transition[cite: 104].
           - HOW TO EDIT: Changing variants in the PageTransition component affects this page.
        */
        <PageTransition>
            {/* SECTION: UI LAYOUT
                - [cite_start]USE: Centered flex container with a dark background to match the "Industrial" aesthetic[cite: 106].
                - KEYPOINT: Uses a max-width container to ensure the form remains scannable on desktops.
            */}
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">

                    {/* SECTION: BRANDING AREA
                        - [cite_start]USE: Displays the CREO MechaLabX logo and project title[cite: 92, 108].
                        - HOW TO EDIT: Change the icon or h1 text to update the app name globally.
                    */}
                    <div className="text-center mb-8">
                        <div className="bg-blue-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Settings className="text-yellow-400 w-10 h-10" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">CREO MechaLabX</h1>
                        <p className="text-slate-500">Mechatronics NC II Trainer</p>
                    </div>

                    {/* SECTION: INPUT FIELDS
                        - [cite_start]USE: Captures Trainee credentials[cite: 99, 100].
                        - KEYPOINT: Icons are positioned absolutely inside relative wrappers for a modern feel.
                        - EDIT: Add 'value' and 'onChange' props here to bind these inputs to a React state.
                    */ }
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

                        {/* SECTION: SUBMIT BUTTON
                            - USE: Finalizes login and triggers handleLogin.
                            - KEYPOINT: 'disabled' attribute prevents multiple submissions while loading.
                        */}
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
        </PageTransition>
    );
};

export default Login;