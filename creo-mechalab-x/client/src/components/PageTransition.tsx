/* SECTION: IMPORTS & TYPES 
   - USE: Imports Framer Motion for high-performance hardware-accelerated animations.
   - KEYPOINT: Uses 'import type' for Transition and Variants to satisfy strict TypeScript 
     module syntax (verbatimModuleSyntax).
*/
import { motion } from 'framer-motion';
import type { Transition, Variants } from 'framer-motion';
import type { ReactNode } from 'react';

/* SECTION: ANIMATION VARIANTS (pageVariants)
   - USE: Defines the three states of a page: 'initial' (pre-entry), 'in' (active), and 'out' (exit).
   - HOW IT WORKS: Combined scale (0.98 to 1.02) and blur (10px to 0px) creates a "Morph" effect.
   - EDIT: To change the "feel," adjust 'scale' (e.g., set to 1 for no zoom) or 'filter' (to remove blur).
   - IF REWRITTEN: Ensure 'initial', 'in', and 'out' keys match the props in the component below.
*/
const pageVariants: Variants = {
    initial: {
        opacity: 0,
        scale: 0.98,
        filter: "blur(10px)"
    },
    in: {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)"
    },
    out: {
        opacity: 0,
        scale: 1.02,
        filter: "blur(10px)"
    }
};

/* SECTION: TRANSITION CONFIGURATION
   - USE: Controls the speed and "easing" (the curve of the movement).
   - KEYPOINT: Duration is set to 0.4s to coordinate with the Login logic delays.
   - HOW TO EDIT: Change 'duration' to make transitions faster or slower.
*/
const pageTransition: Transition = {
    type: "tween",
    ease: "easeInOut",
    duration: 0.4
};

interface Props {
    children: ReactNode;
}

/* SECTION: THE WRAPPER COMPONENT
   - USE: This is a "Higher Order Component" used in App.tsx to wrap every main page.
   - HOW IT WORKS: It applies the variants and transition settings to whatever JSX is placed inside it.
   - IF REWRITTEN: Removing this wrapper will make the app's navigation instant/static, 
     potentially re-introducing the "white flash" effect between page loads.
*/
const PageTransition = ({ children }: Props) => {
    return (
        <motion.div
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;