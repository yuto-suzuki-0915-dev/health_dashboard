"use client";

import { useState } from "react";
import { dateLabel, timeToMinutes, type DailySchedule, type TimeBlock } from "@/lib/schedule";

const newId = () => crypto.randomUUID();

function blankBlock(startTime: string): TimeBlock {
  const end = Math.min(timeToMinutes(startTime) + 60, 23 * 60 + 59);
  return {
    id: newId(),
    startTime,
    endTime: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`,
    category: "",
    task: "",
    completionCondition: "",
    status: "pending",
    actualStart: "",
    actualEnd: "",
    actualTask: "",
    runState: "idle",
  };
}

export default function ScheduleEditor({ initial, onSave, onClose }: {
  initial: DailySchedule;
  onSave: (schedule: DailySchedule) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DailySchedule>(() => ({
    ...initial,
    priority: initial.priority ?? initial.topThree[0]?.text ?? "",
    topThree: initial.topThree.map((task) => ({ ...task })),
    timeBlocks: initial.timeBlocks.map((block) => ({ ...block })),
  }));
  const [error, setError] = useState("");

  function updateBlock(blockId: string, change: Partial<TimeBlock>) {
    setDraft((current) => ({
      ...current,
      timeBlocks: current.timeBlocks.map((block) => block.id === blockId ? { ...block, ...change } : block),
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const blocks = [...draft.timeBlocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (timeToMinutes(draft.workStartTime) >= timeToMinutes(draft.workEndTime)) {
      setError("作業終了は作業開始より後にしてください。");
      return;
    }
    if (blocks.some((block) => timeToMinutes(block.startTime) >= timeToMinutes(block.endTime))) {
      setError("枠の終了時刻は開始時刻より後にしてください。");
      return;
    }
    if (blocks.some((block, index) => index > 0 && timeToMinutes(block.startTime) < timeToMinutes(blocks[index - 1].endTime))) {
      setError("時間枠が重なっています。");
      return;
    }
    if (blocks.some((block) => block.kind !== "break" && ((!block.templateSlotId && !block.task.trim()) || (block.category.trim() && !block.task.trim())))) {
      setError("臨時枠と分野を入力した枠には、予定の内容を入れてください。");
      return;
    }
    onSave({
      ...draft,
      priority: draft.priority?.trim() ?? "",
      timeBlocks: blocks.map((block) => ({
        ...block,
        category: block.category.trim(),
        task: block.task.trim(),
        completionCondition: block.completionCondition.trim(),
      })),
    });
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="editor" role="dialog" aria-modal="true" aria-labelledby="schedule-editor-title">
      <div className="editor-header"><div><span className="eyebrow">DAY PLAN</span><h2 id="schedule-editor-title">{dateLabel(draft.date)}の予定</h2></div><button type="button" className="icon-button" aria-label="閉じる" onClick={onClose}>×</button></div>
      <form onSubmit={submit}>
        <div className="editor-scroll">
          <section className="editor-section"><h3>1日の基本時刻</h3><div className="time-input-grid">
            <label>起床<input type="time" required value={draft.wakeUpTime} onChange={(event) => setDraft({ ...draft, wakeUpTime: event.target.value })} /></label>
            <label>作業開始<input type="time" required value={draft.workStartTime} onChange={(event) => setDraft({ ...draft, workStartTime: event.target.value })} /></label>
            <label>作業終了<input type="time" required value={draft.workEndTime} onChange={(event) => setDraft({ ...draft, workEndTime: event.target.value })} /></label>
          </div></section>
          <section className="editor-section"><h3>Today&apos;s Priority</h3><label>今日、一番前に進めること<input type="text" maxLength={140} placeholder="例：最優先の成果を1つ" value={draft.priority ?? ""} onChange={(event) => setDraft({ ...draft, priority: event.target.value })} /></label></section>
          <section className="editor-section"><div className="section-title-row"><h3>時間割</h3><span className="muted">曜日ごとの固定枠を使用</span></div>
            {draft.timeBlocks.map((block, index) => <div className={`block-editor ${block.kind === "break" ? "break-editor" : ""}`} key={block.id}>
              <div className="block-editor-heading"><span>{block.slotLabel || `臨時枠 ${index + 1}`} · {block.startTime}–{block.endTime}</span>{!block.templateSlotId && <button type="button" className="text-button danger" onClick={() => setDraft({ ...draft, timeBlocks: draft.timeBlocks.filter((item) => item.id !== block.id) })}>削除</button>}</div>
              {block.kind === "break" ? <p className="break-editor-note">休憩枠</p> : <div className="block-editor-grid">
                {!block.templateSlotId && <><label>開始<input type="time" required value={block.startTime} onChange={(event) => updateBlock(block.id, { startTime: event.target.value })} /></label><label>終了<input type="time" required value={block.endTime} onChange={(event) => updateBlock(block.id, { endTime: event.target.value })} /></label></>}
                <label>分野<input type="text" maxLength={40} placeholder="例：研究" value={block.category} onChange={(event) => updateBlock(block.id, { category: event.target.value })} /></label>
                <label className="wide-field">予定<input type="text" maxLength={140} placeholder="例：モデル実験" value={block.task} onChange={(event) => updateBlock(block.id, { task: event.target.value })} /></label>
                <label className="wide-field">完了条件（任意）<input type="text" maxLength={140} placeholder="例：実験を1回完走" value={block.completionCondition} onChange={(event) => updateBlock(block.id, { completionCondition: event.target.value })} /></label>
              </div>}
            </div>)}
            <button type="button" className="add-button" onClick={() => {
              const lastEnd = draft.timeBlocks.reduce((latest, block) => block.endTime > latest ? block.endTime : latest, draft.workStartTime);
              setDraft({ ...draft, timeBlocks: [...draft.timeBlocks, blankBlock(lastEnd)] });
            }}>＋ この日だけの枠を追加</button>
          </section>
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <div className="editor-footer"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button type="submit" className="primary-button">予定を保存 →</button></div>
      </form>
    </div>
  </div>;
}
