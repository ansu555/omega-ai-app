export async function checkOnboarding(walletAddress: string): Promise<boolean> {
  // Fast path: localStorage
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("onboarding_wallet");
    if (stored === walletAddress) return true;
  }

  // Slow path: server-side DB check via API route
  try {
    const res = await fetch(
      `/api/onboarding?wallet=${encodeURIComponent(walletAddress)}`
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.found === true;
  } catch {
    return false;
  }
}
