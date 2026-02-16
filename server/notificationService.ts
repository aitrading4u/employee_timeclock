import webpush from "web-push";
import { getDb } from "./db";
import { pushSubscriptions, notificationLogs, schedules, timeclocks } from "../drizzle/schema";
import { eq, and, gte, lt, inArray, isNull } from "drizzle-orm";

// VAPID keys - these should be set as environment variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@timeclock.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Send a push notification to an employee
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify({
        title,
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: typeof data?.tag === "string" ? data.tag : "timeclock-notification",
        data: data || {},
      })
    );
  } catch (error: any) {
    // Remove invalid subscriptions so the client can re-subscribe with a fresh endpoint.
    if ([400, 401, 403, 404, 410].includes(error.statusCode)) {
      const db = await getDb();
      if (db) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      }
    }
    throw error;
  }
}

/**
 * Check and send notifications for employees who need to clock in
 * This should be called periodically (e.g., every minute via cron)
 */
type NotificationOptions = {
  timeZone?: string;
  leadMinutes?: number;
  lookbackMinutes?: number;
};

const DEFAULT_TIME_ZONE = "Europe/Madrid";
const DEFAULT_ENTRY_LEAD_MINUTES = 5;
const DEFAULT_LOOKBACK_MINUTES = 65;
const EXIT_REMINDER_STARTS = [
  { time: "15:30", intervalMinutes: 30, repeats: 3 },
  { time: "22:30", intervalMinutes: 30, repeats: 3 },
];
const EXIT_REMINDER_SLOT = 0;

function getTimePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return {
    year: Number(lookup("year")),
    month: Number(lookup("month")),
    day: Number(lookup("day")),
    hour: Number(lookup("hour")),
    minute: Number(lookup("minute")),
  };
}

function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const { year, month, day } = getTimePartsInTimeZone(date, timeZone);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseTimeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatMinutesToTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildExitReminderSlots() {
  const slots: Array<{ minuteOfDay: number; scheduleDateOffset: number }> = [];
  for (const start of EXIT_REMINDER_STARTS) {
    const baseMinutes = parseTimeToMinutes(start.time);
    for (let i = 0; i <= start.repeats; i += 1) {
      const total = baseMinutes + i * start.intervalMinutes;
      const minuteOfDay = total % 1440;
      const scheduleDateOffset = total >= 1440 ? -1 : 0;
      slots.push({ minuteOfDay, scheduleDateOffset });
    }
  }
  return slots;
}

function getWrappedMinuteDiff(currentMinuteOfDay: number, slotMinuteOfDay: number) {
  return ((currentMinuteOfDay - slotMinuteOfDay) + 1440) % 1440;
}

function buildEntryReminderSlots(scheduleTime: number, leadMinutes: number) {
  const slots = new Set<number>();
  slots.add(scheduleTime);
  slots.add(scheduleTime - leadMinutes);
  return Array.from(slots).map((minute) => ((minute % 1440) + 1440) % 1440);
}

