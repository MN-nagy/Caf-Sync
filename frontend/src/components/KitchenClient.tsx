"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, ShoppingBag, CheckCircle, Search, Bell, XCircle, ArrowRight, Check } from "lucide-react";
import PinPad from "./PinPad";

export type OrderItem = { drinkName: string; quantity: number };

export type IncomingOrder = {
	orderId: number;
	tableNumber: number | null;
	isPickup: boolean;
	status: "pending" | "active" | "ready" | "completed" | "cancelled";
	customerPhone: string | null;
	items: OrderItem[];
};

export default function KitchenClient({ initialOrders }: { initialOrders: IncomingOrder[] }) {
	const [orders, setOrders] = useState<IncomingOrder[]>(initialOrders);
	const [isConnected, setIsConnected] = useState(false);
	const [activeTab, setActiveTab] = useState<"tables" | "pickups" | "ready">("pickups");
	const [searchQuery, setSearchQuery] = useState("");

	// Auth / PIN State
	const [isPinLocked, setIsPinLocked] = useState(false);
	const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

	const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

	// --- WEBSOCKETS ---
	useEffect(() => {
		const socket: Socket = io(SERVER_URL, { withCredentials: true });
		socket.on("connect", () => setIsConnected(true));
		socket.on("disconnect", () => setIsConnected(false));

		socket.on("order:created", (newOrder: IncomingOrder) => {
			setOrders((prev) => prev.some((o) => o.orderId === newOrder.orderId) ? prev : [...prev, newOrder]);
		});

		socket.on("order:updated", ({ orderId, status }) => {
			if (status === "completed" || status === "cancelled") {
				setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
			} else {
				setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status } : o)));
			}
		});

		return () => { socket.disconnect(); };
	}, [SERVER_URL]);

	// --- STATUS ENGINE ---
	const changeOrderStatus = async (orderId: number, newStatus: string) => {
		const previousOrders = [...orders]; // Save state for rollback

		// Optimistic UI Update (Makes it feel instant)
		if (newStatus === "completed" || newStatus === "cancelled") {
			setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
		} else {
			setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status: newStatus as any } : o)));
		}

		try {
			const res = await fetch(`${SERVER_URL}/api/orders/${orderId}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: newStatus }),
				credentials: "include",
			});

			if (res.status === 401) {
				setOrders(previousOrders); // Rollback
				setPendingAction(() => () => changeOrderStatus(orderId, newStatus));
				setIsPinLocked(true);
				return;
			}
			if (!res.ok) throw new Error("Status update failed");
		} catch (error) {
			console.error(error);
			setOrders(previousOrders); // Rollback on error
		}
	};

	const handlePinSuccess = async () => {
		setIsPinLocked(false);
		if (pendingAction) {
			await pendingAction();
			setPendingAction(null);
		}
	};

	// --- DERIVED STATE (The Magic Filtering) ---
	const tableOrders = orders.filter((o) => !o.isPickup && o.status === "active");
	const pendingPickups = orders.filter((o) => o.isPickup && o.status === "pending");
	const activePickups = orders.filter((o) => o.isPickup && o.status === "active");
	const readyOrders = orders.filter((o) => o.isPickup && o.status === "ready");

	// Search logic for pending orders
	const filteredPending = pendingPickups.filter((o) =>
		o.orderId.toString().includes(searchQuery) ||
		(o.customerPhone && o.customerPhone.includes(searchQuery))
	);

	// --- REUSABLE TICKET COMPONENT ---
	const TicketCard = ({ order, children }: { order: IncomingOrder, children: React.ReactNode }) => (
		<motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
			className="bg-stone-800 border-2 border-stone-700/50 rounded-3xl p-5 shadow-xl flex flex-col justify-between"
		>
			<div>
				<div className="flex justify-between items-start mb-4">
					<span className="text-sm font-black uppercase tracking-widest bg-amber-950 text-amber-400 border border-amber-800 px-3 py-1 rounded-lg">
						#{order.orderId}
					</span>
					<div className="flex items-center gap-2 text-stone-300 bg-stone-900 px-3 py-1 rounded-lg text-sm font-bold">
						{order.isPickup ? <><ShoppingBag size={16} className="text-amber-500" /> Pickup</> : <><Coffee size={16} className="text-emerald-500" /> TBL {order.tableNumber}</>}
					</div>
				</div>
				{order.customerPhone && (
					<div className="mb-4 bg-stone-900 border border-stone-700 rounded-lg p-2 text-center text-stone-400 text-sm font-bold tracking-widest">
						📞 {order.customerPhone}
					</div>
				)}
				<div className="mb-6 p-4 bg-stone-900/50 rounded-2xl border border-stone-700/50">
					<ul className="space-y-3">
						{order.items?.map((item, idx) => (
							<li key={idx} className="flex gap-3 items-center text-stone-200 font-bold text-lg">
								<span className="bg-stone-700 text-stone-100 px-2.5 py-0.5 rounded-md text-sm">{item.quantity}x</span>
								{item.drinkName}
							</li>
						))}
					</ul>
				</div>
			</div>
			{children}
		</motion.div>
	);

	return (
		<div className="min-h-screen bg-stone-950 text-stone-100 p-6 md:p-10 font-sans">
			<AnimatePresence>
				{isPinLocked && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md flex items-center justify-center p-4">
						<motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md"><PinPad onSuccess={handlePinSuccess} /></motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* HEADER & TABS */}
			<header className="mb-8">
				<div className="flex justify-between items-center mb-8">
					<h1 className="text-3xl font-black text-amber-50">Kitchen Display</h1>
					<div className="flex items-center gap-2 bg-stone-900 px-4 py-2 rounded-full border border-stone-800">
						<span className={`w-3 h-3 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
						<span className="text-xs font-bold uppercase tracking-wider text-stone-400">{isConnected ? "Live Feed" : "Offline"}</span>
					</div>
				</div>

				<div className="flex gap-4 border-b border-stone-800 pb-px">
					{[
						{ id: "tables", label: "Tables", count: tableOrders.length },
						{ id: "pickups", label: "Pickups", badge: pendingPickups.length, count: activePickups.length },
						{ id: "ready", label: "Ready", count: readyOrders.length },
					].map((t) => (
						<button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`relative px-6 py-4 font-black uppercase tracking-widest text-sm transition-colors ${activeTab === t.id ? "text-amber-400 border-b-2 border-amber-400" : "text-stone-500 hover:text-stone-300"}`}>
							<div className="flex items-center gap-2">
								{t.label} ({t.count})
								{t.badge ? <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-bounce">{t.badge} New</span> : null}
							</div>
						</button>
					))}
				</div>
			</header>

			{/* TAB CONTENT */}
			<main className="w-full">

				{/* 1. TABLES TAB */}
				{activeTab === "tables" && (
					<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{tableOrders.map((o) => (
							<TicketCard key={o.orderId} order={o}>
								<button onClick={() => changeOrderStatus(o.orderId, "completed")} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95">
									<CheckCircle size={20} /> Mark Complete
								</button>
							</TicketCard>
						))}
						{tableOrders.length === 0 && <p className="col-span-full text-center py-20 text-stone-600 font-bold">No active table orders.</p>}
					</div>
				)}

				{/* 2. PICKUPS TAB (SPLIT SCREEN) */}
				{activeTab === "pickups" && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
						{/* LEFT SIDE: PENDING (WhatsApp Verification) */}
						<div className="bg-stone-900/50 rounded-[2rem] border border-stone-800 p-6">
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-xl font-black text-amber-500 flex items-center gap-2"><Bell size={24} /> Verify Payment</h2>
							</div>

							<div className="relative mb-6">
								<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
								<input
									type="text" placeholder="Search ID or Phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-amber-500/50 focus:outline-none text-stone-200"
								/>
							</div>

							<div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
								<AnimatePresence>
									{filteredPending.map((o) => (
										<TicketCard key={o.orderId} order={o}>
											<div className="grid grid-cols-2 gap-3 mt-2">
												<button onClick={() => changeOrderStatus(o.orderId, "cancelled")} className="bg-stone-900 hover:bg-rose-950 text-rose-500 border border-rose-900/50 py-3 rounded-xl font-black flex justify-center items-center gap-2 transition-colors">
													<XCircle size={18} /> Reject
												</button>
												<button onClick={() => changeOrderStatus(o.orderId, "active")} className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black flex justify-center items-center gap-2 shadow-md">
													<Check size={18} /> Approve
												</button>
											</div>
										</TicketCard>
									))}
									{filteredPending.length === 0 && <p className="text-center py-10 text-stone-600 font-bold">No pending pickups.</p>}
								</AnimatePresence>
							</div>
						</div>

						{/* RIGHT SIDE: PREPARING (Active Pickups) */}
						<div className="bg-stone-900/50 rounded-[2rem] border border-stone-800 p-6">
							<h2 className="text-xl font-black text-emerald-500 mb-6 flex items-center gap-2"><Coffee size={24} /> Preparing</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
								<AnimatePresence>
									{activePickups.map((o) => (
										<TicketCard key={o.orderId} order={o}>
											<button onClick={() => changeOrderStatus(o.orderId, "ready")} className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 py-3.5 rounded-xl font-black flex justify-center items-center gap-2 shadow-md">
												Mark as Ready <ArrowRight size={18} />
											</button>
										</TicketCard>
									))}
								</AnimatePresence>
							</div>
						</div>
					</div>
				)}

				{/* 3. READY TAB (Awaiting Customer Arrival) */}
				{activeTab === "ready" && (
					<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
						{readyOrders.map((o) => (
							<TicketCard key={o.orderId} order={o}>
								<button onClick={() => changeOrderStatus(o.orderId, "completed")} className="w-full bg-stone-100 hover:bg-white text-stone-900 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95">
									<ShoppingBag size={20} /> Picked Up
								</button>
							</TicketCard>
						))}
						{readyOrders.length === 0 && <p className="col-span-full text-center py-20 text-stone-600 font-bold">No orders waiting for pickup.</p>}
					</div>
				)}

			</main>
		</div>
	);
}
