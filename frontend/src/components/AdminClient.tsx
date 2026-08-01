"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, LayoutDashboard, Coffee, LogOut, TrendingUp, AlertCircle, Save } from "lucide-react";
import { Toaster, toast } from 'sonner';
import {
	LineChart, Line, BarChart, Bar,
	XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// Types
export type Drink = {
	id: number;
	name: string;
	description: string | null;
	priceInPiastres: number;
	originalPriceInPiastres?: number | null;
	isOutOfStock: boolean;
	category: string;
};

type Stats = {
	dailyStats: { date: string; orderCount: number; revenuePiastres: number }[];
	itemPopularity: { name: string; salesCount: number }[];
	peakHours: { hour: string; orderCount: number }[];
};

type FieldKey = "priceInPiastres" | "originalPriceInPiastres" | "description" | "category";

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const formatEGP = (piastres: number) => {
	const egp = piastres / 100;
	return Number.isInteger(egp) ? `${egp} EGP` : `${egp.toFixed(2)} EGP`;
};

const fieldLabel = (field: FieldKey) => {
	switch (field) {
		case "priceInPiastres": return "price";
		case "originalPriceInPiastres": return "original price";
		case "description": return "description";
		case "category": return "category";
	}
};

export default function AdminClient({ initialDrinks }: { initialDrinks: Drink[] }) {
	// Start as "unknown" rather than "logged out" — we don't yet know if
	// there's a valid deviceToken cookie until we've checked.
	const [checkingSession, setCheckingSession] = useState(true);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [activeTab, setActiveTab] = useState<"dashboard" | "menu">("dashboard");

	const [stats, setStats] = useState<Stats | null>(null);
	const [drinks, setDrinks] = useState<Drink[]>(initialDrinks);
	const [loading, setLoading] = useState(false);

	// Whether edits commit immediately (onBlur) or wait for an explicit
	// per-row Save click. Defaults to the original auto-save behavior.
	const [autoSave, setAutoSave] = useState(true);

	// Raw text currently shown in an input, keyed by `${drinkId}:${field}`.
	// Only present here while a field has an un-committed edit — once
	// committed (or reverted), the entry is removed and the input falls
	// back to displaying the real value from `drinks`.
	const [rawInputs, setRawInputs] = useState<Record<string, string>>({});

	// --- SESSION CHECK ON LOAD ---
	useEffect(() => {
		(async () => {
			try {
				const res = await fetch(`${SERVER_URL}/api/admin/stats`, {
					credentials: "include",
				});
				if (res.ok) {
					const data = await res.json();
					setStats(data);
					setIsAuthenticated(true);
				}
			} catch (error) {
				console.error("Session check failed:", error);
			} finally {
				setCheckingSession(false);
			}
		})();
	}, []);

	// --- AUTHENTICATION ---
	const handleLogin = async (e: React.SyntheticEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch(`${SERVER_URL}/api/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
				credentials: "include",
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				if (res.status === 429) {
					throw new Error(data.message || "Too many attempts. Try again later.");
				}
				throw new Error(data.message || "Invalid email or password");
			}

			setIsAuthenticated(true);
			toast.success("Access Granted");
			fetchStats();
		} catch (error: any) {
			toast.error(error.message || "Login failed");
		} finally {
			setLoading(false);
		}
	};

	const handleLogout = async () => {
		try {
			await fetch(`${SERVER_URL}/api/auth/logout`, {
				method: "POST",
				credentials: "include",
			});
		} catch (error) {
			console.error("Logout request failed:", error);
		} finally {
			setIsAuthenticated(false);
			setPassword("");
			setEmail("");
			setStats(null);
		}
	};

	// --- DATA FETCHING ---
	const fetchStats = async () => {
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/stats`, {
				credentials: "include",
			});
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error("Failed to load stats");
			}
			const data = await res.json();
			setStats(data);
		} catch (error) {
			console.error(error);
			toast.error("Failed to refresh stats");
		}
	};

	// --- MENU MANAGEMENT ---

	// Returns true on success, false on failure — callers use this to
	// decide whether to clear a row's draft or leave it for retry.
	const handleUpdateDrink = async (id: number, updates: Partial<Drink>): Promise<boolean> => {
		const previous = drinks.find((d) => d.id === id);
		if (!previous) return false;

		setDrinks((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));

		try {
			const res = await fetch(`${SERVER_URL}/api/admin/menu/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updates),
				credentials: "include",
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				if (res.status === 401 || res.status === 403) {
					setIsAuthenticated(false);
					toast.error("Session expired. Please log in again.");
				} else {
					toast.error(data.message || "Failed to update menu");
				}
				setDrinks((prev) => prev.map((d) => (d.id === id ? previous : d)));
				return false;
			}

			toast.success("Menu updated successfully");
			return true;
		} catch (error) {
			toast.error("Network error — could not reach server");
			setDrinks((prev) => prev.map((d) => (d.id === id ? previous : d)));
			return false;
		}
	};

	// --- DRAFT / INPUT HELPERS ---

	const inputKey = (id: number, field: FieldKey) => `${id}:${field}`;

	const getDisplayValue = (drink: Drink, field: FieldKey): string => {
		const key = inputKey(drink.id, field);
		if (key in rawInputs) return rawInputs[key];
		switch (field) {
			case "priceInPiastres":
				return String(drink.priceInPiastres / 100);
			case "originalPriceInPiastres":
				return drink.originalPriceInPiastres ? String(drink.originalPriceInPiastres / 100) : "";
			case "description":
				return drink.description ?? "";
			case "category":
				return drink.category ?? "";
		}
	};

	const handleFieldChange = (id: number, field: FieldKey, value: string) => {
		setRawInputs((prev) => ({ ...prev, [inputKey(id, field)]: value }));
	};

	const isRowDirty = (drink: Drink): boolean =>
		(["priceInPiastres", "originalPriceInPiastres", "description", "category"] as FieldKey[]).some(
			(f) => inputKey(drink.id, f) in rawInputs,
		);

	const clearRowDrafts = (id: number) => {
		setRawInputs((prev) => {
			const copy = { ...prev };
			(["priceInPiastres", "originalPriceInPiastres", "description", "category"] as FieldKey[]).forEach(
				(f) => delete copy[inputKey(id, f)],
			);
			return copy;
		});
	};

	const clearFieldDraft = (id: number, field: FieldKey) => {
		setRawInputs((prev) => {
			const copy = { ...prev };
			delete copy[inputKey(id, field)];
			return copy;
		});
	};

	// Validates a single field's raw text against the drink's current
	// value and returns the update to send (if any actually changed).
	const buildFieldUpdate = (
		drink: Drink,
		field: FieldKey,
	): { valid: boolean; update?: Partial<Drink> } => {
		const key = inputKey(drink.id, field);
		if (!(key in rawInputs)) return { valid: true }; // untouched
		const raw = rawInputs[key];

		if (field === "priceInPiastres") {
			const parsed = parseFloat(raw);
			if (isNaN(parsed) || parsed <= 0) return { valid: false };
			const newPrice = Math.round(parsed * 100); // avoids float drift, e.g. 12.34 * 100
			if (newPrice === drink.priceInPiastres) return { valid: true };
			return { valid: true, update: { priceInPiastres: newPrice } };
		}

		if (field === "originalPriceInPiastres") {
			if (raw === "") {
				if (drink.originalPriceInPiastres == null) return { valid: true };
				return { valid: true, update: { originalPriceInPiastres: null } };
			}
			const parsed = parseFloat(raw);
			if (isNaN(parsed) || parsed <= 0) return { valid: false };
			const newOriginal = Math.round(parsed * 100);
			if (newOriginal === drink.originalPriceInPiastres) return { valid: true };
			return { valid: true, update: { originalPriceInPiastres: newOriginal } };
		}

		if (field === "description") {
			if (raw === (drink.description ?? "")) return { valid: true };
			return { valid: true, update: { description: raw } };
		}

		if (field === "category") {
			if (raw.trim() === "") return { valid: false };
			if (raw === drink.category) return { valid: true };
			return { valid: true, update: { category: raw } };
		}

		return { valid: true };
	};

	// Auto-save mode: commits a single field the moment it loses focus.
	const commitField = async (drink: Drink, field: FieldKey) => {
		const result = buildFieldUpdate(drink, field);
		if (!result.valid) {
			toast.error(`Enter a valid ${fieldLabel(field)}`);
			clearFieldDraft(drink.id, field); // revert input to last known-good value
			return;
		}
		clearFieldDraft(drink.id, field);
		if (result.update) {
			await handleUpdateDrink(drink.id, result.update);
		}
	};

	// Manual-save mode: gathers every changed field on the row and sends
	// them together as one PATCH when the Save button is clicked.
	const handleSaveRow = async (drink: Drink) => {
		const fields: FieldKey[] = ["priceInPiastres", "originalPriceInPiastres", "description", "category"];
		let update: Partial<Drink> = {};
		let hasInvalid = false;

		for (const field of fields) {
			const result = buildFieldUpdate(drink, field);
			if (!result.valid) {
				hasInvalid = true;
				toast.error(`Enter a valid ${fieldLabel(field)}`);
				continue;
			}
			if (result.update) update = { ...update, ...result.update };
		}

		if (hasInvalid) return; // keep drafts so the admin can fix and retry

		if (Object.keys(update).length === 0) {
			clearRowDrafts(drink.id); // nothing actually changed
			return;
		}

		const success = await handleUpdateDrink(drink.id, update);
		if (success) clearRowDrafts(drink.id); // keep drafts on failure so nothing is lost
	};

	// --- RENDER: CHECKING SESSION ---
	if (checkingSession) {
		return (
			<div className="min-h-screen bg-stone-100 flex items-center justify-center">
				<p className="text-stone-400 font-bold">Checking session…</p>
			</div>
		);
	}

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
					<p className="text-sm text-stone-500 mb-8">Sign in with your manager account to continue.</p>

					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Manager Email"
						autoComplete="username"
						className="text-stone-900 w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-4 mb-4 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
					/>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
						autoComplete="current-password"
						className="text-stone-900 w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-4 mb-4 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
					/>
					<button
						type="submit"
						disabled={loading}
						className="w-full bg-amber-900 hover:bg-amber-800 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
					>
						{loading ? "Verifying..." : "Secure Login"}
					</button>
				</motion.form>
			</div>
		);
	}

	// Derived KPI totals for the dashboard summary cards
	const totalRevenuePiastres = stats?.dailyStats.reduce((sum, d) => sum + d.revenuePiastres, 0) ?? 0;
	const totalOrders = stats?.dailyStats.reduce((sum, d) => sum + d.orderCount, 0) ?? 0;
	const avgOrderValuePiastres = totalOrders > 0 ? Math.round(totalRevenuePiastres / totalOrders) : 0;
	const now = new Date();
	const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	const currentMonthRevenuePiastres = stats?.dailyStats
		.filter((d) => d.date.startsWith(currentMonthKey))
		.reduce((sum, d) => sum + d.revenuePiastres, 0) ?? 0;

	const categoryOptions = Array.from(new Set(drinks.map((d) => d.category))).filter(Boolean);

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
					onClick={handleLogout}
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
								<>
									{/* KPI Summary Cards */}
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
										<div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
											<p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Total Revenue (60d)</p>
											<p className="text-2xl font-black text-emerald-600">{formatEGP(totalRevenuePiastres)}</p>
										</div>
										<div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
											<p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Total Revenue (This Month)</p>
											<p className="text-2xl font-black text-emerald-600">{formatEGP(currentMonthRevenuePiastres)}</p>
										</div>
										<div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
											<p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Total Orders (60d)</p>
											<p className="text-2xl font-black text-amber-900">{totalOrders}</p>
										</div>
										<div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200">
											<p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Avg Order Value</p>
											<p className="text-2xl font-black text-stone-700">{formatEGP(avgOrderValuePiastres)}</p>
										</div>
									</div>

									<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

										{/* Order Curve Chart */}
										<div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 lg:col-span-2">
											<h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-6 flex items-center gap-2"><TrendingUp size={16} /> Orders (Last 60 Days)</h3>
											<div className="h-72">
												<ResponsiveContainer width="100%" height="100%">
													<LineChart data={stats.dailyStats}>
														<CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
														<XAxis dataKey="date" tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} />
														<YAxis tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} allowDecimals={false} />
														<Tooltip formatter={(value) => [`${value} orders`, "Orders"]} labelStyle={{ color: '#1c1917', fontWeight: 'bold' }} />
														<Line type="monotone" dataKey="orderCount" stroke="#059669" strokeWidth={4} dot={false} activeDot={{ r: 8 }} />
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

										{/* Top Items — horizontal bar, easier to rank/compare than a pie
										    once you have more than a handful of items */}
										<div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
											<h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-6">Top Items</h3>
											<div className="h-64">
												<ResponsiveContainer width="100%" height="100%">
													<BarChart data={stats.itemPopularity} layout="vertical" margin={{ left: 16 }}>
														<CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
														<XAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} allowDecimals={false} />
														<YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#57534e' }} tickLine={false} axisLine={false} />
														<Tooltip cursor={{ fill: '#f5f5f4' }} formatter={(value) => [`${value} sold`, ""]} />
														<Bar dataKey="salesCount" fill="#7c3aed" radius={[0, 4, 4, 0]} />
													</BarChart>
												</ResponsiveContainer>
											</div>
										</div>

									</div>
								</>
							)}
						</motion.div>
					)}

					{/* TAB 2: MENU MANAGER */}
					{activeTab === "menu" && (
						<motion.div key="menu" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
							<div className="flex items-center justify-between mb-8 flex-wrap gap-4">
								<h2 className="text-3xl font-black text-stone-800">Menu Manager</h2>
								<label className="flex items-center gap-3 cursor-pointer select-none">
									<span className="text-sm font-bold text-stone-500">Auto-save</span>
									<button
										type="button"
										role="switch"
										aria-checked={autoSave}
										onClick={() => setAutoSave((v) => !v)}
										className={`relative w-11 h-6 rounded-full transition-colors ${autoSave ? "bg-emerald-500" : "bg-stone-300"}`}
									>
										<span
											className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSave ? "translate-x-5" : ""}`}
										/>
									</button>
								</label>
							</div>

							<datalist id="category-options">
								{categoryOptions.map((cat) => (
									<option key={cat} value={cat} />
								))}
							</datalist>

							<div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse">
										<thead>
											<tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold text-stone-500 uppercase tracking-widest">
												<th className="p-4 pl-6">Item Name</th>
												<th className="p-4">Category</th>
												<th className="p-4">Description</th>
												<th className="p-4">Current Price (EGP)</th>
												<th className="p-4">Original Price (EGP)</th>
												<th className="p-4">Stock Status</th>
												<th className="p-4">Action</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-stone-100">
											{drinks.map(drink => (
												<tr key={drink.id} className="hover:bg-stone-50/50 transition-colors align-top">
													<td className="p-4 pl-6 font-bold text-stone-800 whitespace-nowrap">
														{drink.name}
													</td>

													<td className="p-4">
														<input
															type="text"
															list="category-options"
															value={getDisplayValue(drink, "category")}
															onChange={(e) => handleFieldChange(drink.id, "category", e.target.value)}
															onBlur={() => { if (autoSave) commitField(drink, "category"); }}
															className="w-32 bg-stone-100 border-none rounded-lg px-3 py-1.5 text-xs font-semibold text-stone-700 focus:ring-2 focus:ring-amber-500"
														/>
													</td>

													<td className="p-4">
														<textarea
															rows={2}
															value={getDisplayValue(drink, "description")}
															onChange={(e) => handleFieldChange(drink.id, "description", e.target.value)}
															onBlur={() => { if (autoSave) commitField(drink, "description"); }}
															className="w-48 bg-stone-100 border-none rounded-lg px-3 py-1.5 text-xs text-stone-600 resize-none focus:ring-2 focus:ring-amber-500"
														/>
													</td>

													<td className="p-4">
														<input
															type="number"
															step="0.01"
															value={getDisplayValue(drink, "priceInPiastres")}
															onChange={(e) => handleFieldChange(drink.id, "priceInPiastres", e.target.value)}
															onBlur={() => { if (autoSave) commitField(drink, "priceInPiastres"); }}
															className="w-24 bg-stone-100 border-none rounded-lg px-3 py-1.5 font-bold text-stone-700 focus:ring-2 focus:ring-amber-500"
														/>
													</td>

													<td className="p-4">
														<input
															type="number"
															step="0.01"
															placeholder="None"
															value={getDisplayValue(drink, "originalPriceInPiastres")}
															onChange={(e) => handleFieldChange(drink.id, "originalPriceInPiastres", e.target.value)}
															onBlur={() => { if (autoSave) commitField(drink, "originalPriceInPiastres"); }}
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
														{autoSave ? (
															<span className="text-xs text-stone-400 flex items-center gap-1"><Save size={14} /> Auto-saves</span>
														) : (
															<button
																onClick={() => handleSaveRow(drink)}
																disabled={!isRowDirty(drink)}
																className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors ${isRowDirty(drink)
																	? "bg-amber-900 text-white hover:bg-amber-800"
																	: "bg-stone-100 text-stone-400 cursor-not-allowed"
																	}`}
															>
																<Save size={14} /> {isRowDirty(drink) ? "Save" : "Saved"}
															</button>
														)}
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
