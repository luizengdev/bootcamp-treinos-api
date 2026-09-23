import dayjs, {Dayjs} from "dayjs";
import utc from "dayjs/plugin/utc.js";

import {NotFoundError} from "../errors/index.js";
import {WeekDay} from "../generated/prisma/enums.js";
import {prisma} from "../lib/db.js";

dayjs.extend(utc);

const WEEK_DAYS_BY_INDEX: WeekDay[] = [
  WeekDay.SUNDAY,
  WeekDay.MONDAY,
  WeekDay.TUESDAY,
  WeekDay.WEDNESDAY,
  WeekDay.THURSDAY,
  WeekDay.FRIDAY,
  WeekDay.SATURDAY,
];

const DATE_FORMAT = "YYYY-MM-DD";

interface InputDto {
  userId: string;
  date: string;
}

interface OutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercisesCount: number;
  };
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
}

const getWeekDay = (date: Dayjs): WeekDay => WEEK_DAYS_BY_INDEX[date.day()];

interface CalculateWorkoutStreakParams {
  date: Dayjs;
  planWeekDays: Set<WeekDay>;
  completedDates: Set<string>;
}

const calculateWorkoutStreak = ({date, planWeekDays, completedDates}: CalculateWorkoutStreakParams): number => {
  if (planWeekDays.size === 0 || completedDates.size === 0) {
    return 0;
  }

  const earliestCompletedDate = [...completedDates].sort()[0];
  const isTodayCompleted = completedDates.has(date.format(DATE_FORMAT));
  let cursor = isTodayCompleted ? date : date.subtract(1, "day");
  let streak = 0;

  while (cursor.format(DATE_FORMAT) >= earliestCompletedDate) {
    if (planWeekDays.has(getWeekDay(cursor))) {
      if (!completedDates.has(cursor.format(DATE_FORMAT))) {
        break;
      }
      streak++;
    }
    cursor = cursor.subtract(1, "day");
  }

  return streak;
};

export class GetHomeData {
  async execute(dto: InputDto): Promise<OutputDto> {
    const date = dayjs.utc(dto.date);
    const weekStart = date.startOf("week");
    const weekEnd = date.endOf("week");

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {userId: dto.userId, isActive: true},
      include: {
        workoutDays: {
          include: {
            _count: {select: {exercises: true}},
          },
        },
      },
    });
    if (!activeWorkoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const todayWorkoutDay = activeWorkoutPlan.workoutDays.find((day) => day.weekDay === getWeekDay(date));
    if (!todayWorkoutDay) {
      throw new NotFoundError("Workout day not found for this date");
    }

    const weekSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {workoutPlan: {userId: dto.userId}},
        startedAt: {gte: weekStart.toDate(), lte: weekEnd.toDate()},
      },
    });

    const consistencyByDay: OutputDto["consistencyByDay"] = Object.fromEntries(
      Array.from({length: 7}, (_, index) => [
        weekStart.add(index, "day").format(DATE_FORMAT),
        {workoutDayCompleted: false, workoutDayStarted: false},
      ]),
    );
    weekSessions.forEach((session) => {
      const key = dayjs.utc(session.startedAt).format(DATE_FORMAT);
      consistencyByDay[key] = {
        workoutDayStarted: true,
        workoutDayCompleted: consistencyByDay[key].workoutDayCompleted || session.completedAt !== null,
      };
    });

    const completedSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {workoutPlanId: activeWorkoutPlan.id},
        completedAt: {not: null},
        startedAt: {lte: date.endOf("day").toDate()},
      },
      select: {startedAt: true},
    });

    const workoutStreak = calculateWorkoutStreak({
      date,
      planWeekDays: new Set(activeWorkoutPlan.workoutDays.map((day) => day.weekDay)),
      completedDates: new Set(completedSessions.map((session) => dayjs.utc(session.startedAt).format(DATE_FORMAT))),
    });

    return {
      activeWorkoutPlanId: activeWorkoutPlan.id,
      todayWorkoutDay: {
        workoutPlanId: todayWorkoutDay.workoutPlanId,
        id: todayWorkoutDay.id,
        name: todayWorkoutDay.name,
        isRest: todayWorkoutDay.isRest,
        weekDay: todayWorkoutDay.weekDay,
        estimatedDurationInSeconds: todayWorkoutDay.estimatedDurationInSeconds,
        coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
        exercisesCount: todayWorkoutDay._count.exercises,
      },
      workoutStreak,
      consistencyByDay,
    };
  }
}
