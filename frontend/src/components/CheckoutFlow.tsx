"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, CheckCircle2, Phone, ArrowRight, X, Edit2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type CartItem = { drinkId: number; drinkName: string; quantity: number };

interface CheckoutFlowProps {
	cartItems: CartItem[];
	totalPiastres: number;
	orderType: string;
	tableNumber: string | null;
	onBack: () => void;
}

export default function CheckoutFlow({ cartItems, totalPiastres, orderType, tableNumber, onBack }: CheckoutFlowProps) {
	const [phone, setPhone] = useState("");
	const [phoneError, setPhoneError] = useState("");
	const [step, setStep] = useState<"form" | "processing" | "ticket" | "success">(
		orderType === "pickup" ? "form" : "processing"
	);
	const [loading, setLoading] = useState(false);
	const [orderId, setOrderId] = useState<number | null>(null);

	const router = useRouter();
	const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

	// NEW: Egyptian Phone Validation
	const validatePhone = (number: string) => {
		const phoneRegex = /^(010|011|012|015)\d{8}$/;
		return phoneRegex.test(number);
	};

	const handlePhoneSubmit = async (e?: React.SubmitEvent<HTMLFormElement>) => {
		if (e) e.preventDefault();
		setPhoneError("");

		if (orderType === "pickup" && !validatePhone(phone)) {
			setPhoneError("Please enter a valid 11-digit Egyptian number starting with 010, 011, 012, or 015.");
			return;
		}

		setLoading(true);

		try {
			// If order already exists, just update the phone number!
			if (orderId) {
				const res = await fetch(`${SERVER_URL}/api/orders/${orderId}/phone`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ customerPhone: phone }),
				});
				if (!res.ok) throw new Error("Failed to update phone");
				setStep("ticket");
				setLoading(false);
				return;
			}

			// Otherwise, create a brand new order
			const isPickup = orderType === "pickup";
			const payload = {
				isPickup,
				tableNumber: !isPickup && tableNumber ? parseInt(tableNumber) : null,
				customerPhone: isPickup ? phone : null,
				totalPiastres,
				items: cartItems,
			};

			const res = await fetch(`${SERVER_URL}/api/orders`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.message);

			setOrderId(data.orderId);

			if (!isPickup) {
				setStep("success");
				setTimeout(() => { onBack(); router.push("/"); }, 3000);
			} else {
				setStep("ticket");
			}
		} catch (error) {
			console.error("Checkout failed:", error);
			alert("Failed to process order. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	// Auto-submit for dine-in
	if (step === "processing" && !loading && orderType === "dine-in" && !orderId) {
		handlePhoneSubmit();
	}

	const finishProcess = () => {
		setStep("success");
		setTimeout(() => { onBack(); router.push("/"); }, 3000);
	};

	return (
		<motion.div
			initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
			className="fixed inset-0 z-50 bg-stone-50/95 backdrop-blur-xl flex items-center justify-center p-4 font-sans text-stone-800 overflow-y-auto"
		>
			{/* Back Button (Only close overlay if we are on the form and haven't created an order yet) */}
			{step === "form" && !orderId && (
				<button onClick={onBack} className="absolute top-6 left-6 p-3 bg-white rounded-full text-stone-400 hover:text-amber-900 shadow-sm border border-stone-200 z-50">
					<X size={24} />
				</button>
			)}

			{/* Decorative Background */}
			<motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="fixed top-10 left-10 w-96 h-96 bg-amber-200/40 rounded-full blur-[100px] pointer-events-none" />

			<div className="relative z-10 w-full max-w-md my-auto py-10">
				<AnimatePresence mode="wait">

					{/* STEP 1: PHONE FORM */}
					{step === "form" && (
						<motion.form
							key="form"
							initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }}
							onSubmit={handlePhoneSubmit}
							className="w-full bg-white border border-stone-200 p-8 rounded-4xl shadow-xl"
						>
							<h2 className="text-3xl font-black text-amber-900 tracking-tight mb-2">
								{orderId ? "Update Number" : "Almost ready"}
							</h2>
							<p className="text-stone-500 mb-8">We need your WhatsApp number to verify your payment receipt.</p>

							<div className="space-y-2 mb-8">
								<label className="text-xs font-bold text-stone-400 uppercase tracking-wider pl-1 block">WhatsApp Number</label>
								<div className="relative">
									<Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
									<input
										type="tel"
										required
										value={phone}
										onChange={(e) => {
											setPhone(e.target.value);
											setPhoneError(""); // Clear error when typing
										}}
										placeholder="01xxxxxxxxx"
										className={`w-full bg-stone-50 border text-amber-900 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:outline-none text-lg font-medium transition-all ${phoneError ? "border-rose-500 focus:ring-rose-500/20" : "border-stone-200 focus:ring-emerald-600/20 focus:border-emerald-600"
											}`}
									/>
								</div>
								{/* NEW: Error Message Display */}
								{phoneError && (
									<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-500 text-xs font-bold pl-2 pt-1">
										{phoneError}
									</motion.p>
								)}
							</div>

							<button type="submit" disabled={loading} className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md">
								{loading ? "Processing..." : (orderId ? "Save & Continue" : `Checkout • ${(totalPiastres / 100).toFixed(2)} EGP`)}
								{!loading && <ArrowRight size={18} />}
							</button>
						</motion.form>
					)}

					{/* STEP 2: PROCESSING */}
					{step === "processing" && (
						<motion.div key="processing" className="text-center flex flex-col items-center">
							<div className="w-16 h-16 border-4 border-stone-200 border-t-emerald-600 rounded-full animate-spin mb-6" />
							<h2 className="text-xl font-black text-amber-900">Sending to kitchen...</h2>
						</motion.div>
					)}

					{/* STEP 3: THE TICKET */}
					{step === "ticket" && (
						<motion.div key="ticket" initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="w-full space-y-4">

							<div className="bg-white border border-stone-200 rounded-4xl p-6 shadow-xl relative overflow-hidden">
								<div className="absolute top-0 left-0 w-full h-1 bg-stone-200" />
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Your Order</h3>
									<span className="bg-amber-50 text-amber-900 font-black uppercase text-xs px-2 py-1 rounded-md border border-amber-200">
										#{orderId}
									</span>
								</div>

								<ul className="space-y-3 mb-6">
									{cartItems.map((item, i) => (
										<li key={i} className="flex justify-between items-center text-amber-900 font-medium">
											<div className="flex items-center gap-3">
												<span className="bg-stone-100 text-stone-500 font-bold px-2 py-1 rounded-lg text-sm">{item.quantity}x</span>
												<span>{item.drinkName}</span>
											</div>
										</li>
									))}
								</ul>

								<div className="flex justify-between items-center pt-4 border-t border-dashed border-stone-200">
									<span className="text-stone-500 font-bold uppercase text-xs tracking-wider">Total Due</span>
									<span className="text-2xl font-black text-emerald-700">{(totalPiastres / 100).toFixed(2)} <span className="text-sm text-stone-400 font-bold">EGP</span></span>
								</div>
							</div>

							{/* NEW: Editable Phone Display Card */}
							<div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-md flex justify-between items-center">
								<div>
									<p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-0.5">Linked WhatsApp</p>
									<p className="font-bold text-amber-900">{phone}</p>
								</div>
								<button onClick={() => setStep("form")} className="p-2 bg-stone-50 rounded-xl text-stone-500 hover:text-amber-900 hover:bg-stone-100 transition-colors border border-stone-200">
									<Edit2 size={16} />
								</button>
							</div>

							<div className="bg-white border border-stone-200 rounded-4xl p-8 shadow-xl relative overflow-hidden">
								<div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-amber-600 to-emerald-600" />

								<div className="text-center mb-6">
									<h2 className="text-2xl font-black mt-2 text-amber-900">Awaiting Payment</h2>
								</div>

								<div className="space-y-3 my-6">
									<div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center">
										<p className="text-xs text-stone-500 font-bold uppercase mb-1">1. Send via InstaPay</p>
										<p className="text-xl font-black tracking-wider text-amber-900">cafe.instapay</p>
									</div>

									<div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
										<p className="text-xs text-emerald-600/70 font-bold uppercase mb-1">2. WhatsApp Receipt & ID</p>
										<p className="text-xl font-black tracking-wider text-emerald-700">0123 456 7890</p>
									</div>
								</div>

								<button onClick={finishProcess} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md">
									<CheckCircle2 size={20} />
									I have sent the money
								</button>
							</div>
						</motion.div>
					)}

					{/* STEP 4: SUCCESS OVERLAY */}
					{step === "success" && (
						<motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center flex flex-col items-center bg-white p-10 rounded-4xl border border-stone-200 shadow-xl">

							<div className="w-24 h-24 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mb-6">
								<Coffee className="text-emerald-600" size={40} />
							</div>
							<h2 className="text-3xl font-black text-amber-900 mb-2">Received!</h2>
							<p className="text-stone-500">
								{orderType === "pickup" ? "We are verifying your payment and preparing your order." : "We are preparing your order and bringing it to your table."}
							</p>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</motion.div>
	);
}
