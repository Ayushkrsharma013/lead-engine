"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/prospecting-os/login");
        router.refresh();
      }}
      className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-80"
      style={{
        background: "none",
        border: "none",
        color: "var(--text-secondary, #b0aeaa)",
        cursor: "pointer",
        fontFamily: "inherit",
        padding: "6px 10px",
        borderRadius: 8,
      }}
    >
      <LogOut size={15} />
      Sign Out
    </button>
  );
}
