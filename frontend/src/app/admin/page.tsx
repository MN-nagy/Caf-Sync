import AdminClient from "@/components/AdminClient";

// Force Next.js to fetch fresh data every time this page loads
export const dynamic = "force-dynamic";

async function getDrinks() {
	try {
		const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
		const res = await fetch(`${apiUrl}/api/menu`, {
			cache: "no-store",
		});

		if (!res.ok) throw new Error("Failed to fetch menu");
		return await res.json();
	} catch (error) {
		console.error("Error fetching drinks for Admin:", error);
		return []; // Fallback so the page doesn't crash if DB is offline
	}
}

export default async function AdminPage() {
	const drinks = await getDrinks();

	return (
		<main>
			<AdminClient initialDrinks={drinks} />
		</main>
	);
}
