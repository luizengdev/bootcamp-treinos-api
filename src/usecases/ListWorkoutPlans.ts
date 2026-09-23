import {WeekDay} from "../generated/prisma/enums.js";
import {prisma} from "../lib/db.js";

interface InputDto {
  userId: string;
  active?: boolean;
}

interface OutputDto {
  id: string;
  name: string;
  isActive: boolean;
  workoutDays: Array<{
    id: string;
    name: string;
    workoutPlanId: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercises: Array<{
      id: string;
      name: string;
      order: number;
      workoutDayId: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class ListWorkoutPlans {
  async execute(dto: InputDto): Promise<OutputDto[]> {
    const workoutPlans = await prisma.workoutPlan.findMany({
      where: {
        userId: dto.userId,
        isActive: dto.active,
      },
      orderBy: {createdAt: "desc"},
      include: {
        workoutDays: {
          include: {
            exercises: {orderBy: {order: "asc"}},
          },
        },
      },
    });

    return workoutPlans.map((workoutPlan) => ({
      id: workoutPlan.id,
      name: workoutPlan.name,
      isActive: workoutPlan.isActive,
      workoutDays: workoutPlan.workoutDays.map((day) => ({
        id: day.id,
        name: day.name,
        workoutPlanId: day.workoutPlanId,
        weekDay: day.weekDay,
        isRest: day.isRest,
        estimatedDurationInSeconds: day.estimatedDurationInSeconds,
        coverImageUrl: day.coverImageUrl ?? undefined,
        exercises: day.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          order: exercise.order,
          workoutDayId: exercise.workoutDayId,
          sets: exercise.sets,
          reps: exercise.reps,
          restTimeInSeconds: exercise.restTimeInSeconds,
        })),
      })),
    }));
  }
}
