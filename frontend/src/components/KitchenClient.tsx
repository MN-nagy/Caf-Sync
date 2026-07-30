"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, ShoppingBag, CheckCircle, Search, Bell, XCircle, ArrowRight, Check, Undo2, AlertCircle } from "lucide-react";
import PinPad from "./PinPad";
import { Toaster, toast } from 'sonner';

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

	// Search States
	const [searchPickups, setSearchPickups] = useState("");
	const [searchTables, setSearchTables] = useState("");
	const [searchReady, setSearchReady] = useState("");

	// UI States
	const [isPinLocked, setIsPinLocked] = useState(false);
	const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

	// Seen Tracking (For Smart Notification Badges)
	const [seenOrders, setSeenOrders] = useState<{ tables: Set<number>, pickups: Set<number>, ready: Set<number> }>({
		tables: new Set(), pickups: new Set(), ready: new Set()
	});

	// Action Confirmation System
	const [confirmId, setConfirmId] = useState<number | null>(null);
	const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
	const [confirmLabel, setConfirmLabel] = useState("");

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

	// --- DERIVED STATE ---
	const tableOrders = orders.filter((o) => !o.isPickup && o.status === "active");
	const pendingPickups = orders.filter((o) => o.isPickup && o.status === "pending");
	const activePickups = orders.filter((o) => o.isPickup && o.status === "active");
	const readyOrders = orders.filter((o) => o.isPickup && o.status === "ready");

	// Search Filters
	const filteredTables = tableOrders.filter((o) => o.orderId.toString().includes(searchTables) || (o.tableNumber?.toString().includes(searchTables)));
	const filteredPickups = pendingPickups.filter((o) => o.orderId.toString().includes(searchPickups) || (o.customerPhone && o.customerPhone.includes(searchPickups)));
	const filteredReady = readyOrders.filter((o) => o.orderId.toString().includes(searchReady) || (o.customerPhone && o.customerPhone.includes(searchReady)));

	// --- SMART BADGES ---
	// When a tab is active, instantly mark all current orders in that tab as "seen"
	useEffect(() => {
		setSeenOrders((prev) => {
			const next = { tables: new Set(prev.tables), pickups: new Set(prev.pickups), ready: new Set(prev.ready) };
			if (activeTab === "tables") tableOrders.forEach((o) => next.tables.add(o.orderId));
			if (activeTab === "pickups") pendingPickups.forEach((o) => next.pickups.add(o.orderId));
			if (activeTab === "ready") readyOrders.forEach((o) => next.ready.add(o.orderId));
			return next;
		});
	}, [activeTab, orders.length]); // Re-run when tab changes or total orders changes

	const unreadTables = tableOrders.filter((o) => !seenOrders.tables.has(o.orderId)).length;
	const unreadPickups = pendingPickups.filter((o) => !seenOrders.pickups.has(o.orderId)).length;
	const unreadReady = readyOrders.filter((o) => !seenOrders.ready.has(o.orderId)).length;

	// --- STATUS ENGINE ---
	const triggerConfirm = (id: number, target: string, label: string) => {
		setConfirmId(id); setConfirmTarget(target); setConfirmLabel(label);
	};

	const executeStatusChange = async () => {
		if (!confirmId || !confirmTarget) return;
		const orderId = confirmId;
		const newStatus = confirmTarget;
		const actionLabel = confirmLabel;

		// Reset confirm state
		setConfirmId(null); setConfirmTarget(null); setConfirmLabel("");

		const previousOrders = [...orders];

		// Optimistic UI
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
				setPendingAction(() => () => changeStatusBypassConfirm(orderId, newStatus, actionLabel));
				setIsPinLocked(true);
				return;
			}
			if (!res.ok) throw new Error("Update failed");


			toast.success(`Order #${orderId} ${actionLabel.toLowerCase()}`);
		} catch (error) {
			console.error(error);
			setOrders(previousOrders); // Rollback
			toast.error(`Failed to update Order #${orderId}`);
		}
	};

	// Helper for when PIN pad resumes an action (skips the confirm click)
	const changeStatusBypassConfirm = async (orderId: number, newStatus: string, label: string) => {
		setConfirmId(orderId); setConfirmTarget(newStatus); setConfirmLabel(label);
		await executeStatusChange();
	};

	const handlePinSuccess = async () => {
		setIsPinLocked(false);
		if (pendingAction) { await pendingAction(); setPendingAction(null); }
	};

	// --- REUSABLE TICKET ---
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

			{/* Action Area (Normal vs Confirming) */}
			<div className="mt-2 h-14">
				{confirmId === order.orderId ? (
					<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 h-full">
						<button onClick={() => setConfirmId(null)} className="w-1/3 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-xl font-bold transition-colors">
							Cancel
						</button>
						<button onClick={executeStatusChange} className="w-2/3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-md">
							<AlertCircle size={18} /> Confirm {confirmLabel}
						</button>
					</motion.div>
				) : (
					<div className="h-full flex gap-2">
						{children}
					</div>
				)}
			</div>
		</motion.div>
	);

	return (
		<div className="min-h-screen bg-stone-950 text-stone-100 p-6 md:p-10 font-sans relative overflow-x-hidden">

			<Toaster richColors position="top-right" theme="dark" />

			<AnimatePresence>
				{isPinLocked && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md flex items-center justify-center p-4">
						<motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-md"><PinPad onSuccess={handlePinSuccess} /></motion.div>
					</motion.div>
				)}
			</AnimatePresence>

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
						{ id: "tables", label: "Tables", count: tableOrders.length, unread: unreadTables },
						{ id: "pickups", label: "Pickups", count: activePickups.length, unread: unreadPickups },
						{ id: "ready", label: "Ready", count: readyOrders.length, unread: unreadReady },
					].map((t) => (
						<button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`relative px-6 py-4 font-black uppercase tracking-widest text-sm transition-colors ${activeTab === t.id ? "text-amber-400 border-b-2 border-amber-400" : "text-stone-500 hover:text-stone-300"}`}>
							<div className="flex items-center gap-2">
								{t.label} ({t.count})
								{t.unread > 0 && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.5)]">{t.unread} New</span>}
							</div>
						</button>
					))}
				</div>
			</header>

			<main className="w-full">

				{/* 1. TABLES TAB */}
				{activeTab === "tables" && (
					<div className="space-y-6">
						<div className="relative max-w-md">
							<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
							<input type="text" placeholder="Search Order ID or Table..." value={searchTables} onChange={(e) => setSearchTables(e.target.value)} className="w-full bg-stone-900/50 border border-stone-800 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500/50 focus:outline-none text-stone-200" />
						</div>
						<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
							<AnimatePresence>
								{filteredTables.map((o) => (
									<TicketCard key={o.orderId} order={o}>
										<button onClick={() => triggerConfirm(o.orderId, "completed", "Complete")} className="w-full h-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md">
											<CheckCircle size={20} /> Mark Complete
										</button>
									</TicketCard>
								))}
							</AnimatePresence>
						</div>
					</div>
				)}

				{/* 2. PICKUPS TAB */}
				{activeTab === "pickups" && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
						{/* LEFT SIDE: PENDING */}
						<div className="bg-stone-900/50 rounded-4xl border border-stone-800 p-6">
							<h2 className="text-xl font-black text-amber-500 mb-6 flex items-center gap-2"><Bell size={24} /> Verify Payment</h2>
							<div className="relative mb-6">
								<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
								<input type="text" placeholder="Search ID or Phone..." value={searchPickups} onChange={(e) => setSearchPickups(e.target.value)} className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-amber-500/50 focus:outline-none text-stone-200" />
							</div>
							<div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
								<AnimatePresence>
									{filteredPickups.map((o) => (
										<TicketCard key={o.orderId} order={o}>
											<button onClick={() => triggerConfirm(o.orderId, "cancelled", "Reject")} className="w-1/3 bg-stone-900 hover:bg-rose-950 text-rose-500 border border-rose-900/50 rounded-xl font-black flex justify-center items-center gap-2 transition-colors">
												<XCircle size={18} />
											</button>
											<button onClick={() => triggerConfirm(o.orderId, "active", "Approve")} className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black flex justify-center items-center gap-2 shadow-md">
												<Check size={18} /> Approve
											</button>
										</TicketCard>
									))}
								</AnimatePresence>
							</div>
						</div>

						{/* RIGHT SIDE: PREPARING */}
						<div className="bg-stone-900/50 rounded-4xl border border-stone-800 p-6">
							<h2 className="text-xl font-black text-emerald-500 mb-6 flex items-center gap-2"><Coffee size={24} /> Preparing</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
								<AnimatePresence>
									{activePickups.map((o) => (
										<TicketCard key={o.orderId} order={o}>
											<button onClick={() => triggerConfirm(o.orderId, "pending", "Revert")} className="w-1/3 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-xl font-bold flex items-center justify-center transition-colors tooltip" title="Revert to Pending">
												<Undo2 size={18} />
											</button>
											<button onClick={() => triggerConfirm(o.orderId, "ready", "Ready")} className="w-2/3 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-xl font-black flex justify-center items-center gap-2 shadow-md">
												Ready <ArrowRight size={18} />
											</button>
										</TicketCard>
									))}
								</AnimatePresence>
							</div>
						</div>
					</div>
				)}

				{/* 3. READY TAB */}
				{activeTab === "ready" && (
					<div className="space-y-6">
						<div className="relative max-w-md">
							<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
							<input type="text" placeholder="Search Order ID or Phone..." value={searchReady} onChange={(e) => setSearchReady(e.target.value)} className="w-full bg-stone-900/50 border border-stone-800 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-amber-500/50 focus:outline-none text-stone-200" />
						</div>
						<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
							<AnimatePresence>
								{filteredReady.map((o) => (
									<TicketCard key={o.orderId} order={o}>
										<button onClick={() => triggerConfirm(o.orderId, "completed", "Picked Up")} className="w-full h-full bg-stone-100 hover:bg-white text-stone-900 rounded-xl font-black flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md">
											<ShoppingBag size={20} /> Picked Up
										</button>
									</TicketCard>
								))}
							</AnimatePresence>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
