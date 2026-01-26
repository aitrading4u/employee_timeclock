import webpush from "web-push";
import { getDb } from "./db";
import { pushSubscriptions, notificationLogs, schedules, timeclocks } from "../drizzle/schema";
import { eq, and, gte, lt } from "drizzle-orm";

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
        tag: "timeclock-notification",
        data: data || {},
      })
    );
  } catch (error: any) {
    // If subscription is invalid, we might want to remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
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
};

const DEFAULT_TIME_ZONE = "Europe/Madrid";

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

export async function checkAndSendNotifications(
  options: NotificationOptions = {}
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const timeZone = options.timeZone || DEFAULT_TIME_ZONE;
  const leadMinutes = Math.max(0, options.leadMinutes ?? 0);
  const { year, month, day, hour, minute } = getTimePartsInTimeZone(now, timeZone);
  const currentDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  const currentDay = currentDate.getDay(); // 0-6 (Sunday-Saturday)
  const currentHour = currentDate.getHours();
  const currentMinute = currentDate.getMinutes();
  // Date-only value for schedule logging
  const todayDate = new Date(year, month - 1, day);

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
    
    // Check if it's time to send notification (at the scheduled time or within the last minute)
    // This handles cases where the server was down or there was a delay
    const scheduleTime = scheduleHour * 60 + scheduleMinute;
    const currentTime = currentHour * 60 + currentMinute;
    const notifyAt = scheduleTime - leadMinutes;
    const timeDiff = currentTime - notifyAt;

    // Send notification at lead time or up to 1 minute after
    if (timeDiff >= 0 && timeDiff <= 1) {
      // Check if we already sent a notification for this time today
      const existingLog = await db
        .select()
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.employeeId, schedule.employeeId),
            eq(notificationLogs.entryTime, schedule.entryTime),
            eq(notificationLogs.scheduleDate, todayDate),
            eq(notificationLogs.entrySlot, schedule.entrySlot)
          )
        )
        .limit(1);

      if (existingLog.length > 0) {
        continue; // Already notified
      }

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

      // Check if employee has already clocked in for this entry slot
      const hasClockedIn = todayTimeclocks.some(
        (tc) => tc.entryTime && !tc.exitTime
      );

      if (hasClockedIn) {
        continue; // Already clocked in
      }

      // Get employee's push subscriptions
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.employeeId, schedule.employeeId));

      // Send notification to all subscriptions
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
            `Es hora de registrar tu entrada (${schedule.entryTime})`,
            {
              url: "/employee/dashboard",
              entryTime: schedule.entryTime,
              entrySlot: schedule.entrySlot,
            }
          );

          // Log the notification
          await db.insert(notificationLogs).values({
            employeeId: schedule.employeeId,
            entryTime: schedule.entryTime,
            scheduleDate: todayDate,
            entrySlot: schedule.entrySlot,
          });
        } catch (error) {
          console.error(`Failed to send notification to employee ${schedule.employeeId}:`, error);
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
