"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, LayoutDashboard, Coffee, LogOut, TrendingUp, AlertCircle, Save } from "lucide-react";
import { Toaster, toast } from 'sonner';
import {
	LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
	XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

// Types
export type Drink = {
	id: number;
	name: string;
	category: string;
	priceInPiastres: number;
	originalPriceInPiastres?: number | null;
	isOutOfStock: boolean;
};

type Stats = {
	dailyStats: { date: string; orderCount: number; revenuePiastres: number }[];
	itemPopularity: { name: string; salesCount: number }[];
	peakHours: { hour: string; orderCount: number }[];
};

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const PIE_COLORS = ["#059669", "#d97706", "#dc2626", "#2563eb", "#7c3aed", "#475569", "#0891b2", "#be185d"];

export default function AdminClient({ initialDrinks }: { initialDrinks: Drink[] }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [password, setPassword] = useState("");
	const [activeTab, setActiveTab] = useState<"dashboard" | "menu">("dashboard");

	const [stats, setStats] = useState<Stats | null>(null);
	const [drinks, setDrinks] = useState<Drink[]>(initialDrinks);
	const [loading, setLoading] = useState(false);

	// --- AUTHENTICATION ---
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
				credentials: "include", // Essential for setting the HTTP-only cookie
			});

			if (!res.ok) throw new Error("Invalid password");

			setIsAuthenticated(true);
			toast.success("Access Granted");
			fetchStats();
		} catch (error) {
			toast.error("Incorrect Admin Password");
		} finally {
			setLoading(false);
		}
	};

	// --- DATA FETCHING ---
	const fetchStats = async () => {
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/stats`, {
				credentials: "include", // Essential for sending the HTTP-only cookie
			});
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error("Failed to load stats");
			}
			const data = await res.json();
			setStats(data);
		} catch (error) {
			console.error(error);
		}
	};

	// --- MENU MANAGEMENT ---
	const handleUpdateDrink = async (id: number, updates: Partial<Drink>) => {
		// Optimistic UI Update
		setDrinks(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));

		try {
			const res = await fetch(`${SERVER_URL}/api/admin/menu/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updates),
				credentials: "include",
			});

			if (!res.ok) throw new Error("Failed to update");
			toast.success("Menu updated successfully");
		} catch (error) {
			toast.error("Failed to update menu");
			// Revert on failure (simplified for this example, normally you'd save the previous state)
		}
	};

	// --- RENDER LOGIN ---
	if (!isAuthenticated) {
		return (
			<div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
				<Toaster richColors position="top-right" />
				<motion.form
					initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
					onSubmit={handleLogin}
					className="bg-white p-8 rounded-4xl shadow-xl border border-stone-200 w-full max-w-sm text-center"
				>
					<div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
						<Lock className="text-stone-500" size={32} />
					</div>
					<h1 className="text-2xl font-black text-amber-900 mb-2">Admin Portal</h1>
					<p className="text-sm text-stone-500 mb-8">Enter your agency password to continue.</p>

					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Admin Password"
						className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-4 mb-4 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
					/>
					<button
						type="submit"
						disabled={loading}
						className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-3 rounded-xl transition-colors"
					>
						{loading ? "Verifying..." : "Secure Login"}
					</button>
				</motion.form>
			</div>
		);
	}

	// --- RENDER DASHBOARD ---
	return (
		<div className="min-h-screen bg-stone-100 text-stone-800 font-sans flex flex-col md:flex-row">
			<Toaster richColors position="top-right" />

			{/* Sidebar Navigation */}
			<aside className="w-full md:w-64 bg-white border-r border-stone-200 p-6 flex flex-col justify-between">
				<div>
					<h1 className="text-2xl font-black text-amber-900 mb-8 tracking-tight">Command Center</h1>
					<nav className="space-y-2">
						<button
							onClick={() => setActiveTab("dashboard")}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === "dashboard" ? "bg-amber-50 text-amber-900" : "text-stone-500 hover:bg-stone-50"}`}
						>
							<LayoutDashboard size={20} /> Analytics
						</button>
						<button
							onClick={() => setActiveTab("menu")}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === "menu" ? "bg-amber-50 text-amber-900" : "text-stone-500 hover:bg-stone-50"}`}
						>
							<Coffee size={20} /> Menu Manager
						</button>
					</nav>
				</div>
				<button
					onClick={() => { setIsAuthenticated(false); setPassword(""); }}
					className="flex items-center gap-2 text-stone-400 hover:text-rose-500 font-bold transition-colors mt-8 md:mt-0"
				>
					<LogOut size={18} /> Disconnect
				</button>
			</aside>

			{/* Main Content Area */}
			<main className="flex-1 p-6 md:p-10 overflow-y-auto">
				<AnimatePresence mode="wait">

					{/* TAB 1: ANALYTICS DASHBOARD */}
					{activeTab === "dashboard" && (
						<motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
							<div className="flex items-center justify-between mb-8">
								<h2 className="text-3xl font-black text-stone-800">Business Intelligence</h2>
								<button onClick={fetchStats} className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors">
									Refresh Data
								</button>
							</div>

							{!stats ? (
								<div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-6 py-1"><div className="h-64 bg-stone-200 rounded-3xl"></div></div></div>
							) : (
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

									{/* Revenue Curve Chart */}
									<div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 lg:col-span-2">
										<h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp size={16} /> Revenue (Last 60 Days)</h3>
										<div className="h-72">
											<ResponsiveContainer width="100%" height="100%">
												<LineChart data={stats.dailyStats.map(s => ({ ...s, rev: s.revenuePiastres / 100 }))}>
													<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
													<XAxis dataKey="date" tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} />
													<YAxis tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val} EGP`} />
													<Tooltip formatter={(value: number) => [`${value} EGP`, "Revenue"]} labelStyle={{ color: '#1c1917', fontWeight: 'bold' }} />
													<Line type="monotone" dataKey="rev" stroke="#059669" strokeWidth={4} dot={false} activeDot={{ r: 8 }} />
												</LineChart>
											</ResponsiveContainer>
										</div>
									</div>

									{/* Peak Hours Bar Chart */}
									<div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
										<h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-6">Peak Activity Hours</h3>
										<div className="h-64">
											<ResponsiveContainer width="100%" height="100%">
												<BarChart data={stats.peakHours}>
													<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
													<XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#78716c' }} interval="preserveStartEnd" />
													<Tooltip cursor={{ fill: '#f5f5f4' }} />
													<Bar dataKey="orderCount" fill="#d97706" radius={[4, 4, 0, 0]} />
												</BarChart>
											</ResponsiveContainer>
										</div>
									</div>

									{/* Item Popularity Pie Chart */}
									<div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
										<h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-6">Top Items</h3>
										<div className="h-64">
											<ResponsiveContainer width="100%" height="100%">
												<PieChart>
													<Pie data={stats.itemPopularity} dataKey="salesCount" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
														{stats.itemPopularity.map((entry, index) => (
															<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
														))}
													</Pie>
													<Tooltip />
													<Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }} />
												</PieChart>
											</ResponsiveContainer>
										</div>
									</div>

								</div>
							)}
						</motion.div>
					)}

					{/* TAB 2: MENU MANAGER */}
					{activeTab === "menu" && (
						<motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
							<h2 className="text-3xl font-black text-stone-800 mb-8">Menu Manager</h2>

							<div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse">
										<thead>
											<tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-500 uppercase tracking-widest">
												<th className="p-4 pl-6">Item Name</th>
												<th className="p-4">Current Price (EGP)</th>
												<th className="p-4">Original Price (EGP)</th>
												<th className="p-4">Stock Status</th>
												<th className="p-4">Action</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-stone-100">
											{drinks.map(drink => (
												<tr key={drink.id} className="hover:bg-stone-50/50 transition-colors">
													<td className="p-4 pl-6 font-bold text-stone-800">
														{drink.name} <span className="block text-[10px] text-stone-400 font-normal mt-0.5">{drink.category}</span>
													</td>

													<td className="p-4">
														<input
															type="number"
															defaultValue={drink.priceInPiastres / 100}
															onBlur={(e) => {
																const newPrice = parseFloat(e.target.value) * 100;
																if (newPrice !== drink.priceInPiastres) handleUpdateDrink(drink.id, { priceInPiastres: newPrice });
															}}
															className="w-24 bg-stone-100 border-none rounded-lg px-3 py-1.5 font-bold text-stone-700 focus:ring-2 focus:ring-amber-500"
														/>
													</td>

													<td className="p-4">
														<input
															type="number"
															placeholder="None"
															defaultValue={drink.originalPriceInPiastres ? drink.originalPriceInPiastres / 100 : ""}
															onBlur={(e) => {
																const val = e.target.value;
																const newOriginal = val ? parseFloat(val) * 100 : null;
																if (newOriginal !== drink.originalPriceInPiastres) handleUpdateDrink(drink.id, { originalPriceInPiastres: newOriginal });
															}}
															className="w-24 bg-stone-100 border-none rounded-lg px-3 py-1.5 font-bold text-stone-500 placeholder:text-stone-300 focus:ring-2 focus:ring-amber-500"
														/>
													</td>

													<td className="p-4">
														<button
															onClick={() => handleUpdateDrink(drink.id, { isOutOfStock: !drink.isOutOfStock })}
															className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${drink.isOutOfStock ? "bg-rose-100 text-rose-700 hover:bg-rose-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
																}`}
														>
															{drink.isOutOfStock ? "Out of Stock" : "In Stock"}
														</button>
													</td>

													<td className="p-4">
														<span className="text-xs text-stone-400 flex items-center gap-1"><Save size={14} /> Auto-saves</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
							<p className="mt-4 text-sm text-stone-500 flex items-center gap-1">
								<AlertCircle size={16} /> To set a discount, add a higher Original Price. To remove a discount, delete the Original Price.
							</p>
						</motion.div>
					)}
				</AnimatePresence>
			</main>
		</div>
	);
}
