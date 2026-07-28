"use client";

import { useState } from "react";

export type Drink = {
	id: number;
	name: string;
	description: string;
	priceInPiastres: number;
};

type CartItem = Drink & { quantity: number };

// A temporary helper to give us beautiful images until we update our database
const getDrinkImage = (name: string) => {
	if (name.includes('Cappuccino')) return 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80';
	if (name.includes('Flat')) return 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=400&q=80';
	if (name.includes('Spanish')) return 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=400&q=80';
	if (name.includes('Cold')) return 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80';
	if (name.includes('Mocha')) return 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80';
	return 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=400&q=80'; // Default coffee
};

export default function MenuClient({ drinks }: { drinks: Drink[] }) {
	const [cart, setCart] = useState<CartItem[]>([]);

	const addToCart = (drink: Drink) => {
		setCart((prevCart) => {
			const existingItem = prevCart.find((item) => item.id === drink.id);
			if (existingItem) {
				return prevCart.map((item) =>
					item.id === drink.id ? { ...item, quantity: item.quantity + 1 } : item
				);
			}
			return [...prevCart, { ...drink, quantity: 1 }];
		});
	};

	const removeFromCart = (drinkId: number) => {
		setCart((prevCart) => {
			const existingItem = prevCart.find((item) => item.id === drinkId);
			if (existingItem?.quantity === 1) {
				return prevCart.filter((item) => item.id !== drinkId);
			}

			return prevCart.map((item) =>
				item.id === drinkId ? { ...item, quantity: item.quantity - 1 } : item
			);
		});
	};

	const getQuantity = (drinkId: number) => {
		return cart.find((item) => item.id === drinkId)?.quantity || 0;
	};

	const totalPiastres = cart.reduce((total, item) => total + (item.priceInPiastres * item.quantity), 0);

	return (
		<div className="pb-24">
			<div className="max-w-2xl mx-auto space-y-4">
				{drinks.map((drink) => {
					const qty = getQuantity(drink.id);
					return (
						<div key={drink.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex gap-4">
							{/* Left Side: Modern Square Image */}
							<img
								src={getDrinkImage(drink.name)}
								alt={drink.name}
								className="w-28 h-28 object-cover rounded-xl shadow-inner"
							/>

							{/* Right Side: Details & Action */}
							<div className="flex-1 flex flex-col justify-between py-1">
								<div>
									<h2 className="text-lg font-bold text-amber-900 leading-tight">{drink.name}</h2>
									<p className="text-stone-500 text-xs mt-1 line-clamp-2">{drink.description}</p>
								</div>

								<div className="flex justify-between items-end mt-2">
									<span className="font-bold text-amber-900">
										{(drink.priceInPiastres / 100).toFixed(2)} EGP
									</span>

									{/* Conditional Rendering: The Counter vs The Add Button */}
									{qty > 0 ? (
										<div className="flex items-center gap-3 bg-stone-100 rounded-full px-2 py-1 border border-stone-200">
											<button
												onClick={() => removeFromCart(drink.id)}
												className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-amber-900 shadow-sm hover:bg-stone-50"
											>-</button>
											<span className="font-bold text-sm w-4 text-center">{qty}</span>
											<button
												onClick={() => addToCart(drink)}
												className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
											>+</button>
										</div>
									) : (
										<button
											onClick={() => addToCart(drink)}
											className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 rounded-full text-sm font-medium transition-colors shadow-sm"
										>
											Add
										</button>
									)}
								</div>
							</div>

						</div>
					);
				})}
			</div>

			{cart.length > 0 && (
				<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] z-50">
					<div className="max-w-2xl mx-auto flex justify-between items-center">
						<div>
							<p className="text-stone-500 text-xs uppercase tracking-wider font-bold">Total Order</p>
							<p className="text-amber-900 font-black text-2xl">{(totalPiastres / 100).toFixed(2)} <span className="text-sm font-bold">EGP</span></p>
						</div>
						<button className="bg-amber-900 hover:bg-amber-800 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg transition-transform active:scale-95 flex gap-2 items-center">
							Checkout
							<span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
								{cart.reduce((sum, item) => sum + item.quantity, 0)}
							</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
