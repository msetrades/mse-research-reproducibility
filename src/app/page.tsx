"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { buildArchive, completeness, fingerprintRun, reportMarkdown, sensitivityEffect, validateArchive, type ResearchRun, type SensitivityEntry } from "@/lib/research";

type Tab = "runs" | "sensitivity" | "integrity";
const RUNS = "researchtrace.runs.v1";
const SENSITIVITY = "researchtrace.sensitivity.v1";
const saveFile = (name: string, content: string, type: string) => { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function Home() {
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const [sensitivity, setSensitivity] = useState<SensitivityEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("runs");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [runModal, setRunModal] = useState(false);
  const [sensitivityModal, setSensitivityModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const savedRuns = localStorage.getItem(RUNS);
      const savedSensitivity = localStorage.getItem(SENSITIVITY);
      // Hydrate browser-only persistence after SSR to avoid a server/client mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedRuns) setRuns(JSON.parse(savedRuns) as ResearchRun[]);
      if (savedSensitivity) setSensitivity(JSON.parse(savedSensitivity) as SensitivityEntry[]);
    } catch { setNotice("Could not read local records. Import a valid ResearchTrace archive to restore them."); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(RUNS, JSON.stringify(runs)); }, [runs, ready]);
  useEffect(() => { if (ready) localStorage.setItem(SENSITIVITY, JSON.stringify(sensitivity)); }, [sensitivity, ready]);

  const current = runs.find((run) => run.id === selected) ?? runs[0] ?? null;
  const filtered = useMemo(() => runs.filter((run) => `${run.study} ${run.field} ${run.question} ${run.metric}`.toLowerCase().includes(query.toLowerCase())), [runs, query]);
  const meanScore = runs.length ? Math.round(runs.reduce((sum, run) => sum + completeness(run).score, 0) / runs.length) : 0;
  const groups = new Set(runs.map((run) => `${run.study.toLowerCase()}|${run.metric.toLowerCase()}|${run.unit.toLowerCase()}`)).size;

  async function recordRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    const draft = {
      study: String(form.get("study") ?? "").trim(), field: String(form.get("field") ?? "").trim(),
      question: String(form.get("question") ?? "").trim(), protocol: String(form.get("protocol") ?? "").trim(),
      dataSource: String(form.get("dataSource") ?? "").trim(), dataVersion: String(form.get("dataVersion") ?? "").trim(),
      codeUrl: String(form.get("codeUrl") ?? "").trim(), commit: String(form.get("commit") ?? "").trim(),
      environment: String(form.get("environment") ?? "").trim(), seed: String(form.get("seed") ?? "").trim(),
      metric: String(form.get("metric") ?? "").trim(), value: Number(form.get("value")), unit: String(form.get("unit") ?? "").trim(),
      limitations: String(form.get("limitations") ?? "").trim(), artifactUrl: String(form.get("artifactUrl") ?? "").trim(),
    };
    const base = { ...draft, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    try {
      const entry = { ...base, fingerprint: await fingerprintRun(base) };
      setRuns((rows) => [entry, ...rows]); setSelected(entry.id); setRunModal(false);
      setNotice(`Saved record fingerprint ${entry.fingerprint.slice(0, 16)}…`);
    } catch { setNotice("Could not fingerprint the record in this browser. Please use a secure browser context and retry."); }
    setSaving(false);
  }

  function recordSensitivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const entry: SensitivityEntry = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), study: String(form.get("study") ?? "").trim(),
      factor: String(form.get("factor") ?? "").trim(), unit: String(form.get("unit") ?? "").trim(),
      baselineInput: Number(form.get("baselineInput")), lowInput: Number(form.get("lowInput")), highInput: Number(form.get("highInput")),
      baselineOutput: Number(form.get("baselineOutput")), lowOutput: Number(form.get("lowOutput")), highOutput: Number(form.get("highOutput")),
    };
    if (entry.lowInput > entry.baselineInput || entry.baselineInput > entry.highInput) { setNotice("Input values must be ordered low, baseline, high."); return; }
    setSensitivity((rows) => [entry, ...rows]); setSensitivityModal(false); setNotice("Sensitivity comparison recorded.");
  }

  function exportArchive() { saveFile(`researchtrace-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildArchive(runs, sensitivity), null, 2), "application/json"); }
  async function importArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const incoming = validateArchive(JSON.parse(await file.text()));
      const runIds = new Set(runs.map((row) => row.id)); const sensitivityIds = new Set(sensitivity.map((row) => row.id));
      setRuns((rows) => [...incoming.runs.filter((row) => !runIds.has(row.id)), ...rows]);
      setSensitivity((rows) => [...incoming.sensitivity.filter((row) => !sensitivityIds.has(row.id)), ...rows]);
      setNotice(`Imported ${incoming.runs.length} run(s) and ${incoming.sensitivity.length} comparison(s); duplicate IDs were skipped.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Archive import failed."); }
    event.target.value = "";
  }

  const nav: [Tab, string, string][] = [["runs", "▤", "Research runs"], ["sensitivity", "⌁", "Sensitivity"], ["integrity", "◈", "Integrity checks"]];
  return <main className="shell">
    <aside className="rail"><a className="brand" href="#top"><span className="brand-mark">R<span>·</span></span><span><b>researchtrace</b><small>Reproducibility workspace</small></span></a><p className="rail-caption">WORKSPACE</p><nav>{nav.map(([id, icon, label]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? "nav active" : "nav"}><span>{icon}</span>{label}<i>{id === "runs" ? runs.length : id === "sensitivity" ? sensitivity.length : ""}</i></button>)}</nav><div className="rail-foot"><span className="privacy">◉ <span><b>Private by design</b><small>Saved in this browser</small></span></span><small>LOCAL WORKSPACE <b>v1.0</b></small></div></aside>
    <section className="main" id="top"><header className="topbar"><div><p className="crumb">MSE RESEARCH / <b>{tab.toUpperCase()}</b></p><span className="local-state">{ready ? "● LOCAL ARCHIVE READY" : "○ LOADING ARCHIVE"}</span></div><div className="tools"><label className="import">Import JSON<input type="file" accept="application/json,.json" onChange={importArchive} /></label><button className="button pale" disabled={!runs.length && !sensitivity.length} onClick={exportArchive}>Export archive</button><button className="button dark" onClick={() => setRunModal(true)}>＋ Record a run</button></div></header>
      <section className="intro"><div><p className="eyebrow">A RESEARCH RECORD YOU CAN HAND OFF</p><h1>Make results <em>reproducible.</em></h1><p>Capture the data, code, environment, protocol and caveats behind every result. Compare outcomes and preserve the exact record that produced them.</p></div><div className="seal"><small>RECORD INTEGRITY</small><b>SHA<br/>256</b><span>Metadata fingerprint</span></div></section>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
      <section className="stats"><Stat label="RECORDED RUNS" value={String(runs.length).padStart(2,"0")} note={`${new Set(runs.map((row) => row.study)).size} distinct studies`} /><Stat label="MEAN TRACEABILITY" value={`${meanScore}%`} note="Required provenance fields present" /><Stat label="SENSITIVITY CHECKS" value={String(sensitivity.length).padStart(2,"0")} note="Low / baseline / high comparisons" /><Stat label="COMPARABLE GROUPS" value={String(groups).padStart(2,"0")} note="Same study and metric" /></section>
      {tab === "runs" && <div className="columns"><section className="registry"><header className="panel-heading"><div><p className="eyebrow">EXPERIMENT REGISTER</p><h2>Research runs</h2></div><span className="count">{filtered.length} RECORDS</span></header><label className="search">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search study, field, question or metric" /></label><div className="run-list">{filtered.map((run) => { const score = completeness(run); return <button key={run.id} className={current?.id === run.id ? "run selected" : "run"} onClick={() => setSelected(run.id)}><div className="run-meta"><span>{run.field || "Unclassified"}</span><time>{date(run.createdAt)}</time></div><h3>{run.study}</h3><p>{run.question}</p><div className="run-bottom"><span><b>{run.metric}</b> {run.value} {run.unit}</span><small>{score.score}% TRACEABLE</small></div></button>; })}{ready && filtered.length === 0 && <Empty title="No research runs recorded" description="Start with a result you need to explain, reproduce or hand off. Capture its method and provenance in one structured record." action="Record your first run" onClick={() => setRunModal(true)} />}</div></section>
        <section className="detail">{current ? <><header className="detail-heading"><div><p className="eyebrow">RUN DETAIL / {current.field.toUpperCase()}</p><h2>{current.study}</h2></div><button className="icon" title="Download Markdown report" onClick={() => saveFile(`${current.study.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.md`, reportMarkdown(current), "text/markdown")}>↓</button></header><p className="question">{current.question}</p><div className="outcome"><small>RECORDED OUTCOME</small><b>{current.metric} <strong>{current.value}</strong> {current.unit}</b></div><section className="context"><h3>Reproduction context</h3><Info label="Protocol" value={current.protocol} /><Info label="Data source" value={current.dataSource} /><Info label="Data snapshot" value={current.dataVersion} /><Info label="Code / notebook" value={current.codeUrl} link /><Info label="Commit" value={current.commit} mono /><Info label="Environment" value={current.environment} /><Info label="Random seed" value={current.seed} mono /></section><div className="caveat"><b>Limitations & caveats</b><p>{current.limitations || "None recorded."}</p></div>{current.artifactUrl && <a className="artifact" href={current.artifactUrl} target="_blank" rel="noreferrer">↗ Open result artifact</a>}<div className="fingerprint"><small>RECORD FINGERPRINT · SHA-256</small><code>{current.fingerprint}</code><button onClick={() => navigator.clipboard.writeText(current.fingerprint)}>Copy</button></div><footer className="record-foot"><span>Recorded {date(current.createdAt)}</span><button onClick={() => { if (window.confirm("Remove this run from this browser?")) setRuns((rows) => rows.filter((row) => row.id !== current.id)); }}>Delete record</button></footer></> : <div className="blank-detail"><span>◈</span><h3>Research detail</h3><p>Select a run to review its provenance or record your first experiment.</p></div>}</section></div>}
      {tab === "sensitivity" && <section className="full-panel"><header className="panel-heading"><div><p className="eyebrow">ROBUSTNESS REVIEW</p><h2>Sensitivity register</h2><p>Record how key outcomes move when an assumption changes.</p></div><button className="button dark" onClick={() => setSensitivityModal(true)}>＋ Add comparison</button></header>{sensitivity.length ? <div className="table-wrap"><table><thead><tr><th>STUDY / FACTOR</th><th>INPUT RANGE</th><th>OUTPUT LOW</th><th>BASELINE</th><th>OUTPUT HIGH</th><th>OUTPUT SPAN</th></tr></thead><tbody>{sensitivity.map((item) => { const effect = sensitivityEffect(item); return <tr key={item.id}><td><b>{item.factor}</b><small>{item.study} · {item.unit}</small></td><td>{item.lowInput} – {item.highInput}<small>baseline {item.baselineInput}</small></td><td>{item.lowOutput}</td><td>{item.baselineOutput}</td><td>{item.highOutput}</td><td>{effect.absoluteOutputSpan > 0 ? "+" : ""}{effect.absoluteOutputSpan}<small>{effect.relativeOutputSpanPct === null ? "baseline zero" : `${effect.relativeOutputSpanPct.toFixed(1)}% of baseline`}</small></td></tr>; })}</tbody></table></div> : <Empty title="No sensitivity comparisons" description="Record low, baseline and high inputs with the observed output. This stores evidence; it does not pretend to rerun the underlying model." action="Record a comparison" onClick={() => setSensitivityModal(true)} />}<p className="note">Output span = high-case output − low-case output. Relative span divides by the absolute baseline output. This is descriptive sensitivity, not causal effect or a confidence interval.</p></section>}
      {tab === "integrity" && <section className="full-panel"><header className="panel-heading"><div><p className="eyebrow">TRACEABILITY AUDIT</p><h2>Integrity checks</h2><p>Find missing context before handing work to someone else.</p></div></header>{runs.length ? <div className="audit-list">{runs.map((run) => { const report = completeness(run); return <article className="audit-row" key={run.id}><b className="grade">{report.score}</b><span><strong>{run.study}</strong><small>{run.metric}: {run.value} {run.unit}</small><small>{report.missing.length ? `Missing: ${report.missing.join(" · ")}` : "All provenance fields are present"}</small></span><button className="text-button" onClick={() => { setSelected(run.id); setTab("runs"); }}>Review run ↗</button></article>; })}</div> : <Empty title="No records to audit" description="Integrity checks will appear after you create a run record." action="Record a run" onClick={() => setRunModal(true)} />}<div className="disclaimer"><b>What a fingerprint proves</b><p>SHA-256 detects changes to this saved metadata. It does not verify the experiment was executed, validate external data, authenticate a person or certify the result. Preserve code, data and artifacts separately.</p></div></section>}
      <footer className="page-foot"><span>RESEARCHTRACE / LOCAL-FIRST RESEARCH PROVENANCE</span><span>{ready ? "SAVED IN THIS BROWSER" : "LOADING LOCAL RECORDS"}</span></footer>
    </section>

    {runModal && <Dialog title="Record a research run" onClose={() => setRunModal(false)}><form className="record-form" onSubmit={recordRun}><div className="form-grid"><Field name="study" label="Study / experiment title" required placeholder="Regional demand forecast v2" /><Field name="field" label="Field / discipline" required placeholder="Climate, public health, AI…" /></div><Field name="question" label="Research question" required placeholder="What did this run test?" /><Area name="protocol" label="Protocol / method" required placeholder="Evaluation design, transformations and decisions" /><div className="form-grid"><Field name="dataSource" label="Data source" required placeholder="DOI, repository, file or URL" /><Field name="dataVersion" label="Data version / snapshot" required placeholder="Version, date or content hash" /><Field name="codeUrl" label="Code / notebook URL" placeholder="https://…" /><Field name="commit" label="Code commit / revision" placeholder="Git SHA or release tag" /><Field name="environment" label="Software environment" placeholder="Runtime and key package versions" /><Field name="seed" label="Random seed" placeholder="Seed or not applicable" /></div><div className="form-grid"><Field name="metric" label="Outcome metric" required placeholder="MAE, F1, RMSE…" /><Field name="value" label="Observed value" required type="number" /><Field name="unit" label="Unit" placeholder="%, kWh, points…" /><Field name="artifactUrl" label="Artifact URL" type="url" placeholder="Chart or report" /></div><Area name="limitations" label="Limitations / caveats" required placeholder="Known gaps, assumptions and validity risks" /><p className="form-note">A fingerprint is created from this exact record. Amendments should be saved as a new run, preserving the original record.</p><div className="modal-actions"><button type="button" className="button pale" onClick={() => setRunModal(false)}>Cancel</button><button className="button dark" disabled={saving}>{saving ? "Fingerprinting…" : "Save run record"}</button></div></form></Dialog>}
    {sensitivityModal && <Dialog title="Add sensitivity comparison" onClose={() => setSensitivityModal(false)}><form className="record-form" onSubmit={recordSensitivity}><Field name="study" label="Study" required placeholder="Study name" /><div className="form-grid"><Field name="factor" label="Input factor" required placeholder="Lookback window" /><Field name="unit" label="Input unit" placeholder="days, %, threshold…" /></div><div className="form-grid three"><Field name="lowInput" label="Low input" required type="number" /><Field name="baselineInput" label="Baseline input" required type="number" /><Field name="highInput" label="High input" required type="number" /></div><div className="form-grid three"><Field name="lowOutput" label="Output at low" required type="number" /><Field name="baselineOutput" label="Output at baseline" required type="number" /><Field name="highOutput" label="Output at high" required type="number" /></div><p className="form-note">Inputs must be ordered low ≤ baseline ≤ high. Output span is descriptive and does not imply causality.</p><div className="modal-actions"><button type="button" className="button pale" onClick={() => setSensitivityModal(false)}>Cancel</button><button className="button dark">Save comparison</button></div></form></Dialog>}
  </main>;
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) { return <article className="stat"><small>{label}</small><b>{value}</b><span>{note}</span></article>; }
function Empty({ title, description, action, onClick }: { title: string; description: string; action: string; onClick: () => void }) { return <div className="empty"><div className="empty-icon">R<span>·</span></div><h3>{title}</h3><p>{description}</p><button className="button dark" onClick={onClick}>{action}</button><small>No sample data is inserted. Your workspace starts empty.</small></div>; }
function Info({ label, value, link = false, mono = false }: { label: string; value: string; link?: boolean; mono?: boolean }) { return <div className="info"><dt>{label}</dt><dd className={mono ? "mono" : ""}>{link && value ? <a href={value} target="_blank" rel="noreferrer">{value} ↗</a> : value || <i>Not recorded</i>}</dd></div>; }
function Field({ name, label, required = false, placeholder = "", type = "text" }: { name: string; label: string; required?: boolean; placeholder?: string; type?: string }) { return <label className="field">{label}<input name={name} type={type} placeholder={placeholder} required={required} step={type === "number" ? "any" : undefined} /></label>; }
function Area({ name, label, required = false, placeholder = "" }: { name: string; label: string; required?: boolean; placeholder?: string }) { return <label className="field">{label}<textarea name={name} rows={3} placeholder={placeholder} required={required} /></label>; }
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true"><header><div><p className="eyebrow">RESEARCHTRACE / NEW RECORD</p><h2>{title}</h2></div><button className="icon" onClick={onClose} aria-label="Close">×</button></header>{children}</section></div>; }
