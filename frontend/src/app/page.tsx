"use client";

import { motion, Variants } from "framer-motion";
import { Coffee, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";

// --- NEW COMPONENT: Ambient Spinning Circles ---
function AmbientCircles({ className }: { className: string }) {
  // We create 5 "ash" particles per circle group
  const ashParticles = [1, 2, 3, 4, 5];

  return (
    <div className={`absolute w-64 h-64 opacity-20 pointer-events-none ${className}`}>
      {/* 1. Outer Circle: Smooth Curly (Wavy Ring) - Spins Counter-Clockwise */}
      <motion.div
        className="absolute inset-0 text-amber-900"
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="4">
          {/* A path that looks like a smooth wavy flower/curly ring */}
          <path d="M 100, 10
            C 120, 10 130, 30 150, 30
            C 170, 30 180, 50 180, 70
            C 180, 90 190, 100 170, 120
            C 150, 140 140, 160 120, 160
            C 100, 160 90, 180 70, 180
            C 50, 180 40, 160 20, 160
            C 0,  160 10, 140 10, 120
            C 10, 100 0,  80  20, 60
            C 40, 40  50, 20  70, 20
            C 90, 20  100, 10 100, 10 Z"
          />
        </svg>
      </motion.div>

      {/* 2. Inner Circle: Bumps on a highway with a hole - Spins Clockwise */}
      <motion.div
        className="absolute inset-8 text-amber-900"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* We use a thick dashed stroke to create the "highway bumps" and leave the center transparent */}
          <circle
            cx="50"
            cy="50"
            r="35"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray="10 8" // This creates the bumps!
            strokeLinecap="round" // Makes the bumps smooth
          />
        </svg>
      </motion.div>

      {/* 3. The Ash Particles coming out of them */}
      {ashParticles.map((particle, index) => (
        <motion.div
          key={particle}
          className="absolute w-2 h-2 bg-amber-900 rounded-full left-1/2 top-1/2"
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0], // Fade in, then fade out
            y: [-10, -80 - (index * 20)], // Float upwards
            x: [0, (index % 2 === 0 ? 30 : -30)], // Drift left or right
            scale: [0.5, 1.5, 0.5]
          }}
          transition={{
            repeat: Infinity,
            duration: 3 + index, // Different speeds so they don't look robotic
            delay: index * 0.8,  // Stagger their start times
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
}
// -----------------------------------------------

export default function WelcomeGate() {
  const router = useRouter();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.2 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  return (
    // Note: We added 'relative' and 'overflow-hidden' here so the circles stay inside the screen
    <main className="relative overflow-hidden min-h-screen bg-stone-100 flex flex-col items-center justify-center p-6 font-sans">

      {/* Background Decor: Top Left */}
      <AmbientCircles className="-top-16 -left-16" />

      {/* Background Decor: Bottom Right */}
      <AmbientCircles className="-bottom-16 -right-16" />

      {/* Main Content (Needs z-10 so it stays above the background) */}
      <motion.div
        className="relative z-10 w-full max-w-md flex flex-col items-center"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants} className="mb-12 text-center">
          <h1 className="text-5xl font-black text-amber-900 tracking-tighter mb-3">
            The Cafe
          </h1>
          <p className="text-amber-800/70 text-lg font-medium">
            How would you like your order?
          </p>
        </motion.div>

        <div className="w-full space-y-4">
          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/setup")}
            className="w-full bg-white/90 backdrop-blur-sm border-2 border-stone-200 p-6 rounded-3xl shadow-sm flex items-center gap-6 group hover:border-emerald-600 transition-colors"
          >
            <div className="bg-emerald-100 p-4 rounded-full text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Coffee size={32} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-bold text-amber-900">Dine-In</h2>
              <p className="text-stone-500 text-sm mt-1">I am sitting at a table</p>
            </div>
          </motion.button>

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/menu?type=pickup")}
            className="w-full bg-white/90 backdrop-blur-sm border-2 border-stone-200 p-6 rounded-3xl shadow-sm flex items-center gap-6 group hover:border-amber-900 transition-colors"
          >
            <div className="bg-amber-100 p-4 rounded-full text-amber-900 group-hover:bg-amber-900 group-hover:text-white transition-colors">
              <ShoppingBag size={32} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-bold text-amber-900">Pick-Up</h2>
              <p className="text-stone-500 text-sm mt-1">I am just passing by</p>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </main>
  );
}
