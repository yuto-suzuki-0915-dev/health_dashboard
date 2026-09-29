"use client";

import { useState } from "react";
import { timeToMinutes, WEEKDAY_LABELS, type FixedSlot, type WeekTemplate } from "@/lib/schedule";

const newId = () => crypto.randomUUID();

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function cloneTemplate(template: WeekTemplate): WeekTemplate {
  return Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, (template[day] ?? []).map((slot) => ({ ...slot }))])) as WeekTemplate;
}

export default function WeekTemplateEditor({ initial, initialDay, onSave, onClose }: {
  initial: WeekTemplate;
  initialDay: number;
  onSave: (template: WeekTemplate) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => cloneTemplate(initial));
  const [day, setDay] = useState(initialDay);
  const [error, setError] = useState("");
  const slots = draft[day] ?? [];

  function updateSlot(slotId: string, patch: Partial<FixedSlot>) {
    setDraft((current) => ({
      ...current,
      [day]: current[day].map((slot) => slot.id === slotId ? { ...slot, ...patch } : slot),
    }));
  }

  function addSlot() {
    const last = slots.at(-1);
    const startMinutes = last ? Math.min(timeToMinutes(last.endTime) + 10, 22 * 60) : 8 * 60 + 50;
    const slot: FixedSlot = {
      id: newId(),
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(startMinutes + 90),
      label: `${slots.filter((item) => item.kind === "work").length + 1}限`,
      kind: "work",
    };
    setDraft((current) => ({ ...current, [day]: [...slots, slot] }));
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    for (let weekday = 0; weekday < 7; weekday++) {
      const ordered = [...draft[weekday]].sort((a, b) => a.startTime.localeCompare(b.startTime));
      if (ordered.some((slot) => !slot.label.trim() || timeToMinutes(slot.startTime) >= timeToMinutes(slot.endTime))) {
        setDay(weekday);
        setError("枠の名前と、開始より後の終了時刻を設定してください。");
        return;
      }
      if (ordered.some((slot, index) => index > 0 && timeToMinutes(slot.startTime) < timeToMinutes(ordered[index - 1].endTime))) {
        setDay(weekday);
        setError("時間枠が重なっています。時刻を調整してください。");
        return;
      }
    }
    onSave(Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => [weekday, [...draft[weekday]].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((slot) => ({ ...slot, label: slot.label.trim() }))])) as WeekTemplate);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="editor template-editor" role="dialog" aria-modal="true" aria-labelledby="template-title">
        <div className="editor-header">
          <div><span className="eyebrow">WEEKLY FRAMEWORK</span><h2 id="template-title">固定の時間枠を設定</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <form onSubmit={save}>
          <div className="editor-scroll">
            <p className="template-intro">曜日ごとの時刻と休憩を先に決めます。授業や作業の内容は、「予定を立てる」で日付ごとに入力します。</p>
            <div className="weekday-tabs" role="tablist" aria-label="曜日">
              {WEEKDAY_LABELS.map((label, index) => <button type="button" role="tab" aria-selected={day === index} className={day === index ? "active" : ""} key={index} onClick={() => { setDay(index); setError(""); }}>{label}</button>)}
            </div>
            <div className="template-toolbar"><strong>{WEEKDAY_LABELS[day]}曜日の枠</strong><button type="button" className="text-button" onClick={() => setDraft((current) => Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => [weekday, current[day].map((slot) => ({ ...slot }))])) as WeekTemplate)}>この枠組みを全曜日にコピー</button></div>
            {slots.length ? <div className="template-slots">{slots.map((slot, index) => <div className="template-slot" key={slot.id}>
              <span className="template-slot-number">{String(index + 1).padStart(2, "0")}</span>
              <label>開始<input type="time" required value={slot.startTime} onChange={(event) => updateSlot(slot.id, { startTime: event.target.value })} /></label>
              <label>終了<input type="time" required value={slot.endTime} onChange={(event) => updateSlot(slot.id, { endTime: event.target.value })} /></label>
              <label className="slot-label">枠の名前<input type="text" required maxLength={30} placeholder="例：1限、昼休み" value={slot.label} onChange={(event) => updateSlot(slot.id, { label: event.target.value })} /></label>
              <label className="slot-type">種類<select value={slot.kind} onChange={(event) => updateSlot(slot.id, { kind: event.target.value as FixedSlot["kind"] })}><option value="work">授業・作業</option><option value="break">休憩</option></select></label>
              <button type="button" className="subtle-icon" aria-label={`${slot.label}を削除`} onClick={() => setDraft((current) => ({ ...current, [day]: current[day].filter((item) => item.id !== slot.id) }))}>×</button>
            </div>)}</div> : <p className="template-empty">この曜日にはまだ固定枠がありません。</p>}
            <button type="button" className="add-button" onClick={addSlot}>＋ 固定枠を追加</button>
            <p className="template-note">保存済みの日別記録は変更されません。未作成の日から新しい枠組みが表示されます。</p>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <div className="editor-footer"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button type="submit" className="primary-button">固定枠を保存 <span>→</span></button></div>
        </form>
      </div>
    </div>
  );
}
