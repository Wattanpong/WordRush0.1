// src/pages/TypingPractice.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPost } from "../api";
import "./styles.css";

/* ---------------------- Fallback (เผื่อ API ล่ม) ---------------------- */
const FALLBACK = {
  easy: ["apple","orange","banana","teacher","student","happy","music","family","window","keyboard"],
  normal: [
    "beautiful day","finish your homework","practice makes perfect",
    "remember to breathe","welcome to the jungle","strong determination"
  ],
  hard: [
    "Consistency beats intensity in the long run",
    "Simplicity is the ultimate sophistication",
    "Innovation distinguishes between a leader and a follower",
    "Opportunities don't happen you create them",
  ],
};

/* เวลา/ตัวคูณคะแนนต่อระดับ */
const LEVEL_META = {
  easy:   { label: "ง่าย",  time: 15, mult: 1 },
  normal: { label: "กลาง",  time: 15, mult: 2 },
  hard:   { label: "ยาก",   time: 15, mult: 3 },
};

const LEVELS = ["easy", "normal", "hard"];

// ระบุ user id ที่จะใช้ผูก localStorage / สถิติ
const userKey = (user) => (user?.id || user?._id || user?.userId || "guest");

// คีย์สำหรับ localStorage (เก็บแยกตาม user + level)
const lsBest   = (uid, lv) => `typing:bestTotal:${uid}:${lv}`;
const lsScore  = (uid, lv) => `typing:lastScore:${uid}:${lv}`;
const lsStreak = (uid, lv) => `typing:lastStreak:${uid}:${lv}`;
const lsLevel  = (uid)     => `typing:lastLevel:${uid}`;

