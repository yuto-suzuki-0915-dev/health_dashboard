export type BlockStatus = "pending" | "completed" | "failed";
export type RunState = "idle" | "running" | "paused";

export type TopTask = {
  id: string;
  text: string;
  completed: boolean;
};

export type TimeBlock = {
  id: string;
  startTime: string;
  endTime: string;
  category: string;
  task: string;
  completionCondition: string;
  status: BlockStatus;
  actualStart: string;
  actualEnd: string;
  runState: RunState;
};

export type DailySchedule = {
  date: string;
  wakeUpTime: string;
  workStartTime: string;
  workEndTime: string;
  topThree: TopTask[];
  timeBlocks: TimeBlock[];
};

export type ScheduleStore = Record<string, DailySchedule>;
export const STORAGE_KEY = "dayframe:schedules:v1";

export const newSchedule = (date: string): DailySchedule => ({
  date,
  wakeUpTime: "07:30",
  workStartTime: "09:00",
  workEndTime: "18:00",
  topThree: [],
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
  const blocks = schedule.timeBlocks;
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

export function readSchedules(): ScheduleStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as ScheduleStore;
  } catch {
    return {};
  }
}
