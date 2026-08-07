"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2 } from "lucide-react";
import AuthWrapper from "./AuthWrapper";

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function ManagerLogin() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		try {
			const res = await fetch(`${SERVER_URL}/api/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
				credentials: "include", // Essential for receiving the HttpOnly cookie
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				throw new Error(data.message || "Login failed");
			}

			router.refresh();
		} catch (err: any) {
			setError(err.message);
			setLoading(false);
		}
	};

	return (
		<AuthWrapper title="Device Enrollment" subtitle="Manager credentials required to bind this device.">
			<form onSubmit={handleLogin} className="space-y-5">
				{error && (
					<div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 text-sm p-3 rounded-xl text-center font-medium">
						{error}
					</div>
				)}

				<div className="space-y-1">
					<label className="text-xs font-bold text-stone-400 uppercase tracking-wider pl-1">Email</label>
					<div className="relative">
						<Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
						<input
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full bg-stone-950 border border-stone-800 text-stone-100 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
							placeholder="manager@caf.com"
						/>
					</div>
				</div>

				<div className="space-y-1">
					<label className="text-xs font-bold text-stone-400 uppercase tracking-wider pl-1">Password</label>
					<div className="relative">
						<Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
						<input
							type="password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full bg-stone-950 border border-stone-800 text-stone-100 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
							placeholder="••••••••"
						/>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					className="w-full bg-amber-600 hover:bg-amber-500 text-amber-50 font-bold py-3.5 rounded-xl transition-all active:scale-95 flex justify-center items-center gap-2 shadow-lg shadow-amber-900/20"
				>
					{loading ? <Loader2 className="animate-spin" size={20} /> : "Bind Device"}
				</button>
			</form>
		</AuthWrapper>
	);
}
