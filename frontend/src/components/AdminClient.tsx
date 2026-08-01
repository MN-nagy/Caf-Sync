"use client";

import { useState, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, LayoutDashboard, Coffee, LogOut, TrendingUp, AlertCircle, Save, Settings, Plus, Trash2, KeyRound } from "lucide-react";
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

type CafeTable = { id: number; number: number; isActive: boolean };

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
	const [activeTab, setActiveTab] = useState<"dashboard" | "menu" | "settings">("dashboard");

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

	const [tables, setTables] = useState<CafeTable[]>([]);
	const [newTableNumber, setNewTableNumber] = useState("");
	const [newDrinkForm, setNewDrinkForm] = useState({ name: "", category: "", description: "", priceInPiastres: "" });
	const [addingDrink, setAddingDrink] = useState(false);
	const [newPin, setNewPin] = useState("");
	const [confirmPin, setConfirmPin] = useState("");
	const [changingPin, setChangingPin] = useState(false);

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
				fetchTables();
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
			fetchTables();
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

	const fetchTables = async () => {
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/tables`, { credentials: "include" });
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error("Failed to load tables");
			}
			setTables(await res.json());
		} catch (error) {
			console.error(error);
			toast.error("Failed to load tables");
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

	const handleAddTable = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const num = parseInt(newTableNumber, 10);
		if (isNaN(num) || num <= 0) { toast.error("Enter a valid table number"); return; }
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/tables`, {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ number: num }), credentials: "include",
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error(data.message || "Failed to add table");
			}
			setTables((prev) => [...prev, data.data].sort((a, b) => a.number - b.number));
			setNewTableNumber("");
			toast.success(`Table ${num} added`);
		} catch (error: any) {
			toast.error(error.message || "Failed to add table");
		}
	};

	const handleToggleTable = async (table: CafeTable) => {
		const previous = tables;
		setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, isActive: !t.isActive } : t)));
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/tables/${table.id}`, {
				method: "PATCH", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ isActive: !table.isActive }), credentials: "include",
			});
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error("Failed");
			}
		} catch {
			setTables(previous);
			toast.error("Failed to update table");
		}
	};

	const handleRemoveTable = async (table: CafeTable) => {
		const previous = tables;
		setTables((prev) => prev.filter((t) => t.id !== table.id));
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/tables/${table.id}`, { method: "DELETE", credentials: "include" });
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error("Failed");
			}
			toast.success(`Table ${table.number} removed`);
		} catch {
			setTables(previous);
			toast.error("Failed to remove table");
		}
	};

	const handleAddDrink = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const price = parseFloat(newDrinkForm.priceInPiastres);
		if (!newDrinkForm.name.trim() || !newDrinkForm.category.trim() || isNaN(price) || price <= 0) {
			toast.error("Fill in a name, category, and valid price");
			return;
		}
		setAddingDrink(true);
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/menu`, {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: newDrinkForm.name,
					category: newDrinkForm.category,
					description: newDrinkForm.description || null,
					priceInPiastres: Math.round(price * 100),
				}),
				credentials: "include",
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error(data.message || "Failed to add item");
			}
			setDrinks((prev) => [...prev, data.data]);
			setNewDrinkForm({ name: "", category: "", description: "", priceInPiastres: "" });
			toast.success("Menu item added");
		} catch (error: any) {
			toast.error(error.message || "Failed to add item");
		} finally {
			setAddingDrink(false);
		}
	};

	const handleArchiveDrink = async (drink: Drink) => {
		if (!confirm(`Remove "${drink.name}" from the menu? Past orders keep referencing it — it just won't show to customers anymore.`)) return;
		const previous = drinks;
		setDrinks((prev) => prev.filter((d) => d.id !== drink.id));
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/menu/${drink.id}`, { method: "DELETE", credentials: "include" });
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error("Failed");
			}
			toast.success(`${drink.name} removed from menu`);
		} catch {
			setDrinks(previous);
			toast.error("Failed to remove item");
		}
	};

	const handleChangePin = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!/^\d{4}$/.test(newPin)) { toast.error("PIN must be exactly 4 digits"); return; }
		if (newPin !== confirmPin) { toast.error("PINs don't match"); return; }
		setChangingPin(true);
		try {
			const res = await fetch(`${SERVER_URL}/api/admin/pin`, {
				method: "PATCH", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ newPin }), credentials: "include",
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				if (res.status === 401 || res.status === 403) setIsAuthenticated(false);
				throw new Error(data.message || "Failed to update PIN");
			}
			toast.success("Kitchen PIN updated");
			setNewPin(""); setConfirmPin("");
		} catch (error: any) {
			toast.error(error.message || "Failed to update PIN");
		} finally {
			setChangingPin(false);
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
						<button
							onClick={() => setActiveTab("settings")}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === "settings" ? "bg-amber-50 text-amber-900" : "text-stone-500 hover:bg-stone-50"}`}
						>
							<Settings size={20} /> Settings
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

					{/* TAB 3: Settings */}
					{activeTab === "settings" && (
						<motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
							<h2 className="text-3xl font-black text-stone-800 mb-2">Store Settings</h2>

							{/* TABLES */}
							<div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6">
								<h3 className="text-lg font-black text-stone-800 mb-4">Tables</h3>
								<form onSubmit={handleAddTable} className="flex gap-3 mb-6">
									<input type="number" min={1} placeholder="Table number" value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} className="w-40 bg-stone-100 border-none rounded-xl px-4 py-2.5 font-bold text-stone-700 focus:ring-2 focus:ring-amber-500" />
									<button type="submit" className="bg-amber-900 hover:bg-amber-800 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"><Plus size={16} /> Add Table</button>
								</form>
								<div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
									{tables.map((table) => (
										<div key={table.id} className={`rounded-2xl p-3 border flex flex-col items-center gap-2 ${table.isActive ? "bg-emerald-50 border-emerald-200" : "bg-stone-100 border-stone-200"}`}>
											<span className={`text-xl font-black ${table.isActive ? "text-emerald-700" : "text-stone-400"}`}>{table.number}</span>
											<div className="flex gap-1.5 w-full">
												<button onClick={() => handleToggleTable(table)} className={`flex-1 text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${table.isActive ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-stone-300 text-stone-600 hover:bg-stone-400"}`}>
													{table.isActive ? "On" : "Off"}
												</button>
												<button onClick={() => handleRemoveTable(table)} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100"><Trash2 size={12} /></button>
											</div>
										</div>
									))}
									{tables.length === 0 && <p className="col-span-full text-sm text-stone-400">No tables yet — add one above.</p>}
								</div>
							</div>

							{/* ADD MENU ITEM */}
							<div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6">
								<h3 className="text-lg font-black text-stone-800 mb-4">Add Menu Item</h3>
								<form onSubmit={handleAddDrink} className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<input type="text" placeholder="Item name" value={newDrinkForm.name} onChange={(e) => setNewDrinkForm((prev) => ({ ...prev, name: e.target.value }))} className="bg-stone-100 border-none rounded-xl px-4 py-2.5 font-bold text-stone-700 focus:ring-2 focus:ring-amber-500" />
									<input type="text" list="category-options" placeholder="Category" value={newDrinkForm.category} onChange={(e) => setNewDrinkForm((prev) => ({ ...prev, category: e.target.value }))} className="bg-stone-100 border-none rounded-xl px-4 py-2.5 font-semibold text-stone-700 focus:ring-2 focus:ring-amber-500" />
									<input type="number" step="0.01" placeholder="Price (EGP)" value={newDrinkForm.priceInPiastres} onChange={(e) => setNewDrinkForm((prev) => ({ ...prev, priceInPiastres: e.target.value }))} className="bg-stone-100 border-none rounded-xl px-4 py-2.5 font-bold text-stone-700 focus:ring-2 focus:ring-amber-500" />
									<input type="text" placeholder="Description (optional)" value={newDrinkForm.description} onChange={(e) => setNewDrinkForm((prev) => ({ ...prev, description: e.target.value }))} className="bg-stone-100 border-none rounded-xl px-4 py-2.5 text-stone-600 focus:ring-2 focus:ring-amber-500" />
									<button type="submit" disabled={addingDrink} className="md:col-span-2 bg-amber-900 hover:bg-amber-800 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
										<Plus size={16} /> {addingDrink ? "Adding..." : "Add Item"}
									</button>
								</form>
							</div>

							{/* REMOVE MENU ITEMS */}
							<div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6">
								<h3 className="text-lg font-black text-stone-800 mb-4">Remove Menu Items</h3>
								<div className="divide-y divide-stone-100">
									{drinks.map((drink) => (
										<div key={drink.id} className="flex items-center justify-between py-3">
											<div>
												<p className="font-bold text-stone-800">{drink.name}</p>
												<p className="text-xs text-stone-400">{drink.category}</p>
											</div>
											<button onClick={() => handleArchiveDrink(drink)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg"><Trash2 size={16} /></button>
										</div>
									))}
								</div>
							</div>

							{/* KITCHEN PIN */}
							<div className="bg-white rounded-3xl shadow-sm border border-stone-200 p-6 max-w-md">
								<h3 className="text-lg font-black text-stone-800 mb-4 flex items-center gap-2"><KeyRound size={18} /> Kitchen PIN</h3>
								<form onSubmit={handleChangePin} className="space-y-3">
									<input type="password" inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} className="w-full bg-stone-100 border-none rounded-xl px-4 py-2.5 text-center tracking-[0.5em] font-bold text-stone-700 focus:ring-2 focus:ring-amber-500" />
									<input type="password" inputMode="numeric" maxLength={4} placeholder="Confirm PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} className="w-full bg-stone-100 border-none rounded-xl px-4 py-2.5 text-center tracking-[0.5em] font-bold text-stone-700 focus:ring-2 focus:ring-amber-500" />
									<button type="submit" disabled={changingPin} className="w-full bg-amber-900 hover:bg-amber-800 disabled:opacity-60 text-white font-bold py-3 rounded-xl">
										{changingPin ? "Updating..." : "Update PIN"}
									</button>
								</form>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</main>
		</div>
	);
}
