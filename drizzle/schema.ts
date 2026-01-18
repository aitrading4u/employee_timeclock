import {
  pgEnum,
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["employee", "admin"]);
export const incidentTypeEnum = pgEnum("incident_type", ["late_arrival", "early_exit", "other"]);
export const incidentStatusEnum = pgEnum("incident_status", ["pending", "approved", "rejected"]);

/**
 * Core user table backing auth flow.
 * Extended with employee-specific fields for the timeclock system.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 255 }), // For employee login
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("employee").notNull(),
  employeeId: integer("employeeId"), // Reference to employee table
  restaurantId: integer("restaurantId"), // Reference to restaurant (for admin)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Restaurant table for storing restaurant information and location
 */
export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  radiusMeters: integer("radiusMeters").default(100).notNull(), // GPS validation radius
  adminId: integer("adminId").notNull(), // Reference to admin user
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = typeof restaurants.$inferInsert;

/**
 * Employee table for storing employee information
 */
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurantId").notNull(), // Reference to restaurant
  name: varchar("name", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // Hashed password
  phone: varchar("phone", { length: 20 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

/**
 * Schedule table for storing employee work schedules
 */
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId").notNull(), // Reference to employee
  dayOfWeek: integer("dayOfWeek").notNull(), // 0-6 (Sunday-Saturday)
  entryTime: varchar("entryTime", { length: 5 }).notNull(), // HH:mm format
  exitTime: varchar("exitTime", { length: 5 }), // HH:mm format (optional)
  isWorkDay: boolean("isWorkDay").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

/**
 * Timeclock table for storing clock-in/clock-out records
 */
export const timeclocks = pgTable("timeclocks", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId").notNull(), // Reference to employee
  entryTime: timestamp("entryTime"),
  exitTime: timestamp("exitTime"),
  isLate: boolean("isLate").default(false).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Timeclock = typeof timeclocks.$inferSelect;
export type InsertTimeclock = typeof timeclocks.$inferInsert;

/**
 * Incident table for storing employee incidents
 */
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employeeId").notNull(), // Reference to employee
  timeclockId: integer("timeclockId"), // Reference to timeclock entry
  type: incidentTypeEnum("type").notNull(),
  reason: text("reason").notNull(),
  status: incidentStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;
