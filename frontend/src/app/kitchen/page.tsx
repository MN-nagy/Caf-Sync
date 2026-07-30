import { cookies } from "next/headers";
import KitchenClient from "@/components/KitchenClient";
import ManagerLogin from "@/components/ManagerLogin";
import PinPad from "@/components/PinPad";

// Force Next.js to dynamically fetch this on every request (no stale caching)
export const dynamic = "force-dynamic";

export default async function KitchenPage() {


	const cookieStore = await cookies();
	const deviceToken = cookieStore.get("deviceToken")?.value;
	const shiftToken = cookieStore.get("shiftToken")?.value;

	if (!deviceToken) {
		return <ManagerLogin />;
	}

	if (!shiftToken) {
		return <PinPad />;
	}

	const cookieHeader = cookieStore.toString();
	const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

	let activeOrders = [];
	try {
		const res = await fetch(`${API_URL}/api/orders/active`, {
			headers: { Cookie: cookieHeader },
			cache: 'no-store',
		});
		if (res.ok) {
			activeOrders = await res.json();
		} else {
			console.error(`Failed to fetch order. Status: ${res.status}`);
		}

	} catch (error) {
		console.error("Network error while fetching order:", error);

	}

	return <KitchenClient initialOrders={Array.isArray(activeOrders) ? activeOrders : []} />;
}
