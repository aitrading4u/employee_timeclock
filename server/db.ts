import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, employees, restaurants, schedules, timeclocks, incidents } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: postgres.Sql | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, { ssl: "require" });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getOrCreateLocalAdmin(name: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get admin: database not available");
    return undefined;
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.openId, "local-admin"))
    .limit(1);

  if (existing.length > 0) return existing[0];

  await db.insert(users).values({
    openId: "local-admin",
    name,
    role: "admin",
    lastSignedIn: new Date(),
  });

  const created = await db
    .select()
    .from(users)
    .where(eq(users.openId, "local-admin"))
    .limit(1);

  return created.length > 0 ? created[0] : undefined;
}

// Employee queries
export async function getEmployeeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getEmployeesByRestaurant(restaurantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(employees).where(eq(employees.restaurantId, restaurantId));
}

export async function getEmployeeByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(employees).where(eq(employees.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Restaurant queries
export async function getRestaurantById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRestaurantByAdmin(adminId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(restaurants).where(eq(restaurants.adminId, adminId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Schedule queries
export async function getSchedulesByEmployee(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(schedules).where(eq(schedules.employeeId, employeeId));
}

export async function getScheduleByEmployeeAndDay(employeeId: number, dayOfWeek: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(schedules)
    .where(and(eq(schedules.employeeId, employeeId), eq(schedules.dayOfWeek, dayOfWeek)))
    .orderBy(schedules.entrySlot)
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getScheduleByEmployeeDayAndSlot(
  employeeId: number,
  dayOfWeek: number,
  entrySlot: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.employeeId, employeeId),
        eq(schedules.dayOfWeek, dayOfWeek),
        eq(schedules.entrySlot, entrySlot)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Timeclock queries
export async function getTimeclocksByEmployee(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(timeclocks).where(eq(timeclocks.employeeId, employeeId));
}

export async function getTimeclockById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(timeclocks).where(eq(timeclocks.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Incident queries
export async function getIncidentsByEmployee(employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(incidents).where(eq(incidents.employeeId, employeeId));
}

export async function getIncidentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
