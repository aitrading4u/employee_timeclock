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
  getTimeclocksByEmployee,
  getIncidentsByEmployee,
  getEmployeeById,
  getRestaurantById,
  getSchedulesByEmployee,
  getIncidentById
} from "./db";
import { restaurants, employees, schedules, timeclocks, incidents, users } from "../drizzle/schema";
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
      if (schedule) {
        const [scheduleHour, scheduleMinute] = schedule.entryTime.split(':').map(Number);
        const scheduleTime = new Date();
        scheduleTime.setHours(scheduleHour, scheduleMinute, 0, 0);
        
        if (now > scheduleTime) {
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
