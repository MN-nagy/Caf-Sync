"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2 } from "lucide-react";
import AuthWrapper from "./AuthWrapper";

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface PinPadProps {
	onSuccess?: () => void;
}

export default function PinPad({ onSuccess }: PinPadProps) {
	const [pin, setPin] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handlePress = async (num: string) => {
		if (pin.length >= 4 || loading) return;

		const newPin = pin + num;
		setPin(newPin);
		setError("");

		// Auto-submit when 4 digits are reached
		if (newPin.length === 4) {
			setLoading(true);
			try {
				const res = await fetch(`${SERVER_URL}/api/auth/verify-pin`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pin: newPin }),
					credentials: "include",
				});

				const data = await res.json();

				if (!res.ok || !data.success) {
					throw new Error(data.message || "Incorrect PIN");
				}

				// If rendered inside KitchenClient as a modal, trigger onSuccess callback
				// if (onSuccess) {
				// 	onSuccess();
				// } else {
				// 	router.refresh();
				// }


				//NOTE: review before real deployment, check ManagerLogin.tsx
				if (onSuccess) {
					onSuccess();
				} else {
					window.location.reload();
				}
			} catch (err: any) {
				setError(err.message);
				setPin(""); // Clear the pad on error
			} finally {
				setLoading(false);
			}
		}
	};

	const handleDelete = () => setPin(pin.slice(0, -1));

	return (
		<AuthWrapper title="Shift Locked" subtitle="Enter store PIN to access Kitchen Display">
			<div className="flex flex-col items-center">
				{/* PIN Dots Display */}
				<div className="flex gap-4 mb-8">
					{[0, 1, 2, 3].map((i) => (
						<div
							key={i}
							className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length > i ? "bg-amber-400 scale-110 shadow-[0_0_15px_rgba(251,191,36,0.5)]" : "bg-stone-800"
								}`}
						/>
					))}
				</div>

				{error && (
					<p className="text-rose-400 text-sm font-medium mb-4 animate-pulse">{error}</p>
				)}
				{loading && (
					<p className="text-amber-400 text-sm font-medium mb-4 flex items-center gap-2">
						<Loader2 className="animate-spin" size={16} /> Verifying...
					</p>
				)}

				{/* Numpad */}
				<div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
						<button
							key={num}
							onClick={() => handlePress(num.toString())}
							className="h-16 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-2xl text-2xl font-semibold text-stone-200 transition-colors"
						>
							{num}
						</button>
					))}
					<div className="h-16" /> {/* Empty space */}
					<button
						onClick={() => handlePress("0")}
						className="h-16 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-2xl text-2xl font-semibold text-stone-200 transition-colors"
					>
						0
					</button>
					<button
						onClick={handleDelete}
						className="h-16 bg-stone-800 hover:bg-rose-900/30 active:bg-rose-900/50 rounded-2xl flex items-center justify-center text-stone-400 hover:text-rose-400 transition-colors"
					>
						<Delete size={24} />
					</button>
				</div>
			</div>
		</AuthWrapper>
	);
}
