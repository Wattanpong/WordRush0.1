// src/pages/AdminWords.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPost, apiDelete } from "../api";

const LEVELS = [
  { value: "easy",   label: "ง่าย",  pill: { bg: "#ecfdf5", fg: "#065f46", bd: "#a7f3d0"} },
  { value: "normal", label: "กลาง",  pill: { bg: "#eff6ff", fg: "#1e3a8a", bd: "#bfdbfe"} },
  { value: "hard",   label: "ยาก",   pill: { bg: "#fef2f2", fg: "#991b1b", bd: "#fecaca"} },
];
const LV_SET = new Set(LEVELS.map(l=>l.value));

export default function AdminWords() {
  const { token = "" } = useAuth() || {};

  const [level, setLevel] = useState("easy");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ term: "", level: "easy", hint: "" });
  const [adding, setAdding] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkSummary, setBulkSummary] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadSummary, setUploadSummary] = useState("");

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const searchTimer = useRef(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQ(search.trim().toLowerCase()), 220);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [search]);

  const fetchWords = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    setError("");
    try {
      const data = await apiGet(`/api/words?level=${encodeURIComponent(level)}`, token);
      if (!cancelled) {
        const arr = Array.isArray(data) ? data : data?.data ?? [];
        setList(arr);
      }
    } catch {
      if (!cancelled) setError("โหลดรายการคำศัพท์ไม่สำเร็จ");
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, [level, token]);

  useEffect(() => {
    const cleanup = fetchWords();
    return () => { if (typeof cleanup === "function") cleanup(); };
  }, [fetchWords]);

  const filtered = useMemo(() => {
    if (!q) return list;
    return list.filter(w =>
      String(w.term || "").toLowerCase().includes(q) ||
      String(w.hint || "").toLowerCase().includes(q)
    );
  }, [list, q]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setToast(""); setError("");
    const term = form.term.trim();
    const hint = form.hint.trim();
    if (!term) { setError("กรุณากรอกคำศัพท์"); return; }

    setAdding(true);
    try {
      await apiPost("/api/words", { term, level: form.level, hint: hint || undefined }, token);
      setForm(f => ({ ...f, term: "", hint: "" }));
      setToast("เพิ่มคำศัพท์เรียบร้อย");
      await fetchWords();
    } catch (e) {
      const status = e?.status ?? e?.response?.status ?? "";
      const msg = String(e?.message || "");
      const conflict = status === 409 || /409|duplicate|exists/i.test(msg);
      setError(conflict ? "คำนี้มีอยู่แล้วในระดับนี้" : "เพิ่มคำศัพท์ไม่สำเร็จ");
    } finally {
      setAdding(false);
    }
  };
  const handleTermKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) onSubmit(e); };

  const parseBulk = (text) =>
    text.split(/\r?\n/).map(ln=>ln.trim()).filter(Boolean).map(ln=>{
      const byTab = ln.split("\t");
      if (byTab.length >= 2) return { term: byTab[0].trim(), hint: byTab.slice(1).join(" ").trim() };
      const byComma = splitCSVLine(ln);
      if (byComma.length >= 2) return { term: String(byComma[0]).trim(), hint: byComma.slice(1).join(",").trim() };
      return { term: ln, hint: "" };
    }).filter(o=>o.term);

  const onBulkSubmit = async (e) => {
    e.preventDefault();
    setToast(""); setBulkSummary(""); setError("");
    const items = parseBulk(bulkText);
    if (items.length === 0) { setError("กรุณาวางอย่างน้อย 1 บรรทัด"); return; }

    setBulkAdding(true);
    let ok=0, dup=0, fail=0;
    const levelToUse = form.level;

    const tasks = items.map(async ({ term, hint }) => {
      try {
        await apiPost("/api/words", { term, hint: hint || undefined, level: levelToUse }, token);
        ok++;
      } catch (e) {
        const status = e?.status ?? e?.response?.status ?? "";
        const msg = String(e?.message || "");
        const conflict = status === 409 || /409|duplicate|exists/i.test(msg);
        conflict ? dup++ : fail++;
      }
    });

    await Promise.allSettled(tasks);
    await fetchWords();
    setBulkSummary(`สำเร็จ ${ok} รายการ, ซ้ำ ${dup}, ล้มเหลว ${fail}`);
    if (ok > 0 && fail === 0) setToast("เพิ่มหลายคำเรียบร้อย");
    setBulkText("");
    setBulkAdding(false);
  };

  const detectDelimiter = (name, text) => {
    if (/\.(tsv)$/i.test(name)) return "\t";
    if (/\.(csv)$/i.test(name)) return ",";
    const first = (text.split(/\r?\n/)[0] || "");
    const comma = (first.match(/,/g) || []).length;
    const tab = (first.match(/\t/g) || []).length;
    return tab > comma ? "\t" : ",";
  };
  const stripBOM = (s) => (s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);

  function splitCSVLine(line, delimiter = ",") {
    const out = []; let cur = ""; let inQuotes = false;
    for (let i=0;i<line.length;i++){
      const c=line[i];
      if (c === '"'){
        if (inQuotes && line[i+1] === '"'){ cur+='"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === delimiter && !inQuotes){
        out.push(cur); cur="";
      } else cur+=c;
    }
    out.push(cur);
    return out;
  }

  const parseFileText = (text, delimiter) => {
    const lines = stripBOM(text).split(/\r?\n/).filter(ln=>ln.trim().length>0);
    if (!lines.length) return [];
    const first = lines[0];
    const cols = delimiter === "\t" ? first.split("\t") : splitCSVLine(first, delimiter);
    const hasHeader =
      cols.some(c=>/^(term|คำศัพท์)$/i.test(c.trim())) ||
      cols.some(c=>/^hint$/i.test(c.trim())) ||
      cols.some(c=>/^level$/i.test(c.trim()));
    let start = hasHeader ? 1 : 0;
    const header = hasHeader ? cols.map(c=>c.trim().toLowerCase()) : [];

    const records = [];
    for (let i=start;i<lines.length;i++){
      const raw = lines[i];
      const cells = delimiter === "\t" ? raw.split("\t") : splitCSVLine(raw, delimiter);
      let term="", hint="", lv="";
      if (hasHeader){
        header.forEach((h,idx)=>{
          const v = (cells[idx] ?? "").trim();
          if (h==="term"||h==="คำศัพท์") term=v;
          else if (h==="hint") hint=v;
          else if (h==="level") lv=v;
        });
      } else {
        term=(cells[0]??"").trim(); hint=(cells[1]??"").trim(); lv=(cells[2]??"").trim();
      }
      if (term) records.push({ term, hint, level: lv });
    }
    return records;
  };

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true); setUploadSummary(""); setError(""); setToast("");
    try {
      const text = await file.text();
      const delimiter = detectDelimiter(file.name, text);
      const rows = parseFileText(text, delimiter);
      if (!rows.length) { setError("ไฟล์ว่างหรือรูปแบบไม่ถูกต้อง"); setUploading(false); return; }

      let ok=0,dup=0,fail=0;
      const defaultLevel = form.level;
      const tasks = rows.map(async (r)=>{
        const lv = (r.level || "").trim().toLowerCase();
        const finalLevel = LV_SET.has(lv) ? lv : defaultLevel;
        try{
          await apiPost("/api/words",{ term:r.term, hint:r.hint||undefined, level: finalLevel }, token);
          ok++;
        }catch(e){
          const status = e?.status ?? e?.response?.status ?? "";
          const msg = String(e?.message || "");
          const conflict = status === 409 || /409|duplicate|exists/i.test(msg);
          conflict ? dup++ : fail++;
        }
      });

      await Promise.allSettled(tasks);
      await fetchWords();
      setUploadSummary(`อัปโหลดเสร็จ — สำเร็จ ${ok}, ซ้ำ ${dup}, ล้มเหลว ${fail}`);
      if (ok>0 && fail===0) setToast("อัปโหลดรายการเรียบร้อย");
    } catch {
      setError("อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("ลบคำนี้ใช่ไหม?")) return;
    const backup = list;
    setList(prev => prev.filter(x => x._id !== id));
    try {
      await apiDelete(`/api/words/${id}`, token);
      setToast("ลบแล้ว");
    } catch {
      setList(backup);
      alert("ลบไม่สำเร็จ");
    }
  };

  const curLv = LEVELS.find(l => l.value === level) || LEVELS[0];
  const total = list.length;
  const shown = filtered.length;
  const canSubmit = !!form.term.trim() && !adding;
  const hasBulk = bulkText.trim().length > 0;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.h1}>คำศัพท์ (Admin)</h1>
        <div style={S.kpis}>
          <div style={S.kpi}>
            <div style={S.kpiLabel}>ระดับที่กำลังแก้ไข</div>
            <div style={S.kpiValue}>
              <span style={{...S.pill, background:curLv.pill.bg, color:curLv.pill.fg, borderColor:curLv.pill.bd}}>
                {curLv.label}
              </span>
            </div>
          </div>
          <div style={S.kpi}><div style={S.kpiLabel}>ทั้งหมด</div><div style={S.kpiValue}>{total}</div></div>
          <div style={S.kpi}><div style={S.kpiLabel}>ที่แสดง</div><div style={S.kpiValue}>{shown}</div></div>
          <div style={S.kpi}><div style={S.kpiLabel}>สถานะ</div><div style={S.kpiValue}>{loading ? "กำลังโหลด..." : "พร้อมใช้งาน"}</div></div>
        </div>
      </div>

      <div style={S.toolbar}>
        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <span style={S.label}>ระดับ:</span>
          <div style={S.segment}>
            {LEVELS.map(lv => (
              <button key={lv.value} onClick={() => setLevel(lv.value)} style={{ ...S.segBtn, ...(level===lv.value ? S.segBtnActive : {}) }}>
                {lv.label}
              </button>
            ))}
          </div>
          <button onClick={fetchWords} style={S.btnGhost}>รีโหลด</button>
        </div>

        <div style={S.searchWrap}>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="ค้นหา term หรือ hint..." style={S.search} />
          <div style={S.searchInfo}>แสดง {shown}/{total}</div>
        </div>
      </div>

      <div style={S.modeBar}>
        <div>
          <button onClick={()=>setBulkMode(false)} style={{...S.tab, ...(bulkMode?{}:S.tabActive)}}>เพิ่มทีละคำ</button>
          <button onClick={()=>setBulkMode(true)}  style={{...S.tab, ...(bulkMode?S.tabActive:{})}}>เพิ่มหลายคำ</button>
        </div>

        <label style={S.upload}>
          <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={onFileSelected} disabled={uploading} style={{ display:"none" }} />
          <span>{uploading ? "กำลังอัปโหลด..." : "อัปโหลด CSV/TSV"}</span>
        </label>

        <div style={{flex:1}} />
        {(toast || uploadSummary) && (<span style={S.toast}>{uploadSummary || toast}</span>)}
      </div>

      {!bulkMode ? (
        <form onSubmit={onSubmit} style={S.card}>
          <div style={S.formGrid}>
            <div>
              <label style={S.formLabel}>คำศัพท์ (term)</label>
              <input value={form.term} onChange={(e)=>setForm(f=>({...f, term:e.target.value}))} onKeyDown={handleTermKeyDown} style={S.input} placeholder="เช่น keyboard (กด Enter เพื่อเพิ่ม)" required />
            </div>
            <div>
              <label style={S.formLabel}>ระดับ</label>
              <select value={form.level} onChange={(e)=>setForm(f=>({...f, level:e.target.value}))} style={S.select}>
                {LEVELS.map(lv=>(<option key={lv.value} value={lv.value}>{lv.label}</option>))}
              </select>
            </div>
            <div style={{ gridColumn:"1 / -1" }}>
              <label style={S.formLabel}>คำใบ้ (hint)</label>
              <input value={form.hint} onChange={(e)=>setForm(f=>({...f, hint:e.target.value}))} style={S.input} placeholder="(ไม่บังคับ)" />
            </div>
          </div>

          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button type="submit" style={{ ...S.btnPrimary, opacity: canSubmit ? 1 : .6 }} disabled={!canSubmit}>
              {adding ? "กำลังเพิ่ม..." : "เพิ่มคำศัพท์"}
            </button>
            {error && <span style={S.errorInline}>{error}</span>}
          </div>
        </form>
      ) : (
        <form onSubmit={onBulkSubmit} style={S.card}>
          <div style={S.formGrid2}>
            <div>
              <label style={S.formLabel}>ระดับเริ่มต้น (ใช้เมื่อบรรทัด/ไฟล์ไม่มี level)</label>
              <select value={form.level} onChange={(e)=>setForm(f=>({...f, level:e.target.value}))} style={S.select}>
                {LEVELS.map(lv=>(<option key={lv.value} value={lv.value}>{lv.label}</option>))}
              </select>
            </div>
            <div style={{ gridColumn:"1 / -1" }}>
              <label style={S.formLabel}>วางรายการ (1 บรรทัดต่อ 1 คำ)</label>
              <textarea value={bulkText} onChange={(e)=>setBulkText(e.target.value)} rows={8} style={S.textarea}
                placeholder={`ตัวอย่าง:
apple
keyboard,อุปกรณ์พิมพ์
strong determination\tคำยากระดับกลาง`} />
              <div style={S.hint}>รูปแบบ: <code>term</code> หรือ <code>term,hint</code> หรือ <code>term[TAB]hint</code></div>
            </div>
          </div>

          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button type="submit" style={{ ...S.btnPrimary, opacity: hasBulk && !bulkAdding ? 1 : .6 }} disabled={!hasBulk || bulkAdding}>
              {bulkAdding ? "กำลังเพิ่มหลายคำ..." : "เพิ่มหลายคำ"}
            </button>
            {bulkSummary && <span style={S.toast}>{bulkSummary}</span>}
            {error && <span style={S.errorInline}>{error}</span>}
          </div>
        </form>
      )}

      <div style={S.card}>
        <div style={S.tableHead}>
          <div style={{ flex: 2.2 }}>คำศัพท์</div>
          <div style={{ flex: 3   }}>คำใบ้</div>
          <div style={{ width: 120, textAlign:"center" }}>การจัดการ</div>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <div style={S.empty}>
            <div style={{fontSize:18, fontWeight:800, color:"#1e3a8a"}}>ไม่มีรายการ</div>
            <div style={{color:"#64748b"}}>ลองเปลี่ยนระดับ หรือค้นหาคำอื่น</div>
          </div>
        ) : (
          filtered.map((w, i) => (
            <div key={w._id || `${w.term}-${i}`} style={S.tableRow}>
              <div style={{ flex: 2.2, fontWeight:700, color:"#0f172a" }}>{w.term}</div>
              <div style={{ flex: 3, color:"#475569" }}>{w.hint || <span style={{opacity:.6}}>(ไม่มี)</span>}</div>
              <div style={{ width: 120, textAlign:"center" }}>
                <button style={S.btnDanger} onClick={()=>handleDelete(w._id)}>ลบ</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SkeletonRows({ rows = 6 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{...S.tableRow, opacity:.9}}>
          <Sk w={220} /><Sk w={360} />
          <div style={{ width:120, textAlign:"center" }}><Sk w={72} h={28} r={8} /></div>
        </div>
      ))}
    </div>
  );
}
function Sk({ w=120, h=14, r=6 }) {
  return (
    <span style={{
      display:"inline-block", width:w, height:h, borderRadius:r,
      background:"linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9)",
      backgroundSize:"200% 100%", animation:"shimmer 1.2s infinite",
      marginRight:12
    }}/>
  );
}

