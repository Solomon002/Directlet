import { prisma } from "../lib/prisma";
import { startOfTodayUtc, addDays } from "../lib/rentPeriod";
import { sendViewingReminder } from "../lib/notify";

// Emails both sides the day before a confirmed viewing. Safe to run more than once a
// day: each viewing is stamped when its reminder goes out, and moving the date clears
// the stamp so the new day gets its own reminder.
export async function runViewingReminders() {
  const tomorrow = addDays(startOfTodayUtc(), 1);
  const dayAfter = addDays(tomorrow, 1);

  const due = await prisma.inspectionRequest.findMany({
    where: {
      status: "SCHEDULED",
      reminderSentAt: null,
      scheduledFor: { gte: tomorrow, lt: dayAfter },
    },
    select: {
      id: true,
      name: true,
      email: true,
      scheduledFor: true,
      unit: {
        select: {
          label: true,
          property: { select: { name: true, landlord: { select: { fullName: true, email: true } } } },
        },
      },
    },
  });

  for (const viewing of due) {
    if (!viewing.scheduledFor) continue;
    const { label, property } = viewing.unit;
    sendViewingReminder(viewing.email, viewing.name, property.name, label, viewing.scheduledFor, "VISITOR");
    sendViewingReminder(
      property.landlord.email,
      property.landlord.fullName,
      property.name,
      label,
      viewing.scheduledFor,
      "LANDLORD",
    );
    await prisma.inspectionRequest.update({ where: { id: viewing.id }, data: { reminderSentAt: new Date() } });
  }

  return { reminded: due.length };
}
