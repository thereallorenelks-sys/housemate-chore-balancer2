import React, { useMemo, useState, useEffect } from "react";

/**
 * Housemate Chore Balancer — v1
 * Single-file React app
 * Goals:
 *  - Enter chores with weight (difficulty) and frequency
 *  - Auto-assign fairly to people across a weekly cycle
 *  - Avoid repeats and balance total weight per person
 *  - Export CSV
 *  - Lightweight, no backend
 *
 * Tips:
 *  - Frequencies include: Daily, Weekly, Twice a Week, Every 2 Weeks, Monthly (in a 4-week cycle)
 *  - "Avoid repeats" prevents the same person from getting the same chore in consecutive eligible weeks
 *  - Cycle length is in weeks (default 4). For Monthly, an occurrence is placed in Week 1 of each 4-week block.
 */

const DEFAULT_PEOPLE = [
  "Loren <thereallorenelks@gmail.com>",
  "Zach <zachlamason@gmail.com>",
  "Tristyn <tristynelks@gmail.com>"
];

const FREQS = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "twice_week", label: "Twice a Week" },
  { key: "every_2_weeks", label: "Every 2 Weeks" },
  { key: "monthly", label: "Monthly (staggered)" },
  { key: "quarterly", label: "Quarterly (group week)" },
];

// Areas from your uploaded CSV
const AREA_OPTIONS = [
  "All Rooms",
  "Bathroom",
  "Kitchen",
  "Laundry",
  "Laundry / Cat Area",
  "Laundry Room",
  "Living Room",
  "Stairs",
  "Upstairs",
];

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

