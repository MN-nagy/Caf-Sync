"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, ShoppingBag, CheckCircle } from "lucide-react";
import PinPad from "./PinPad"; // Import your existing PinPad

export type OrderItem = {
	drinkName: string;
	quantity: number;
};

export type IncomingOrder = {
	orderId: number;
	tableNumber: number | null;
	isPickup: boolean;
	items: OrderItem[];
};

export default function KitchenClient({ initialOrders }: { initialOrders: IncomingOrder[] }) {
	const [orders, setOrders] = useState<IncomingOrder[]>(initialOrders);
	const [isConnected, setIsConnected] = useState(false);

	// Modal state for shift PIN expiration
	const [isPinLocked, setIsPinLocked] = useState(false);
	const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

	const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

	useEffect(() => {
		const socket: Socket = io(SERVER_URL, {
			withCredentials: true,
		});

		socket.on("connect", () => setIsConnected(true));
		socket.on("disconnect", () => setIsConnected(false));

		socket.on("order:created", (newOrder: IncomingOrder) => {
			setOrders((prev) => {
				if (prev.some((o) => o.orderId === newOrder.orderId)) return prev;
				return [...prev, newOrder];
			});
		});

		socket.on("order:completed", ({ orderId }: { orderId: number }) => {
			setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
		});

		return () => {
			socket.disconnect();
		};
	}, [SERVER_URL]);

	const markComplete = async (orderId: number) => {
		const existingOrder = orders.find((o) => o.orderId === orderId);

		// Remove from UI instantly (Optimistic UI)
		setOrders((prev) => prev.filter((o) => o.orderId !== orderId));

		try {
			const res = await fetch(`${SERVER_URL}/api/orders/${orderId}/complete`, {
				method: "PATCH",
				credentials: "include",
			});

			// If the 24-hour shift token expired, trigger the PIN Modal
			if (res.status === 401) {
				// Rollback: restore order ticket
				if (existingOrder) {
					setOrders((prev) => [...prev, existingOrder]);
				}
				// Save action to retry automatically after entering PIN
				setPendingAction(() => () => markComplete(orderId));
				setIsPinLocked(true);
				return;
			}

			if (!res.ok) {
				throw new Error("Server responded with error status");
			}
		} catch (error) {
			console.error("Failed to mark complete, rolling back UI", error);
			if (existingOrder) {
				setOrders((prev) => [...prev, existingOrder]);
			}
		}
	};

	const handlePinSuccess = async () => {
		setIsPinLocked(false);

		// Automatically retry completing the drink that was blocked by 401
		if (pendingAction) {
			await pendingAction();
			setPendingAction(null);
		}
	};

	return (
		<div className="min-h-screen bg-stone-900 text-stone-100 p-6 md:p-10 font-sans relative">
			{/* PIN Modal Backdrop Overlay */}
			<AnimatePresence>
				{isPinLocked && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md flex items-center justify-center p-4"
					>
						<motion.div
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.9, opacity: 0 }}
							className="w-full max-w-md"
						>
							<PinPad onSuccess={handlePinSuccess} />
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<header className="flex justify-between items-center mb-10 pb-6 border-b border-stone-800">
				<div>
					<h1 className="text-3xl font-black tracking-tight text-amber-100 flex items-center gap-3">
						Kitchen Display System
					</h1>
					<p className="text-stone-400 text-sm mt-1">
						Real-time incoming orders via WebSockets
					</p>
				</div>

				<div className="flex items-center gap-2 bg-stone-800 px-4 py-2 rounded-full border border-stone-700">
					<span className={`w-3 h-3 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
					<span className="text-xs font-bold uppercase tracking-wider text-stone-300">
						{isConnected ? "Live Feed" : "Disconnected"}
					</span>
				</div>
			</header>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<AnimatePresence>
					{orders.map((order) => (
						<motion.div
							key={order.orderId}
							initial={{ opacity: 0, scale: 0.9, y: -20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.85 }}
							transition={{ duration: 0.25 }}
							className="bg-stone-800 border-2 border-amber-900/40 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between"
						>
							<div>
								<div className="flex justify-between items-start mb-4">
									<span className="text-xs font-black uppercase tracking-widest bg-amber-950 text-amber-300 border border-amber-800/50 px-3 py-1 rounded-full">
										Order #{order.orderId}
									</span>

									<div className="flex items-center gap-2 text-stone-300 bg-stone-900/60 px-3 py-1 rounded-xl text-sm font-semibold">
										{order.isPickup ? (
											<><ShoppingBag size={16} className="text-amber-400" /><span>Pick-Up</span></>
										) : (
											<><Coffee size={16} className="text-emerald-400" /><span>Table {order.tableNumber}</span></>
										)}
									</div>
								</div>

								<div className="my-4 p-4 bg-stone-900/40 rounded-2xl border border-stone-700/50 grow">
									<p className="text-xs text-stone-400 font-medium uppercase tracking-wider mb-3">
										Order Details
									</p>

									<ul className="space-y-3">
										{order.items?.map((item, index) => (
											<li key={index} className="flex justify-between items-center text-stone-200 font-medium text-lg">
												<span className="flex items-center gap-3">
													<span className="bg-amber-500 text-stone-900 px-2 py-0.5 rounded-md font-black text-sm">
														{item.quantity}x
													</span>
													{item.drinkName}
												</span>
											</li>
										))}
									</ul>
								</div>
							</div>

							<button
								onClick={() => markComplete(order.orderId)}
								className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md"
							>
								<CheckCircle size={20} />
								Mark Complete
							</button>
						</motion.div>
					))}
				</AnimatePresence>
			</div>

			{orders.length === 0 && (
				<div className="text-center py-20 text-stone-500">
					<Coffee size={48} className="mx-auto mb-4 opacity-30" />
					<p className="text-lg font-medium">No active orders right now.</p>
				</div>
			)}
		</div>
	);
}
