"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import GoalEditor from "@/components/GoalEditor";
import ScheduleEditor from "@/components/ScheduleEditor";
import WeekTemplateEditor from "@/components/WeekTemplateEditor";
import {
  addDays, dateLabel, defaultWeekTemplate, emptyPrimaryGoal, GOAL_KEY, localDate,
  readPrimaryGoal, readSchedules, readWeekTemplate, scheduleFromTemplate, STORAGE_KEY,
  TEMPLATE_KEY, timeNow, timeToMinutes, weekdayForDate, weekStart,
  type DailySchedule, type PrimaryGoal, type ScheduleStore, type TimeBlock, type WeekTemplate,
} from "@/lib/schedule";

const subscribeHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
const dayShort = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const weekdayShort = (date: string) => ["日", "月", "火", "水", "木", "金", "土"][weekdayForDate(date)];

function duration(start: string, end: string) {
  if (!start || !end) return start ? "進行中" : "";
  const minutes = Math.max(0, timeToMinutes(end) - timeToMinutes(start));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? `${String(rest).padStart(2, "0")}m` : ""}` : `${rest}m`;
}

function PriorityCard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <section className="df-priority" aria-labelledby="priority-title">
    <div className="df-section-kicker"><span>01</span> TODAY&apos;S PRIORITY</div>
    <div className="df-priority-body"><div><h2 id="priority-title">今日、一番前に進めること</h2><p>ひとつに絞って、ここから始める。</p></div><input aria-label="今日の最優先事項" type="text" maxLength={140} placeholder="今日の最優先事項を1つ入力" value={value} onChange={(event) => onChange(event.target.value)} /></div>
  </section>;
}

function ActualRecord({ block, onChange, allowNow }: { block: TimeBlock; onChange: (change: Partial<TimeBlock>) => void; allowNow: boolean }) {
  const [editing, setEditing] = useState(false);
  const recordedTask = block.actualTask ?? (block.status === "completed" ? block.task : "");
  return <div className="df-actual-record">{!editing ? <div className="df-actual-preview"><div><strong>{recordedTask || "未記録"}</strong>{duration(block.actualStart, block.actualEnd) && <span>{duration(block.actualStart, block.actualEnd)}</span>}</div><button type="button" onClick={() => setEditing(true)}>{recordedTask || block.actualStart ? "編集" : "実績を記録"} ↗</button></div> : <>
    <div className="df-actual-main"><input aria-label={`${block.startTime}の実績内容`} type="text" maxLength={140} placeholder="実際にしたこと" value={recordedTask} onChange={(event) => onChange({ actualTask: event.target.value })} /><span className="df-duration">{duration(block.actualStart, block.actualEnd) || "時間未記録"}</span></div>
    <div className="df-actual-controls"><label>開始<input aria-label={`${block.startTime}の実際の開始`} type="time" value={block.actualStart || ""} onChange={(event) => onChange({ actualStart: event.target.value })} /></label><label>終了<input aria-label={`${block.startTime}の実際の終了`} type="time" value={block.actualEnd || ""} onChange={(event) => onChange({ actualEnd: event.target.value })} /></label>
      {allowNow && !block.actualStart && <button type="button" onClick={() => onChange({ actualStart: timeNow() })}>今から開始</button>}
      {allowNow && block.actualStart && !block.actualEnd && <button type="button" onClick={() => onChange({ actualEnd: timeNow() })}>今終了</button>}
      <button type="button" onClick={() => setEditing(false)}>閉じる</button>
    </div></>}
  </div>;
}

function Timetable({ blocks, editable, onChange, allowNow = false }: {
  blocks: TimeBlock[];
  editable: boolean;
  onChange?: (blockId: string, change: Partial<TimeBlock>) => void;
  allowNow?: boolean;
}) {
  if (!blocks.length) return <div className="df-empty">時間枠がありません。「予定を立てる」でこの曜日の固定枠を設定してください。</div>;
  return <div className="df-table-wrap"><table className="df-table"><thead><tr><th>時間</th><th>予定</th><th>実績</th></tr></thead><tbody>{blocks.map((block) => <tr key={block.id} className={block.kind === "break" ? "df-break" : ""}>
    <td data-label="時間"><strong>{block.startTime}–{block.endTime}</strong><small>{block.slotLabel || "臨時枠"}</small></td>
    <td data-label="予定"><span className="df-plan-category">{block.kind === "break" ? "休憩" : block.category || "予定"}</span><strong>{block.kind === "break" ? block.slotLabel || "休憩" : block.task || "未設定"}</strong>{block.kind !== "break" && block.completionCondition && <small>完了条件：{block.completionCondition}</small>}</td>
    <td data-label="実績">{editable && onChange ? <ActualRecord block={block} allowNow={allowNow} onChange={(change) => onChange(block.id, change)} /> : <div className="df-readonly-actual"><strong>{block.actualTask || (block.status === "completed" ? block.task : "未記録")}</strong>{duration(block.actualStart, block.actualEnd) && <small>{duration(block.actualStart, block.actualEnd)}</small>}</div>}</td>
  </tr>)}</tbody></table></div>;
}

function WeeklyProgress({ goal, week, onWeekChange, onGoalChange, onEdit }: {
  goal: PrimaryGoal;
  week: string;
  onWeekChange: (week: string) => void;
  onGoalChange: (goal: PrimaryGoal) => void;
  onEdit: () => void;
}) {
  function valueAt(metricId: string, atWeek: string) {
    const latestWeek = Object.keys(goal.weeklyValues)
      .filter((entry) => entry <= atWeek && Object.hasOwn(goal.weeklyValues[entry], metricId))
      .sort()
      .at(-1);
    return latestWeek === undefined ? undefined : goal.weeklyValues[latestWeek][metricId];
  }
  function changeValue(metricId: string, raw: string) {
    const previous = goal.weeklyValues[week] ?? {};
    const next = { ...previous };
    if (raw === "") delete next[metricId];
    else next[metricId] = Number(raw);
    onGoalChange({ ...goal, weeklyValues: { ...goal.weeklyValues, [week]: next } });
  }
  return <section className="df-panel df-weekly" aria-labelledby="weekly-title">
    <div className="df-panel-heading"><div><div className="df-section-kicker"><span>03</span> WEEKLY PROGRESS</div><h2 id="weekly-title">今週、目標にどれだけ近づいたか</h2><p>主要目標の累計を、週単位で記録。</p></div><button type="button" className="df-quiet-button" onClick={onEdit}>目標を設定 ↗</button></div>
    <div className="df-week-bar"><div><strong>{dayShort(week)}–{dayShort(addDays(week, 6))}</strong><span>{goal.period || "今週"}</span></div><div className="df-week-nav"><button type="button" aria-label="前の週" onClick={() => onWeekChange(addDays(week, -7))}>←</button><button type="button" onClick={() => onWeekChange(weekStart(localDate()))}>今週</button><button type="button" aria-label="次の週" onClick={() => onWeekChange(addDays(week, 7))}>→</button></div></div>
    {goal.title && goal.metrics.length ? <div className="df-goal-content"><h3>{goal.title}</h3><div className="df-metrics">{goal.metrics.map((metric) => {
      const value = valueAt(metric.id, week);
      const previous = valueAt(metric.id, addDays(week, -7));
      const delta = value !== undefined && previous !== undefined ? value - previous : undefined;
      const percent = metric.target && metric.target > 0 && value !== undefined ? Math.min(100, Math.max(0, value / metric.target * 100)) : 0;
      const recorded = goal.weeklyValues[week]?.[metric.id];
      return <div className="df-metric" key={metric.id}><label htmlFor={`metric-${metric.id}`}>{metric.label}</label><div className="df-metric-value"><input id={`metric-${metric.id}`} type="number" min="0" step="any" placeholder={value === undefined ? "0" : String(value)} value={recorded ?? ""} onChange={(event) => changeValue(metric.id, event.target.value)} /><span>{metric.unit}</span>{metric.target !== null && <small>/ {metric.target}{metric.unit}</small>}</div>{recorded === undefined && value !== undefined && <small className="df-metric-inherited">前週までの累計 {value}{metric.unit}</small>}{delta !== undefined && <small className="df-metric-delta">前週から {delta >= 0 ? "+" : ""}{delta}{metric.unit}</small>}{metric.target !== null && metric.target > 0 && <div className="df-meter" aria-label={`${Math.round(percent)}%`}><span style={{ width: `${percent}%` }} /></div>}</div>;
    })}</div></div> : <div className="df-empty df-goal-empty"><strong>主要目標を1つ設定する</strong><p>追いかける数値と期間の目標値を自由に決められます。</p><button type="button" className="df-solid-button" onClick={onEdit}>目標を設定 →</button></div>}
  </section>;
}

export default function Dashboard() {
  const hydrated = useSyncExternalStore(subscribeHydration, getClientSnapshot, getServerSnapshot);
  const [schedules, setSchedules] = useState<ScheduleStore>(() => typeof window === "undefined" ? {} : readSchedules());
  const [template, setTemplate] = useState<WeekTemplate>(() => typeof window === "undefined" ? defaultWeekTemplate() : readWeekTemplate());
  const [goal, setGoal] = useState<PrimaryGoal>(() => typeof window === "undefined" ? emptyPrimaryGoal() : readPrimaryGoal());
  const [today, setToday] = useState(() => localDate());
  const [selectedDate, setSelectedDate] = useState(() => localDate());
  const [selectedWeek, setSelectedWeek] = useState(() => weekStart(localDate()));
  const [view, setView] = useState<"home" | "planner">("home");
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDate()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules)); }, [hydrated, schedules]);
  useEffect(() => { if (hydrated) localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template)); }, [hydrated, template]);
  useEffect(() => { if (hydrated) localStorage.setItem(GOAL_KEY, JSON.stringify(goal)); }, [hydrated, goal]);

  const todaySchedule = schedules[today] ?? scheduleFromTemplate(today, template);
  const selectedSchedule = schedules[selectedDate] ?? scheduleFromTemplate(selectedDate, template);
  const todayBlocks = useMemo(() => [...todaySchedule.timeBlocks].sort((a, b) => a.startTime.localeCompare(b.startTime)), [todaySchedule.timeBlocks]);
  const selectedBlocks = useMemo(() => [...selectedSchedule.timeBlocks].sort((a, b) => a.startTime.localeCompare(b.startTime)), [selectedSchedule.timeBlocks]);
  const priority = todaySchedule.priority ?? todaySchedule.topThree[0]?.text ?? "";
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart(selectedDate), index));

  function updateDay(date: string, transform: (schedule: DailySchedule) => DailySchedule) {
    setSchedules((current) => {
      const base = current[date] ?? scheduleFromTemplate(date, template);
      return { ...current, [date]: transform(base) };
    });
  }
  function updateActual(date: string, blockId: string, change: Partial<TimeBlock>) {
    updateDay(date, (schedule) => ({ ...schedule, timeBlocks: schedule.timeBlocks.map((block) => block.id === blockId ? { ...block, ...change } : block) }));
  }
  function saveSchedule(schedule: DailySchedule) {
    setSchedules((current) => ({ ...current, [schedule.date]: schedule }));
    setEditingSchedule(false);
  }

  if (!hydrated) return <main className="loading-screen">DAYFRAME</main>;

  return <div className="df-shell">
    <header className="df-header"><div className="df-brand"><span className="df-brand-mark">▦</span> DAYFRAME</div><nav aria-label="メインナビゲーション"><button type="button" className={view === "home" ? "active" : ""} onClick={() => setView("home")}>今日</button><button type="button" className={view === "planner" ? "active" : ""} onClick={() => setView("planner")}>予定を立てる</button></nav><span className="df-header-date">{dayShort(today)}（{weekdayShort(today)}）</span></header>
    <main className="df-main">
      {view === "home" ? <>
        <div className="df-page-title"><div><span className="df-overline">DAILY DASHBOARD</span><h1>今日を、予定通りに。</h1><p>{dateLabel(today)}</p></div><button type="button" className="df-quiet-button" onClick={() => { setSelectedDate(today); setView("planner"); }}>今日の予定を編集 ↗</button></div>
        <PriorityCard value={priority} onChange={(value) => updateDay(today, (schedule) => ({ ...schedule, priority: value }))} />
        <section className="df-panel df-timetable" aria-labelledby="timetable-title"><div className="df-panel-heading"><div><div className="df-section-kicker"><span>02</span> TIME TABLE</div><h2 id="timetable-title">時間割</h2><p>予定した時間と、実際に使った時間。</p></div><button type="button" className="df-quiet-button" onClick={() => { setSelectedDate(today); setView("planner"); }}>予定を変更 ↗</button></div><Timetable blocks={todayBlocks} editable allowNow onChange={(blockId, change) => updateActual(today, blockId, change)} /></section>
        <WeeklyProgress goal={goal} week={selectedWeek} onWeekChange={setSelectedWeek} onGoalChange={setGoal} onEdit={() => setEditingGoal(true)} />
      </> : <>
        <div className="df-page-title"><div><span className="df-overline">PLAN AHEAD</span><h1>先の予定を立てる</h1><p>曜日の枠組みを使い、日ごとの内容を決める。</p></div><button type="button" className="df-quiet-button" onClick={() => setEditingTemplate(true)}>曜日の固定枠を設定 ↗</button></div>
        <section className="df-panel df-planner" aria-label="日付と予定の選択"><div className="df-plan-toolbar"><div className="df-week-nav"><button type="button" aria-label="前の週" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>←</button><strong>{dayShort(weekDates[0])}–{dayShort(weekDates[6])}</strong><button type="button" aria-label="次の週" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>→</button></div><label>日付を選ぶ<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><button type="button" className="df-solid-button" onClick={() => setEditingSchedule(true)}>この日の予定を編集 →</button></div>
          <div className="df-week-strip">{weekDates.map((date) => {
            const plan = schedules[date] ?? scheduleFromTemplate(date, template);
            const planned = plan.timeBlocks.filter((block) => block.kind !== "break" && block.task.trim()).length;
            const firstTask = plan.timeBlocks.find((block) => block.kind !== "break" && block.task.trim())?.task;
            return <button type="button" key={date} className={selectedDate === date ? "selected" : ""} onClick={() => setSelectedDate(date)}><span>{weekdayShort(date)}</span><strong>{Number(date.slice(8, 10))}</strong><small title={firstTask}>{firstTask || "内容未設定"}{planned > 1 ? ` ほか${planned - 1}件` : ""}</small></button>;
          })}</div>
        </section>
        <section className="df-panel df-plan-detail" aria-labelledby="plan-detail-title"><div className="df-panel-heading"><div><div className="df-section-kicker">DAY PLAN</div><h2 id="plan-detail-title">{dateLabel(selectedDate)}</h2><p>最優先：{selectedSchedule.priority ?? selectedSchedule.topThree[0]?.text ?? "未設定"}</p></div><button type="button" className="df-quiet-button" onClick={() => setEditingSchedule(true)}>内容を編集 ↗</button></div><Timetable blocks={selectedBlocks} editable={selectedDate <= today} allowNow={selectedDate === today} onChange={(blockId, change) => updateActual(selectedDate, blockId, change)} /></section>
      </>}
      <footer className="df-footer"><span>DAYFRAME</span><span>記録はこのブラウザに保存されます</span></footer>
    </main>
    {editingSchedule && <ScheduleEditor initial={selectedSchedule} onSave={saveSchedule} onClose={() => setEditingSchedule(false)} />}
    {editingTemplate && <WeekTemplateEditor initial={template} initialDay={weekdayForDate(selectedDate)} onSave={(next) => { setTemplate(next); setEditingTemplate(false); }} onClose={() => setEditingTemplate(false)} />}
    {editingGoal && <GoalEditor initial={goal} onSave={(next) => { setGoal(next); setEditingGoal(false); }} onClose={() => setEditingGoal(false)} />}
  </div>;
}
