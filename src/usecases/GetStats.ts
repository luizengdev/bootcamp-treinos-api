import dayjs, {Dayjs} from "dayjs";
import utc from "dayjs/plugin/utc.js";

import {prisma} from "../lib/db.js";
import {calculateWorkoutStreak, DATE_FORMAT} from "../lib/workout-streak.js";

dayjs.extend(utc);

interface InputDto {
  userId: string;
  from: string;
  to: string;
}

interface OutputDto {
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

interface GetWorkoutStreakParams {
  userId: string;
  date: Dayjs;
}

export class GetStats {
  async execute(dto: InputDto): Promise<OutputDto> {
    const from = dayjs.utc(dto.from).startOf("day");
    const to = dayjs.utc(dto.to).endOf("day");

    const sessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {workoutPlan: {userId: dto.userId}},
        startedAt: {gte: from.toDate(), lte: to.toDate()},
      },
    });

    const consistencyByDay = sessions.reduce<OutputDto["consistencyByDay"]>((acc, session) => {
      const key = dayjs.utc(session.startedAt).format(DATE_FORMAT);
      acc[key] = {
        workoutDayStarted: true,
        workoutDayCompleted: (acc[key]?.workoutDayCompleted ?? false) || session.completedAt !== null,
      };
      return acc;
    }, {});

    const completedSessions = sessions.filter((session) => session.completedAt !== null);
    const completedWorkoutsCount = completedSessions.length;
    const conclusionRate = sessions.length === 0 ? 0 : completedWorkoutsCount / sessions.length;
    const totalTimeInSeconds = completedSessions.reduce(
      (total, session) => total + dayjs(session.completedAt).diff(session.startedAt, "second"),
      0,
    );

    const workoutStreak = await this.getWorkoutStreak({userId: dto.userId, date: dayjs.utc(dto.to)});

    return {
      workoutStreak,
      consistencyByDay,
      completedWorkoutsCount,
      conclusionRate,
      totalTimeInSeconds,
    };
  }

  private async getWorkoutStreak({userId, date}: GetWorkoutStreakParams): Promise<number> {
    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {userId, isActive: true},
      include: {workoutDays: {select: {weekDay: true}}},
    });
    if (!activeWorkoutPlan) {
      return 0;
    }

    const completedSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {workoutPlanId: activeWorkoutPlan.id},
        completedAt: {not: null},
        startedAt: {lte: date.endOf("day").toDate()},
      },
      select: {startedAt: true},
    });

    return calculateWorkoutStreak({
      date,
      planWeekDays: new Set(activeWorkoutPlan.workoutDays.map((day) => day.weekDay)),
      completedDates: new Set(completedSessions.map((session) => dayjs.utc(session.startedAt).format(DATE_FORMAT))),
    });
  }
}
