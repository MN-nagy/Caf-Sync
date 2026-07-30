"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import CheckoutFlow from "./CheckoutFlow";
import { AnimatePresence } from "framer-motion";

export type Drink = {
	id: number;
	name: string;
	description: string;
	priceInPiastres: number;
};

type CartItem = Drink & { quantity: number };

// Helper to provide premium hero images
const getDrinkImage = (name: string) => {
	if (name.includes('Cappuccino')) return 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=800&q=80';
	if (name.includes('Flat')) return 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=800&q=80';
	if (name.includes('Spanish')) return 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&q=80';
	if (name.includes('Cold')) return 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&q=80';
	if (name.includes('Mocha')) return 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80';
	return 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80';
};

export default function MenuClient({
	drinks,
	orderType,
	tableNumber
}: {
	drinks: Drink[],
	orderType: string,
	tableNumber: string | null
}) {
	const [isCartOpen, setIsCartOpen] = useState(false);
	const router = useRouter();
	const [cart, setCart] = useState<CartItem[]>([]);
	const [activeCategory, setActiveCategory] = useState("All");
	const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

	const categories = ["All", "Hot Coffee", "Iced Coffee", "Frappe"];

	// Filter logic based on the drink name
	const filteredDrinks = drinks.filter(drink => {
		if (activeCategory === "All") return true;
		if (activeCategory === "Hot Coffee") return drink.name.includes("Cappuccino") || drink.name.includes("Flat");
		if (activeCategory === "Iced Coffee") return drink.name.includes("Cold") || drink.name.includes("Spanish");
		if (activeCategory === "Frappe") return drink.name.includes("Frappe");
		return true;
	});

	const addToCart = (drink: Drink) => {
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
	const totalPiastres = cart.reduce((sum, item) => sum + (item.priceInPiastres * item.quantity), 0);

	return (
		<div className="pb-32">
			{/* Sticky Header with Context */}
			<header className="sticky top-0 z-40 bg-stone-100/90 backdrop-blur-md pt-6 pb-4 px-6 shadow-[0_4px_20px_-15px_rgba(0,0,0,0.1)]">
				<div className="flex justify-between items-center mb-4">
					<button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm text-amber-900 hover:bg-stone-50 transition-colors">
						<ArrowLeft size={20} />
					</button>
					<div className="text-center">
						<p className="text-xs font-bold uppercase tracking-widest text-stone-500">
							{orderType === 'dine-in' ? 'Dine-In' : 'Pick-Up'}
						</p>
						<h1 className="text-xl font-black text-amber-900">
							{tableNumber ? `Table ${tableNumber}` : 'Menu'}
						</h1>
					</div>
					<div className="w-9"></div> {/* Spacer for centering */}
				</div>

				{/* Category Pills */}
				<div className="flex overflow-x-auto gap-3 no-scrollbar py-1">
					{categories.map(category => (
						<button
							key={category}
							onClick={() => setActiveCategory(category)}
							className={`whitespace-nowrap px-5 py-2 rounded-full font-bold text-sm transition-all shadow-sm ${activeCategory === category
								? "bg-emerald-600 text-white"
								: "bg-white text-stone-500 hover:text-amber-900"
								}`}
						>
							{category}
						</button>
					))}
				</div>
			</header>

			{/* Drink Cards Grid */}
			<div className="p-6 space-y-6 max-w-lg mx-auto">
				{filteredDrinks.map((drink) => {
					const qty = getQty(drink.id);
					return (
						<motion.div
							key={drink.id}
							layout
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							className="bg-white rounded-4xl overflow-hidden shadow-sm border border-stone-200"
						>
							{/* Top Half: Bleeding Image */}
							<div className="relative h-56 w-full bg-stone-200">
								<img src={getDrinkImage(drink.name)} alt={drink.name} className="absolute inset-0 w-full h-full object-cover" />
							</div>

							{/* Bottom Half: Details & Actions */}
							<div className="p-6">
								<div className="flex justify-between items-start mb-2">
									<h2 className="text-2xl font-black text-amber-900">{drink.name}</h2>
									<span className="text-xl font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
										{(drink.priceInPiastres / 100).toFixed(2)}
									</span>
								</div>

								<p className="text-stone-500 text-sm leading-relaxed mb-6">
									{drink.description}
								</p>

								{/* Add / Counter Action */}
								<div className="flex justify-end">
									{qty > 0 ? (
										<div className="flex items-center gap-4 bg-stone-100 rounded-full p-1.5 border border-stone-200 w-32 justify-between">
											<button
												onClick={() => removeFromCart(drink.id)}
												className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-amber-900 shadow-sm hover:bg-stone-50 active:scale-90 transition-transform"
											>-</button>
											<span className="font-bold text-lg">{qty}</span>
											<button
												onClick={() => addToCart(drink)}
												className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-90 transition-transform"
											>+</button>
										</div>
									) : (
										<button
											onClick={() => addToCart(drink)}
											className="bg-amber-900 hover:bg-amber-800 active:scale-95 text-white px-8 py-3.5 rounded-full font-bold shadow-md transition-transform w-full"
										>
											Add to Order
										</button>
									)}
								</div>
							</div>
						</motion.div>
					);
				})}
			</div>

			{/* Floating Checkout Cart */}
			{cart.length > 0 && (
				<motion.div
					initial={{ y: 100 }}
					animate={{ y: 0 }}
					className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none"
				>
					<div className="max-w-lg mx-auto bg-amber-900 text-white p-4 rounded-[2rem] shadow-2xl pointer-events-auto overflow-hidden">

						{/* SLIDING CART DETAILS */}
						<AnimatePresence>
							{isCartOpen && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									className="mb-4 space-y-3 border-b border-amber-800 pb-4"
								>
									<div className="flex justify-between items-center mb-4">
										<span className="font-bold text-amber-200 tracking-widest uppercase text-xs">Your Order Items</span>
									</div>
									{cart.map((item) => (
										<div key={item.id} className="flex justify-between items-center text-sm">
											<div className="flex items-center gap-3">
												<span className="bg-amber-800 text-amber-100 font-bold px-2 py-1 rounded-md">{item.quantity}x</span>
												<span className="font-medium">{item.name}</span>
											</div>
											<span className="font-bold">{(item.priceInPiastres * item.quantity / 100).toFixed(2)}</span>
										</div>
									))}
								</motion.div>
							)}
						</AnimatePresence>

						{/* BOTTOM SUMMARY BAR */}
						<div className="flex justify-between items-center">
							<div
								className="pl-2 cursor-pointer group"
								onClick={() => setIsCartOpen(!isCartOpen)}
							>
								<p className="text-amber-200/80 text-xs uppercase tracking-wider font-bold mb-0.5 flex items-center gap-1 group-hover:text-amber-100 transition-colors">
									Total Order
									<ChevronUp size={14} className={`transition-transform duration-300 ${isCartOpen ? "rotate-180" : ""}`} />
								</p>
								<p className="font-black text-2xl">{(totalPiastres / 100).toFixed(2)} EGP</p>
							</div>
							<button
								onClick={() => setIsCheckoutOpen(true)}
								className="bg-white text-amber-900 px-8 py-4 rounded-2xl font-black shadow-inner active:scale-95 transition-transform flex items-center gap-3"
							>
								Checkout
								<span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full text-sm">
									{cart.reduce((sum, item) => sum + item.quantity, 0)}
								</span>
							</button>
						</div>
					</div>
				</motion.div>
			)}

			{/* --- RENDER THE CHECKOUT FLOW OVERLAY --- */}
			<AnimatePresence>
				{isCheckoutOpen && (
					<CheckoutFlow
						cartItems={cart.map(item => ({ drinkId: item.id, drinkName: item.name, quantity: item.quantity }))}
						totalPiastres={totalPiastres}
						orderType={orderType}
						tableNumber={tableNumber}
						onBack={() => setIsCheckoutOpen(false)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}
