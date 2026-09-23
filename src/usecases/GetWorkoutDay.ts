import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

import {ForbiddenError, NotFoundError} from "../errors/index.js";
import {WeekDay} from "../generated/prisma/enums.js";
import {prisma} from "../lib/db.js";

dayjs.extend(utc);

const DATE_FORMAT = "YYYY-MM-DD";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
}

interface OutputDto {
  id: string;
  name: string;
  isRest: boolean;
  coverImageUrl?: string;
  estimatedDurationInSeconds: number;
  exercises: Array<{
    id: string;
    name: string;
    order: number;
    workoutDayId: string;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
  }>;
  weekDay: WeekDay;
  sessions: Array<{
    id: string;
    workoutDayId: string;
    startedAt?: string;
    completedAt?: string;
  }>;
}

export class GetWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: {id: dto.workoutPlanId},
    });
    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }
    if (workoutPlan.userId !== dto.userId) {
      throw new ForbiddenError("You are not the owner of this workout plan");
    }

    const workoutDay = await prisma.workoutDay.findUnique({
      where: {id: dto.workoutDayId, workoutPlanId: dto.workoutPlanId},
      include: {
        exercises: {orderBy: {order: "asc"}},
        sessions: {orderBy: {startedAt: "asc"}},
      },
    });
    if (!workoutDay) {
      throw new NotFoundError("Workout day not found");
    }

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRest,
      coverImageUrl: workoutDay.coverImageUrl ?? undefined,
      estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
      exercises: workoutDay.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        order: exercise.order,
        workoutDayId: exercise.workoutDayId,
        sets: exercise.sets,
        reps: exercise.reps,
        restTimeInSeconds: exercise.restTimeInSeconds,
      })),
      weekDay: workoutDay.weekDay,
      sessions: workoutDay.sessions.map((session) => ({
        id: session.id,
        workoutDayId: session.workoutDayId,
        startedAt: dayjs.utc(session.startedAt).format(DATE_FORMAT),
        completedAt: session.completedAt ? dayjs.utc(session.completedAt).format(DATE_FORMAT) : undefined,
      })),
    };
  }
}
