import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Settings, Eye, EyeOff, AlertTriangle, Sun, Moon } from 'lucide-react';
// import PageTransition from '../components/PageTransition';
import HangarDoors from '../components/HangarDoors'; // <-- RESTORED IMPORT
import { requestJson } from '../api/http';
import { setAuthSession, type AuthRole } from '../utils/auth';

type LoginResponse = {
    token: string;
    role: AuthRole;
    sub: number;
    account_id: number;
    trainee_id: number | null;
};

// --- SCI-FI ANIMATED TELEMETRY COMPONENT ---
const AnimatedTelemetryBar = ({ label, texts, defaultLevel }: { label: string, texts: string[], defaultLevel: number }) => {
    const [level, setLevel] = useState(defaultLevel);

    useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() > 0.75) {
                setLevel(Math.floor(Math.random() * 4));
            } else {
                setLevel(defaultLevel);
            }
        }, 600 + Math.random() * 1500);
        return () => clearInterval(interval);
    }, [defaultLevel]);

    let colorClass = "";
    let textClass = "";
    let bars: React.JSX.Element[] = [];

    if (level === 3) {
        colorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]";
        textClass = "text-emerald-600 dark:text-emerald-400";
        bars = [1, 2, 3].map(i => <div key={i} className={`w-3 h-1 ${colorClass} transition-all duration-200`} />);
    } else if (level === 2) {
        colorClass = "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]";
        textClass = "text-cyan-600 dark:text-cyan-400";
        bars = [1, 2].map(i => <div key={i} className={`w-3 h-1 ${colorClass} transition-all duration-200`} />);
    } else if (level === 1) {
        colorClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]";
        textClass = "text-amber-600 dark:text-amber-400";
        bars = [1].map(i => <div key={i} className={`w-3 h-1 ${colorClass} transition-all duration-200`} />);
    } else {
        colorClass = "bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.8)]";
        textClass = "text-rose-600 dark:text-rose-400 animate-pulse";
        bars = [1].map(i => <div key={i} className={`w-1.5 h-1 ${colorClass} transition-all duration-200`} />);
    }

    return (
        <div className="flex flex-col gap-1 w-24">
            <span className="dark:text-slate-400">{label} //</span>
            <div className="flex gap-1 h-1 items-center">
                {bars}
            </div>
            <span className={`${textClass} mt-1 transition-colors duration-300 font-bold`}>{texts[level]}</span>
        </div>
    );
};

// --- SCI-FI RUNNING TERMINAL LOG (RIGHT ALIGNED) ---
const THEME_LOGS = [
    "sys.boot.init()",
    "load_module('PNEUMATICS')",
    "verify_relay_uplink",
    "PLC_TICK_RATE: 10ms",
    "awaiting_sensor_data",
    "valves.check('ALL')_OK",
    "compressor == ONLINE",
    "parse_ladder_diagram()",
    "ESTABLISH_SECURE_LINK",
    "handshake_req(auth)",
    "[WARN] minor_pressure_drop",
    "compensating_pressure()",
    "override_lock: FALSE",
    "execute_sequence(0x00)",
    "V_2.0.4 ALIGNMENT_DONE",
    "IO_PORTS: [1 0 0 1 1]",
    "allocating_memory(1GB)",
    "MOUNT_VFS: /sim_data",
    "AWAIT_USER_AUTH"
];

