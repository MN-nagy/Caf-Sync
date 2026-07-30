import PremiumMenuClient from "@/components/PremiumMenuClient";

// Define the shape of Next.js page props
type Props = {
	searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default async function MenuPage({ searchParams }: Props) {
	// 1. Read the URL parameters (e.g., ?type=dine-in&table=5)
	const resolvedSearchParams = await searchParams;

	const orderType = resolvedSearchParams.type || 'pickup';
	const tableNumber = resolvedSearchParams.table || null;


	const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

	let drinks = [];

	try {
		const res = await fetch(`${API_URL}/api/menu`, { cache: 'no-store' });
		if (res.ok) {
			const rawData = await res.json();
			drinks = Array.isArray(rawData) ? rawData : [];
		} else {
			console.error(`Failed to fetch menu. Status: ${res.status}`);
		}
	} catch (error) {
		console.error("Network error while fetching menu:", error);
	}

	return (
		<main className="min-h-screen bg-stone-100 font-sans selection:bg-emerald-200">
			{/* 4. Pass the data and the URL context to our interactive client UI */}
			<PremiumMenuClient drinks={drinks} orderType={orderType} tableNumber={tableNumber} />
		</main>
	);
}
