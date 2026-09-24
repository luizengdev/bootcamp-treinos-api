import z from "zod";

import { WeekDay } from "../generated/prisma/enums.js";

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const UpdateWorkoutSessionSchema = z.object({
  completedAt: z.iso.datetime(),
});

export const WorkoutSessionSchema = z.object({
  id: z.uuid(),
  completedAt: z.iso.datetime(),
  startedAt: z.iso.datetime(),
});

export const HomeDataSchema = z.object({
  activeWorkoutPlanId: z.uuid(),
  todayWorkoutDay: z.object({
    workoutPlanId: z.uuid(),
    id: z.uuid(),
    name: z.string(),
    isRest: z.boolean(),
    weekDay: z.enum(WeekDay),
    estimatedDurationInSeconds: z.number().int(),
    coverImageUrl: z.url().optional(),
    exercisesCount: z.number().int().min(0),
  }),
  workoutStreak: z.number().int().min(0),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});

export const WorkoutPlanDetailsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  workoutDays: z.array(
    z.object({
      id: z.uuid(),
      weekDay: z.enum(WeekDay),
      name: z.string(),
      isRest: z.boolean(),
      coverImageUrl: z.url().optional(),
      estimatedDurationInSeconds: z.number().int(),
      exercisesCount: z.number().int().min(0),
    }),
  ),
});

export const WorkoutDayDetailsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isRest: z.boolean(),
  coverImageUrl: z.url().optional(),
  estimatedDurationInSeconds: z.number().int(),
  exercises: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      order: z.number().int().min(0),
      workoutDayId: z.uuid(),
      sets: z.number().int(),
      reps: z.number().int(),
      restTimeInSeconds: z.number().int(),
    }),
  ),
  weekDay: z.enum(WeekDay),
  sessions: z.array(
    z.object({
      id: z.uuid(),
      workoutDayId: z.uuid(),
      startedAt: z.iso.date().optional(),
      completedAt: z.iso.date().optional(),
    }),
  ),
});

export const GetStatsQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine((query) => query.from <= query.to, {
    message: "'from' must be before or equal to 'to'",
    path: ["from"],
  });

export const StatsSchema = z.object({
  workoutStreak: z.number().int().min(0),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
  completedWorkoutsCount: z.number().int().min(0),
  conclusionRate: z.number().min(0).max(1),
  totalTimeInSeconds: z.number().int().min(0),
});

export const ListWorkoutPlansQuerySchema = z.object({
  active: z.stringbool({ truthy: ["true"], falsy: ["false"] }).optional(),
});

export const WorkoutPlanListSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    isActive: z.boolean(),
    workoutDays: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        workoutPlanId: z.uuid(),
        weekDay: z.enum(WeekDay),
        isRest: z.boolean(),
        estimatedDurationInSeconds: z.number().int(),
        coverImageUrl: z.url().optional(),
        exercises: z.array(
          z.object({
            id: z.uuid(),
            name: z.string(),
            order: z.number().int().min(0),
            workoutDayId: z.uuid(),
            sets: z.number().int(),
            reps: z.number().int(),
            restTimeInSeconds: z.number().int(),
          }),
        ),
      }),
    ),
  }),
);

export const AiChatSchema = z.object({
  messages: z
    .array(
      z.looseObject({
        id: z.string(),
        role: z.enum(["system", "user", "assistant"]),
        parts: z.array(z.looseObject({ type: z.string() })),
      }),
    )
    .min(1),
});

export const UpsertUserTrainDataSchema = z.object({
  weightInGrams: z.number().int().positive(),
  heightInCentimeters: z.number().int().positive(),
  age: z.number().int().positive(),
  bodyFatPercentage: z.number().int().min(0).max(100),
});

export const UserTrainDataSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  weightInGrams: z.number().int().min(0),
  heightInCentimeters: z.number().int().min(0),
  age: z.number().int().min(0),
  bodyFatPercentage: z.number().int().min(0).max(100),
});

export const WorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  workoutDays: z.array(
    z.object({
      name: z.string().trim().min(1),
      weekDay: z.enum(WeekDay),
      isRest: z.boolean().default(false),
      estimatedDurationInSeconds: z.number().int().min(1),
      coverImageUrl: z.url().optional(),
      exercises: z.array(
        z.object({
          order: z.number().min(0),
          name: z.string().trim().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          restTimeInSeconds: z.number().min(1),
        }),
      ),
    }),
  ),
});
