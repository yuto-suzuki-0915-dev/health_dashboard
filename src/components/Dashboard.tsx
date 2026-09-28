"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  addDays,
  blockTime,
  dateLabel,
  formatCountdown,
  localDate,
  newSchedule,
  readSchedules,
  scheduleStats,
  STORAGE_KEY,
  timeNow,
  timeToMinutes,
  type BlockStatus,
  type DailySchedule,
  type ScheduleStore,
  type TimeBlock,
  type TopTask,
} from "@/lib/schedule";

const id = () => crypto.randomUUID();
const subscribeHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function blankBlock(startTime = "09:00"): TimeBlock {
  const endMinutes = Math.min(timeToMinutes(startTime) + 60, 23 * 60 + 59);
  return {
    id: id(),
    startTime,
    endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
    category: "",
    task: "",
    completionCondition: "",
    status: "pending",
    actualStart: "",
    actualEnd: "",
    runState: "idle",
  };
}

function copySchedule(schedule: DailySchedule): DailySchedule {
  return {
    ...schedule,
    topThree: schedule.topThree.map((task) => ({ ...task })),
    timeBlocks: schedule.timeBlocks.map((block) => ({ ...block })),
  };
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "red" | "amber" }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function ScheduleEditor({ initial, onSave, onClose }: {
  initial: DailySchedule;
  onSave: (schedule: DailySchedule) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DailySchedule>(() => copySchedule(initial));
  const [error, setError] = useState("");

  function updateBlock(blockId: string, field: keyof TimeBlock, value: string) {
    setDraft((current) => ({
      ...current,
      timeBlocks: current.timeBlocks.map((block) => block.id === blockId ? { ...block, [field]: value } : block),
    }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const blocks = [...draft.timeBlocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (timeToMinutes(draft.workStartTime) >= timeToMinutes(draft.workEndTime)) {
      setError("作業終了は作業開始より後の時刻にしてください。");
      return;
    }
    if (blocks.some((block) => !block.category.trim() || !block.task.trim() || !block.completionCondition.trim())) {
      setError("各ブロックの分野・やること・完了条件を入力してください。");
      return;
    }
    if (blocks.some((block) => timeToMinutes(block.startTime) >= timeToMinutes(block.endTime))) {
      setError("各ブロックの終了時刻は開始時刻より後にしてください。");
      return;
    }
    if (blocks.some((block, index) => index > 0 && timeToMinutes(block.startTime) < timeToMinutes(blocks[index - 1].endTime))) {
      setError("時間ブロックが重なっています。時刻を調整してください。");
      return;
    }
    onSave({
      ...draft,
      topThree: draft.topThree.filter((task) => task.text.trim()).map((task) => ({ ...task, text: task.text.trim() })),
      timeBlocks: blocks.map((block) => ({
        ...block,
        category: block.category.trim(),
        task: block.task.trim(),
        completionCondition: block.completionCondition.trim(),
      })),
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="editor-header">
          <div>
            <span className="eyebrow">PLAN YOUR DAY</span>
            <h2 id="editor-title">{dateLabel(draft.date)}の時間割</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <form onSubmit={save}>
          <div className="editor-scroll">
            <section className="editor-section">
              <h3>1日の基本時刻</h3>
              <div className="time-input-grid">
                <label>起床予定<input type="time" required value={draft.wakeUpTime} onChange={(event) => setDraft({ ...draft, wakeUpTime: event.target.value })} /></label>
                <label>作業開始<input type="time" required value={draft.workStartTime} onChange={(event) => setDraft({ ...draft, workStartTime: event.target.value })} /></label>
                <label>作業終了<input type="time" required value={draft.workEndTime} onChange={(event) => setDraft({ ...draft, workEndTime: event.target.value })} /></label>
              </div>
            </section>
            <section className="editor-section">
              <div className="section-title-row"><h3>Today&apos;s 3</h3><span className="muted">最大3件</span></div>
              {draft.topThree.map((task, index) => (
                <div className="top-edit-row" key={task.id}>
                  <span className="row-number">0{index + 1}</span>
                  <input type="text" maxLength={100} placeholder="今日必ず終えること" value={task.text} onChange={(event) => setDraft({ ...draft, topThree: draft.topThree.map((item) => item.id === task.id ? { ...item, text: event.target.value } : item) })} />
                  <button type="button" className="subtle-icon" aria-label="項目を削除" onClick={() => setDraft({ ...draft, topThree: draft.topThree.filter((item) => item.id !== task.id) })}>×</button>
                </div>
              ))}
              {draft.topThree.length < 3 && <button type="button" className="add-button" onClick={() => setDraft({ ...draft, topThree: [...draft.topThree, { id: id(), text: "", completed: false }] })}>＋ やることを追加</button>}
            </section>
            <section className="editor-section">
              <div className="section-title-row"><h3>時間ブロック</h3><span className="muted">時間が重ならないように設定</span></div>
              {draft.timeBlocks.map((block, index) => (
                <div className="block-editor" key={block.id}>
                  <div className="block-editor-heading"><span>BLOCK {String(index + 1).padStart(2, "0")}</span><button type="button" className="text-button danger" onClick={() => setDraft({ ...draft, timeBlocks: draft.timeBlocks.filter((item) => item.id !== block.id) })}>削除</button></div>
                  <div className="block-editor-grid">
                    <label>開始<input type="time" required value={block.startTime} onChange={(event) => updateBlock(block.id, "startTime", event.target.value)} /></label>
                    <label>終了<input type="time" required value={block.endTime} onChange={(event) => updateBlock(block.id, "endTime", event.target.value)} /></label>
                    <label>分野<input type="text" required maxLength={40} placeholder="例：研究" value={block.category} onChange={(event) => updateBlock(block.id, "category", event.target.value)} /></label>
                    <label className="wide-field">やること<input type="text" required maxLength={120} placeholder="例：モデル実験を進める" value={block.task} onChange={(event) => updateBlock(block.id, "task", event.target.value)} /></label>
                    <label className="wide-field">完了条件<input type="text" required maxLength={120} placeholder="例：実験を1回完走" value={block.completionCondition} onChange={(event) => updateBlock(block.id, "completionCondition", event.target.value)} /></label>
                  </div>
                </div>
              ))}
              <button type="button" className="add-button" onClick={() => {
                const last = draft.timeBlocks.at(-1);
                setDraft({ ...draft, timeBlocks: [...draft.timeBlocks, blankBlock(last?.endTime || draft.workStartTime)] });
              }}>＋ 時間ブロックを追加</button>
            </section>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <div className="editor-footer"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button type="submit" className="primary-button">時間割を保存 <span>→</span></button></div>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const hydrated = useSyncExternalStore(subscribeHydration, getClientSnapshot, getServerSnapshot);
  const [schedules, setSchedules] = useState<ScheduleStore>(() => typeof window === "undefined" ? {} : readSchedules());
  const [today, setToday] = useState(() => localDate());
  const [selectedDate, setSelectedDate] = useState(() => localDate());
  const [clock, setClock] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClock(Date.now());
      const nextToday = localDate();
      setToday((oldToday) => {
        if (oldToday !== nextToday) setSelectedDate((date) => date === oldToday ? nextToday : date);
        return nextToday;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  }, [schedules, hydrated]);

  const schedule = schedules[selectedDate] ?? newSchedule(selectedDate);
  const blocks = useMemo(() => [...schedule.timeBlocks].sort((a, b) => a.startTime.localeCompare(b.startTime)), [schedule.timeBlocks]);
  const stats = scheduleStats(schedule);
  const isToday = selectedDate === today;
  const isTomorrow = selectedDate === addDays(today, 1);
  const hasPlan = !!schedules[selectedDate];
  const dueBlocks = isToday ? blocks.filter((block) => block.status === "pending" && blockTime(selectedDate, block.endTime) <= clock) : [];
  const nowBlock = isToday ? blocks.find((block) => block.status === "pending" && blockTime(selectedDate, block.startTime) <= clock && blockTime(selectedDate, block.endTime) > clock) : undefined;
  const nextBlock = isToday && !nowBlock ? blocks.find((block) => block.status === "pending" && blockTime(selectedDate, block.startTime) > clock) : undefined;
  const focusBlock = nowBlock ?? nextBlock;

  function saveSchedule(next: DailySchedule) {
    setSchedules((current) => ({ ...current, [next.date]: next }));
    setEditing(false);
  }

  function updateBlock(blockId: string, change: Partial<TimeBlock>) {
    setSchedules((current) => {
      const base = current[selectedDate] ?? newSchedule(selectedDate);
      return { ...current, [selectedDate]: { ...base, timeBlocks: base.timeBlocks.map((block) => block.id === blockId ? { ...block, ...change } : block) } };
    });
  }

  function setStatus(block: TimeBlock, status: BlockStatus) {
    updateBlock(block.id, { status, actualEnd: block.actualStart ? timeNow() : block.actualEnd, runState: "idle" });
  }

  function startBlock(block: TimeBlock) {
    updateBlock(block.id, { runState: "running", actualStart: block.actualStart || timeNow() });
  }

  function toggleTopTask(task: TopTask) {
    setSchedules((current) => {
      const base = current[selectedDate];
      if (!base) return current;
      return { ...current, [selectedDate]: { ...base, topThree: base.topThree.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item) } };
    });
  }

  if (!hydrated) return <main className="loading-screen">DAYFRAME</main>;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand"><span className="brand-mark"><i /><i /><i /><i /></span><span>DAYFRAME</span></div>
        <div className="header-right"><span className="header-caption">今日を、予定通りに。</span><span className="live-dot" /> <span className="header-clock">{new Date(clock).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</span></div>
      </header>

      <main className="main-content">
        <div className="page-topline"><span>PERSONAL DASHBOARD</span><span>01 / DAILY PLANNER</span></div>
        <div className="page-heading">
          <div><p className="eyebrow">YOUR DAY, BY DESIGN</p><h1>{isToday ? "今日の時間割" : isTomorrow ? "明日の時間割" : "時間割"}</h1><p className="date-heading">{dateLabel(selectedDate)}</p></div>
          <div className="heading-actions"><label className="date-picker-label">日付を選ぶ<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label><button className="primary-button" onClick={() => setEditing(true)}>{hasPlan ? "時間割を編集" : "時間割を作成"}<span>↗</span></button></div>
        </div>

        <nav className="date-tabs" aria-label="表示する日付"><button className={isToday ? "active" : ""} onClick={() => setSelectedDate(today)}>今日 <span>{today.slice(5).replace("-", "/")}</span></button><button className={isTomorrow ? "active" : ""} onClick={() => setSelectedDate(addDays(today, 1))}>明日 <span>{addDays(today, 1).slice(5).replace("-", "/")}</span></button></nav>

        <section className="overview-card" aria-label="1日の概要">
          <div className="overview-intro"><span className="eyebrow">DAILY OVERVIEW</span><strong>{isToday ? "今日の予定" : isTomorrow ? "明日の予定" : "この日の予定"}</strong><span className="muted">{blocks.length}つの時間ブロック</span></div>
          <div className="overview-item"><span>起床</span><strong>{hasPlan ? schedule.wakeUpTime : "--:--"}</strong></div>
          <div className="overview-item"><span>作業開始</span><strong>{hasPlan ? schedule.workStartTime : "--:--"}</strong></div>
          <div className="overview-item"><span>作業終了</span><strong>{hasPlan ? schedule.workEndTime : "--:--"}</strong></div>
          <div className="overview-score"><span>予定遵守率</span><strong>{blocks.length ? `${stats.adherence}%` : "—"}</strong><small>完了ブロックの割合</small></div>
        </section>

        {!hasPlan && <div className="empty-plan-banner"><div><strong>まだ時間割がありません</strong><span>やることと時間を決めて、1日の流れを作りましょう。</span></div><button className="outline-button" onClick={() => setEditing(true)}>時間割を作成 →</button></div>}

        {dueBlocks.length > 0 && <section className="due-panel" aria-label="終了した時間ブロック"><div className="due-heading"><span className="due-icon">!</span><div><strong>終了したブロックを判定してください</strong><p>未完了でも予定は後ろへずらしません。次のブロックから戻れます。</p></div></div><div className="due-list">{dueBlocks.map((block) => <div className="due-item" key={block.id}><span>{block.endTime} 終了 · {block.task}</span><div><button onClick={() => setStatus(block, "completed")}>完了</button><button onClick={() => setStatus(block, "failed")}>未完了</button></div></div>)}</div></section>}

        <div className="dashboard-grid">
          <div className="left-column">
            <section className="now-card" aria-label="現在の時間ブロック">
              <div className="card-topline"><span className="eyebrow light">{nowBlock ? "● NOW" : nextBlock ? "↗ UP NEXT" : "NOW"}</span><span>{isToday ? timeNow(new Date(clock)) : "DAILY PLAN"}</span></div>
              {focusBlock ? <>
                <div className="now-main"><p className="now-time">{focusBlock.startTime} <span>—</span> {focusBlock.endTime}</p><span className="now-category">{focusBlock.category}</span><h2>{focusBlock.task}</h2><div className="condition"><span>完了条件</span><p>{focusBlock.completionCondition}</p></div></div>
                {focusBlock.runState !== "idle" && <div className="timer-row"><div><span>終了予定まで</span><strong>{formatCountdown(blockTime(selectedDate, focusBlock.endTime) - clock)}</strong></div><Pill tone={focusBlock.runState === "paused" ? "amber" : "green"}>{focusBlock.runState === "paused" ? "一時停止中" : "進行中"}</Pill></div>}
                {nowBlock && <div className="now-actions">{focusBlock.runState !== "running" ? <button className="now-start" onClick={() => startBlock(focusBlock)}>{focusBlock.runState === "paused" ? "RESUME" : "START"} <span>→</span></button> : <button className="now-pause" onClick={() => updateBlock(focusBlock.id, { runState: "paused" })}>PAUSE</button>}<button className="now-complete" onClick={() => setStatus(focusBlock, "completed")}>完了</button><button className="now-failed" onClick={() => setStatus(focusBlock, "failed")}>未完了</button></div>}
                {nextBlock && <p className="next-note">開始時刻になると、このブロックを実行できます。</p>}
              </> : <div className="no-now"><span className="no-now-symbol">◎</span><h2>{!isToday ? "この日の予定を確認" : blocks.length ? "現在のブロックはありません" : "時間割を作成しましょう"}</h2><p>{isToday && blocks.length ? "予定を終えたら、今日の結果を振り返りましょう。" : "時間ブロックを設定すると、ここに次の予定が表示されます。"}</p>{!blocks.length && <button onClick={() => setEditing(true)}>時間割を作成 →</button>}</div>}
              <div className="now-footnote">予定が崩れても、次のブロックから再開。</div>
            </section>

            <section className="panel top-three-panel"><div className="panel-heading"><div><span className="eyebrow">PRIORITIES</span><h2>Today&apos;s 3</h2></div><span className="fraction">{stats.topCompleted}<span> / {stats.topTotal || 3}</span></span></div>
              {schedule.topThree.length ? <div className="top-three-list">{schedule.topThree.map((task, index) => <label className={`top-task ${task.completed ? "done" : ""}`} key={task.id}><input type="checkbox" checked={task.completed} disabled={!isToday} onChange={() => toggleTopTask(task)} /><span className="custom-check">✓</span><span className="top-task-text">{task.text}</span><span className="task-index">0{index + 1}</span></label>)}</div> : <div className="panel-empty">今日、必ず終えたいことを最大3つ設定できます。</div>}
              <button className="panel-link" onClick={() => setEditing(true)}>項目を編集 <span>↗</span></button>
            </section>
          </div>

          <div className="right-column">
            <section className="panel timetable-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR SCHEDULE</span><h2>{isToday ? "今日" : isTomorrow ? "明日" : "この日"}の時間割</h2></div><span className="block-count">{blocks.length} BLOCKS</span></div>
              {blocks.length ? <div className="timetable-list">{blocks.map((block, index) => {
                const active = isToday && blockTime(selectedDate, block.startTime) <= clock && blockTime(selectedDate, block.endTime) > clock;
                const ended = isToday && blockTime(selectedDate, block.endTime) <= clock;
                return <article className={`time-row ${active ? "active" : ""} ${block.status !== "pending" ? "settled" : ""}`} key={block.id}>
                  <div className="row-timeline"><span className="timeline-dot" /><span className="row-time">{block.startTime}</span><span className="row-end">{block.endTime}</span></div>
                  <div className="row-content"><div className="row-category"><span>{block.category}</span>{active && block.status === "pending" && <span className="active-tag">NOW</span>}</div><h3>{block.task}</h3><p>完了条件：{block.completionCondition}</p><div className="record-row"><label>実際の開始 <input type="time" value={block.actualStart} disabled={!isToday} onChange={(event) => updateBlock(block.id, { actualStart: event.target.value })} /></label><label>実際の終了 <input type="time" value={block.actualEnd} disabled={!isToday} onChange={(event) => updateBlock(block.id, { actualEnd: event.target.value })} /></label></div></div>
                  <div className="row-result"><Pill tone={block.status === "completed" ? "green" : block.status === "failed" ? "red" : ended ? "amber" : "neutral"}>{block.status === "completed" ? "完了" : block.status === "failed" ? "未完了" : ended ? "判定待ち" : "予定"}</Pill>{isToday && block.status === "pending" && <div className="row-actions"><button onClick={() => setStatus(block, "completed")} title="完了として記録">✓</button><button onClick={() => setStatus(block, "failed")} title="未完了として記録">×</button></div>}{isToday && block.status !== "pending" && <button className="undo-button" onClick={() => updateBlock(block.id, { status: "pending", actualEnd: "" })}>取り消す</button>}</div>
                  <span className="row-order">{String(index + 1).padStart(2, "0")}</span>
                </article>;
              })}</div> : <div className="timetable-empty"><span>＋</span><strong>ブロックがありません</strong><p>集中する時間と、その完了条件を決めましょう。</p><button onClick={() => setEditing(true)}>ブロックを追加 →</button></div>}
              {blocks.length > 0 && <div className="timetable-footer"><span>終了時刻を過ぎたブロックは判定待ちになります。</span><button onClick={() => setEditing(true)}>時間割を編集 ↗</button></div>}
            </section>
          </div>
        </div>

        {selectedDate <= today && <section className="result-panel"><div className="result-title"><span className="eyebrow">DAY IN REVIEW</span><h2>{isToday ? "今日" : "この日"}の振り返り</h2><p>予定通りにできたことを、シンプルに確認。</p></div><div className="result-stat"><span>時間ブロック完了</span><strong>{stats.completed}<small> / {stats.total}</small></strong></div><div className="result-stat"><span>予定通り開始 <sup>※</sup></span><strong>{stats.onTime}<small> / {stats.total}</small></strong></div><div className="result-stat"><span>Today&apos;s 3</span><strong>{stats.topCompleted}<small> / {stats.topTotal}</small></strong></div><div className="result-stat accent"><span>予定遵守率</span><strong>{blocks.length ? `${stats.adherence}%` : "—"}</strong></div><p className="result-note">※ 予定開始から5分以内に開始したブロック</p></section>}
        <footer className="site-footer"><span>DAYFRAME</span><span>小さな計画を、今日の行動に。</span><span>データはこのブラウザに保存されます</span></footer>
      </main>
      {editing && <ScheduleEditor initial={schedule} onSave={saveSchedule} onClose={() => setEditing(false)} />}
    </div>
  );
}
