import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api";
import { publicUser } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { UserProvider } from "@/components/layout/user-context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <UserProvider initial={publicUser(user)}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
