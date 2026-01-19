import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  getRestaurantByAdmin, 
  getEmployeesByRestaurant, 
  getScheduleByEmployeeAndDay,
  getScheduleByEmployeeDayAndSlot,
  getTimeclocksByEmployee,
  getIncidentsByEmployee,
  getEmployeeById,
  getRestaurantById,
  getSchedulesByEmployee,
  getIncidentById,
  getEmployeeByUsername,
  getOrCreateLocalAdmin
} from "./db";
import { getVapidPublicKey } from "./notificationService";
import { restaurants, employees, schedules, timeclocks, incidents, users, pushSubscriptions, notificationLogs } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  publicApi: router({
    adminLogin: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    ).mutation(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      const admin = await getOrCreateLocalAdmin(input.username);
      if (!admin) throw new Error("Admin not available");
      return { success: true, adminId: admin.id };
    }),

    getRestaurant: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    ).query(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      const admin = await getOrCreateLocalAdmin(input.username);
      if (!admin) throw new Error("Admin not available");
      return await getRestaurantByAdmin(admin.id);
    }),

    upsertRestaurant: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        name: z.string().min(1),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        radiusMeters: z.number().default(100),
      })
    ).mutation(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const admin = await getOrCreateLocalAdmin(input.username);
      if (!admin) throw new Error("Admin not available");
      const existing = await getRestaurantByAdmin(admin.id);
      if (existing) {
        await db.update(restaurants).set({
          name: input.name,
          address: input.address,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          radiusMeters: input.radiusMeters,
        }).where(eq(restaurants.id, existing.id));
        return { success: true, restaurantId: existing.id };
      }
      await db.insert(restaurants).values({
        name: input.name,
        address: input.address,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
        radiusMeters: input.radiusMeters,
        adminId: admin.id,
      });
      const created = await getRestaurantByAdmin(admin.id);
      return { success: true, restaurantId: created?.id };
    }),

    createEmployee: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeName: z.string().min(1),
        employeeUsername: z.string().min(3),
        employeePassword: z.string().min(6),
        employeePhone: z.string().optional(),
        lateGraceMinutes: z.number().min(0).max(120).default(5),
        schedule: z.record(
          z.string(),
          z.union([
            z.string(),
            z.object({
              entry1: z.string().optional(),
              entry2: z.string().optional(),
              isActive: z.boolean(),
            }),
          ])
        ),
      })
    ).mutation(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const admin = await getOrCreateLocalAdmin(input.username);
      if (!admin) throw new Error("Admin not available");
      const restaurant = await getRestaurantByAdmin(admin.id);
      if (!restaurant) throw new Error("Restaurant not found");
      const hashedPassword = Buffer.from(input.employeePassword).toString("base64");
      const result = await db.insert(employees).values({
        restaurantId: restaurant.id,
        name: input.employeeName,
        username: input.employeeUsername,
        password: hashedPassword,
        phone: input.employeePhone,
        lateGraceMinutes: input.lateGraceMinutes,
        isActive: true,
      });
      const employee = await getEmployeeByUsername(input.employeeUsername);
      if (!employee) return { success: true };
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      for (const [dayKey, rawValue] of Object.entries(input.schedule)) {
        const value =
          typeof rawValue === "string"
            ? {
                entry1: rawValue,
                entry2: "",
                isActive: rawValue.trim().length > 0,
              }
            : rawValue;
        const dayOfWeek = dayMap[dayKey];
        if (dayOfWeek === undefined) continue;
        if (!value.isActive) {
          await db.insert(schedules).values({
            employeeId: employee.id,
            dayOfWeek,
            entryTime: "00:00",
            isWorkDay: false,
            entrySlot: 1,
          });
          continue;
        }
        if (value.entry1) {
          await db.insert(schedules).values({
            employeeId: employee.id,
            dayOfWeek,
            entryTime: value.entry1,
            isWorkDay: true,
            entrySlot: 1,
          });
        }
        if (value.entry2) {
          await db.insert(schedules).values({
            employeeId: employee.id,
            dayOfWeek,
            entryTime: value.entry2,
            isWorkDay: true,
            entrySlot: 2,
          });
        }
      }
      return { success: true };
    }),

    updateEmployee: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeId: z.number(),
        employeeName: z.string().min(1),
        employeeUsername: z.string().min(3),
        employeePassword: z.string().optional(),
        employeePhone: z.string().optional(),
        lateGraceMinutes: z.number().min(0).max(120).default(5),
        schedule: z.record(
          z.string(),
          z.union([
            z.string(),
            z.object({
              entry1: z.string().optional(),
              entry2: z.string().optional(),
              isActive: z.boolean(),
            }),
          ])
        ),
      })
    ).mutation(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const employee = await getEmployeeById(input.employeeId);
      if (!employee) throw new Error("Empleado no encontrado");

      const updateData: Record<string, unknown> = {
        name: input.employeeName,
        username: input.employeeUsername,
        phone: input.employeePhone ?? null,
        lateGraceMinutes: input.lateGraceMinutes,
      };
      if (input.employeePassword) {
        updateData.password = Buffer.from(input.employeePassword).toString("base64");
      }
      await db.update(employees).set(updateData).where(eq(employees.id, input.employeeId));

      await db.delete(schedules).where(eq(schedules.employeeId, input.employeeId));
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      for (const [dayKey, rawValue] of Object.entries(input.schedule)) {
        const value =
          typeof rawValue === "string"
            ? {
                entry1: rawValue,
                entry2: "",
                isActive: rawValue.trim().length > 0,
              }
            : rawValue;
        const dayOfWeek = dayMap[dayKey];
        if (dayOfWeek === undefined) continue;
        if (!value.isActive) {
          await db.insert(schedules).values({
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: "00:00",
            isWorkDay: false,
            entrySlot: 1,
          });
          continue;
        }
        if (value.entry1) {
          await db.insert(schedules).values({
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: value.entry1,
            isWorkDay: true,
            entrySlot: 1,
          });
        }
        if (value.entry2) {
          await db.insert(schedules).values({
            employeeId: input.employeeId,
            dayOfWeek,
            entryTime: value.entry2,
            isWorkDay: true,
            entrySlot: 2,
          });
        }
      }
      return { success: true };
    }),

    listEmployees: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    ).query(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      const admin = await getOrCreateLocalAdmin(input.username);
      if (!admin) return [];
      const restaurant = await getRestaurantByAdmin(admin.id);
      if (!restaurant) return [];
      return await getEmployeesByRestaurant(restaurant.id);
    }),

    getEmployeeRestaurant: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeId: z.number(),
      })
    ).query(async ({ input }) => {
      const employee = await getEmployeeByUsername(input.username);
      if (!employee || employee.id !== input.employeeId) {
        throw new Error("Empleado no encontrado");
      }
      const hashed = Buffer.from(input.password).toString("base64");
      if (employee.password !== hashed) {
        throw new Error("Credenciales inválidas");
      }
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant) throw new Error("Restaurant not found");
      return restaurant;
    }),

    getTimeclocksByEmployee: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeId: z.number(),
      })
    ).query(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      return await getTimeclocksByEmployee(input.employeeId);
    }),

    listIncidents: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    ).query(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      const admin = await getOrCreateLocalAdmin(input.username);
      if (!admin) return [];
      const restaurant = await getRestaurantByAdmin(admin.id);
      if (!restaurant) return [];
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id);
      const employeeIds = restaurantEmployees.map((e) => e.id);
      if (employeeIds.length === 0) return [];
      const db = await getDb();
      if (!db) return [];
      const allIncidents = await db.select().from(incidents);
      return allIncidents.filter((incident) => employeeIds.includes(incident.employeeId));
    }),

    listTimeclocks: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    ).query(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      if (input.username !== adminUsername || input.password !== adminPassword) {
        throw new Error("Invalid admin credentials");
      }
      const admin = await getOrCreateLocalAdmin(input.username);
      if (!admin) return [];
      const restaurant = await getRestaurantByAdmin(admin.id);
      if (!restaurant) return [];
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id);
      const employeeIds = restaurantEmployees.map((e) => e.id);
      if (employeeIds.length === 0) return [];
      const db = await getDb();
      if (!db) return [];
      const allTimeclocks = await db.select().from(timeclocks);
      return allTimeclocks.filter((entry) => employeeIds.includes(entry.employeeId));
    }),

    getEmployeeTimeclocks: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeId: z.number(),
      })
    ).query(async ({ input }) => {
      const employee = await getEmployeeByUsername(input.username);
      if (!employee || employee.id !== input.employeeId) {
        throw new Error("Empleado no encontrado");
      }
      const hashed = Buffer.from(input.password).toString("base64");
      if (employee.password !== hashed) {
        throw new Error("Credenciales inválidas");
      }
      return await getTimeclocksByEmployee(input.employeeId);
    }),

    getEmployeeSchedule: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeId: z.number(),
      })
    ).query(async ({ input }) => {
      const adminUsername = process.env.ADMIN_USERNAME ?? "ilbandito";
      const adminPassword = process.env.ADMIN_PASSWORD ?? "Vat1stop";
      const isAdmin = input.username === adminUsername && input.password === adminPassword;

      let targetEmployeeId = input.employeeId;
      if (!isAdmin) {
        const employee = await getEmployeeByUsername(input.username);
        if (!employee || employee.id !== input.employeeId) {
          throw new Error("Empleado no encontrado");
        }
        const hashed = Buffer.from(input.password).toString("base64");
        if (employee.password !== hashed) {
          throw new Error("Credenciales inválidas");
        }
        targetEmployeeId = employee.id;
      }

      const scheduleRows = await getSchedulesByEmployee(targetEmployeeId);
      const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const scheduleMap: Record<string, { entry1: string; entry2: string; isActive: boolean }> = {};
      for (const row of scheduleRows) {
        const key = dayKeys[row.dayOfWeek] ?? "monday";
        if (!scheduleMap[key]) {
          scheduleMap[key] = { entry1: "", entry2: "", isActive: row.isWorkDay };
        }
        if (!row.isWorkDay) {
          scheduleMap[key].isActive = false;
        } else if (row.entrySlot === 2) {
          scheduleMap[key].entry2 = row.entryTime;
        } else {
          scheduleMap[key].entry1 = row.entryTime;
        }
      }
      return scheduleMap;
    }),

    employeeLogin: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    ).mutation(async ({ input }) => {
      const employee = await getEmployeeByUsername(input.username);
      if (!employee) throw new Error("Empleado no encontrado");
      const hashed = Buffer.from(input.password).toString("base64");
      if (employee.password !== hashed) {
        throw new Error("Credenciales inválidas");
      }
      const scheduleRows = await getSchedulesByEmployee(employee.id);
      const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const scheduleMap: Record<string, { entry1: string; entry2: string; isActive: boolean }> = {};
      for (const row of scheduleRows) {
        const key = dayKeys[row.dayOfWeek] ?? "monday";
        if (!scheduleMap[key]) {
          scheduleMap[key] = { entry1: "", entry2: "", isActive: row.isWorkDay };
        }
        if (!row.isWorkDay) {
          scheduleMap[key].isActive = false;
        } else if (row.entrySlot === 2) {
          scheduleMap[key].entry2 = row.entryTime;
        } else {
          scheduleMap[key].entry1 = row.entryTime;
        }
      }
      return {
        success: true,
        employeeId: employee.id,
        restaurantId: employee.restaurantId,
        schedule: scheduleMap,
        lateGraceMinutes: employee.lateGraceMinutes ?? 5,
      };
    }),

    clockIn: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeId: z.number(),
        latitude: z.number(),
        longitude: z.number(),
      })
    ).mutation(async ({ input }) => {
      const employee = await getEmployeeByUsername(input.username);
      if (!employee || employee.id !== input.employeeId) {
        throw new Error("Empleado no encontrado");
      }
      const hashed = Buffer.from(input.password).toString("base64");
      if (employee.password !== hashed) {
        throw new Error("Credenciales inválidas");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant) throw new Error("Restaurant not found");
      const distance = calculateDistance(
        parseFloat(restaurant.latitude.toString()),
        parseFloat(restaurant.longitude.toString()),
        input.latitude,
        input.longitude
      );
      if (distance > restaurant.radiusMeters) {
        throw new Error("You are not at the restaurant location");
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimeclocks = await getTimeclocksByEmployee(input.employeeId);
      const todayRecord = todayTimeclocks.find(tc => {
        const tcDate = new Date(tc.createdAt);
        tcDate.setHours(0, 0, 0, 0);
        return tcDate.getTime() === today.getTime() && tc.entryTime;
      });
      if (todayRecord) throw new Error("Already clocked in today");
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hasPreviousShift = todayTimeclocks.some(tc => tc.exitTime);
      const schedule = hasPreviousShift
        ? await getScheduleByEmployeeDayAndSlot(input.employeeId, dayOfWeek, 2)
        : await getScheduleByEmployeeAndDay(input.employeeId, dayOfWeek);
      let isLate = false;
      const graceMinutes = employee.lateGraceMinutes ?? 5;
      if (schedule && schedule.isWorkDay && schedule.entryTime !== "00:00") {
        const [scheduleHour, scheduleMinute] = schedule.entryTime.split(":").map(Number);
        const scheduleTime = new Date();
        scheduleTime.setHours(scheduleHour, scheduleMinute, 0, 0);
        const graceTime = new Date(scheduleTime.getTime() + graceMinutes * 60 * 1000);
        if (now > graceTime) {
          isLate = true;
        }
      }
      await db.insert(timeclocks).values({
        employeeId: input.employeeId,
        entryTime: now,
        isLate,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
      });
      return { success: true, isLate };
    }),

    clockOut: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeId: z.number(),
        latitude: z.number(),
        longitude: z.number(),
      })
    ).mutation(async ({ input }) => {
      const employee = await getEmployeeByUsername(input.username);
      if (!employee || employee.id !== input.employeeId) {
        throw new Error("Empleado no encontrado");
      }
      const hashed = Buffer.from(input.password).toString("base64");
      if (employee.password !== hashed) {
        throw new Error("Credenciales inválidas");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant) throw new Error("Restaurant not found");
      const distance = calculateDistance(
        parseFloat(restaurant.latitude.toString()),
        parseFloat(restaurant.longitude.toString()),
        input.latitude,
        input.longitude
      );
      if (distance > restaurant.radiusMeters) {
        throw new Error("You are not at the restaurant location");
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimeclocks = await getTimeclocksByEmployee(input.employeeId);
      const todayRecord = todayTimeclocks.find(tc => {
        const tcDate = new Date(tc.createdAt);
        tcDate.setHours(0, 0, 0, 0);
        return tcDate.getTime() === today.getTime() && tc.entryTime && !tc.exitTime;
      });
      if (!todayRecord) throw new Error("No active timeclock entry found");
      const now = new Date();
      await db.update(timeclocks).set({
        exitTime: now,
      }).where(eq(timeclocks.id, todayRecord.id));
      return { success: true };
    }),

    createIncident: publicProcedure.input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        employeeId: z.number(),
        type: z.enum(["late_arrival", "early_exit", "other"]),
        reason: z.string().min(1),
        timeclockId: z.number().optional(),
      })
    ).mutation(async ({ input }) => {
      const employee = await getEmployeeByUsername(input.username);
      if (!employee || employee.id !== input.employeeId) {
        throw new Error("Empleado no encontrado");
      }
      const hashed = Buffer.from(input.password).toString("base64");
      if (employee.password !== hashed) {
        throw new Error("Credenciales inválidas");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(incidents).values({
        employeeId: input.employeeId,
        timeclockId: input.timeclockId,
        type: input.type,
        reason: input.reason,
        status: "pending",
      });
      return { success: true };
    }),

    pushNotifications: router({
      getVapidPublicKey: publicProcedure.query(() => {
        return { publicKey: getVapidPublicKey() };
      }),

      subscribe: publicProcedure.input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
          employeeId: z.number(),
          subscription: z.object({
            endpoint: z.string().url(),
            keys: z.object({
              p256dh: z.string(),
              auth: z.string(),
            }),
          }),
        })
      ).mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const employee = await getEmployeeByUsername(input.username);
        if (!employee || employee.id !== input.employeeId) {
          throw new Error("Invalid employee credentials");
        }

        if (employee.password !== input.password) {
          throw new Error("Invalid employee credentials");
        }

        const existing = await db
          .select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.subscription.endpoint))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(pushSubscriptions)
            .set({
              employeeId: input.employeeId,
              p256dh: input.subscription.keys.p256dh,
              auth: input.subscription.keys.auth,
              updatedAt: new Date(),
            })
            .where(eq(pushSubscriptions.endpoint, input.subscription.endpoint));
        } else {
          await db.insert(pushSubscriptions).values({
            employeeId: input.employeeId,
            endpoint: input.subscription.endpoint,
            p256dh: input.subscription.keys.p256dh,
            auth: input.subscription.keys.auth,
          });
        }

        return { success: true };
      }),

      unsubscribe: publicProcedure.input(
        z.object({
          endpoint: z.string().url(),
        })
      ).mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, input.endpoint));

        return { success: true };
      }),
    }),
  }),

  // Restaurant management
  restaurant: router({
    getByAdmin: adminProcedure.query(async ({ ctx }) => {
      return await getRestaurantByAdmin(ctx.user.id);
    }),
    
    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      address: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      radiusMeters: z.number().default(100),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const result = await db.insert(restaurants).values({
        name: input.name,
        address: input.address,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
        radiusMeters: input.radiusMeters,
        adminId: ctx.user.id,
      });
      
      return { success: true };
    }),

    update: adminProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      radiusMeters: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const restaurant = await getRestaurantById(input.id);
      if (!restaurant || restaurant.adminId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }
      
      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.address) updateData.address = input.address;
      if (input.latitude) updateData.latitude = input.latitude.toString();
      if (input.longitude) updateData.longitude = input.longitude.toString();
      if (input.radiusMeters) updateData.radiusMeters = input.radiusMeters;
      
      await db.update(restaurants).set(updateData).where(eq(restaurants.id, input.id));
      return { success: true };
    }),
  }),

  // Employee management
  employee: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const restaurant = await getRestaurantByAdmin(ctx.user.id);
      if (!restaurant) return [];
      return await getEmployeesByRestaurant(restaurant.id);
    }),

    create: adminProcedure.input(z.object({
      name: z.string().min(1),
      username: z.string().min(3),
      password: z.string().min(6),
      phone: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const restaurant = await getRestaurantByAdmin(ctx.user.id);
      if (!restaurant) throw new Error('Restaurant not found');
      
      // Hash password (in production, use bcrypt)
      const hashedPassword = Buffer.from(input.password).toString('base64');
      
      const result = await db.insert(employees).values({
        restaurantId: restaurant.id,
        name: input.name,
        username: input.username,
        password: hashedPassword,
        phone: input.phone,
        isActive: true,
      });
      
      return { success: true };
    }),

    getById: protectedProcedure.input(z.number()).query(async ({ input }) => {
      return await getEmployeeById(input);
    }),
  }),

  // Schedule management
  schedule: router({
    getByEmployee: protectedProcedure.input(z.number()).query(async ({ input }) => {
      return await getSchedulesByEmployee(input);
    }),

    create: adminProcedure.input(z.object({
      employeeId: z.number(),
      dayOfWeek: z.number().min(0).max(6),
      entryTime: z.string(),
      exitTime: z.string().optional(),
      isWorkDay: z.boolean().default(true),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const employee = await getEmployeeById(input.employeeId);
      if (!employee) throw new Error('Employee not found');
      
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant || restaurant.adminId !== ctx.user.id) {
        throw new Error('Unauthorized');
      }
      
      await db.insert(schedules).values({
        employeeId: input.employeeId,
        dayOfWeek: input.dayOfWeek,
        entryTime: input.entryTime,
        exitTime: input.exitTime,
        isWorkDay: input.isWorkDay,
      });
      
      return { success: true };
    }),
  }),

  // Timeclock management
  timeclock: router({
    getByEmployee: protectedProcedure.input(z.number()).query(async ({ input }) => {
      return await getTimeclocksByEmployee(input);
    }),

    clockIn: protectedProcedure.input(z.object({
      employeeId: z.number(),
      latitude: z.number(),
      longitude: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const employee = await getEmployeeById(input.employeeId);
      if (!employee) throw new Error('Employee not found');
      
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant) throw new Error('Restaurant not found');
      
      // Validate location
      const distance = calculateDistance(
        parseFloat(restaurant.latitude.toString()),
        parseFloat(restaurant.longitude.toString()),
        input.latitude,
        input.longitude
      );
      
      if (distance > restaurant.radiusMeters) {
        throw new Error('You are not at the restaurant location');
      }
      
      // Check if already clocked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayTimeclocks = await getTimeclocksByEmployee(input.employeeId);
      const todayRecord = todayTimeclocks.find(tc => {
        const tcDate = new Date(tc.createdAt);
        tcDate.setHours(0, 0, 0, 0);
        return tcDate.getTime() === today.getTime() && tc.entryTime;
      });
      
      if (todayRecord) {
        throw new Error('Already clocked in today');
      }
      
      // Check if late
      const now = new Date();
      const dayOfWeek = now.getDay();
      const schedule = await getScheduleByEmployeeAndDay(input.employeeId, dayOfWeek);
      
      let isLate = false;
      const graceMinutes = employee.lateGraceMinutes ?? 5;
      if (schedule) {
        const [scheduleHour, scheduleMinute] = schedule.entryTime.split(':').map(Number);
        const scheduleTime = new Date();
        scheduleTime.setHours(scheduleHour, scheduleMinute, 0, 0);
        const graceTime = new Date(scheduleTime.getTime() + graceMinutes * 60 * 1000);
        
        if (now > graceTime) {
          isLate = true;
        }
      }
      
      await db.insert(timeclocks).values({
        employeeId: input.employeeId,
        entryTime: now,
        isLate,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
      });
      
      return { success: true, isLate };
    }),

    clockOut: protectedProcedure.input(z.object({
      employeeId: z.number(),
      latitude: z.number(),
      longitude: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const employee = await getEmployeeById(input.employeeId);
      if (!employee) throw new Error('Employee not found');
      
      const restaurant = await getRestaurantById(employee.restaurantId);
      if (!restaurant) throw new Error('Restaurant not found');
      
      // Validate location
      const distance = calculateDistance(
        parseFloat(restaurant.latitude.toString()),
        parseFloat(restaurant.longitude.toString()),
        input.latitude,
        input.longitude
      );
      
      if (distance > restaurant.radiusMeters) {
        throw new Error('You are not at the restaurant location');
      }
      
      // Get today's timeclock entry
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayTimeclocks = await getTimeclocksByEmployee(input.employeeId);
      const todayRecord = todayTimeclocks.find(tc => {
        const tcDate = new Date(tc.createdAt);
        tcDate.setHours(0, 0, 0, 0);
        return tcDate.getTime() === today.getTime() && tc.entryTime && !tc.exitTime;
      });
      
      if (!todayRecord) {
        throw new Error('No active timeclock entry found');
      }
      
      const now = new Date();
      await db.update(timeclocks).set({
        exitTime: now,
      }).where(eq(timeclocks.id, todayRecord.id));
      
      return { success: true };
    }),
  }),

  // Incident management
  incident: router({
    getByEmployee: protectedProcedure.input(z.number()).query(async ({ input }) => {
      return await getIncidentsByEmployee(input);
    }),

    create: protectedProcedure.input(z.object({
      employeeId: z.number(),
      timeclockId: z.number().optional(),
      type: z.enum(['late_arrival', 'early_exit', 'other']),
      reason: z.string().min(1),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      await db.insert(incidents).values({
        employeeId: input.employeeId,
        timeclockId: input.timeclockId,
        type: input.type,
        reason: input.reason,
        status: 'pending',
      });
      
      return { success: true };
    }),

    list: adminProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      
      const restaurant = await getRestaurantByAdmin(ctx.user.id);
      if (!restaurant) return [];
      
      const restaurantEmployees = await getEmployeesByRestaurant(restaurant.id);
      const employeeIds = restaurantEmployees.map(e => e.id);
      
      if (employeeIds.length === 0) return [];
      
      const allIncidents = await db.select().from(incidents);
      return allIncidents.filter(inc => employeeIds.includes(inc.employeeId));
    }),

    updateStatus: adminProcedure.input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'approved', 'rejected']),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      
      const incident = await getIncidentById(input.id);
      if (!incident) throw new Error('Incident not found');
      
      await db.update(incidents).set({
        status: input.status,
      }).where(eq(incidents.id, input.id));
      
      return { success: true };
    }),
  }),

});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type AppRouter = typeof appRouter;
