"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";

export default function SetupPage() {
	const router = useRouter();
	const [tableNumber, setTableNumber] = useState<string>("");

	// Assuming the cafe has 25 tables. We create an array [1, 2, 3... 25]
	const availableTables = Array.from({ length: 25 }, (_, i) => i + 1);

	const handleSelectTable = (num: number) => {
		// When they click a table, we route them to the menu with their table number
		router.push(`/menu?type=dine-in&table=${num}`);
	};

	const handleManualSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (tableNumber && Number(tableNumber) > 0 && Number(tableNumber) <= 25) {
			router.push(`/menu?type=dine-in&table=${tableNumber}`);
		}
	};

	return (
		<main className="min-h-screen bg-stone-100 flex flex-col p-6 font-sans">

			{/* Back Button */}
			<button
				onClick={() => router.back()}
				className="self-start p-3 bg-white rounded-full shadow-sm text-amber-900 hover:bg-stone-50 transition-colors mb-8"
			>
				<ArrowLeft size={24} />
			</button>

			<motion.div
				className="w-full max-w-md mx-auto flex-1 flex flex-col"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<div className="mb-8 text-center">
					<div className="inline-flex bg-amber-100 p-4 rounded-full text-amber-900 mb-4">
						<MapPin size={32} />
					</div>
					<h1 className="text-3xl font-black text-amber-900 tracking-tight">
						Find Your Table
					</h1>
					<p className="text-stone-500 mt-2">
						Select your table number to view the menu
					</p>
				</div>

				{/* Manual Input Form */}
				<form onSubmit={handleManualSubmit} className="mb-8 relative">
					<input
						type="number"
						placeholder="Enter table number..."
						value={tableNumber}
						onChange={(e) => setTableNumber(e.target.value)}
						className="w-full p-4 rounded-2xl border-2 border-stone-200 bg-white text-xl text-center text-amber-900 font-bold focus:outline-none focus:border-emerald-600 focus:ring-0 transition-colors"
					/>
					{tableNumber && (
						<motion.button
							initial={{ opacity: 0, scale: 0.8 }}
							animate={{ opacity: 1, scale: 1 }}
							type="submit"
							className="absolute right-2 top-2 bottom-2 bg-emerald-600 text-white px-6 rounded-xl font-bold hover:bg-emerald-700"
						>
							Go
						</motion.button>
					)}
				</form>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-stone-300"></div>
					</div>
					<div className="relative flex justify-center text-sm">
						<span className="px-2 bg-stone-100 text-stone-500 font-medium">Or select below</span>
					</div>
				</div>

				{/* The Table Grid */}
				<div className="grid grid-cols-4 gap-3 mt-8 pb-12">
					{availableTables.map((num) => (
						<motion.button
							key={num}
							whileTap={{ scale: 0.9 }}
							onClick={() => handleSelectTable(num)}
							className="aspect-square bg-white border border-stone-200 rounded-2xl flex items-center justify-center text-2xl font-bold text-amber-900 hover:border-emerald-600 hover:bg-emerald-50 transition-colors shadow-sm"
						>
							{num}
						</motion.button>
					))}
				</div>

			</motion.div>
		</main>
	);
}
