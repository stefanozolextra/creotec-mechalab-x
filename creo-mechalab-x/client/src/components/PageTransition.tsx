import { motion } from 'framer-motion';
import type { Transition, Variants } from 'framer-motion';
import type { ReactNode } from 'react';

// The "Fluid Morph" effect
// The page will slightly zoom out and blur when leaving,
// and zoom in from a blur when entering.
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

const pageTransition: Transition = {
    type: "tween",
    ease: "easeInOut",
    duration: 0.4 // Quick but noticeable
};

interface Props {
    children: ReactNode;
}

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