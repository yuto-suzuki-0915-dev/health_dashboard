export type BlockStatus = "pending" | "completed" | "failed";
export type RunState = "idle" | "running" | "paused";

export type TopTask = {
  id: string;
  text: string;
  completed: boolean;
};

export type TimeBlock = {
  id: string;
  templateSlotId?: string;
  slotLabel?: string;
  kind?: "work" | "break";
  startTime: string;
  endTime: string;
  category: string;
  task: string;
  completionCondition: string;
  status: BlockStatus;
  actualStart: string;
  actualEnd: string;
  actualTask?: string;
  runState: RunState;
};

export type DailySchedule = {
  date: string;
  wakeUpTime: string;
  workStartTime: string;
  workEndTime: string;
  topThree: TopTask[];
  priority?: string;
  dailyTasks?: TopTask[];
  timeBlocks: TimeBlock[];
};

export type ScheduleStore = Record<string, DailySchedule>;
export const STORAGE_KEY = "dayframe:schedules:v1";
export const TEMPLATE_KEY = "dayframe:week-template:v1";
export const HORIZON_TASKS_KEY = "dayframe:horizon-tasks:v1";
export const GOAL_KEY = "dayframe:primary-goal:v1";

export type GoalMetric = {
  id: string;
  label: string;
  unit: string;
  target: number | null;
};

export type GoalSnapshot = {
  title: string;
  period: string;
  metrics: GoalMetric[];
  weeklyValues: Record<string, Record<string, number>>;
};

export type PrimaryGoal = GoalSnapshot & {
  history: GoalSnapshot[];
};

export const emptyPrimaryGoal = (): PrimaryGoal => ({
  title: "",
  period: "",
  metrics: [],
  weeklyValues: {},
  history: [],
});

export function updatePrimaryGoal(previous: PrimaryGoal, settings: Pick<GoalSnapshot, "title" | "period" | "metrics">): PrimaryGoal {
  if (previous.period === settings.period) return { ...previous, ...settings };
  const hasRecordedValues = Object.values(previous.weeklyValues).some((values) => Object.keys(values).length > 0);
  const history = hasRecordedValues
    ? [...previous.history, { title: previous.title, period: previous.period, metrics: previous.metrics, weeklyValues: previous.weeklyValues }]
    : previous.history;
  return { ...settings, weeklyValues: {}, history };
}

export type FixedSlot = {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  kind: "work" | "break";
};

export type WeekTemplate = Record<number, FixedSlot[]>;
export type HorizonTask = {
  id: string;
  text: string;
  horizon: "medium" | "long";
  dueDate: string;
  completed: boolean;
};

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const LATER_PERIODS: FixedSlot[] = [
  { id: "period-4", startTime: "15:10", endTime: "16:40", label: "4限", kind: "work" },
  { id: "period-5", startTime: "16:50", endTime: "18:20", label: "5限", kind: "work" },
];

function overlaps(first: { startTime: string; endTime: string }, second: { startTime: string; endTime: string }) {
  return first.startTime < second.endTime && second.startTime < first.endTime;
}

function extendLegacySlots(slots: FixedSlot[]): FixedSlot[] {
  if (!slots.some((slot) => slot.id === "period-3" && slot.endTime === "15:00")) return slots;
  if (slots.some((slot) => slot.startTime >= "15:00" && !LATER_PERIODS.some((period) => period.id === slot.id))) return slots;
  const extended = [...slots];
  for (const period of LATER_PERIODS) {
    if (extended.some((slot) => slot.id === period.id || slot.label === period.label || overlaps(slot, period))) continue;
    extended.push({ ...period });
  }
  return extended.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function defaultWeekTemplate(): WeekTemplate {
  const slots: FixedSlot[] = [
    { id: "period-1", startTime: "08:50", endTime: "10:20", label: "1限", kind: "work" },
    { id: "period-2", startTime: "10:30", endTime: "12:00", label: "2限", kind: "work" },
    { id: "lunch", startTime: "12:00", endTime: "13:30", label: "昼休み", kind: "break" },
    { id: "period-3", startTime: "13:30", endTime: "15:00", label: "3限", kind: "work" },
    ...LATER_PERIODS,
  ];
  return Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, day === 0 || day === 6 ? [] : slots.map((slot) => ({ ...slot }))])) as WeekTemplate;
}

