import { getSessionUser } from "@/lib/api";
import { publicUser } from "@/lib/auth/server";
import { ensureDemoSession } from "@/lib/auth/demo-session";
import { AppShell } from "@/components/layout/app-shell";
import { UserProvider } from "@/components/layout/user-context";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = await getSessionUser();

  if (!user) {
    user = await ensureDemoSession();
  }

  return (
    <UserProvider initial={publicUser(user)}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}