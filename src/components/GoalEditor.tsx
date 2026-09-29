"use client";

import { useState } from "react";
import { updatePrimaryGoal, type PrimaryGoal } from "@/lib/schedule";

export default function GoalEditor({ initial, onSave, onClose }: {
  initial: PrimaryGoal;
  onSave: (goal: PrimaryGoal) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PrimaryGoal>(() => ({ ...initial, metrics: initial.metrics.map((metric) => ({ ...metric })) }));
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.metrics.length && !draft.title.trim()) {
      setError("主要目標の名前を入力してください。");
      return;
    }
    if (draft.metrics.some((metric) => !metric.label.trim())) {
      setError("数値項目の名前を入力してください。");
      return;
    }
    onSave(updatePrimaryGoal(initial, {
      title: draft.title.trim(),
      period: draft.period.trim(),
      metrics: draft.metrics.map((metric) => ({ ...metric, label: metric.label.trim(), unit: metric.unit.trim() })),
    }));
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="editor goal-editor" role="dialog" aria-modal="true" aria-labelledby="goal-editor-title">
      <div className="editor-header"><div><span className="eyebrow">ONE PRIMARY GOAL</span><h2 id="goal-editor-title">Weekly Progress の設定</h2></div><button type="button" className="icon-button" aria-label="閉じる" onClick={onClose}>×</button></div>
      <form onSubmit={submit}><div className="editor-scroll">
        <p className="df-editor-note">数値化するのは、今期の主要目標1つだけ。各週には、その週末時点の累計値を記録します。</p>
        <section className="editor-section df-goal-basics"><label>目標名<input type="text" maxLength={100} placeholder="例：Web制作の受注を増やす" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>期間名（任意）<input type="text" maxLength={40} placeholder="例：2026 Q4" value={draft.period} onChange={(event) => setDraft({ ...draft, period: event.target.value })} /></label></section>
        {initial.period !== draft.period.trim() && Object.values(initial.weeklyValues).some((values) => Object.keys(values).length > 0) && <p className="df-goal-period-note">期間を変更すると、今の累計は履歴に保存され、新しい期間は空欄から始まります。</p>}
        <section className="editor-section"><div className="section-title-row"><h3>追いかける数値</h3><span className="muted">最大6項目</span></div>
          {draft.metrics.map((metric) => <div className="df-metric-editor" key={metric.id}>
            <label>項目<input type="text" maxLength={50} placeholder="例：営業送信" value={metric.label} onChange={(event) => setDraft({ ...draft, metrics: draft.metrics.map((item) => item.id === metric.id ? { ...item, label: event.target.value } : item) })} /></label>
            <label>単位<input type="text" maxLength={12} placeholder="件・円など" value={metric.unit} onChange={(event) => setDraft({ ...draft, metrics: draft.metrics.map((item) => item.id === metric.id ? { ...item, unit: event.target.value } : item) })} /></label>
            <label>期間の目標値（任意）<input type="number" min="0" step="any" placeholder="未設定" value={metric.target ?? ""} onChange={(event) => setDraft({ ...draft, metrics: draft.metrics.map((item) => item.id === metric.id ? { ...item, target: event.target.value === "" ? null : Number(event.target.value) } : item) })} /></label>
            <button type="button" className="subtle-icon" aria-label={`${metric.label || "項目"}を削除`} onClick={() => setDraft({ ...draft, metrics: draft.metrics.filter((item) => item.id !== metric.id) })}>×</button>
          </div>)}
          {draft.metrics.length < 6 && <button type="button" className="add-button" onClick={() => setDraft({ ...draft, metrics: [...draft.metrics, { id: crypto.randomUUID(), label: "", unit: "", target: null }] })}>＋ 数値項目を追加</button>}
        </section>
        {initial.history.length > 0 && <section className="editor-section df-goal-history"><details><summary>過去の目標・週次記録（{initial.history.length}件）</summary>{initial.history.map((goal, index) => <div className="df-goal-history-item" key={index}><strong>{goal.period || "期間未設定"} · {goal.title}</strong>{Object.entries(goal.weeklyValues).sort(([a], [b]) => a.localeCompare(b)).map(([week, values]) => <p key={week}>{week}：{goal.metrics.filter((metric) => Object.hasOwn(values, metric.id)).map((metric) => `${metric.label} ${values[metric.id]}${metric.unit}`).join(" / ")}</p>)}</div>)}</details></section>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div><div className="editor-footer"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button type="submit" className="primary-button">設定を保存 →</button></div></form>
    </div>
  </div>;
}