/* ============ Styles (กว้างขึ้น) ============ */
const S = {
  page:   { maxWidth: 1280, margin: "0 auto", padding: "28px 20px" },

  header: { background:"linear-gradient(180deg,#ffffff,#f7fbff)", border:"1px solid #e2e8f0", borderRadius:14, padding:18, marginBottom:16 },
  h1:     { margin:0, fontSize:24, color:"#0f172a" },

  kpis:   { display:"grid", gridTemplateColumns:"repeat(4, minmax(0,1fr))", gap:12, marginTop:12 },
  kpi:    { background:"#fff", border:"1px solid #eef2f7", borderRadius:12, padding:"12px 14px", boxShadow:"0 1px 0 rgba(16,24,40,.04)" },
  kpiLabel:{ fontSize:12.5, color:"#6b7280", letterSpacing:.2 },
  kpiValue:{ fontWeight:800, fontSize:18, marginTop:2, display:"flex", gap:8, alignItems:"center" },
  pill:   { padding:"4px 10px", borderRadius:999, border:"1px solid", fontSize:12.5, fontWeight:700 },

  toolbar:{ position:"sticky", top:8, zIndex:1, display:"flex", justifyContent:"space-between", gap:16, alignItems:"center",
            padding:14, background:"#ffffffcc", backdropFilter:"saturate(1.2) blur(2px)", border:"1px solid #e2e8f0",
            borderRadius:12, marginBottom:14 },
  label:  { color:"#334155", fontWeight:700 },
  segment:{ display:"flex", gap:10, background:"#eff6ff", padding:6, borderRadius:12 },
  segBtn: { border:"1px solid transparent", background:"transparent", padding:"9px 14px", borderRadius:10, fontWeight:700, color:"#1e40af", cursor:"pointer" },
  segBtnActive:{ background:"#dbeafe", borderColor:"#bfdbfe", color:"#1d4ed8" },
  btnGhost:{ background:"#fff", border:"1px solid #e2e8f0", padding:"9px 14px", borderRadius:10, cursor:"pointer", fontWeight:700, color:"#1e40af" },

  searchWrap:{ display:"flex", alignItems:"center", gap:12, minWidth:360, width: "min(520px, 40vw)" },
  search: { flex:1, minWidth:320, border:"1px solid #e2e8f0", borderRadius:12, padding:"11px 14px", outline:"none" },
  searchInfo:{ color:"#475569", fontSize:13 },

  modeBar:{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", marginBottom:12 },
  tab:    { background:"#fff", border:"1px solid #e2e8f0", padding:"9px 14px", borderRadius:10, cursor:"pointer", fontWeight:800, color:"#334155", marginRight:8 },
  tabActive:{ background:"#eff6ff", borderColor:"#c7d2fe", color:"#1d4ed8" },
  upload: { display:"inline-flex", alignItems:"center", gap:10, background:"#10b981", color:"#fff", padding:"9px 14px", borderRadius:10, fontWeight:800, cursor:"pointer", boxShadow:"0 6px 16px rgba(16,185,129,.22)" },
  toast:  { color:"#065f46", background:"#ecfdf5", border:"1px solid #a7f3d0", padding:"6px 10px", borderRadius:8, fontSize:13 },
  errorInline:{ color:"#b91c1c", background:"#fee2e2", border:"1px solid #fecaca", padding:"6px 10px", borderRadius:8, fontSize:13 },

  card:   { background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:18, marginBottom:14 },

  formGrid:{ display:"grid", gridTemplateColumns:"1fr 200px", gap:14 },
  formGrid2:{ display:"grid", gridTemplateColumns:"1fr", gap:14 },
  formLabel:{ display:"block", fontSize:13, color:"#475569", marginBottom:6 },
  input:  { width:"100%", border:"1px solid #e2e8f0", borderRadius:12, padding:"11px 14px", outline:"none" },
  select: { width:"100%", border:"1px solid #e2e8f0", borderRadius:12, padding:"11px 14px", outline:"none", background:"#fff" },
  textarea:{ width:"100%", border:"1px solid #e2e8f0", borderRadius:12, padding:"11px 14px", outline:"none", minHeight:180, fontFamily:"inherit" },
  hint:   { color:"#475569", marginTop:6, fontSize:13 },

  btnPrimary:{ background:"#1d4ed8", color:"#fff", padding:"10px 16px", borderRadius:10, border:"none", fontWeight:800, cursor:"pointer", boxShadow:"0 6px 16px rgba(29,78,216,.22)" },
  btnDanger: { background:"#ef4444", color:"#fff", padding:"7px 12px", borderRadius:9, border:"none", cursor:"pointer", fontWeight:700 },

  tableHead:{ display:"flex", gap:14, padding:"12px 16px", background:"#eff6ff", borderRadius:10, border:"1px solid #e2e8f0", fontWeight:800, color:"#1d4ed8" },
  tableRow: { display:"flex", gap:14, padding:"12px 16px", alignItems:"center", borderTop:"1px solid #f1f5f9" },
  empty:    { padding:32, textAlign:"center" },
};