export async function checkAndSendNotifications(
  options: NotificationOptions = {}
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const timeZone = options.timeZone || DEFAULT_TIME_ZONE;
  const leadMinutes = Math.max(0, options.leadMinutes ?? DEFAULT_ENTRY_LEAD_MINUTES);
  const lookbackMinutes = Math.max(1, options.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES);
  const { year, month, day, hour, minute } = getTimePartsInTimeZone(now, timeZone);
  const currentDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  const currentDay = currentDate.getDay(); // 0-6 (Sunday-Saturday)
  const currentHour = currentDate.getHours();
  const currentMinute = currentDate.getMinutes();
  // Date-only value for schedule logging
  const todayDate = getDateKeyInTimeZone(currentDate, timeZone);

  // Get all active employees with schedules for today
  const todaySchedules = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.dayOfWeek, currentDay),
        eq(schedules.isWorkDay, true)
      )
    );

  for (const schedule of todaySchedules) {
    const [scheduleHour, scheduleMinute] = schedule.entryTime.split(":").map(Number);
    const scheduleTime = scheduleHour * 60 + scheduleMinute;
    const currentTime = currentHour * 60 + currentMinute;
    const reminderSlots = buildEntryReminderSlots(scheduleTime, leadMinutes);

    // Check if employee already clocked in today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todayTimeclocks = await db
      .select()
      .from(timeclocks)
      .where(
        and(
          eq(timeclocks.employeeId, schedule.employeeId),
          gte(timeclocks.createdAt, todayStart),
          lt(timeclocks.createdAt, todayEnd)
        )
      );

    const hasClockedIn = todayTimeclocks.some(
      (tc) => tc.entryTime && !tc.exitTime
    );
    if (hasClockedIn) {
      continue;
    }

    for (const reminderMinute of reminderSlots) {
      const reminderTime = formatMinutesToTime(reminderMinute);
      const timeDiff = currentTime - reminderMinute;
      if (timeDiff < 0 || timeDiff > lookbackMinutes) {
        continue;
      }

      const existingLog = await db
        .select()
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.employeeId, schedule.employeeId),
            eq(notificationLogs.entryTime, reminderTime),
            eq(notificationLogs.scheduleDate, todayDate),
            eq(notificationLogs.entrySlot, schedule.entrySlot)
          )
        )
        .limit(1);
      if (existingLog.length > 0) {
        continue;
      }

      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.employeeId, schedule.employeeId));

      const isLeadReminder = reminderMinute !== scheduleTime;
      const body = isLeadReminder
        ? `En 5 minutos toca fichar entrada (${schedule.entryTime})`
        : `Es hora de registrar tu entrada (${schedule.entryTime})`;

      for (const sub of subscriptions) {
        try {
          await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            "⏰ Hora de entrada",
            body,
            {
              url: "/employee/dashboard",
              entryTime: schedule.entryTime,
              entrySlot: schedule.entrySlot,
              reminderType: isLeadReminder ? "lead_5m" : "on_time",
            }
          );

          await db.insert(notificationLogs).values({
            employeeId: schedule.employeeId,
            entryTime: reminderTime,
            scheduleDate: todayDate,
            entrySlot: schedule.entrySlot,
          });
        } catch (error) {
          console.error(`Failed to send notification to employee ${schedule.employeeId}:`, error);
        }
      }
    }
  }

  const exitReminderSlots = buildExitReminderSlots();
  const currentMinutes = currentHour * 60 + currentMinute;
  const matchingSlots = exitReminderSlots
    .map(slot => {
      const diff = getWrappedMinuteDiff(currentMinutes, slot.minuteOfDay);
      const crossedMidnight = currentMinutes < slot.minuteOfDay;
      const reminderDateOffset = slot.scheduleDateOffset - (crossedMidnight ? 1 : 0);
      return { ...slot, diff, reminderDateOffset };
    })
    .filter(slot => slot.diff <= lookbackMinutes);

  if (matchingSlots.length === 0) return;

  const openTimeclocks = await db
    .select()
    .from(timeclocks)
    .where(isNull(timeclocks.exitTime));

  if (openTimeclocks.length === 0) return;

  const openByEmployee = new Map<number, typeof openTimeclocks>();
  for (const clock of openTimeclocks) {
    if (!clock.entryTime) continue;
    const list = openByEmployee.get(clock.employeeId) || [];
    list.push(clock);
    openByEmployee.set(clock.employeeId, list);
  }

  for (const slot of matchingSlots) {
    const reminderDate = addDays(currentDate, slot.reminderDateOffset);
    const reminderDateKey = getDateKeyInTimeZone(reminderDate, timeZone);
    const reminderTime = formatMinutesToTime(slot.minuteOfDay);

    const candidateEmployeeIds: number[] = [];
    for (const [employeeId, clocks] of openByEmployee.entries()) {
      const hasOpenOnDate = clocks.some(clock => {
        if (!clock.entryTime) return false;
        const entryDateKey = getDateKeyInTimeZone(new Date(clock.entryTime), timeZone);
        return entryDateKey === reminderDateKey;
      });
      if (hasOpenOnDate) {
        candidateEmployeeIds.push(employeeId);
      }
    }

    if (candidateEmployeeIds.length === 0) continue;

    const existingLogs = await db
      .select()
      .from(notificationLogs)
      .where(
        and(
          inArray(notificationLogs.employeeId, candidateEmployeeIds),
          eq(notificationLogs.entrySlot, EXIT_REMINDER_SLOT),
          eq(notificationLogs.entryTime, reminderTime),
          eq(notificationLogs.scheduleDate, reminderDateKey)
        )
      );
    const alreadyNotified = new Set(existingLogs.map(log => log.employeeId));

    for (const employeeId of candidateEmployeeIds) {
      if (alreadyNotified.has(employeeId)) continue;
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.employeeId, employeeId));

      if (subscriptions.length === 0) continue;

      for (const sub of subscriptions) {
        try {
          await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            "⏰ Recuerda fichar la salida",
            "No olvides registrar tu salida cuando termines.",
            {
              url: "/employee/dashboard",
              tag: `timeclock-exit-${reminderDateKey}-${reminderTime}-${employeeId}`,
            }
          );

          await db.insert(notificationLogs).values({
            employeeId,
            entryTime: reminderTime,
            scheduleDate: reminderDateKey,
            entrySlot: EXIT_REMINDER_SLOT,
          });
        } catch (error) {
          console.error(`Failed to send exit reminder to employee ${employeeId}:`, error);
        }
      }
    }
  }
}

/**
 * Get VAPID public key for client-side subscription
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