/* ---------------------- COMPONENT ---------------------- */
export default function TypingPractice() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const token = auth?.token ?? null;
  const uid = userKey(user);

  // ระดับเริ่มต้น: จำจาก localStorage ต่อ user
  const [level, setLevel] = useState(() => {
    const remembered = localStorage.getItem(lsLevel(uid));
    return LEVELS.includes(remembered) ? remembered : "easy";
  });

  // คำศัพท์จาก DB ต่อระดับ: เก็บเป็นอ็อบเจ็กต์ { term, hint }
  const [wordsMap, setWordsMap] = useState({ easy: [], normal: [], hard: [] });
  const [wordsLoading, setWordsLoading] = useState(false);
  const [wordsError, setWordsError] = useState("");

  // สถานะเกม
  const [status, setStatus] = useState("idle"); // idle | countdown | speaking | typing | gameover
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(LEVEL_META[level].time);

  // โจทย์/พิมพ์
  const [target, setTarget] = useState("");         // คำจริงที่ต้องพิมพ์
  const [targetHint, setTargetHint] = useState(""); // hint (ถ้ามี)
  const [input, setInput] = useState("");
  const [showHint, setShowHint] = useState(true);

  // เฉลยตอนแพ้
  const [revealTarget, setRevealTarget] = useState("");

  // คะแนน “ต่อระดับ” แยกเก็บเป็น map
  const readMapFromLS = useCallback(
    (maker) => ({
      easy: Number(localStorage.getItem(maker(uid, "easy")) || 0),
      normal: Number(localStorage.getItem(maker(uid, "normal")) || 0),
      hard: Number(localStorage.getItem(maker(uid, "hard")) || 0),
    }),
    [uid]
  );

  const [scoreMap, setScoreMap] = useState(() => readMapFromLS(lsScore));
  const [streakMap, setStreakMap] = useState(() => readMapFromLS(lsStreak));
  const [bestMap, setBestMap] = useState(() => readMapFromLS(lsBest));

  // สำหรับสรุป/ข้อมูลล่าสุด
  const currScore = scoreMap[level];
  const currStreak = streakMap[level];
  const currBest = bestMap[level];
  const [lastAccuracy, setLastAccuracy] = useState(0);

  // refs
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const speakingRef = useRef(false);

  /* ---------- utils ---------- */
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const pickTarget = useCallback(() => {
    // ใช้ข้อมูลจาก wordsMap เป็น [{term, hint}] ถ้าไม่มีใช้ FALLBACK แล้วห่อเป็น object
    const list = wordsMap[level]?.length
      ? wordsMap[level]
      : FALLBACK[level].map((t) => ({ term: t, hint: "" }));

    const next = list[Math.floor(Math.random() * list.length)];
    setTarget(next?.term || "");
    setTargetHint(next?.hint || "");
  }, [wordsMap, level]);

  /* ---------- preload voices + เคลียร์เสียงเมื่อออก ---------- */
  useEffect(() => {
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  /* ---------- เปลี่ยนผู้ใช้ → โหลดค่า map จาก localStorage ---------- */
  useEffect(() => {
    setScoreMap(readMapFromLS(lsScore));
    setStreakMap(readMapFromLS(lsStreak));
    setBestMap(readMapFromLS(lsBest));
  }, [uid, readMapFromLS]);

  /* ---------- โหลดคำจาก DB ตามระดับ ---------- */
  const fetchWordsByLevel = useCallback(
    async (lv) => {
      setWordsError("");
      setWordsLoading(true);
      try {
        // GET /api/words?level=easy → [{ _id, term, hint }, ...]
        const data = await apiGet(`/api/words?level=${encodeURIComponent(lv)}`, token);
        const list = Array.isArray(data) ? data : data?.data || [];
        // เก็บทั้ง term และ hint
        const items = list
          .map((w) => ({
            term: String(w?.term || "").trim(),
            hint: String(w?.hint || "").trim(),
          }))
          .filter((w) => !!w.term);

        const safe = items.length
          ? shuffle(items)
          : FALLBACK[lv].map((t) => ({ term: t, hint: "" }));

        setWordsMap((m) => ({ ...m, [lv]: safe }));
      } catch {
        setWordsError("โหลดคำศัพท์จากฐานข้อมูลไม่สำเร็จ ใช้คำตัวอย่างแทนชั่วคราว");
        setWordsMap((m) => ({
          ...m,
          [lv]: FALLBACK[lv].map((t) => ({ term: t, hint: "" })),
        }));
      } finally {
        setWordsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchWordsByLevel(level);
  }, [level, fetchWordsByLevel]);

  /* ---------- เปลี่ยนระดับ → รีเซ็ตเวลา จบเกมถ้ากำลังเล่น และจำระดับ ---------- */
  useEffect(() => {
    setTimeLeft(LEVEL_META[level].time);
    localStorage.setItem(lsLevel(uid), level);
    if (status !== "idle") endGame(); // กันค้างขณะสลับโหมด
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  /* ---------- โหลด Best จากเซิร์ฟเวอร์ (prefetch เมื่อมี token) ---------- */
  const loadBestFromServer = useCallback(
    async (lv) => {
      if (!token) return;
      try {
        const data = await apiGet(`/api/typing/best?level=${encodeURIComponent(lv)}`, token);
        if (data?.level && String(data.level).toLowerCase() !== lv) return;
        const best = Number(data?.best ?? 0);
        setBestMap((m) => {
          const next = { ...m, [lv]: best };
          localStorage.setItem(lsBest(uid, lv), String(best));
          return next;
        });
      } catch { /* ใช้ค่าใน localStorage ต่อ */ }
    },
    [token, uid]
  );

  useEffect(() => {
    loadBestFromServer(level);
  }, [level, loadBestFromServer]);

  /* ---------- การเริ่ม/จบ/รอบถัดไป ---------- */
  const startGame = () => {
    setScoreMap((m) => {
      const next = { ...m, [level]: 0 };
      localStorage.setItem(lsScore(uid, level), "0");
      return next;
    });
    setStreakMap((m) => {
      const next = { ...m, [level]: 0 };
      localStorage.setItem(lsStreak(uid, level), "0");
      return next;
    });
    setInput("");
    setRevealTarget(""); // เคลียร์เฉลยเดิม
    setTimeLeft(LEVEL_META[level].time);
    pickTarget();
    setStatus("countdown");
    setCountdown(3);
  };

  const endGame = useCallback((accVal) => {
    clearInterval(timerRef.current);
    speakingRef.current = false;
    if (typeof accVal === "number") setLastAccuracy(accVal);

    // บันทึกเฉลย (คำล่าสุด)
    setRevealTarget((prev) => target || prev);

    // อัปเดต Best
    setBestMap((prev) => {
      const currentScore = scoreMap[level] ?? 0;
      const currBest = prev[level] ?? 0;
      const nextBest = Math.max(currBest, currentScore);

      if (nextBest !== currBest) {
        localStorage.setItem(lsBest(uid, level), String(nextBest));
      }

      if (user && token && nextBest > currBest) {
        apiPost("/api/typing/best", { level, score: nextBest }, token)
          .then((res) => {
            const serverBest = Number(res?.best ?? nextBest);
            setBestMap((p2) => {
              const upd = { ...p2, [level]: serverBest };
              localStorage.setItem(lsBest(uid, level), String(serverBest));
              return upd;
            });
          })
          .catch(() => {});
      }

      return { ...prev, [level]: nextBest };
    });

    setStatus("gameover");
  }, [level, scoreMap, token, uid, user, target]);

  const nextRound = () => {
    setInput("");
    setTimeLeft(LEVEL_META[level].time);
    pickTarget();
    setStatus("speaking");
  };

  /* ---------- Countdown ---------- */
  useEffect(() => {
    if (status !== "countdown") return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          setStatus("speaking");
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  /* ---------- พูดโจทย์ (เริ่มพิมพ์หลังเสียงจบ) ---------- */
  useEffect(() => {
    if (status !== "speaking" || !target) return;
    const utter = new SpeechSynthesisUtterance(target);
    utter.lang = "en-US";
    utter.rate = 0.95;
    speakingRef.current = true;
    utter.onend = () => {
      speakingRef.current = false;
      setStatus("typing");
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    return () => {
      // ถ้าออกกลางคันให้ยกเลิกเสียง
      window.speechSynthesis.cancel();
      speakingRef.current = false;
    };
  }, [status, target]);

  /* ---------- จับเวลา + ความแม่นยำ ---------- */
  const accuracy = useMemo(() => {
    if (!target) return 0;
    const t = target.split(""),
          i = input.split("");
    let ok = 0;
    t.forEach((ch, idx) => { if (i[idx] === ch) ok++; });
    return Math.round((ok / t.length) * 100);
  }, [input, target]);

  useEffect(() => {
    if (status !== "typing") return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // คำนวณ accuracy ล่าสุดตอนหมดเวลา
          const accNow = (() => {
            if (!target) return 0;
            const tar = target.split(""), inp = input.split("");
            let ok = 0;
            tar.forEach((ch, idx) => { if (inp[idx] === ch) ok++; });
            return Math.round((ok / tar.length) * 100);
          })();
          endGame(accNow);
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [status, target, input, endGame]);

  /* ---------- โฟกัสอินพุต ---------- */
  useEffect(() => {
    if ((status === "typing" || status === "speaking") && inputRef.current) {
      inputRef.current.focus();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [status]);

  /* ---------- คิดคะแนน (รวมไว้ที่ scoreMap[level]) ---------- */
  const scoreForPerfect = (word) => {
    const { mult } = LEVEL_META[level];
    return Math.max(1, Math.round((word.length + Math.max(0, timeLeft)) * mult));
  };

  useEffect(() => {
    if (status === "typing" && target && input === target) {
      // อัปเดตคะแนน/สตรีค เฉพาะของระดับนี้
      setScoreMap((m) => {
        const nextVal = (m[level] ?? 0) + scoreForPerfect(target);
        const next = { ...m, [level]: nextVal };
        localStorage.setItem(lsScore(uid, level), String(nextVal));
        return next;
      });
      setStreakMap((m) => {
        const nextVal = (m[level] ?? 0) + 1;
        const next = { ...m, [level]: nextVal };
        localStorage.setItem(lsStreak(uid, level), String(nextVal));
        return next;
      });
      nextRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, target, status, timeLeft]);

  /* ---------- Render ---------- */
  const wordCount = useMemo(() => (target ? target.split(" ").length : 0), [target]);

  const maskedBoxes = useMemo(() => {
    if (!target) return [];
    return target.split("").map((ch, idx) => {
      const show = showHint && idx === 0 ? ch : ch === " " ? "·" : "";
      return (
        <div key={idx} className="box">
          {show}
        </div>
      );
    });
  }, [target, showHint]);

  return (
    <div className="container" onPaste={(e) => e.preventDefault()}>
      <nav className="nav">
        <div className="brand">WordRush • Endless Typing</div>
        {/* ย้ายสรุปคะแนนไปไว้ด้านขวาแล้ว (ภายใน aside) */}
      </nav>

      <div className="grid">
        {/* ซ้าย: พื้นที่เล่น */}
        <section className="card wrap">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <div className="segment" role="tablist" aria-label="Level">
                {LEVELS.map((k) => (
                  <button
                    key={k}
                    className={k === level ? "active" : ""}
                    onClick={() => setLevel(k)}
                    aria-pressed={k === level}
                    title={`ระดับ${LEVEL_META[k].label}`}
                  >
                    {LEVEL_META[k].label}
                  </button>
                ))}
              </div>
              <span className="subtle">เวลา/คำ {LEVEL_META[level].time}s</span>
            </div>

            <div className="row" style={{ alignItems: "center", gap: 12 }}>
              <label className="subtle" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showHint}
                  onChange={(e) => setShowHint(e.target.checked)}
                />
                แสดงคำใบ้
              </label>
              <span className="timer">⏱ {timeLeft}s</span>

              {status === "idle" ? (
                <button className="btn primary" onClick={startGame} disabled={wordsLoading}>
                  {wordsLoading ? "กำลังโหลดคำ..." : "เริ่มเกม"}
                </button>
              ) : status === "gameover" ? (
                <button className="btn primary" onClick={startGame}>เริ่มใหม่</button>
              ) : (
                <button className="btn" onClick={() => endGame(accuracy)}>ยอมแพ้</button>
              )}
            </div>
          </div>

          {!!wordsError && (
            <div className="panel error">
              {wordsError}
            </div>
          )}

          {/* เป้าหมาย */}
          <div className="panel afterTarget">
            <div className="subtle" style={{ marginBottom: 16 }}>เป้าหมาย</div>
            <div className="target">
              {target ? (
                maskedBoxes
              ) : (
                <em className="subtle">
                  {status === "idle" ? "กด “เริ่มเกม” เพื่อเริ่ม" : "กำลังเตรียมคำ…"}
                </em>
              )}
            </div>

            {/* ข้อมูลช่วย (optional) */}
            {target && showHint && (
              <div className="subtle" style={{ marginTop: 10 }}>
                {targetHint && (<div>Hint: <b>{targetHint}</b></div>)}
                ยาว {target.length} ตัว | {wordCount} คำ | ตัวแรก “<b>{target[0]}</b>”
              </div>
            )}
          </div>

          {/* อินพุต */}
          <div className="wrap" style={{ paddingTop: 0 }}>
            {status === "countdown" && <div className="count"> {countdown} </div>}

            <input
              ref={inputRef}
              className="input"
              placeholder={
                status === "idle"
                  ? "กดเริ่มเกมก่อน"
                  : speakingRef.current
                  ? "กำลังพูด… พิมพ์ได้เลย"
                  : "พิมพ์ได้เลย"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!(status === "typing" || status === "speaking")}
            />

            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="subtle">
                ความแม่นยำล่าสุด: <b>{status === "typing" ? `${accuracy}%` : `${lastAccuracy}%`}</b>
              </div>
              <div className="row">
                <button
                  className="btn ghost"
                  onClick={() => {
                    if (target) {
                      const u = new SpeechSynthesisUtterance(target);
                      u.lang = "en-US";
                      u.rate = 0.95;
                      window.speechSynthesis.speak(u);
                    }
                  }}
                  disabled={!target || status === "idle"}
                >
                  🔊 ฟังซ้ำ
                </button>
              </div>
            </div>
          </div>

          {/* จบเกม */}
          {status === "gameover" && (
            <div className="panel">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b>เกมจบแล้ว</b>
                  <div className="subtle" style={{ marginTop: 4 }}>
                    สรุประดับ {LEVEL_META[level].label}:
                    {" "}Score {currScore ?? 0} • Streak {currStreak ?? 0} • Best {currBest ?? 0}
                  </div>
                  <div className="subtle">ความแม่นยำรอบสุดท้าย: {lastAccuracy}%</div>

                  {/* เฉลยคำตอบ */}
                  {revealTarget && (
                    <div className="subtle" style={{ marginTop: 8 }}>
                      เฉลย: <code className="ans">{revealTarget}</code>
                    </div>
                  )}
                </div>

                <div className="row">
                  <button className="btn" onClick={startGame}>เริ่มใหม่</button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ขวา: สรุป + วิธีเล่น (เรียงลงมา) */}
        <aside className="card wrap">
          {/* ====== กล่องสรุปคะแนน/ผู้เล่น (อยู่ด้านบน) ====== */}
          <div className="panel stats">
            <div className="stats-row">
              <div className="kpi">
                <div className="kpi-label">ระดับ</div>
                <div className="kpi-value">
                  <span className={`pill lv-${level}`}>{LEVEL_META[level].label}</span>
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Score</div>
                <div className="kpi-value">{currScore ?? 0}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Streak</div>
                <div className="kpi-value">{currStreak ?? 0}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Best</div>
                <div className="kpi-value">
                  {currBest ?? 0}
                  {!!(currBest > 0) && <span className="badge">🏆</span>}
                </div>
              </div>
            </div>

            <div className="stats-foot">
              <div className="user-chip">
                <span className="avatar">{(user?.name || "G")[0].toUpperCase()}</span>
                <div>
                  <div className="user-name">{user?.name || "Guest"}</div>
                  <div className="user-sub">ผู้เล่น WordRush</div>
                </div>
              </div>

              <div className="mini-note">
                <div>ตัวคูณคะแนนโหมดนี้: <b>x{LEVEL_META[level].mult}</b></div>
                <div>จับเวลา/คำ: <b>{LEVEL_META[level].time}s</b></div>
              </div>
            </div>
          </div>

          {/* ====== วิธีเล่น ====== */}
          <h3 style={{ margin: "6px 0 4px" }}>วิธีเล่น (สะสมคะแนนต่อระดับ)</h3>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>กด <b>เริ่มเกม</b> → ระบบนับถอยหลัง 3 วิ</li>
            <li>ระบบพูดภาษาอังกฤษ → เมื่อเสียงจบจึงเริ่มจับเวลาให้พิมพ์</li>
            <li><b>พิมพ์ถูก 100%</b> → ไปคำถัดไปอัตโนมัติ</li>
            <li>หมดเวลา/กดยอมแพ้ → เกมจบ</li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
