import React, { useState, useEffect, useRef } from "react";
import useLocalStorage from "use-local-storage";
import { SpeedInsights } from "@vercel/speed-insights/react";

const categories = ["Hygiene", "Expiration", "Performance", "Plants", "None"];
const verbs = ["Appointment", "Meeting", "Replace", "Check", "Water"];
const intervalUnits = ["Days", "Weeks", "Months", "Years"];

type DisplayUnit = "days" | "weeks" | "months" | "years" | "decades";

type Item = {
  id: number;
  name: string;
  replacementInterval: number;
  intervalUnit: string;
  lastReplaced: string;
  category: string;
  verb: string;
  // A per-item preference for a finer unit than the countdown warrants.
  // Absent means "just follow the natural unit".
  displayUnit?: DisplayUnit;
};

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const ls = localStorage.getItem("dark-mode");
    if (ls !== null) return ls === "true";
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });
  useEffect(() => {
    if (dark) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("dark-mode", "true");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("dark-mode", "false");
    }
  }, [dark]);
  return [dark, setDark] as const;
}

function addInterval(dateStr: string, interval: number, unit: string) {
  const date = new Date(dateStr + "T00:00:00");
  switch (unit) {
    case "Days":
      date.setDate(date.getDate() + interval);
      break;
    case "Weeks":
      date.setDate(date.getDate() + interval * 7);
      break;
    case "Months":
      date.setMonth(date.getMonth() + interval);
      break;
    case "Years":
      date.setFullYear(date.getFullYear() + interval);
      break;
    default:
      date.setDate(date.getDate() + interval);
      break;
  }
  return date;
}

function calculateDaysLeft(
  lastReplaced: string,
  interval: number,
  unit: string
) {
  const now = new Date();
  let next = addInterval(lastReplaced, interval, unit);
  const diff = Math.ceil(
    (next.getTime() - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
  );
  return diff;
}

function calculateNextDate(
  lastReplaced: string,
  interval: number,
  unit: string
) {
  return formatDate(addInterval(lastReplaced, interval, unit));
}

function formatDate(date: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  // Without the year, a yearly cycle reads as "Last Sep 14 / Next Sep 14".
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString(undefined, opts);
}

function unitLabel(interval: number, unit: string) {
  const lower = unit.toLowerCase();
  return interval === 1 ? lower.replace(/s$/, "") : lower;
}

// Length of one full cycle, used to size the depletion track and decide
// whether an item counts as "due soon" relative to its own interval.
// Local calendar date, not toISOString — that converts to UTC and lands on the
// previous day for anyone east of Greenwich.
function toInputDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function isValidDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(value + "T00:00:00").getTime())
  );
}

function getCycleDays(lastReplaced: string, interval: number, unit: string) {
  const last = new Date(lastReplaced + "T00:00:00");
  const next = addInterval(lastReplaced, interval, unit);
  return Math.max(1, Math.round((next.getTime() - last.getTime()) / 86400000));
}

type Status = "ok" | "soon" | "over";

function getStatus(
  daysLeft: number,
  cycleDays: number,
  soonPercent: number,
  soonDays: number
): Status {
  if (daysLeft < 0) return "over";
  // Proportional so a weekly plant and a yearly service both warn sensibly,
  // with a plain-days floor for whichever comes first.
  if (daysLeft <= soonDays || daysLeft / cycleDays <= soonPercent / 100)
    return "soon";
  return "ok";
}

// Largest unit first, so both selection loops below can scan downwards.
const UNITS = [
  { key: "decades", days: 3650, one: "decade", many: "decades" },
  { key: "years", days: 365, one: "year", many: "years" },
  { key: "months", days: 30, one: "month", many: "months" },
  { key: "weeks", days: 7, one: "week", many: "weeks" },
  { key: "days", days: 1, one: "day", many: "days" },
] as const;

const DAYS_UNIT = UNITS[UNITS.length - 1];

// The coarsest unit worth using for a span. Requires at least 2 of a unit,
// otherwise a 6-day item would read "1 week" and lose more than it gains.
function naturalIndex(absDays: number) {
  const i = UNITS.findIndex((u) => Math.round(absDays / u.days) >= 2);
  return i === -1 ? UNITS.length - 1 : i;
}

