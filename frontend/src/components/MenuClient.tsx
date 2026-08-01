"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronUp, Coffee, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import CheckoutFlow from "./CheckoutFlow";

export type Drink = {
	id: number;
	name: string;
	description: string;
	priceInPiastres: number;
	originalPriceInPiastres?: number | null;
	category: string;
	isOutOfStock: boolean; // NEW FIELD
};

type CartItem = Drink & { quantity: number };

const formatEGP = (piastres: number) => {
	const egp = piastres / 100;
	return Number.isInteger(egp) ? `${egp} EGP` : `${egp.toFixed(2)} EGP`;
};

export default function MenuClient({ drinks, orderType, tableNumber }: { drinks: Drink[]; orderType: string; tableNumber: string | null; }) {
	const [isCartOpen, setIsCartOpen] = useState(false);
	const [cart, setCart] = useState<CartItem[]>([]);
	const [activeCategory, setActiveCategory] = useState("All");
	const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

	const router = useRouter();

	const hasOffers = drinks.some(d => d.originalPriceInPiastres && d.originalPriceInPiastres > d.priceInPiastres && !d.isOutOfStock);
	const baseCategories = ["All", "Hot Coffee", "Iced Coffee", "Frappe"];
	const categories = hasOffers ? ["All", "Offers", ...baseCategories.slice(1)] : baseCategories;

	const handleBack = () => {
		if (typeof window !== "undefined" && window.history.length > 1) {
			router.back();
		} else {
			router.push("/");
		}
	};

	const filteredDrinks = drinks.filter((drink) => {
		if (activeCategory === "All") return true;
		if (activeCategory === "Offers") {
			return !!(drink.originalPriceInPiastres && drink.originalPriceInPiastres > drink.priceInPiastres && !drink.isOutOfStock);
		}
		return drink.category === activeCategory;
	});

	const addToCart = (drink: Drink) => {
		if (drink.isOutOfStock) return; // Failsafe
		setCart((prev) => {
			const exists = prev.find((item) => item.id === drink.id);
			if (exists) return prev.map((item) => item.id === drink.id ? { ...item, quantity: item.quantity + 1 } : item);
			return [...prev, { ...drink, quantity: 1 }];
		});
	};

	const removeFromCart = (id: number) => {
		setCart((prev) => {
			const exists = prev.find((item) => item.id === id);
			if (exists?.quantity === 1) return prev.filter((item) => item.id !== id);
			return prev.map((item) => item.id === id ? { ...item, quantity: item.quantity - 1 } : item);
		});
	};

	const getQty = (id: number) => cart.find((item) => item.id === id)?.quantity || 0;
	const totalPiastres = cart.reduce((sum, item) => sum + item.priceInPiastres * item.quantity, 0);

	return (
		<div className="pb-36 min-h-screen bg-stone-50 text-stone-800">
			<header className="sticky top-0 z-40 bg-stone-100/90 backdrop-blur-md pt-6 pb-4 px-6 shadow-[0_4px_20px_-15px_rgba(0,0,0,0.1)]">
				<div className="flex justify-between items-center mb-4">
					<button onClick={handleBack} className="p-2.5 bg-white rounded-full shadow-sm text-amber-900 hover:bg-stone-50 active:scale-95 transition-all" aria-label="Go back">
						<ArrowLeft size={20} />
					</button>
					<div className="text-center">
						<p className="text-xs font-bold uppercase tracking-widest text-stone-500">
							{orderType === "dine-in" ? "Dine-In" : "Pick-Up"}
						</p>
						<h1 className="text-xl font-black text-amber-900">
							{tableNumber ? `Table ${tableNumber}` : "Menu"}
						</h1>
					</div>
					<div className="w-10" />
				</div>

				<div className="flex overflow-x-auto gap-3 no-scrollbar py-1">
					{categories.map((category) => (
						<button
							key={category}
							onClick={() => setActiveCategory(category)}
							className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm flex items-center gap-2 ${activeCategory === category
									? category === "Offers" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
									: "bg-white text-stone-500 hover:text-amber-900"
								}`}
						>
							{category === "Offers" && <span className={activeCategory === "Offers" ? "text-white" : "text-rose-500"}><Tag size={14} /></span>}
							{category}
						</button>
					))}
				</div>
			</header>

			<div className="p-6 space-y-5 max-w-lg mx-auto">
				{filteredDrinks.map((drink) => {
					const qty = getQty(drink.id);
					const isSale = drink.originalPriceInPiastres && drink.originalPriceInPiastres > drink.priceInPiastres && !drink.isOutOfStock;

					return (
						<motion.div key={drink.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
							className={`bg-white rounded-3xl p-6 shadow-sm border border-stone-200 relative overflow-hidden transition-opacity ${drink.isOutOfStock ? "opacity-70 grayscale-[0.2]" : ""}`}>

							{/* Subtle top accent line based on state */}
							<div className={`absolute top-0 left-0 w-full h-1.5 ${drink.isOutOfStock ? "bg-stone-300" : isSale ? "bg-rose-500" : "bg-emerald-600/20"}`} />

							{/* Out of Stock Badge */}
							{drink.isOutOfStock && (
								<div className="absolute top-4 right-4 z-10 bg-stone-800 text-white text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider">
									SOLD OUT
								</div>
							)}

							<div className="flex justify-between items-start mb-3 mt-1 gap-4">
								<div>
									{/* Category Overline */}
									<span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 block">
										{drink.category}
									</span>
									<h2 className="text-2xl font-black text-amber-900 leading-tight">
										{drink.name}
									</h2>
								</div>

								<div className="flex flex-col items-end shrink-0">
									{isSale && (
										<span className="text-xs text-stone-400 line-through font-bold mb-0.5">
											{formatEGP(drink.originalPriceInPiastres!)}
										</span>
									)}
									<span className={`text-lg font-black px-3 py-1 rounded-xl whitespace-nowrap ${drink.isOutOfStock ? "bg-stone-100 text-stone-500" : isSale ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700"}`}>
										{formatEGP(drink.priceInPiastres)}
									</span>
								</div>
							</div>

							<p className="text-stone-500 text-sm leading-relaxed mb-6 pr-4">
								{drink.description}
							</p>

							<div className="flex justify-end pt-4 border-t border-stone-100">
								{drink.isOutOfStock ? (
									<button disabled className="bg-stone-100 text-stone-400 px-6 py-3 rounded-2xl font-bold w-full flex items-center justify-center cursor-not-allowed">
										Currently Unavailable
									</button>
								) : qty > 0 ? (
									<div className="flex items-center gap-4 bg-stone-100 rounded-full p-1 border border-stone-200 w-36 justify-between">
										<button onClick={() => removeFromCart(drink.id)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-amber-900 shadow-sm hover:bg-stone-50 active:scale-90 transition-transform font-bold text-xl">-</button>
										<span className="font-bold text-lg text-amber-900">{qty}</span>
										<button onClick={() => addToCart(drink)} className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-90 transition-transform font-bold text-xl">+</button>
									</div>
								) : (
									<button onClick={() => addToCart(drink)} className="bg-amber-900/5 hover:bg-amber-900/10 active:scale-95 text-amber-900 px-6 py-3 rounded-2xl font-bold transition-transform w-full border border-amber-900/10 flex items-center justify-center gap-2">
										Add to Order
									</button>
								)}
							</div>
						</motion.div>
					);
				})}

				{filteredDrinks.length === 0 && (
					<div className="text-center py-16 px-4 bg-white rounded-4xl border border-stone-200 shadow-sm">
						<Coffee size={40} className="mx-auto mb-3 text-stone-300" />
						<p className="text-stone-600 font-bold text-lg mb-1">No drinks in this category</p>
						<p className="text-stone-400 text-sm mb-6">Try switching categories to see the rest of the menu.</p>
						<button onClick={() => setActiveCategory("All")} className="bg-stone-100 text-amber-900 font-bold px-6 py-2.5 rounded-full hover:bg-stone-200 transition-colors">
							View All Drinks
						</button>
					</div>
				)}
			</div>

			{/* Floating Bottom Cart */}
			{cart.length > 0 && !isCheckoutOpen && (
				<motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 right-0 p-6 z-40 pointer-events-none">
					<div className="max-w-lg mx-auto bg-amber-900 text-white p-4 rounded-4xl shadow-2xl pointer-events-auto overflow-hidden">
						<AnimatePresence>
							{isCartOpen && (
								<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 space-y-3 border-b border-amber-800 pb-4">
									<div className="flex justify-between items-center mb-2">
										<span className="font-bold text-amber-200 tracking-widest uppercase text-xs">Your Order Items</span>
									</div>
									{cart.map((item) => (
										<div key={item.id} className="flex justify-between items-center text-sm">
											<div className="flex items-center gap-3">
												<span className="bg-amber-800 text-amber-100 font-bold px-2 py-0.5 rounded-md">{item.quantity}x</span>
												<span className="font-medium">{item.name}</span>
											</div>
											<span className="font-bold">{formatEGP(item.priceInPiastres * item.quantity)}</span>
										</div>
									))}
								</motion.div>
							)}
						</AnimatePresence>
						<div className="flex justify-between items-center">
							<div className="pl-2 cursor-pointer group" onClick={() => setIsCartOpen(!isCartOpen)}>
								<p className="text-amber-200/80 text-xs uppercase tracking-wider font-bold mb-0.5 flex items-center gap-1 group-hover:text-amber-100 transition-colors">
									Total Order <ChevronUp size={14} className={`transition-transform duration-300 ${isCartOpen ? "rotate-180" : ""}`} />
								</p>
								<p className="font-black text-2xl">{formatEGP(totalPiastres)}</p>
							</div>
							<button onClick={() => setIsCheckoutOpen(true)} className="bg-white text-amber-900 px-8 py-4 rounded-2xl font-black shadow-inner active:scale-95 transition-transform flex items-center gap-3">
								Checkout <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-sm">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
							</button>
						</div>
					</div>
				</motion.div>
			)}

			<AnimatePresence>
				{isCheckoutOpen && (
					<CheckoutFlow cartItems={cart.map((item) => ({ drinkId: item.id, drinkName: item.name, quantity: item.quantity }))} totalPiastres={totalPiastres} orderType={orderType} tableNumber={tableNumber} onBack={() => setIsCheckoutOpen(false)} />
				)}
			</AnimatePresence>
		</div>
	);
}