// Auto-generated from your uploaded list (ranked) — feel free to edit inline.
const REAL_CHORES = [
  { id: 1, name: "Sweeping & Mopping", area: "Laundry Room", weight: 4, freq: "weekly", notes: "" },
  { id: 2, name: "Dusting", area: "Kitchen", weight: 3, freq: "weekly", notes: "" },
  { id: 3, name: "Coffee table", area: "Living Room", weight: 1, freq: "weekly", notes: "" },
  { id: 4, name: "Side tables", area: "Living Room", weight: 1, freq: "weekly", notes: "" },
  { id: 5, name: "Dining room table", area: "Living Room", weight: 1, freq: "weekly", notes: "" },
  { id: 6, name: "Wipe counters", area: "Kitchen", weight: 2, freq: "weekly", notes: "" },
  { id: 7, name: "Clean sink", area: "Kitchen", weight: 2, freq: "weekly", notes: "" },
  { id: 8, name: "Organizing fridge", area: "Kitchen", weight: 2, freq: "weekly", notes: "" },
  { id: 9, name: "Wipe washer & dryer", area: "Laundry Room", weight: 2, freq: "weekly", notes: "" },
  { id: 10, name: "Clean cat food bowls", area: "Laundry Room", weight: 1, freq: "weekly", notes: "" },
  { id: 11, name: "Sweep stairs", area: "Stairs", weight: 3, freq: "weekly", notes: "" },
  { id: 12, name: "Clean windows", area: "All Rooms", weight: 5, freq: "monthly", notes: "" },
  { id: 13, name: "Wipe doors", area: "All Rooms", weight: 3, freq: "monthly", notes: "" },
  { id: 14, name: "Wipe down trash can", area: "Laundry", weight: 2, freq: "monthly", notes: "" },
  { id: 15, name: "Deep clean fridge", area: "Kitchen", weight: 4, freq: "monthly", notes: "" },
  { id: 16, name: "Organizing cabinets", area: "Kitchen", weight: 3, freq: "monthly", notes: "" },
  { id: 17, name: "Downstairs bathroom", area: "Bathroom", weight: 4, freq: "monthly", notes: "" },
  { id: 18, name: "Clean cat room floor", area: "Laundry / Cat Area", weight: 3, freq: "monthly", notes: "" },
  { id: 19, name: "Clean dishwasher gasket", area: "Kitchen", weight: 2, freq: "monthly", notes: "" },
  { id: 20, name: "Clean dishwasher drain", area: "Kitchen", weight: 3, freq: "monthly", notes: "" },
  { id: 21, name: "Change Filter", area: "Upstairs", weight: 3, freq: "quarterly", notes: "" },
  { id: 22, name: "Clean baseboards", area: "All Rooms", weight: 4, freq: "quarterly", notes: "" },
  { id: 23, name: "Wash curtains", area: "Living Room", weight: 4, freq: "quarterly", notes: "" },
];

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  const [peopleText, setPeopleText] = useState(DEFAULT_PEOPLE.join(", "));
  const peopleObjs = useMemo(
    () => peopleText
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const m = s.match(/^(.+?)(?:<([^>]+)>)?$/);
        return {
          name: (m ? m[1] : s).trim(),
          email: (m && m[2] ? m[2] : "").trim()
        };
      }),
    [peopleText]
  );
  const people = useMemo(() => peopleObjs.map(o => o.name), [peopleObjs]);

  const [cycleWeeks, setCycleWeeks] = useState(4);
  const [avoidRepeats, setAvoidRepeats] = useState(true);
  const [noDupPerWeek, setNoDupPerWeek] = useState(true);

  const [chores, setChores] = useState(REAL_CHORES);
  const [nextId, setNextId] = useState(REAL_CHORES.length + 1);

  const [newChore, setNewChore] = useState({ name: "", area: "", weight: 2, freq: "weekly", notes: "" });
  const [flash, setFlash] = useState("");
  const [cycleStart, setCycleStart] = useState("");

  function addChore() {
    if (!newChore.name.trim()) return;
    const c = { id: nextId, ...newChore, weight: Number(newChore.weight) };
    setChores(prev => [...prev, c]);
    setNextId(id => id + 1);
    setNewChore({ name: "", area: "", weight: 2, freq: "weekly", notes: "" });
  }

  function removeChore(id: number) {
    setChores(prev => prev.filter(c => c.id !== id));
  }

  function freqOccurrencesInWeek(chore: any, weekIndex: number) {
    // weekIndex is 0-based
    const freq = chore.freq;
    switch (freq) {
      case "daily":
        return 7; // 7 daily instances per week (not date-specific here)
      case "weekly":
        return 1;
      case "twice_week":
        return 2;
      case "every_2_weeks":
        return weekIndex % 2 === 0 ? 1 : 0; // weeks 1,3,5,...
      case "monthly": {
        // Stagger monthly chores across the 4-week cycle based on chore id
        const offset = (chore.id - 1) % 4;
        return (weekIndex % 4 === offset) ? 1 : 0;
      }
      case "quarterly": {
        // Group week: all quarterly chores happen the SAME week within the first 4-week block of the quarter
        const block = Math.floor(weekIndex / 4); // 4-week blocks
        if (block % 3 !== 0) return 0; // only the first block of the quarter
        const groupWeek = 0; // Week 1 of the block
        // Each quarterly chore should be a group task: assign one instance per person this week (except Change Filter)
        return (weekIndex % 4 === groupWeek) ? (String(chore.name||"").toLowerCase().includes("change filter") ? 1 : people.length) : 0;
      }
      default:
        return 0;
    }
  }

  // Eligibility rules by chore name (case-insensitive substring match)
  const ELIGIBILITY_RULES = [
    // Zach does not do Dishes
    { test: (n: string) => {
        const name = String(n).toLowerCase();
        return name === "dishes" || name.includes("dishes");
      }, allowed: ["Loren", "Tristyn"] },
    // Zach does not do Sink
    { test: (n: string) => String(n).toLowerCase().includes("sink"), allowed: ["Loren", "Tristyn"] },
    // Outside Trash -> Loren only
    { test: (n: string) => String(n).toLowerCase().includes("outside trash"), allowed: ["Loren"] },
    // Inside Trash -> Zach only
    { test: (n: string) => String(n).toLowerCase().includes("inside trash"), allowed: ["Zach"] },
  ];
  function eligiblePeopleForChore(choreName: string, peopleList: string[]) {
    for (const r of ELIGIBILITY_RULES) {
      if (r.test(choreName)) {
        return peopleList.filter(p => r.allowed.includes(p));
      }
    }
    return peopleList.slice();
  }

  type Week = { week: number, assignments: any[], loads: Record<string, number> };

  function generateAssignments(): Week[] {
    const weeks: Week[] = Array.from({ length: cycleWeeks }, (_, i) => ({
      week: i + 1,
      assignments: [],
      loads: Object.fromEntries(people.map(p => [p, 0])) as Record<string, number>,
    }));

    const lastAssignee: Record<number, string> = {};

    const quarterlyIds = new Set(chores.filter(c => c.freq === "quarterly").map(c => c.id));
    const groupQuarterlyIds = new Set(chores.filter(c => c.freq === "quarterly" && !String(c.name || "").toLowerCase().includes("change filter")).map(c => c.id));

    for (let w = 0; w < cycleWeeks; w++) {
      const hadThisChore: Record<string, Set<number>> = Object.fromEntries(people.map(p => [p, new Set()]));
      const assignedQuarterlyThisWeek = new Set<string>();
      const groupCoveredByChore: Record<number, Set<string>> = Object.fromEntries(Array.from(groupQuarterlyIds).map(id => [id, new Set<string>()]));
      const occ: {choreId:number; choreName:string; area:string; weight:number;}[] = [];
      for (const c of chores) {
        const times = freqOccurrencesInWeek(c, w);
        for (let i = 0; i < times; i++) {
          occ.push({ choreId: c.id, choreName: c.name, area: (c.area || ""), weight: c.weight });
        }
      }

      occ.sort((a, b) => (b.weight - a.weight) || a.choreName.localeCompare(b.choreName));

      for (const job of occ) {
        const candidates = eligiblePeopleForChore(job.choreName, people);
        const isQuarterlyJob = quarterlyIds.has(job.choreId);
        const isGroupQuarterlyJob = groupQuarterlyIds.has(job.choreId);
        let pool = candidates.slice();
        if (isQuarterlyJob) {
          const uncovered = people.filter(p => !assignedQuarterlyThisWeek.has(p));
          if (uncovered.length > 0) {
            pool = pool.filter(p => uncovered.includes(p));
            if (pool.length === 0) pool = candidates;
          }
          if (isGroupQuarterlyJob) {
            const covered = groupCoveredByChore[job.choreId] || new Set<string>();
            const uncoveredEligible = pool.filter(p => !covered.has(p));
            if (uncoveredEligible.length > 0) {
              pool = uncoveredEligible;
            }
          }
        }
        if (pool.length === 0) { continue; }
        const ranked = pool
          .map(p => ({ p, load: weeks[w].loads[p], last: lastAssignee[job.choreId] === p, seen: hadThisChore[p].has(job.choreId) }))
          .sort((a, b) => {
            if (noDupPerWeek && a.seen !== b.seen) return a.seen ? 1 : -1;
            if (a.load !== b.load) return a.load - b.load;
            if (avoidRepeats && a.last !== b.last) return a.last ? 1 : -1;
            return a.p.localeCompare(b.p);
          });
        const chosen = ranked[0].p;
        if (isQuarterlyJob) assignedQuarterlyThisWeek.add(chosen);
        if (isGroupQuarterlyJob) groupCoveredByChore[job.choreId].add(chosen);
        weeks[w].assignments.push({ person: chosen, ...job });
        weeks[w].loads[chosen] += job.weight;
        if (noDupPerWeek) { hadThisChore[chosen].add(job.choreId); }
        lastAssignee[job.choreId] = chosen;
      }
    }

    return weeks;
  }

  const weeks = useMemo(generateAssignments, [peopleText, cycleWeeks, chores, avoidRepeats, noDupPerWeek]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(""), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const totals = useMemo(() => {
    const total: Record<string, number> = Object.fromEntries(people.map(p => [p, 0]));
    weeks.forEach(week => {
      for (const p of people) total[p] += week.loads[p];
    });
    return total;
  }, [weeks, people]);

  // --- Weekly email helpers ---
  function getCurrentWeekIndex() {
    if (!cycleStart) return 0;
    const start = new Date(cycleStart + 'T00:00:00');
    const now = new Date();
    const ms = now.getTime() - start.getTime();
    const days = Math.floor(ms / 86400000);
    if (days < 0) return 0;
    const w = Math.floor(days / 7);
    return ((w % cycleWeeks) + cycleWeeks) % cycleWeeks;
  }
  function weekRangeLabel(widx: number) {
    if (!cycleStart) return '';
    const base = new Date(cycleStart + 'T00:00:00');
    const monday = new Date(base.getTime() + widx * 7 * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    return `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`;
  }
  function buildEmailBody(personName: string, widx: number) {
    const week = weeks[widx] || weeks[0];
    const mine = week.assignments.filter(a => a.person === personName);
    const grouped = mine.reduce((acc: any, a: any) => {
      const found = chores.find(x => String(x.name).trim() === String(a.choreName).trim());
      const aArea = (a && a.area ? a.area : (found ? (found.area || '') : ''));
      const key = a.choreName + '||' + (aArea || '') + '||' + a.weight;
      if (!acc[key]) acc[key] = { name: a.choreName, area: (aArea || ''), weight: a.weight, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {} as any);
    const items = Object.values(grouped).sort((a: any,b: any) => (b.weight - a.weight) || a.name.localeCompare(b.name) || (a.area || '').localeCompare(b.area || ''));
    const total = (items as any[]).reduce((s: number, g: any) => s + g.weight * (g.count || 1), 0);
    const lines: string[] = [];
    lines.push(`Hi ${personName},`);
    lines.push("");
    lines.push(`Here are your chores for this week (Week ${weeks[widx]?.week || (widx+1)}${cycleStart ? `, ${weekRangeLabel(widx)}` : ''}).`);
    lines.push("");
    if (items.length === 0) {
      lines.push("- none -");
    } else {
      for (const g of items as any[]) {
        const areaPart = g.area ? (' [' + g.area + ']') : '';
        const countPart = g.count > 1 ? (' x' + g.count) : '';
        lines.push(`- ${g.name}${areaPart}${countPart} (w${g.weight})`);
      }
    }
    lines.push("");
    lines.push(`Total weekly load: ${total}`);
    lines.push("");
    lines.push("Have a great week!");
    return lines.join("\\n");
  }

  function composeWeeklyEmails() {
    const widx = getCurrentWeekIndex();
    const missing: string[] = [];
    for (const o of peopleObjs) {
      if (!o.email) { missing.push(o.name); continue; }
      const subject = `This Week's Chores — Week ${weeks[widx]?.week || (widx+1)}${cycleStart ? ' (' + weekRangeLabel(widx) + ')' : ''}`;
      const body = buildEmailBody(o.name, widx);
      const url = `mailto:${encodeURIComponent(o.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank');
    }
    if (missing.length) {
      setFlash(`No email on file for: ${missing.join(', ')} (add with Name <email> in Housemates)`);
    } else {
      setFlash('Opened email drafts for all housemates');
    }
  }

  function downloadWeeklyEmailsTxt() {
    const widx = getCurrentWeekIndex();
    const lines: string[] = [];
    for (const o of peopleObjs) {
      lines.push(`# ${o.name}${o.email ? ' <' + o.email + '>' : ''}`);
      lines.push(buildEmailBody(o.name, widx));
      lines.push("");
    }
    downloadText('weekly_chore_emails.txt', lines.join("\\n"));
  }

  return (
    <div className="p-4">
      <section className="grid grid-cols-12 gap-4">
        {/* LEFT: Assignments by Week + Chores */}
        <div className="col-span-8 space-y-4">
          {/* Assignments by Week */}
          <div className="bg-white rounded-2xl shadow p-4 border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Assignments by Week</h2>
              <div className="text-sm text-slate-500">{cycleStart ? `Starting ${cycleStart}` : ''}</div>
            </div>

            {/* weeks */}
            {weeks.map((week, widx) => (
              <div key={week.week} className="rounded-xl border p-3 mb-3">
                <div className="font-semibold mb-2">Week {week.week}{cycleStart ? ` — ${weekRangeLabel(widx)}` : ''}</div>
                <div className="grid grid-cols-3 gap-3">
                  {people.map(p => {
                    const mine = week.assignments.filter(a => a.person === p);
                    const grouped = mine.reduce((acc: any, a: any) => {
                      const found = chores.find(x => String(x.name).trim() === String(a.choreName).trim());
                      const aArea = (a && a.area ? a.area : (found ? (found.area || '') : ''));
                      const key = a.choreName + '||' + (aArea || '') + '||' + a.weight;
                      if (!acc[key]) acc[key] = { name: a.choreName, area: (aArea || ''), weight: a.weight, count: 0 };
                      acc[key].count += 1;
                      return acc;
                    }, {} as any);
                    const items = Object.values(grouped).sort((a: any,b: any) => (b.weight - a.weight) || a.name.localeCompare(b.name) || (a.area || '').localeCompare(b.area || ''));
                    return (
                      <div key={p} className="bg-slate-50 rounded-lg p-3">
                        <div className="font-medium mb-1">{p} <span className="text-xs text-slate-500">load {week.loads[p]}</span></div>
                        <ul className="text-sm space-y-1">
                          {items.length === 0 ? (
                            <li className="text-slate-400 italic">—</li>
                          ) : (
                            (items as any[]).map((g, i) => (
                              <li key={p + '-' + i} className="flex items-center justify-between">
                                <span>{g.name}{g.count > 1 ? ' x' + g.count : ''} {g.area ? (<span className="text-xs text-slate-500">[ {g.area} ]</span>) : null}</span>
                                <span className="text-xs text-slate-500">(w{g.weight})</span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Chores Editor */}
          <div className="bg-white rounded-2xl shadow p-4 border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Chores</h2>
              <div className="flex items-center gap-2"></div>
            </div>

            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-600">
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Area</div>
              <div className="col-span-1">Weight (1-5)</div>
              <div className="col-span-3">Frequency</div>
              <div className="col-span-2">Notes</div>
              <div className="col-span-1 text-right"> </div>
            </div>

            {chores.map(c => (
              <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
                <input className="col-span-3 rounded-lg border px-2 py-1 w-full max-w-[22ch]" value={c.name}
                       onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} />
                <select className="col-span-2 rounded-lg border px-2 py-1" value={c.area || ""}
                        onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, area: e.target.value } : x))}>
                  <option value="">—</option>
                  {AREA_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input type="number" min={1} max={5} className="col-span-1 rounded-lg border px-2 py-1 text-center" value={c.weight}
                       onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, weight: Number(e.target.value) } : x))} />
                <select className="col-span-3 rounded-lg border px-2 py-1" value={c.freq}
                        onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, freq: e.target.value } : x))}>
                  {FREQS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <input className="col-span-2 rounded-lg border px-2 py-1" value={c.notes}
                       onChange={e => setChores(prev => prev.map(x => x.id === c.id ? { ...x, notes: e.target.value } : x))} />
                <div className="col-span-1 text-right">
                  <button onClick={() => removeChore(c.id)} className="text-red-600 hover:underline">Remove</button>
                </div>
              </div>
            ))}

            <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t mt-2">
              <input className="col-span-3 rounded-lg border px-2 py-1 w-full max-w-[22ch]" placeholder="New chore name" value={newChore.name}
                     onChange={e => setNewChore(s => ({ ...s, name: e.target.value }))} />
              <select className="col-span-2 rounded-lg border px-2 py-1" value={newChore.area}
                      onChange={e => setNewChore(s => ({ ...s, area: e.target.value }))}>
                <option value="">—</option>
                {AREA_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <input type="number" min={1} max={5} className="col-span-1 rounded-lg border px-2 py-1 text-center" value={newChore.weight}
                     onChange={e => setNewChore(s => ({ ...s, weight: Number(e.target.value) }))} />
              <select className="col-span-3 rounded-lg border px-2 py-1" value={newChore.freq}
                      onChange={e => setNewChore(s => ({ ...s, freq: e.target.value }))}>
                {FREQS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <input className="col-span-2 rounded-lg border px-2 py-1" placeholder="Notes (optional)" value={newChore.notes}
                     onChange={e => setNewChore(s => ({ ...s, notes: e.target.value }))} />
              <div className="col-span-1 text-right">
                <button onClick={addChore} className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-slate-100">Add</button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="col-span-4 space-y-4">
          {/* Housemates editor (with optional emails) */}
          <div className="bg-white rounded-2xl shadow p-4 border space-y-2">
            <h2 className="text-lg font-semibold">Housemates</h2>
            <p className="text-sm text-slate-600">Comma-separated. Optional emails in angle brackets, e.g., Loren &lt;loren@example.com&gt;.</p>
            <input className="w-full rounded-xl border px-3 py-2" value={peopleText} onChange={e => setPeopleText(e.target.value)} />
          </div>

          {/* Weekly emails composer */}
          <div className="bg-white rounded-2xl shadow p-4 border space-y-3">
            <h2 className="text-lg font-semibold">Weekly emails</h2>
            <label className="flex items-center justify-between gap-4">
              <span>Cycle start (Monday)</span>
              <input type="date" className="rounded-lg border px-2 py-1" value={cycleStart} onChange={e => setCycleStart(e.target.value)} />
            </label>
            <div className="text-xs text-slate-500">We use this to figure out the current week each Monday.</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={composeWeeklyEmails} className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-slate-100">Compose this week's emails</button>
              <button onClick={downloadWeeklyEmailsTxt} className="px-3 py-1.5 rounded-xl border bg-slate-50 hover:bg-slate-100">Download .txt</button>
            </div>
            {peopleObjs.some(p => !p.email) && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                Tip: add emails like "Name &lt;email@domain&gt;" in Housemates to auto-address messages.
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-4 border space-y-3">
            <h2 className="text-lg font-semibold">Cycle Settings</h2>
            <label className="flex items-center justify-between gap-4">
              <span>Cycle length (weeks)</span>
              <input type="number" min={1} max={12} className="w-24 rounded-lg border px-2 py-1 text-right" value={cycleWeeks}
                     onChange={e => setCycleWeeks(Math.max(1, Math.min(12, Number(e.target.value))))} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>Avoid repeats (rotate chore owners)</span>
              <input type="checkbox" checked={avoidRepeats} onChange={e => setAvoidRepeats(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>No same chore twice per person in a week</span>
              <input type="checkbox" checked={noDupPerWeek} onChange={e => setNoDupPerWeek(e.target.checked)} />
            </label>
            <div className="text-xs text-slate-500">"Every 2 Weeks" occurs on Weeks 1,3,5...; "Monthly" is staggered across Weeks 1-4; "Quarterly assigns all quarterly chores in the same week (group week) during the first 4‑week block of each quarter."</div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4 border">
            <h2 className="text-lg font-semibold mb-2">Total Load (whole cycle)</h2>
            <ul className="space-y-1">
              {people.map(p => (
                <li key={p} className="flex items-center justify-between">
                  <span>{p}</span>
                  <span className="font-semibold">{totals[p]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow p-4 border">
            <h2 className="text-lg font-semibold mb-2">Pro tip</h2>
            <p className="text-sm text-slate-600">Use weights like 1=Easy, 3=Medium, 5=Heavy. Daily tasks often feel easier if their weight is small (e.g., dishes=2) but they'll still be balanced fairly across the week.</p>
          </div>
        </div>
      </section>
      <footer className="text-center text-xs text-slate-500 pt-2">
        Built for household harmony. If disputes arise, the judge will accept bribes in the form of warm cookies.
      </footer>
    </div>
  );
}
