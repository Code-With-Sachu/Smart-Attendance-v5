"use client";
import * as React from "react";
import Link from "next/link";
import { Camera, Eye, Pencil, Sheet, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Avatar, Card, CardHeader, PageHeader, Skeleton } from "@/components/ui/misc";
import { useUser } from "@/components/layout/user-context";
import { StudentImportDialog } from "@/components/students/student-import-dialog";
import { WhatsAppContacts } from "@/components/whatsapp/whatsapp-contacts";
import { Preferences } from "@/components/profile/preferences";
import { apiFetch, errorMessage, useApi } from "@/lib/client/api";
import type { Dataset, User } from "@/lib/client/types";
import { formatDateTime, pluralize } from "@/lib/utils";

/** Resize to a 256px square WebP data URL so photos stay small. */
async function resizePhoto(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Use a PNG, JPG or WebP image.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Image is larger than 8 MB.");
  const bmp = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const s = Math.min(bmp.width, bmp.height);
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return canvas.toDataURL("image/webp", 0.85);
}

function ProfileCard() {
  const { user, setUser } = useUser();
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function patch(body: Partial<User>) {
    const r = await apiFetch<{ user: User }>("/api/me", { method: "PATCH", body });
    setUser(r.user);
  }

  async function onPhoto(file: File) {
    try {
      const photo = await resizePhoto(file);
      await patch({ photo });
      toast.success("Photo updated");
    } catch (e) {
      toast.error(e instanceof Error && !("status" in e) ? e.message : errorMessage(e));
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await patch({ name: String(f.get("name")), subject: String(f.get("subject")), teacherId: String(f.get("teacherId")) });
      toast.success("Profile saved");
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Profile"
        action={
          !editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Edit Profile
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-6 p-5 sm:flex-row">
        <div className="flex flex-col items-center gap-3">
          <Avatar name={user.name} src={user.photo} size={88} />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Upload profile photo"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onPhoto(f);
            }}
          />
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera /> Upload Photo
            </Button>
            {user.photo && (
              <Button variant="ghost" size="icon-sm" aria-label="Remove photo" onClick={() => patch({ photo: "" }).catch((e) => toast.error(errorMessage(e)))}>
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
        {editing ? (
          <form onSubmit={submit} className="grid flex-1 gap-4 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2">
              <Input name="name" defaultValue={user.name} required minLength={2} />
            </Field>
            <Field label="Subject" optional>
              <Input name="subject" defaultValue={user.subject} placeholder="e.g. Computer Science" />
            </Field>
            <Field label="Teacher ID" optional>
              <Input name="teacherId" defaultValue={user.teacherId} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={saving}>
                Save
              </Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid flex-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-fg-muted">Name</dt>
              <dd className="font-medium text-fg">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Email</dt>
              <dd className="font-medium text-fg">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Subject</dt>
              <dd className="font-medium text-fg">{user.subject || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Teacher ID</dt>
              <dd className="font-medium text-fg">{user.teacherId || "—"}</dd>
            </div>
          </dl>
        )}
      </div>
    </Card>
  );
}

function StudentDataCard() {
  const { data, isLoading, mutate } = useApi<{ datasets: (Dataset & { label: string })[]; profileDatasetId: string }>("/api/datasets");
  const [importOpen, setImportOpen] = React.useState<null | "file" | "google-sheet">(null);
  const master = data?.datasets.find((d) => d.id === data.profileDatasetId);
  return (
    <Card>
      <CardHeader title="Student Data" description="Upload student information for future use. Copy it into any class from that class's import dialog." />
      <div className="p-5">
        {isLoading || !master ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Users className="size-5" aria-hidden />
              </div>
              <div>
                <div className="text-xs text-fg-muted">Current student dataset</div>
                <div className="font-semibold text-fg">{pluralize(master.studentCount, "Student")}</div>
                <div className="text-xs text-fg-muted">
                  Last updated: {master.lastImportedAt ? formatDateTime(master.lastImportedAt) : "Never"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setImportOpen("file")}>
                <Upload /> {master.studentCount ? "Update Student Data" : "Upload Student File"}
              </Button>
              <Button variant="secondary" onClick={() => setImportOpen("google-sheet")}>
                <Sheet /> Import Google Sheet
              </Button>
              {master.studentCount > 0 && (
                <Link href={`/students?list=${master.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-fg-muted hover:bg-muted hover:text-fg">
                  <Eye className="size-4" /> View Students
                </Link>
              )}
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-fg-muted">Supported: CSV, XLSX, XLS, PDF, DOCX — or a Google Sheet shared by link.</p>
      </div>
      {master && (
        <StudentImportDialog
          open={importOpen !== null}
          onOpenChange={(o) => !o && setImportOpen(null)}
          datasetId={master.id}
          targetLabel="your master dataset"
          initialSource={importOpen ?? "file"}
          onImported={() => mutate()}
        />
      )}
    </Card>
  );
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Your details, student data, WhatsApp contacts and preferences." />
      <div className="grid gap-5">
        <ProfileCard />
        <StudentDataCard />
        <Card id="whatsapp">
          <CardHeader title="WhatsApp Sharing" description="Saved numbers you can send attendance reports to. Numbers are masked by default." />
          <div className="p-5">
            <WhatsAppContacts />
          </div>
        </Card>
        <Card>
          <CardHeader title="Preferences" />
          <div className="p-5">
            <Preferences />
          </div>
        </Card>
      </div>
    </>
  );
}