const AnimatedTerminalLog = () => {
    const [lines, setLines] = useState<string[]>(() =>
        Array.from({ length: 12 }, () =>
            `${THEME_LOGS[Math.floor(Math.random() * THEME_LOGS.length)]} [0x${Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0')}]`
        )
    );

    useEffect(() => {
        const interval = setInterval(() => {
            setLines(prev => {
                const nextLine = `${THEME_LOGS[Math.floor(Math.random() * THEME_LOGS.length)]} [0x${Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0')}]`;
                const newLines = [...prev, nextLine];
                if (newLines.length > 12) newLines.shift();
                return newLines;
            });
        }, 800);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 flex-col w-[260px] pointer-events-none z-0">
            {/* Header: Line stretches from left to right */}
            <div className="flex items-center justify-end gap-2 mb-4 opacity-80">
                <div className="flex-1 h-[1px] bg-cyan-500/30 dark:bg-cyan-400/30"></div>
                <span className="text-[10px] font-black tracking-[0.2em] text-cyan-700 dark:text-cyan-400 uppercase">// SYS.LOG</span>
                <div className="w-1.5 h-1.5 bg-cyan-500 dark:bg-cyan-400 animate-pulse"></div>
            </div>

            {/* Log Container */}
            <div
                className="flex flex-col justify-end h-[180px] overflow-hidden"
                style={{
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 100%)',
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 100%)'
                }}
            >
                <div className="flex flex-col items-end gap-2 text-[9px] font-mono tracking-widest break-all text-right">
                    {lines.map((line, i) => {
                        const isLast = i === lines.length - 1;
                        return (
                            <span
                                key={i}
                                className={`${isLast ? 'text-cyan-600 dark:text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' : 'text-slate-400 dark:text-slate-400/80'} transition-all duration-300`}
                            >
                                {line}
                            </span>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};
// ---------------------------------------------------

const Login = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // --- THEME TOGGLE STATE ---
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
        typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
    );

    const toggleTheme = () => {
        const newMode = !isDarkMode;
        setIsDarkMode(newMode);
        document.documentElement.classList.toggle('dark', newMode);
    };
    // -------------------------------

    // --- RESTORED: DOOR STATE ---
    const [isHangarClosed, setIsHangarClosed] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsHangarClosed(false); // Slide doors open to reveal login screen
        }, 300);
        return () => clearTimeout(timer);
    }, []);
    // ----------------------------

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

            // --- RESTORED: TRIGGER HANGAR DOORS TO CLOSE ---
            setIsHangarClosed(true);

            setTimeout(() => {
                navigate(auth.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
            }, 1500);
            // -----------------------------------------------

        } catch (err) {
            const message = err instanceof Error && err.message ? err.message : 'Login failed.';
            setError(message);
            setLoading(false); // Keep this in catch so the button stays "AUTHORIZING..." during success door animation
        }
    };

    return (
        // <PageTransition>
        <div className={`min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-slate-900 font-sans relative z-0 overflow-hidden px-4 sm:px-6 select-none transition-colors duration-500 ${isDarkMode ? 'dark' : ''}`}>

            {/* --- THEME TOGGLE BUTTON --- */}
            <button
                type="button"
                onClick={toggleTheme}
                className="absolute top-6 right-6 z-50 p-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-cyan-400 hover:scale-105 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
                title="Toggle Theme"
            >
                {isDarkMode ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
            </button>
            {/* -------------------------------- */}

            {/* --- LOBBY ENVIRONMENT & ATMOSPHERE --- */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1)_0%,transparent_60%)] dark:bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.08)_0%,rgba(15,23,42,1)_70%)] pointer-events-none -z-20" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.05)_50%)] dark:bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none -z-10 opacity-50" />

            {/* Left Bulkhead Telemetry */}
            <div className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 flex-col gap-6 text-[10px] font-mono font-black tracking-[0.2em] text-slate-400 dark:text-slate-400 pointer-events-none opacity-80">
                <AnimatedTelemetryBar label="SYS.STATUS" defaultLevel={3} texts={['CRITICAL', 'DEGRADED', 'NOMINAL', 'ONLINE']} />
                <AnimatedTelemetryBar label="HANGAR.ENV" defaultLevel={3} texts={['BREACH', 'VENTING', 'STABILIZING', 'PRESSURIZED']} />
                <AnimatedTelemetryBar label="TRAINER.LINK" defaultLevel={1} texts={['OFFLINE', 'SEARCHING', 'CONNECTING', 'STANDBY']} />
            </div>

            {/* Right Bulkhead Terminal Log */}
            <AnimatedTerminalLog />
            {/* -------------------------------------- */}

            {/* --- MAIN ACCESS TERMINAL --- */}
            <div className="w-full max-w-[440px] relative z-10 flex flex-col">

                {/* Targeting Brackets (Outer Frame) */}
                <div className="absolute -inset-4 border border-slate-300/50 dark:border-cyan-500/30 pointer-events-none rounded-xl">
                    <div className="absolute -top-[1px] -left-[1px] w-8 h-8 border-t-2 border-l-2 border-cyan-500 rounded-tl-xl pointer-events-none" />
                    <div className="absolute -top-[1px] -right-[1px] w-8 h-8 border-t-2 border-r-2 border-cyan-500 rounded-tr-xl pointer-events-none" />
                    <div className="absolute -bottom-[1px] -left-[1px] w-8 h-8 border-b-2 border-l-2 border-cyan-500 rounded-bl-xl pointer-events-none" />
                    <div className="absolute -bottom-[1px] -right-[1px] w-8 h-8 border-b-2 border-r-2 border-cyan-500 rounded-br-xl pointer-events-none" />
                </div>

                {/* Terminal Glass Container */}
                <div className="bg-white/90 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-600/50 shadow-2xl rounded-lg overflow-hidden transition-colors duration-300">

                    {/* Terminal Header */}
                    <div className="px-8 py-8 border-b border-slate-200 dark:border-slate-700/80 flex flex-col items-center text-center gap-3 relative overflow-hidden">
                        {/* Animated Background Line */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50" />
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-cyan-500/30 rounded-2xl flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative">
                            <Settings size={32} className="text-cyan-600 dark:text-cyan-400 animate-[spin_6s_linear_infinite]" strokeWidth={1.5} />
                            <div className="absolute inset-0 border border-cyan-500/50 rounded-2xl animate-[ping_3s_infinite]" />
                        </div>

                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-[0.15em] uppercase">CREOSim-MECHA</h1>
                            <p className="text-[10px] text-slate-500 dark:text-cyan-400/80 font-mono uppercase tracking-[0.2em] font-bold mt-1">
                                TESDA Mechatronics NC II Trainer
                            </p>
                        </div>

                        <div className="flex items-center gap-2 mt-2 bg-amber-100/50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/60 px-3 py-1 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[9px] text-amber-700 dark:text-amber-400 font-mono uppercase tracking-widest font-black">Authorization Required</span>
                        </div>
                    </div>

                    {/* Terminal Body */}
                    <div className="p-8">
                        <form onSubmit={handleLogin} className="flex flex-col gap-5">

                            {/* Email Input */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black tracking-widest uppercase text-slate-500 dark:text-slate-300 flex justify-between">
                                    <span>Username / Email</span>
                                </label>
                                <div className="relative flex items-center group">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 dark:bg-slate-600 group-focus-within:bg-cyan-500 transition-colors" />
                                    <User size={16} className="absolute left-4 text-slate-400 dark:text-slate-400 group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors" strokeWidth={2} />
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-mono px-11 py-3.5 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-cyan-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        placeholder="cadet@creosim.net"
                                        autoComplete="email"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="flex flex-col gap-1.5 mt-2">
                                <label className="text-[10px] font-black tracking-widest uppercase text-slate-500 dark:text-slate-300 flex justify-between">
                                    <span>Password</span>
                                </label>
                                <div className="relative flex items-center group">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 dark:bg-slate-600 group-focus-within:bg-cyan-500 transition-colors" />
                                    <Lock size={16} className="absolute left-4 text-slate-400 dark:text-slate-400 group-focus-within:text-cyan-600 dark:group-focus-within:text-cyan-400 transition-colors" strokeWidth={2} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        name="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-mono px-11 py-3.5 focus:outline-none focus:bg-white dark:focus:bg-slate-950 focus:border-cyan-500/50 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 text-slate-400 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors outline-none"
                                    >
                                        {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                                    </button>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mt-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-md p-3 flex items-start gap-3">
                                    <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" strokeWidth={2.5} />
                                    <p id="login-error" className="text-[11px] font-mono uppercase tracking-wider text-rose-700 dark:text-rose-300 leading-relaxed" role="alert">
                                        <span className="font-black">AUTH FAULT:</span> {error}
                                    </p>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-6 w-full bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600/80 dark:hover:bg-cyan-500 text-white dark:text-white border border-transparent dark:border-cyan-500/50 py-4 rounded-md font-black text-xs tracking-[0.2em] uppercase transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3 relative overflow-hidden group"
                            >
                                {/* Button Scanline Effect */}
                                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(255,255,255,0.1)_50%)] bg-[length:100%_4px] pointer-events-none group-hover:opacity-50 transition-opacity" />

                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 dark:border-white/50 border-t-white dark:border-t-white rounded-full animate-spin" />
                                        AUTHORIZING...
                                    </>
                                ) : (
                                    'LOG IN'
                                )}
                            </button>
                        </form>

                        <div className="mt-8 flex justify-between items-center text-[10px] font-bold font-mono tracking-widest uppercase text-slate-500 dark:text-slate-400 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <span>V_1.0.0 ONLINE</span>
                            <button type="button" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                                FORGOT PASSWORD?
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- RESTORED: RENDER HANGAR DOORS --- */}
            <HangarDoors isClosed={isHangarClosed} />
        </div>
    );
};

export default Login;