import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkAndSendNotifications } from "../../server/notificationService";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (secret) {
    if (!authHeader || authHeader !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    await checkAndSendNotifications({ timeZone: "Europe/Madrid", leadMinutes: 1 });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Cron notifications error:", error);
    return res.status(500).json({ error: "Failed to run notifications" });
  }
}
