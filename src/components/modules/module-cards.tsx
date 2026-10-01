"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Copy,
  FolderOpen,
  History,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/misc";
import { MoreMenu } from "@/components/ui/dropdown";
import { cn, pluralize, relativeDay } from "@/lib/utils";
import type { ModuleSummary, SubModuleSummary } from "@/lib/client/types";

export function MainModuleCard({
  module,
  onTakeAttendance,
  onCreateSub,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  module: ModuleSummary;
  onTakeAttendance: () => void;
  onCreateSub: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const href = `/modules/${module.id}`;
  return (
    <Card className="group relative flex flex-col overflow-hidden transition-shadow hover:shadow-pop">
      <div className="h-1" style={{ background: module.color }} aria-hidden />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
              style={{ background: module.color }}
              aria-hidden
            >
              {module.number}
            </div>
            <div className="min-w-0">
              <Link href={href} className="block truncate text-[15px] font-semibold text-fg after:absolute after:inset-0 hover:text-primary">
                {module.name}
              </Link>
              <div className="text-xs text-fg-muted">Module {module.number}</div>
            </div>
          </div>
          <div className="relative z-10">
            <MoreMenu
              label={`Actions for ${module.name}`}
              items={[
                { label: "Open", icon: FolderOpen, onSelect: () => router.push(href) },
                { label: "Take Attendance", icon: ClipboardCheck, onSelect: onTakeAttendance },
                { label: "Create Sub Module", icon: Plus, onSelect: onCreateSub },
                { label: "Manage Students", icon: Users, onSelect: () => router.push(href) },
                { label: "Edit", icon: Pencil, onSelect: onEdit },
                { label: "Duplicate", icon: Copy, onSelect: onDuplicate },
                { type: "separator" },
                { label: "Delete", icon: Trash2, onSelect: onDelete, danger: true },
              ]}
            />
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-fg-muted">Sub modules</dt>
            <dd className="tabular font-medium text-fg">{module.subModuleCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Students</dt>
            <dd className="tabular font-medium text-fg">{module.studentCount}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-fg-muted">Last attendance</dt>
            <dd className="font-medium text-fg">{relativeDay(module.lastAttendance)}</dd>
          </div>
        </dl>
        <div className="relative z-10 mt-5">
          <Button variant="soft" className="w-full" onClick={onTakeAttendance}>
            <ClipboardCheck /> Take Attendance
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function SubModuleCard({
  sub,
  color,
  onEdit,
  onCreateSub,
  onDelete,
}: {
  sub: SubModuleSummary;
  color: string;
  onEdit: () => void;
  onCreateSub: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const href = `/modules/${sub.mainModuleId}/${sub.id}`;
  return (
    <Card className="relative flex flex-col p-5 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted" aria-hidden>
            <Layers className="size-5" style={{ color }} />
          </div>
          <div className="min-w-0">
            <Link href={href} className="block truncate text-[15px] font-semibold text-fg after:absolute after:inset-0 hover:text-primary">
              {sub.name}
            </Link>
            <div className="text-xs text-fg-muted">{sub.code || "Sub module"}</div>
          </div>
        </div>
        <div className="relative z-10">
          <MoreMenu
            label={`Actions for ${sub.name}`}
            items={[
              { label: "Take Attendance", icon: ClipboardCheck, onSelect: () => router.push(`/attendance/${sub.id}`) },
              { label: "Manage Student Data", icon: Users, onSelect: () => router.push(`${href}?tab=students`) },
              { label: "Attendance History", icon: History, onSelect: () => router.push(`/history?subModuleId=${sub.id}`) },
              { label: "Edit", icon: Pencil, onSelect: onEdit },
              { label: "Create Sub Module", icon: Plus, onSelect: onCreateSub },
              { type: "separator" },
              { label: "Delete", icon: Trash2, onSelect: onDelete, danger: true },
            ]}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{pluralize(sub.studentCount, "student")}</Badge>
        <Badge>{pluralize(sub.sessions, "class", "classes")}</Badge>
        {sub.averageAttendance !== null && <Badge tone="primary">{sub.averageAttendance}% avg</Badge>}
      </div>
      <div className="mt-3 text-xs text-fg-muted">Last attendance: {relativeDay(sub.lastAttendance)}</div>
      <div className="relative z-10 mt-4 flex gap-2">
        {sub.studentCount ? (
          <Link href={`/attendance/${sub.id}`} className={cn(buttonClass("soft", "md"), "flex-1")}>
            <ClipboardCheck /> Take Attendance
          </Link>
        ) : (
          <Link href={`${href}?tab=students`} className={cn(buttonClass("secondary", "md"), "flex-1")}>
            <Users /> Add students
          </Link>
        )}
      </div>
    </Card>
  );
}
