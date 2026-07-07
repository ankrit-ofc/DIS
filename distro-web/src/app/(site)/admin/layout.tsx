"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (!token || user?.role !== "ADMIN") {
      router.replace("/login");
    }
  }, [token, user, router]);

  if (!token || user?.role !== "ADMIN") return null;

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-5 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
