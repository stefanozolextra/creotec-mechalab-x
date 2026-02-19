/* SECTION: IMPORTS 
   - USE: Navigation hook and industrial-themed icons.
   - KEYPOINT: Wrapped in PageTransition to keep the fluid motion even when hitting an error.
*/
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, PlugZap } from 'lucide-react';
import PageTransition from '../components/PageTransition';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <PageTransition>
            {/* SECTION: MAIN LAYOUT 
                - USE: Centered, full-screen flex container with a dark industrial background.
                - KEYPOINT: 'select-none' prevents text highlighting for a native-app feel.
            */}
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 select-none relative overflow-hidden">

                {/* Visual aesthetic: Faint background grid to look like a blueprint/schematic */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)', backgroundSize: '30px 30px' }}
                ></div>

                {/* SECTION: ERROR MESSAGE CONTAINER */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-10 max-w-lg w-full text-center relative z-10">

                    {/* Floating Warning Icon */}
                    <div className="bg-red-500/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                        <PlugZap className="text-red-500 w-12 h-12" aria-hidden="true" />
                    </div>

                    <h1 className="text-6xl font-black text-white mb-2 tracking-tight">404</h1>
                    <h2 className="text-xl font-bold text-red-400 mb-4 uppercase tracking-widest flex items-center justify-center gap-2">
                        <AlertTriangle size={20} /> System Fault
                    </h2>

                    <p className="text-slate-400 mb-8 leading-relaxed">
                        <span className="text-slate-300 font-semibold">Destination Unreachable.</span><br />
                        The circuit path you are trying to access does not exist or has been disconnected from the main terminal.
                    </p>

                    {/* SECTION: RECOVERY ACTION 
                        - USE: Navigates the user safely back to the root ('/') which will auto-redirect them 
                          to either the Login screen or their appropriate Dashboard via our Auth Wrapper.
                    */}
                    <button
                        onClick={() => navigate('/', { replace: true })}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-700 hover:border-slate-500 group"
                    >
                        <Home size={20} className="text-cyan-500 group-hover:scale-110 transition-transform" />
                        Reboot Interface
                    </button>

                </div>
            </div>
        </PageTransition>
    );
};

export default NotFound;