// Units offered for an item: its natural unit and every finer one. A 4-day
// cycle therefore offers only days — weeks and months say nothing useful.
function selectableUnits(cycleDays: number) {
  return UNITS.slice(naturalIndex(cycleDays));
}

// One rounded figure plus its unit, so the countdown always fits one column.
function formatCountdown(daysLeft: number, chosen?: DisplayUnit) {
  const abs = Math.abs(daysLeft);
  const natural = naturalIndex(abs);
  const preferred = chosen ? UNITS.findIndex((u) => u.key === chosen) : -1;

  // UNITS runs coarse to fine, so the larger index is the finer unit. Taking
  // the finer of the two means a preference for smaller units is honoured
  // while it holds up, and quietly gives way as the date closes in.
  const unit = UNITS[Math.max(natural, preferred)] ?? DAYS_UNIT;

  const value = Math.round(abs / unit.days);
  return {
    value,
    unit: value === 1 ? unit.one : unit.many,
    suffix: daysLeft < 0 ? "over" : "left",
    sign: daysLeft < 0 ? "−" : "",
  };
}

const IconCalendar = () => (
  <svg
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconPencil = () => (
  <svg
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconGear = () => (
  <svg
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const App: React.FC = () => {
  const [items, setItems] = useLocalStorage<Item[]>("replacement-items", []);
  const [name, setName] = useState("");
  const [interval, setInterval] = useState(30);
  const [intervalUnit, setIntervalUnit] = useState("Days");
  const [category, setCategory] = useState("None");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editLastDate, setEditLastDate] = useState<string>("");
  const [editNextDate, setEditNextDate] = useState<string>("");
  const [editVerb, setEditVerb] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("None");
  const [editInterval, setEditInterval] = useState<number>(30);
  const [editIntervalUnit, setEditIntervalUnit] = useState<string>("Days");
  const [editDisplayUnit, setEditDisplayUnit] = useState<DisplayUnit>("days");

  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Add form is hidden by default
  const [showAddForm, setShowAddForm] = useState(false);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Dark mode in settings
  const [dark, setDark] = useDarkMode();

  // View mode: days, weeks, months
  // When an item turns amber, adjustable from Settings.
  const [soonPercent, setSoonPercent] = useLocalStorage<number>(
    "soon-percent",
    20
  );
  const [soonDays, setSoonDays] = useLocalStorage<number>("soon-days", 2);

  // Editable title
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useLocalStorage(
    "custom-title",
    "Replacement Tracker"
  );

  const modalRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Click outside the add form to cancel
  useEffect(() => {
    if (!showAddForm) return;
    function handleClick(event: MouseEvent) {
      if (
        formContainerRef.current &&
        !formContainerRef.current.contains(event.target as Node)
      ) {
        setShowAddForm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAddForm]);

  // Click outside the settings dialog to close
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(event: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  // Add new item, always set intervalUnit
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const lastReplaced = new Date().toISOString().slice(0, 10);
    const unit = intervalUnit || "Days";
    setItems([
      ...(items ?? []),
      {
        id: Date.now(),
        name: name.trim(),
        replacementInterval: interval,
        intervalUnit: unit,
        lastReplaced,
        category,
        verb: "Replace",
        displayUnit: selectableUnits(
          getCycleDays(lastReplaced, interval, unit)
        )[0].key,
      },
    ]);
    setName("");
    setInterval(30);
    setIntervalUnit("Days");
    setCategory("None");
  };

  const handleReplace = (id: number) => {
    setItems((items) =>
      (items ?? []).map((item) =>
        item.id === id
          ? { ...item, lastReplaced: new Date().toISOString().slice(0, 10) }
          : item
      )
    );
  };

  const handleDelete = (id: number) => {
    setItems((items ?? []).filter((item) => item.id !== id));
    setDeleteId(null);
  };

  const handleEdit = (item: Item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditLastDate(item.lastReplaced.slice(0, 10));
    const next = addInterval(
      item.lastReplaced.slice(0, 10),
      item.replacementInterval,
      item.intervalUnit || "Days"
    );
    setEditNextDate(toInputDate(next));
    setEditVerb(item.verb);
    setEditCategory(item.category);
    setEditInterval(item.replacementInterval);
    setEditIntervalUnit(item.intervalUnit || "Days");
    setEditDisplayUnit(
      item.displayUnit ??
        selectableUnits(
          getCycleDays(
            item.lastReplaced.slice(0, 10),
            item.replacementInterval,
            item.intervalUnit || "Days"
          )
        )[0].key
    );
  };

  // Last, Next and the interval describe one schedule, so editing any of them
  // keeps the others honest. Without this the Next field looked editable but
  // was never read back, and silently reverted on save.
  const changeLastDate = (value: string) => {
    setEditLastDate(value);
    if (isValidDate(value)) {
      setEditNextDate(
        toInputDate(addInterval(value, editInterval, editIntervalUnit || "Days"))
      );
    }
  };

  const changeNextDate = (value: string) => {
    setEditNextDate(value);
    if (isValidDate(value)) {
      setEditLastDate(
        toInputDate(
          addInterval(value, -editInterval, editIntervalUnit || "Days")
        )
      );
    }
  };

  const changeInterval = (value: number) => {
    setEditInterval(value);
    if (isValidDate(editLastDate)) {
      setEditNextDate(
        toInputDate(
          addInterval(editLastDate, value, editIntervalUnit || "Days")
        )
      );
    }
  };

  const changeIntervalUnit = (value: string) => {
    setEditIntervalUnit(value);
    if (isValidDate(editLastDate)) {
      setEditNextDate(
        toInputDate(addInterval(editLastDate, editInterval, value))
      );
    }
  };

  const handleEditSave = (id: number) => {
    // A cleared date input would otherwise reach toISOString as an Invalid
    // Date and throw, taking the whole render down.
    if (!isValidDate(editLastDate)) return;

    // The interval may have changed under the selection, so re-check that the
    // chosen unit is still one this item can offer.
    const options = selectableUnits(
      getCycleDays(editLastDate, editInterval, editIntervalUnit || "Days")
    );
    const savedUnit = options.some((u) => u.key === editDisplayUnit)
      ? editDisplayUnit
      : options[0].key;

    setItems((items) =>
      (items ?? []).map((item) =>
        item.id === id
          ? {
              ...item,
              name: editName.trim(),
              lastReplaced: editLastDate,
              replacementInterval: editInterval,
              intervalUnit: editIntervalUnit || "Days",
              verb: editVerb,
              category: editCategory,
              displayUnit: savedUnit,
            }
          : item
      )
    );
    setEditingId(null);
    setEditName("");
    setEditLastDate("");
    setEditNextDate("");
    setEditVerb("");
    setEditCategory("None");
    setEditInterval(30);
    setEditIntervalUnit("Days");
    setEditDisplayUnit("days");
    setShowAddForm(false); // Hide add form after editing, for mobile UX
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName("");
    setEditLastDate("");
    setEditNextDate("");
    setEditVerb("");
    setEditCategory("None");
    setEditInterval(30);
    setEditIntervalUnit("Days");
    setEditDisplayUnit("days");
    setShowAddForm(false); // Hide add form after cancel, for mobile UX
  };

  // Click outside the delete confirmation to dismiss it
  useEffect(() => {
    if (deleteId === null) return;
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setDeleteId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [deleteId]);

  const sortedItems = [...(items ?? [])].sort((a, b) => {
    const aLeft = calculateDaysLeft(
      a.lastReplaced,
      a.replacementInterval,
      a.intervalUnit || "Days"
    );
    const bLeft = calculateDaysLeft(
      b.lastReplaced,
      b.replacementInterval,
      b.intervalUnit || "Days"
    );
    return aLeft - bLeft;
  });

  // Guard against a cleared or out-of-range input in Settings.
  const soonPct = Math.min(100, Math.max(0, soonPercent ?? 20));
  const soonFloor = Math.max(0, soonDays ?? 2);

  const tally = { over: 0, soon: 0, ok: 0 };
  sortedItems.forEach((item) => {
    const unit = item.intervalUnit || "Days";
    const daysLeft = calculateDaysLeft(
      item.lastReplaced,
      item.replacementInterval,
      unit
    );
    const cycleDays = getCycleDays(
      item.lastReplaced,
      item.replacementInterval,
      unit
    );
    tally[getStatus(daysLeft, cycleDays, soonPct, soonFloor)] += 1;
  });

  return (
    <>
      <div className="app">
        <div className="shell">
          <header className="bar">
            {editingTitle ? (
              <input
                className="title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape")
                    setEditingTitle(false);
                }}
                autoFocus
                maxLength={40}
                aria-label="Tracker name"
              />
            ) : (
              // Button inside the heading: keeps the tracker name as the
              // heading's accessible name, and gives real keyboard activation.
              <h1 className="title-heading">
                <button
                  type="button"
                  className={`title${
                    title?.trim() ? "" : " title--placeholder"
                  }`}
                  onClick={() => setEditingTitle(true)}
                >
                  {/* A blank title would collapse to zero width, leaving
                      nothing to click and no way to set it again. */}
                  {title?.trim() ? title : "Name this tracker"}
                </button>
              </h1>
            )}
            <div className="bar-actions">
              {!showAddForm && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => setShowAddForm(true)}
                >
                  New
                </button>
              )}
              <button
                className="icon-btn"
                type="button"
                aria-label="Open settings"
                onClick={() => setSettingsOpen(true)}
              >
                <IconGear />
              </button>
            </div>
          </header>

          {showAddForm && (
            <div className="addform" ref={formContainerRef}>
              <form
                onSubmit={(e) => {
                  handleAdd(e);
                  setShowAddForm(false);
                }}
              >
                <div className="addform__row">
                  <input
                    className="field field--name"
                    placeholder="What needs looking after?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    required
                    autoFocus
                    aria-label="Item name"
                  />
                  <input
                    type="number"
                    className="field field--num"
                    min={1}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    required
                    aria-label="Interval"
                  />
                  <select
                    className="field field--select"
                    value={intervalUnit}
                    onChange={(e) => setIntervalUnit(e.target.value)}
                    aria-label="Interval unit"
                  >
                    {intervalUnits.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                  <select
                    className="field field--select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="Category"
                  >
                    {categories.map((cat) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                  <button className="btn" type="submit">
                    Add
                  </button>
                </div>
              </form>
            </div>
          )}

          {sortedItems.length > 0 && (
            <div className="summary">
              <span className="summary__item" style={stateVar("over")}>
                <span className="dot" />
                <b>{tally.over}</b> overdue
              </span>
              <span className="summary__item" style={stateVar("soon")}>
                <span className="dot" />
                <b>{tally.soon}</b> due soon
              </span>
              <span className="summary__item" style={stateVar("ok")}>
                <span className="dot" />
                <b>{tally.ok}</b> scheduled
              </span>
            </div>
          )}

          {sortedItems.length === 0 ? (
            <div className="empty">
              Nothing tracked yet. Add the first thing you keep forgetting.
            </div>
          ) : (
            <div className="list">
              {sortedItems.map((item) => {
                const unit = item.intervalUnit || "Days";
                const daysLeft = calculateDaysLeft(
                  item.lastReplaced,
                  item.replacementInterval,
                  unit
                );
                const cycleDays = getCycleDays(
                  item.lastReplaced,
                  item.replacementInterval,
                  unit
                );
                const status = getStatus(
                  daysLeft,
                  cycleDays,
                  soonPct,
                  soonFloor
                );
                const pct = Math.min(
                  100,
                  Math.max(0, (1 - daysLeft / cycleDays) * 100)
                );
                const isEditing = editingId === item.id;
                const countdown = formatCountdown(daysLeft, item.displayUnit);

                // Recomputed from the live edit fields so the choices track
                // whatever interval is being typed in right now.
                const editOptions = isEditing
                  ? selectableUnits(
                      getCycleDays(
                        editLastDate,
                        editInterval,
                        editIntervalUnit || "Days"
                      )
                    )
                  : UNITS;
                const editUnit = editOptions.some(
                  (u) => u.key === editDisplayUnit
                )
                  ? editDisplayUnit
                  : editOptions[0].key;

                // The preview describes the values being typed, so its colour
                // has to come from those too — not from the saved row.
                const editDateOk = isEditing && isValidDate(editLastDate);
                const editDaysLeft = editDateOk
                  ? calculateDaysLeft(
                      editLastDate,
                      editInterval,
                      editIntervalUnit || "Days"
                    )
                  : 0;
                const editStatus = editDateOk
                  ? getStatus(
                      editDaysLeft,
                      getCycleDays(
                        editLastDate,
                        editInterval,
                        editIntervalUnit || "Days"
                      ),
                      soonPct,
                      soonFloor
                    )
                  : status;

                const figure = `${countdown.sign}${countdown.value}`;

                return (
                  <div className={`row row--${status}`} key={item.id}>
                    <div className="gauge">
                      <span
                        className={`gauge__num${
                          figure.length >= 4
                            ? " gauge__num--sm"
                            : figure.length === 3
                            ? " gauge__num--md"
                            : ""
                        }`}
                      >
                        {figure}
                      </span>
                      <span className="gauge__unit">
                        <strong>{countdown.unit}</strong>
                        <span>{countdown.suffix}</span>
                      </span>
                    </div>

                    <div className="row__body">
                      {!isEditing ? (
                        <>
                          <div className="row__head">
                            <span className="row__name">{item.name}</span>
                            {item.category !== "None" && (
                              <span className="row__cat">{item.category}</span>
                            )}
                          </div>
                          <div className="row__desc">
                            {item.verb} every {item.replacementInterval}{" "}
                            {unitLabel(item.replacementInterval, unit)}
                          </div>

                          <div className="track">
                            <div
                              className="track__fill"
                              style={
                                {
                                  "--pct": `${pct}%`,
                                } as React.CSSProperties
                              }
                            />
                          </div>

                          <div className="row__foot">
                            <div className="row__dates">
                              <span>
                                Last{" "}
                                {formatDate(
                                  new Date(item.lastReplaced + "T00:00:00")
                                )}
                              </span>
                              <span>
                                Next{" "}
                                {calculateNextDate(
                                  item.lastReplaced,
                                  item.replacementInterval,
                                  unit
                                )}
                              </span>
                            </div>
                            <div className="row__actions">
                              <button
                                className="icon-btn"
                                title="Mark done today"
                                aria-label={`Mark ${item.name} done today`}
                                onClick={() => handleReplace(item.id)}
                              >
                                <IconCalendar />
                              </button>
                              <button
                                className="icon-btn"
                                title="Edit"
                                aria-label={`Edit ${item.name}`}
                                onClick={() => handleEdit(item)}
                              >
                                <IconPencil />
                              </button>
                              <button
                                className="icon-btn"
                                title="Delete"
                                aria-label={`Delete ${item.name}`}
                                onClick={() => setDeleteId(item.id)}
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="edit">
                          <input
                            className="field field--name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={40}
                            autoFocus
                            aria-label="Item name"
                          />
                          <div className="edit__inline">
                            <select
                              className="field field--select"
                              value={editVerb}
                              onChange={(e) => setEditVerb(e.target.value)}
                              aria-label="Action"
                            >
                              {verbs.map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                            <span>every</span>
                            <input
                              type="number"
                              className="field field--num"
                              value={editInterval}
                              min={1}
                              onChange={(e) =>
                                changeInterval(Number(e.target.value))
                              }
                              aria-label="Interval"
                            />
                            <select
                              className="field field--select"
                              value={editIntervalUnit}
                              onChange={(e) =>
                                changeIntervalUnit(e.target.value)
                              }
                              aria-label="Interval unit"
                            >
                              {intervalUnits.map((u) => (
                                <option key={u}>{u}</option>
                              ))}
                            </select>
                            <select
                              className="field field--select"
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              aria-label="Category"
                            >
                              {categories.map((cat) => (
                                <option key={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                          <div className="edit__meta">
                            {editOptions.length > 1 && (
                              <label className="edit__field">
                                <span>Count down in</span>
                                <select
                                  className="field field--select field--unit"
                                  value={editUnit}
                                  onChange={(e) =>
                                    setEditDisplayUnit(
                                      e.target.value as DisplayUnit
                                    )
                                  }
                                  aria-label="Countdown unit"
                                >
                                  {[...editOptions].reverse().map((u) => (
                                    <option key={u.key} value={u.key}>
                                      {u.many.charAt(0).toUpperCase() +
                                        u.many.slice(1)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            <label className="edit__field">
                              <span>Last</span>
                              <input
                                type="date"
                                className="field field--date"
                                value={editLastDate}
                                onChange={(e) =>
                                  changeLastDate(e.target.value)
                                }
                              />
                            </label>
                            <label className="edit__field">
                              <span>Next</span>
                              <input
                                type="date"
                                className="field field--date"
                                value={editNextDate}
                                onChange={(e) =>
                                  changeNextDate(e.target.value)
                                }
                              />
                            </label>
                          </div>
                          <div
                            className={`edit__status${
                              editDateOk ? "" : " edit__status--hint"
                            }`}
                            style={editDateOk ? stateVar(editStatus) : undefined}
                          >
                            {(() => {
                              if (!editDateOk) return "Set a last date to save";
                              const c = formatCountdown(editDaysLeft, editUnit);
                              return `${c.value} ${c.unit} ${
                                editDaysLeft < 0 ? "overdue" : "left"
                              }`;
                            })()}
                          </div>
                          <div className="edit__actions">
                            <button
                              className="btn"
                              onClick={() => handleEditSave(item.id)}
                              disabled={!editDateOk}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn--quiet"
                              onClick={handleEditCancel}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {deleteId !== null && (
          <div className="modal-overlay">
            <div className="modal" ref={modalRef}>
              <h2 className="modal__title">Delete this item?</h2>
              <p className="modal__text">
                Its history and schedule will be removed. This can't be undone.
              </p>
              <div className="modal__actions">
                <button
                  className="btn btn--quiet"
                  onClick={() => setDeleteId(null)}
                >
                  Keep it
                </button>
                <button className="btn" onClick={() => handleDelete(deleteId)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="modal-overlay">
            <div className="modal" ref={settingsRef}>
              <h2 className="modal__title">Settings</h2>

              <div className="setting">
                <div className="setting__label">Theme</div>
                <button className="btn btn--quiet" onClick={() => setDark((d) => !d)}>
                  {dark ? "Switch to day mode" : "Switch to night mode"}
                </button>
              </div>

              <div className="setting">
                <div className="setting__label">When items turn amber</div>
                <div className="legend">
                  <span className="legend__item" style={stateVar("ok")}>
                    <span className="dot" />
                    On track
                  </span>
                  <span className="legend__item" style={stateVar("soon")}>
                    <span className="dot" />
                    Due soon
                  </span>
                  <span className="legend__item" style={stateVar("over")}>
                    <span className="dot" />
                    Past due
                  </span>
                </div>
                <div className="rule">
                  <label className="rule__line">
                    Warn when
                    <input
                      type="number"
                      className="field field--num"
                      min={0}
                      max={100}
                      value={soonPct}
                      onChange={(e) =>
                        setSoonPercent(
                          Math.min(100, Math.max(0, Number(e.target.value) || 0))
                        )
                      }
                      aria-label="Percent of cycle remaining"
                    />
                    % of the cycle is left
                  </label>
                  <label className="rule__line">
                    or when
                    <input
                      type="number"
                      className="field field--num"
                      min={0}
                      value={soonFloor}
                      onChange={(e) =>
                        setSoonDays(Math.max(0, Number(e.target.value) || 0))
                      }
                      aria-label="Days remaining"
                    />
                    days are left
                  </label>
                </div>
                <p className="setting__note">
                  Whichever comes first. On a 90-day cycle that means{" "}
                  {Math.max(soonFloor, Math.round((90 * soonPct) / 100))} days'
                  notice. Items turn red on their own once past due.
                </p>
              </div>

              <div className="modal__actions" style={{ marginTop: "1.25rem" }}>
                <button className="btn" onClick={() => setSettingsOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <SpeedInsights />
    </>
  );
};

function stateVar(status: Status): React.CSSProperties {
  return { "--state": `var(--${status})` } as React.CSSProperties;
}

export default App;
