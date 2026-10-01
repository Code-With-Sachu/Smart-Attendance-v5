"use client";
import * as React from "react";
import { toast } from "sonner";
import { ThemeSegmented } from "@/components/layout/theme-toggle";
import { useUser } from "@/components/layout/user-context";
import { Segmented } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { User } from "@/lib/client/types";

export function Preferences() {
  const { user, setUser } = useUser();
  const [threshold, setThreshold] = React.useState(String(user.preferences.lowAttendanceThreshold));

  async function save(prefs: Partial<User["preferences"]>) {
    const prev = user;
    setUser({ ...user, preferences: { ...user.preferences, ...prefs } }); // optimistic
    try {
      const r = await apiFetch<{ user: User }>("/api/me", { method: "PATCH", body: { preferences: prefs } });
      setUser(r.user);
      toast.success("Preference saved");
    } catch (e) {
      setUser(prev);
      toast.error(errorMessage(e));
    }
  }

  return (
    <dl className="divide-y divide-border">
      <div className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <dt className="text-sm font-medium text-fg">Theme</dt>
          <dd className="text-xs text-fg-muted">System follows your device setting. Saved on this device.</dd>
        </div>
        <ThemeSegmented />
      </div>
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <dt className="text-sm font-medium text-fg">Attendance display</dt>
          <dd className="text-xs text-fg-muted">Compact fits more students on screen; Detailed shows full names.</dd>
        </div>
        <Segmented
          label="Attendance display"
          value={user.preferences.attendanceView}
          onChange={(v) => save({ attendanceView: v })}
          options={[
            { value: "compact", label: "Compact" },
            { value: "detailed", label: "Detailed" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <dt className="text-sm font-medium text-fg">Low attendance threshold</dt>
          <dd className="text-xs text-fg-muted">Students below this percentage are flagged in analytics.</dd>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(threshold);
            if (Number.isInteger(n) && n >= 0 && n <= 100) save({ lowAttendanceThreshold: n });
            else toast.error("Enter a whole number from 0 to 100.");
          }}
        >
          <Input
            aria-label="Low attendance threshold percentage"
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            className="w-20"
          />
          <span className="text-sm text-fg-muted">%</span>
        </form>
      </div>
    </dl>
  );
}
