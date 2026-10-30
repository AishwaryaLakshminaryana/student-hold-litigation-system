import React, { FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Scale,
  Files,
  CheckSquare,
  Bell,
  Search,
  Settings,
  Menu,
  X,
} from "lucide-react";

const API = "http:" + "//localhost:4000/api";
type Tab = "Dashboard" | "Students" | "Holds" | "Matters" | "Tasks" | "Audit";
type Institution = { id: string; name: string };
type StudentForm = {
  legalName: string;
  preferredName: string;
  email: string;
  phone: string;
  mailingAddress: string;
  institutionId: string;
  studentRef: string;
  program: string;
  enrollmentStatus: string;
  preferredContact: string;
  consentStatus: string;
  conflictStatus: string;
  notes: string;
};

const emptyStudent: StudentForm = {
  legalName: "",
  preferredName: "",
  email: "",
  phone: "",
  mailingAddress: "",
  institutionId: "",
  studentRef: "",
  program: "",
  enrollmentStatus: "Active",
  preferredContact: "Email",
  consentStatus: "Documented",
  conflictStatus: "Pending",
  notes: "",
};

const items: [Tab, React.ComponentType<{ size?: number } >][] = [
  ["Dashboard", LayoutDashboard],
  ["Students", Users],
  ["Holds", ShieldAlert],
  ["Matters", Scale],
  ["Tasks", CheckSquare],
  ["Audit", Files],
];

function App() {
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [data, setData] = useState<any>(null);
  const [mobile, setMobile] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const loadData = async () => {
    setData(null);
    try {
      const response = await fetch(`${API}/${tab.toLowerCase()}`);
      if (!response.ok) throw new Error("Unable to load records.");
      setData(await response.json());
    } catch (error) {
      setData({ error: error instanceof Error ? error.message : "API unavailable." });
    }
  };

  useEffect(() => {
    loadData();
  }, [tab]);

  const newRecord = () => {
    if (tab === "Students") setShowStudentForm(true);
    else alert(`The New ${tab} workflow will be implemented in the next feature.`);
  };

  return (
    <div className="shell">
      <aside className={mobile ? "open" : ""}>
        <div className="brand">
          <div className="mark">SH</div>
          <div><strong>Student Hold</strong><small>Litigation Tracking</small></div>
        </div>
        <nav>
          {items.map(([name, Icon]) => (
            <button key={name} className={tab === name ? "active" : ""}
              onClick={() => { setTab(name); setMobile(false); }}>
              <Icon size={19} />{name}
            </button>
          ))}
        </nav>
        <div className="sidefoot"><Settings size={18} />System settings</div>
      </aside>

      <main>
        <header>
          <button className="hamb" onClick={() => setMobile(!mobile)} aria-label="Open navigation"><Menu /></button>
          <div className="search"><Search size={18} /><input aria-label="Global search" placeholder="Search students, holds, matters..." /></div>
          <div className="dev">Development authentication</div>
          <Bell />
          <div className="avatar">AM</div>
        </header>

        <section className="content">
          <div className="title">
            <div><p>Workspace / {tab}</p><h1>{tab}</h1></div>
            <button className="primary" onClick={newRecord}>+ New {tab === "Students" ? "Student" : "record"}</button>
          </div>
          {data?.error ? <div className="alert">{data.error}</div> :
            selectedStudentId ? <StudentProfile studentId={selectedStudentId}/>: tab === "Dashboard" ? <Dashboard d={data} /> : <Records tab={tab} d={data} setSelectedStudentId={setSelectedStudentId}/>}
        </section>
      </main>

      {showStudentForm && (
        <StudentModal
          onClose={() => setShowStudentForm(false)}
          onSaved={async () => {
            setShowStudentForm(false);
            setTab("Students");
            await loadData();
          }}
        />
      )}
    </div>
  );
}

function StudentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<StudentForm>(emptyStudent);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/institutions`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((rows: Institution[]) => {
        setInstitutions(rows);
        if (rows.length) setForm(current => ({ ...current, institutionId: rows[0].id }));
      })
      .catch(() => setError("Could not load institutions."));
  }, []);

  const update = (field: keyof StudentForm, value: string) =>
    setForm(current => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!form.legalName.trim() || !form.institutionId) {
      setError("Full legal name and institution are required.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Unable to create student.");
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create student.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modalBackdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="student-form-title">
        <div className="modalHeader">
          <div><p>Student intake</p><h2 id="student-form-title">New Student</h2></div>
          <button className="iconButton" onClick={onClose} aria-label="Close form"><X /></button>
        </div>
        <form onSubmit={submit}>
          {error && <div className="alert">{error}</div>}
          <div className="formGrid">
            <Field label="Full legal name" required value={form.legalName} onChange={v => update("legalName", v)} />
            <Field label="Preferred name" value={form.preferredName} onChange={v => update("preferredName", v)} />
            <Field label="Email" type="email" value={form.email} onChange={v => update("email", v)} />
            <Field label="Phone" value={form.phone} onChange={v => update("phone", v)} />
            <Field label="Mailing address" wide value={form.mailingAddress} onChange={v => update("mailingAddress", v)} />
            <label>Institution <span>*</span>
              <select value={form.institutionId} onChange={e => update("institutionId", e.target.value)} required>
                <option value="">Select institution</option>
                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </label>
            <Field label="Student ID" value={form.studentRef} onChange={v => update("studentRef", v)} />
            <Field label="Program" value={form.program} onChange={v => update("program", v)} />
            <Field label="Enrollment status" value={form.enrollmentStatus} onChange={v => update("enrollmentStatus", v)} />
            <label>Preferred communication
              <select value={form.preferredContact} onChange={e => update("preferredContact", e.target.value)}>
                <option>Email</option><option>Phone</option><option>Mail</option>
              </select>
            </label>
            <label>Consent / representation
              <select value={form.consentStatus} onChange={e => update("consentStatus", e.target.value)}>
                <option>Documented</option><option>Pending</option><option>Not represented</option>
              </select>
            </label>
            <label>Conflict check
              <select value={form.conflictStatus} onChange={e => update("conflictStatus", e.target.value)}>
                <option>Pending</option><option>Cleared</option><option>Conflict identified</option>
              </select>
            </label>
            <label className="wide">Notes
              <textarea rows={4} value={form.notes} onChange={e => update("notes", e.target.value)} />
            </label>
          </div>
          <div className="modalActions">
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? "Saving..." : "Save Student"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false, wide = false }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; wide?: boolean;
}) {
  return <label className={wide ? "wide" : ""}>{label} {required && <span>*</span>}
    <input type={type} value={value} required={required} onChange={e => onChange(e.target.value)} />
  </label>;
}

function Dashboard({ d }: any) {
  if (!d) return <p>Loading…</p>;
  const labels: any = { active: "Active holds", verify: "Awaiting verification", legal: "Legal review", its: "ITS follow-up", overdue: "Overdue tasks", alerts: "Related-matter alerts" };
  return <><div className="cards">{Object.entries(d.cards || {}).map(([k, v]) => <div className="card" key={k}><span>{labels[k]}</span><b>{String(v)}</b><small>Open filtered view →</small></div>)}</div><div className="panel"><div className="panelhead"><h2>Recently updated holds</h2><button>View all</button></div><RecordTable rows={d.recent || []} /></div></>;
}

function Records({ tab, d, setSelectedStudentId }: any) {
  if (!d) return <p>Loading…</p>;
  const rows = Array.isArray(d) ? d : [];
  const openStudent = (id: string) => {setSelectedStudentId(id);};
  return <div className="panel"><div className="panelhead"><h2>{rows.length} records</h2><button>Filter</button></div><RecordTable rows={rows} onRowClick={tab === "Students"? openStudent : undefined} />{!rows.length && <div className="empty">No records in this view.</div>}</div>;
}

type StudentProfileData = {id: string; clientId: string; legalName: string; preferredName?: string| null; email?: string| null; phone?: string| null; institution?: {name:string}|null; holds?: any[]; matters?: any[]; tasks?: any[]; communications?: any[];};

function StudentProfile({ studentId}: { studentId: string}) {
  const [student, setStudent] = useState<StudentProfileData | null>(null);
  useEffect(()=> {fetch(`${API}/students/${studentId}`)
.then((response)=> response.json())
.then((data)=>setStudent(data));
},[studentId]);
if(!student)return
<p>Loading student Profiler...</p>;
;
  return <div className="panel"><h2>{student.legalName}</h2><p>
    <b>Client Id:</b>{student.clientId}</p><p><b>Email:</b>{student.email ||"-"}</p><p><b>Phone:</b>{student.phone ||"-"}</p><p><b>Institution:</b>{student.institution?.name ||"-"}</p></div>;
}

function RecordTable({ rows, onRowClick }: { rows: any[]; onRowClick?:(id:string)=> void }) {
  return <table><thead><tr><th>Record</th><th>Related party</th><th>Status / details</th><th>Updated / due</th></tr></thead><tbody>{rows.map((x: any) => <tr key={x.id} onClick={() => onRowClick?.(x.id)} style={{cursor: onRowClick ? "pointer" : "default"}}><td>{x.holdId || x.clientId || x.matterId || x.title || x.action}<small>{x.name || x.legalName || x.recordType}</small></td><td>{x.student?.legalName || x.institution?.name || x.actor?.name || "—"}</td><td>{x.status ? <Status s={x.status} /> : x.role || x.matchReason || x.department || "—"}</td><td>{(x.updatedAt || x.dueDate || x.createdAt || "").slice(0, 10)}</td></tr>)}</tbody></table>;
}

const Status = ({ s }: { s: string }) => <span className="status">● {s.replaceAll("_", " ")}</span>;
createRoot(document.getElementById("root")!).render(<App />);
