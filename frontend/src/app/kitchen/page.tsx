import KitchenClient from "@/components/KitchenClient";

// Force Next.js to dynamically fetch this on every request (no stale caching)
export const dynamic = "force-dynamic";

export default async function KitchenPage() {
	// 1. Instantly fetch all 'active' orders from the database
	const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
	let activeOrders = [];

	try {
		const res = await fetch(`${API_URL}/api/orders/active`, {
			cache: 'no-store'
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
