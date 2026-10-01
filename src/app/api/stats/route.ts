import { route, requireUser } from "@/lib/api";
import { AttendanceSession, type AttendanceSessionDoc } from "@/lib/models";
import { moduleOverview, serializeSession } from "@/lib/services";
import { percent } from "@/lib/utils";

/** Dashboard numbers. `today` is supplied by the client (teacher's local date). */
export const GET = route(async (req) => {
  const user = await requireUser();
  const today = req.nextUrl.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
  const since = new Date(today);
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);

  const [modules, recent, todays, window] = await Promise.all([
    moduleOverview(user),
    AttendanceSession.find({ owner: user._id }, { records: 0 }).sort({ date: -1, time: -1, _id: -1 }).limit(6).lean<AttendanceSessionDoc[]>(),
    AttendanceSession.find({ owner: user._id, date: today }, { records: 0 }).sort({ time: 1 }).lean<AttendanceSessionDoc[]>(),
    AttendanceSession.find({ owner: user._id, date: { $gte: sinceISO } }, { present: 1, total: 1, date: 1 }).lean<AttendanceSessionDoc[]>(),
  ]);
  const present = window.reduce((a, s) => a + (s.present ?? 0), 0);
  const total = window.reduce((a, s) => a + (s.total ?? 0), 0);

  // 14-day trend for the sparkline chart
  const byDay = new Map<string, { p: number; t: number }>();
  for (const s of window) {
    const d = byDay.get(s.date) ?? { p: 0, t: 0 };
    d.p += s.present ?? 0;
    d.t += s.total ?? 0;
    byDay.set(s.date, d);
  }
  const trend = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, v]) => ({ date, rate: percent(v.p, v.t) }));

  const studentCount = modules.reduce((a, m) => a + m.subModules.reduce((b, s) => Math.max(b, s.studentCount), 0), 0);
  return {
    totals: {
      modules: modules.length,
      subModules: modules.reduce((a, m) => a + m.subModuleCount, 0),
      students: studentCount,
      todaysSessions: todays.length,
      averageAttendance: total ? percent(present, total) : null,
    },
    modules,
    today: todays.map(serializeSession),
    recent: recent.map(serializeSession),
    trend,
  };
});
