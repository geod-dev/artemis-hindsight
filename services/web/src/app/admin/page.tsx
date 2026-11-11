import { AdminPanel } from "@/components/admin/admin-panel";

export const dynamic = "force-dynamic";

// The page itself is open; every admin operation it makes is checked on the server against the access key.
export default function AdminPage() {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <AdminPanel />
    </main>
  );
}
