"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Profile is now a modal accessible from the sidebar.
 * This page exists only as a fallback — redirects to the client portal.
 */
export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/client-portal");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={20} className="animate-spin" style={{ color: "var(--accent)" }} />
    </div>
  );
}
