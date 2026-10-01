"use client";
import { useParams } from "next/navigation";
import { AttendanceTaker } from "@/components/attendance/attendance-taker";

export default function TakeAttendancePage() {
  const { subId } = useParams<{ subId: string }>();
  return <AttendanceTaker subModuleId={subId} />;
}
