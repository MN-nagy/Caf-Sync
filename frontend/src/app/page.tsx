"use client";

import { motion, Variants } from "framer-motion";
import { Coffee, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";

// --- UPDATED COMPONENT: Darker Steam & Faint Blob ---
function AmbientCoffeeArt({ className, delay = 0 }: { className: string, delay?: number }) {

  return (
    // Removed the global opacity-[0.12] from this wrapper so the steam can be darker
    <div className={`absolute w-72 h-72 pointer-events-none ${className}`}>

      {/* 1. The Liquid Blob - We moved the low opacity (opacity-[0.08]) directly here */}
      <motion.div
        className="absolute inset-0 bg-amber-900 opacity-[0.08]"
        style={{ borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%" }}
        animate={{
          rotate: [0, 360],
          borderRadius: [
            "40% 60% 70% 30% / 40% 50% 60% 50%",
            "60% 40% 30% 70% / 50% 60% 40% 50%",
            "40% 60% 70% 30% / 40% 50% 60% 50%"
          ]
        }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear", delay }}
      />

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
      <AmbientCoffeeArt className="-top-16 -left-16" />

      {/* Background Decor: Bottom Right */}
      <AmbientCoffeeArt className="-bottom-16 -right-16" />

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
            className="w-full bg-white/90 backdrop-blur-sm border-2 border-stone-200 p-6 rounded-3xl shadow-sm flex items-center gap-6 group hover:border-emerald-600 active:border-emerald-600 transition-colors"
          >
            <div className="bg-emerald-100 p-4 rounded-full text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white group-active:bg-emerald-600 group-active:text-white transition-colors">
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
            className="w-full bg-white/90 backdrop-blur-sm border-2 border-stone-200 p-6 rounded-3xl shadow-sm flex items-center gap-6 group hover:border-amber-900 active:border-amber-900 transition-colors"
          >
            <div className="bg-amber-100 p-4 rounded-full text-amber-900 group-hover:bg-amber-900 group-hover:text-white group-active:bg-amber-900 group-active:text-white transition-colors">
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
