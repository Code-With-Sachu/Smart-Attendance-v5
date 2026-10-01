import "server-only";

import { connectDB } from "@/lib/db";
import { User, StudentDataset } from "@/lib/models";
import { hashPassword, startSession } from "@/lib/auth/server";

const DEMO_EMAIL = "demo@smartattendance.local";

export async function ensureDemoSession() {
  await connectDB();

  let user = await User.findOne({ email: DEMO_EMAIL });

  if (!user) {
    user = await User.create({
      name: "Teacher",
      email: DEMO_EMAIL,
      passwordHash: await hashPassword("SmartAttendanceDemo123!"),
      subject: "",
      teacherId: "",
    });

    const dataset = await StudentDataset.create({
      owner: user._id,
      name: "Master student dataset",
      scope: "profile",
    });

    user.profileDatasetId = dataset._id;
    await user.save();
  }

  await startSession(user);

  return user;
}