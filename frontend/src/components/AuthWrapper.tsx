"use client";

import { motion } from "framer-motion";
import { Coffee } from "lucide-react";
import { ReactNode } from "react";

export default function AuthWrapper({ children, title, subtitle }: { children: ReactNode, title: string, subtitle: string }) {
	return (
		<div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
			{/* Animated Background Orbs */}
			<motion.div
				animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, 30, 0] }}
				transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
				className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-amber-900/20 rounded-full blur-[100px]"
			/>
			<motion.div
				animate={{ scale: [1, 1.5, 1], x: [0, -50, 0], y: [0, -50, 0] }}
				transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
				className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-900/10 rounded-full blur-[120px]"
			/>

			{/* Auth Card */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="relative z-10 w-full max-w-md bg-stone-900/80 backdrop-blur-xl border border-stone-800 p-8 rounded-3xl shadow-2xl"
			>
				<div className="text-center mb-8">
					<div className="bg-stone-800 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-stone-700 shadow-inner">
						<Coffee className="text-amber-500" size={32} />
					</div>
					<h1 className="text-2xl font-black text-amber-50 tracking-tight">{title}</h1>
					<p className="text-stone-400 text-sm mt-2">{subtitle}</p>
				</div>

				{children}
			</motion.div>
		</div>
	);
}
