/* SECTION: IMPORTS
   - USE: Standard React hook and Lucide icon.
*/
import { RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

const PortraitGuard = ({ children }: Props) => {
    const [isPortrait, setIsPortrait] = useState(false);

    /* SECTION: ORIENTATION LISTENER
       - USE: Detects if the device is held vertically.
       - HOW IT WORKS: Listens to the window's matchMedia API for portrait orientation.
    */
    useEffect(() => {
        const mediaQuery = window.matchMedia("(orientation: portrait)");

        const handleOrientationChange = (e: MediaQueryListEvent | MediaQueryList) => {
            // We only care about portrait mode if it's a mobile-sized screen
            // Desktops can be resized vertically without triggering this screen block.
            if (e.matches && window.innerWidth < 768) {
                setIsPortrait(true);
            } else {
                setIsPortrait(false);
            }
        };

        // Check initially
        handleOrientationChange(mediaQuery);

        // Listen for device rotation
        mediaQuery.addEventListener("change", handleOrientationChange);
        return () => mediaQuery.removeEventListener("change", handleOrientationChange);
    }, []);

    if (isPortrait) {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center text-slate-200 select-none p-6 text-center">
                <RotateCcw size={64} className="text-cyan-500 mb-6 animate-[spin_3s_ease-in-out_infinite]" />
                <h1 className="text-2xl font-bold mb-2">Landscape Mode Required</h1>
                <p className="text-slate-400 max-w-sm">
                    The CREO MechaLabX interface requires a wider screen area.
                    Please rotate your device to continue your training.
                </p>
            </div>
        );
    }

    return <>{children}</>;
};

export default PortraitGuard;