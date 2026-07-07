"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/server/auth/client";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <div className="p-4 pt-6">
      <h1 className="mb-6 text-xl font-bold">设置</h1>
      <Button variant="outline" onClick={handleLogout} className="w-full text-destructive">
        登出
      </Button>
    </div>
  );
}
