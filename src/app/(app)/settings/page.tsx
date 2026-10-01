"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/misc";
import { Preferences } from "@/components/profile/preferences";
import { useUser } from "@/components/layout/user-context";
import { apiFetch } from "@/lib/client/api";

export default function SettingsPage() {
  const { user } = useUser();
  const router = useRouter();
  return (
    <>
      <PageHeader title="Settings" description="Appearance, attendance defaults and your account." />
      <div className="grid gap-5">
        <Card>
          <CardHeader title="Preferences" />
          <div className="p-5">
            <Preferences />
          </div>
        </Card>
        <Card>
          <CardHeader title="Account" description={`Signed in as ${user.email}`} />
          <div className="flex flex-wrap gap-2 p-5">
            <Button variant="secondary" onClick={() => router.push("/forgot-password")}>
              Change password
            </Button>
            <Button
              variant="danger-ghost"
              onClick={async () => {
                await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => null);
                router.replace("/login");
                router.refresh();
              }}
            >
              <LogOut /> Sign out
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Data on this device" description="Attendance drafts and offline submissions are stored in this browser until they're submitted." />
          <div className="p-5 text-sm text-fg-muted">
            Clearing your browser data removes unsent drafts. Submitted attendance is stored securely on the server and is never deleted
            when you change student lists.
          </div>
        </Card>
      </div>
    </>
  );
}
