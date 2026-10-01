"use client";
/**
 * Device-local storage helpers. Everything here is a convenience (drafts,
 * offline queue, UI prefs) — never the source of truth. Every access is
 * wrapped because storage can be unavailable (private mode, quotas).
 */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export type AttendanceDraft = {
  subModuleId: string;
  date: string;
  time: string;
  sessionLabel: string;
  absentIds: string[];
  studentIds: string[];
  savedAt: string;
};

export const draftKey = (userId: string, subModuleId: string) => `sa:draft:${userId}:${subModuleId}`;

/* ------------------------------ Offline outbox ----------------------------- */
export type OutboxItem = {
  clientId: string;
  payload: {
    subModuleId: string;
    date: string;
    time: string;
    sessionLabel: string;
    clientId: string;
    studentIds: string[];
    absentStudentIds: string[];
  };
  label: string;
  queuedAt: string;
};

export const outboxKey = (userId: string) => `sa:outbox:${userId}`;
export const OUTBOX_EVENT = "sa-outbox-changed";

export function queueOutbox(userId: string, item: OutboxItem) {
  const list = readLocal<OutboxItem[]>(outboxKey(userId), []).filter((i) => i.clientId !== item.clientId);
  list.push(item);
  const ok = writeLocal(outboxKey(userId), list);
  window.dispatchEvent(new Event(OUTBOX_EVENT));
  return ok;
}
