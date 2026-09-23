import {Dayjs} from "dayjs";

import {WeekDay} from "../generated/prisma/enums.js";

const WEEK_DAYS_BY_INDEX: WeekDay[] = [
  WeekDay.SUNDAY,
  WeekDay.MONDAY,
  WeekDay.TUESDAY,
  WeekDay.WEDNESDAY,
  WeekDay.THURSDAY,
  WeekDay.FRIDAY,
  WeekDay.SATURDAY,
];

export const DATE_FORMAT = "YYYY-MM-DD";

export const getWeekDay = (date: Dayjs): WeekDay => WEEK_DAYS_BY_INDEX[date.day()];

interface CalculateWorkoutStreakParams {
  date: Dayjs;
  planWeekDays: Set<WeekDay>;
  completedDates: Set<string>;
}

export const calculateWorkoutStreak = ({date, planWeekDays, completedDates}: CalculateWorkoutStreakParams): number => {
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