export function weekdayForDate(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function scheduleFromTemplate(date: string, template: WeekTemplate): DailySchedule {
  const slots = template[weekdayForDate(date)] ?? [];
  const workSlots = slots.filter((slot) => slot.kind === "work");
  return {
    ...newSchedule(date),
    workStartTime: workSlots[0]?.startTime ?? "09:00",
    workEndTime: workSlots.at(-1)?.endTime ?? "18:00",
    timeBlocks: slots.map((slot) => ({
      id: `${date}:${slot.id}`,
      templateSlotId: slot.id,
      slotLabel: slot.label,
      kind: slot.kind,
      startTime: slot.startTime,
      endTime: slot.endTime,
      category: slot.kind === "break" ? "休憩" : "",
      task: slot.kind === "break" ? slot.label : "",
      completionCondition: "",
      status: "pending" as BlockStatus,
      actualStart: "",
      actualEnd: "",
      actualTask: "",
      runState: "idle" as RunState,
    })),
  };
}

export const newSchedule = (date: string): DailySchedule => ({
  date,
  wakeUpTime: "07:30",
  workStartTime: "09:00",
  workEndTime: "18:00",
  topThree: [],
  dailyTasks: [],
  timeBlocks: [],
});

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return localDate(new Date(year, month - 1, day + days));
}

export function weekStart(date: string): string {
  const weekday = weekdayForDate(date);
  return addDays(date, -(weekday === 0 ? 6 : weekday - 1));
}

export function dateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(year, month - 1, day));
}

export function timeNow(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function blockTime(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

export function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function scheduleStats(schedule: DailySchedule) {
  const blocks = schedule.timeBlocks.filter((block) => block.kind !== "break" && block.task.trim());
  const completed = blocks.filter((block) => block.status === "completed").length;
  const onTime = blocks.filter((block) => block.actualStart && timeToMinutes(block.actualStart) <= timeToMinutes(block.startTime) + 5).length;
  const topCompleted = schedule.topThree.filter((task) => task.completed).length;
  return {
    completed,
    total: blocks.length,
    onTime,
    topCompleted,
    topTotal: schedule.topThree.length,
    adherence: blocks.length ? Math.round((completed / blocks.length) * 100) : 0,
  };
}

export function readWeekTemplate(): WeekTemplate {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return defaultWeekTemplate();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaultWeekTemplate();
    const defaults = defaultWeekTemplate();
    return Object.fromEntries(Array.from({ length: 7 }, (_, day) => {
      const value = (parsed as Record<number, unknown>)[day];
      return [day, Array.isArray(value) ? extendLegacySlots(value as FixedSlot[]) : defaults[day]];
    })) as WeekTemplate;
  } catch {
    return defaultWeekTemplate();
  }
}

export function readHorizonTasks(): HorizonTask[] {
  try {
    const raw = localStorage.getItem(HORIZON_TASKS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as HorizonTask[] : [];
  } catch {
    return [];
  }
}

export function readPrimaryGoal(): PrimaryGoal {
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (!raw) return emptyPrimaryGoal();
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return emptyPrimaryGoal();
    const goal = value as Partial<PrimaryGoal>;
    return {
      title: typeof goal.title === "string" ? goal.title : "",
      period: typeof goal.period === "string" ? goal.period : "",
      metrics: Array.isArray(goal.metrics) ? goal.metrics : [],
      weeklyValues: goal.weeklyValues && typeof goal.weeklyValues === "object" ? goal.weeklyValues : {},
      history: Array.isArray(goal.history) ? goal.history : [],
    };
  } catch {
    return emptyPrimaryGoal();
  }
}

export function readSchedules(): ScheduleStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const schedules = parsed as ScheduleStore;
    const template = readWeekTemplate();
    const today = localDate();
    return Object.fromEntries(Object.entries(schedules).map(([date, schedule]) => {
      if (date < today || schedule.workEndTime !== "15:00" ||
        !schedule.timeBlocks.some((block) => block.templateSlotId === "period-3" && block.endTime === "15:00") ||
        schedule.timeBlocks.some((block) => block.startTime >= "15:00" && !LATER_PERIODS.some((period) => period.id === block.templateSlotId))) return [date, schedule];
      const additions = scheduleFromTemplate(date, template).timeBlocks.filter((block) =>
        LATER_PERIODS.some((period) => period.id === block.templateSlotId) &&
        !schedule.timeBlocks.some((existing) => existing.templateSlotId === block.templateSlotId || overlaps(existing, block)),
      );
      if (!additions.length) return [date, schedule];
      return [date, {
        ...schedule,
        workEndTime: additions.at(-1)?.endTime ?? schedule.workEndTime,
        timeBlocks: [...schedule.timeBlocks, ...additions].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }];
    })) as ScheduleStore;
  } catch {
    return {};
  }
}
