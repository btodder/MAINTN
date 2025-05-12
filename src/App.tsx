import React, { useState, useEffect, useRef } from "react";
import useLocalStorage from "use-local-storage";
import { SpeedInsights } from "@vercel/speed-insights/react";

const categories = ["Hygiene", "Expiration", "Performance", "Plants", "None"];
const verbs = ["Appointment", "Meeting", "Replace", "Check", "Water"];
const intervalUnits = ["Days", "Weeks", "Months", "Years"];

type ViewMode = "days" | "weeks" | "months";

type Item = {
  id: number;
  name: string;
  replacementInterval: number;
  intervalUnit: string;
  lastReplaced: string;
  category: string;
  verb: string;
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

function calculateDaysBetween(date1: string, date2: string, unit: string) {
  const d1 = new Date(date1 + "T00:00:00");
  const d2 = new Date(date2 + "T00:00:00");
  let diff = d2.getTime() - d1.getTime();
  switch (unit) {
    case "Days":
      return Math.round(diff / (1000 * 60 * 60 * 24));
    case "Weeks":
      return Math.round(diff / (1000 * 60 * 60 * 24 * 7));
    case "Months":
      return (
        d2.getMonth() -
        d1.getMonth() +
        12 * (d2.getFullYear() - d1.getFullYear())
      );
    case "Years":
      return d2.getFullYear() - d1.getFullYear();
    default:
      return Math.round(diff / (1000 * 60 * 60 * 24));
  }
}

function calculateDaysLeft(lastReplaced: string, interval: number, unit: string) {
  const last = new Date(lastReplaced + "T00:00:00");
  const now = new Date();
  let next = addInterval(lastReplaced, interval, unit);
  const diff = Math.ceil((next.getTime() - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  return diff;
}

function calculateNextDate(lastReplaced: string, interval: number, unit: string) {
  const next = addInterval(lastReplaced, interval, unit);
  return next.toLocaleDateString();
}

function getTimeLeftDisplay(daysLeft: number, view: ViewMode) {
  if (view === "days") {
    return `${daysLeft} days left`;
  } else if (view === "weeks") {
    const weeks = Math.floor(daysLeft / 7);
    const days = daysLeft % 7;
    return `${weeks} weeks${days ? `, ${days} days` : ""} left`;
  } else if (view === "months") {
    const months = Math.floor(daysLeft / 30);
    const weeks = Math.floor((daysLeft % 30) / 7);
    const days = daysLeft % 7;
    let str = "";
    if (months) str += `${months} mo`;
    if (weeks) str += (str ? ", " : "") + `${weeks} wk`;
    if (days) str += (str ? ", " : "") + `${days} d`;
    return str ? `${str} left` : "0 days left";
  }
}

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
  const [intervalDialogOpen, setIntervalDialogOpen] = useState(false);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [verbMenuOpen, setVerbMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  // Add form is hidden by default
  const [showAddForm, setShowAddForm] = useState(false);

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Dark mode in settings
  const [dark, setDark] = useDarkMode();

  // View mode: days, weeks, months
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>("view-mode", "days");

  // Editable title
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useLocalStorage("custom-title", "Replacement Tracker");

  const modalRef = useRef<HTMLDivElement>(null);
  const intervalDialogRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLSpanElement>(null);
  const verbRef = useRef<HTMLSpanElement>(null);
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
    setItems([
      ...(items ?? []),
      {
        id: Date.now(),
        name: name.trim(),
        replacementInterval: interval,
        intervalUnit: intervalUnit || "Days",
        lastReplaced: new Date().toISOString().slice(0, 10),
        category,
        verb: "Replace"
      }
    ]);
    setName("");
    setInterval(30);
    setIntervalUnit("Days");
    setCategory("None");
  };

  const handleReplace = (id: number) => {
    setItems(items =>
      items.map(item =>
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
    const next = addInterval(item.lastReplaced.slice(0, 10), item.replacementInterval, item.intervalUnit || "Days");
    setEditNextDate(next.toISOString().slice(0, 10));
    setEditVerb(item.verb);
    setEditCategory(item.category);
    setEditInterval(item.replacementInterval);
    setEditIntervalUnit(item.intervalUnit || "Days");
  };

  const handleEditSave = (id: number) => {
    setItems(items =>
      items.map(item =>
        item.id === id
          ? {
              ...item,
              name: editName.trim(),
              lastReplaced: new Date(editLastDate + "T00:00:00").toISOString().slice(0, 10),
              replacementInterval: editInterval,
              intervalUnit: editIntervalUnit || "Days",
              verb: editVerb,
              category: editCategory
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
    setIntervalDialogOpen(false);
    setVerbMenuOpen(false);
    setCategoryMenuOpen(false);
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
    setIntervalDialogOpen(false);
    setVerbMenuOpen(false);
    setCategoryMenuOpen(false);
    setShowAddForm(false); // Hide add form after cancel, for mobile UX
  };

  // Click outside for menus/dialogs (for edit mode menus)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (deleteId !== null && modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setDeleteId(null);
      }
      if (intervalDialogOpen && intervalDialogRef.current && !intervalDialogRef.current.contains(event.target as Node)) {
        setIntervalDialogOpen(false);
      }
      if (verbMenuOpen && verbRef.current && !verbRef.current.contains(event.target as Node)) {
        setVerbMenuOpen(false);
      }
      if (categoryMenuOpen && categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
      }
    }
    if (deleteId !== null || intervalDialogOpen || verbMenuOpen || categoryMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [deleteId, intervalDialogOpen, verbMenuOpen, categoryMenuOpen]);

  const sortedItems = [...(items ?? [])].sort((a, b) => {
    const aLeft = calculateDaysLeft(a.lastReplaced, a.replacementInterval, a.intervalUnit || "Days");
    const bLeft = calculateDaysLeft(b.lastReplaced, b.replacementInterval, b.intervalUnit || "Days");
    return aLeft - bLeft;
  });

  const iconColor = dark ? "#fff" : "#000";

  return (
    <div className="App">
      {/* Settings Dialog */}
      {settingsOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog settings-dialog" ref={settingsRef} style={{ minWidth: 340 }}>
            <div className="modal-title">Settings</div>
            <div style={{ textAlign: "left", marginBottom: 18 }}>
              <div style={{ marginBottom: 10 }}>
                <b>Theme:</b>
                <button
                  className="modal-btn"
                  style={{ marginLeft: 10 }}
                  onClick={() => setDark(d => !d)}
                >
                  {dark ? "Switch to Day Mode" : "Switch to Night Mode"}
                </button>
              </div>
              <div>
                <b>View Options:</b>
                <div style={{ marginTop: 8 }}>
                  <label>
                    <input
                      type="radio"
                      checked={viewMode === "days"}
                      onChange={() => setViewMode("days")}
                    />{" "}
                    Days left
                  </label>
                  <br />
                  <label>
                    <input
                      type="radio"
                      checked={viewMode === "weeks"}
                      onChange={() => setViewMode("weeks")}
                    />{" "}
                    Weeks (days & weeks left)
                  </label>
                  <br />
                  <label>
                    <input
                      type="radio"
                      checked={viewMode === "months"}
                      onChange={() => setViewMode("months")}
                    />{" "}
                    Months (months, weeks & days left)
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-btn-row">
              <button className="modal-btn" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editable Title */}
      <h1
        className={`centered-title${editingTitle ? " editing-title" : ""}`}
        style={{
          cursor: "pointer",
          textDecoration: editingTitle ? "none" : undefined
        }}
        onMouseEnter={e => {
          if (!editingTitle) e.currentTarget.style.textDecoration = "underline";
        }}
        onMouseLeave={e => {
          if (!editingTitle) e.currentTarget.style.textDecoration = "none";
        }}
        onClick={() => setEditingTitle(true)}
        tabIndex={0}
      >
        {editingTitle ? (
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false);
            }}
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              background: "none",
              border: "none",
              outline: "none",
              textAlign: "center",
              width: "100%",
              color: "var(--color-text)"
            }}
            autoFocus
            maxLength={40}
          />
        ) : (
          title
        )}
      </h1>

      <div className="main-container">
        <div className="add-row">
          {!showAddForm ? (
            <>
              <button
                className="new-btn"
                type="button"
                onClick={() => setShowAddForm(true)}
              >
                New
              </button>
              <button
                className="icon-btn gear-btn"
                aria-label="Open settings"
                type="button"
                onClick={() => setSettingsOpen(true)}
                style={{ alignSelf: "flex-start", marginTop: "0.25rem" }}
              >
                {/* Gear Icon */}
                <svg width="24" height="24" fill="none" stroke={iconColor} strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <div className="add-form-container" ref={formContainerRef}>
                <form
                  className="input-form"
                  onSubmit={e => {
                    handleAdd(e);
                    setShowAddForm(false);
                  }}
                  style={{ flex: 1, margin: 0, width: "100%" }}
                >
                  <div className="input-row">
                    <input
                      placeholder="Item"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={40}
                      required
                      className="item-input"
                      style={{
                        color: "var(--color-text)",
                        background: "var(--color-card)",
                        flex: 1
                      }}
                    />
                    <input
                      type="number"
                      min={1}
                      value={interval}
                      onChange={(e) => setInterval(Number(e.target.value))}
                      required
                      placeholder="Interval"
                      style={{
                        width: 70,
                        color: "var(--color-text)",
                        background: "var(--color-card)"
                      }}
                    />
                    <select value={intervalUnit} onChange={e => setIntervalUnit(e.target.value)} style={{ width: 90 }}>
                      {intervalUnits.map(u => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 110 }}>
                      {categories.map((cat) => (
                        <option key={cat}>{cat}</option>
                      ))}
                    </select>
                    <button className="replace-btn" type="submit" style={{ width: 80 }}>
                      Add
                    </button>
                  </div>
                </form>
              </div>
              <button
                className="icon-btn gear-btn"
                aria-label="Open settings"
                type="button"
                onClick={() => setSettingsOpen(true)}
                style={{ alignSelf: "flex-start", marginTop: "0.25rem" }}
              >
                {/* Gear Icon */}
                <svg width="24" height="24" fill="none" stroke={iconColor} strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* TASKS/CARDS RENDER HERE */}
        {(sortedItems ?? []).length === 0 && (
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            No items yet. Add something to track!
          </div>
        )}
        {(sortedItems ?? []).map((item, idx) => {
          const daysLeft = calculateDaysLeft(
            item.lastReplaced,
            item.replacementInterval,
            item.intervalUnit || "Days"
          );
          const nextDate = calculateNextDate(
            item.lastReplaced,
            item.replacementInterval,
            item.intervalUnit || "Days"
          );
          const isEditing = editingId === item.id;
          return (
            <React.Fragment key={item.id}>
              <div className={`card${isEditing ? " card-editing" : ""}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="task-name">
                      {isEditing ? (
                        <>
                          <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                            placeholder="Rename item"
                            style={{
                              fontSize: "1.08rem",
                              fontWeight: 700,
                              minWidth: 120,
                              borderRadius: 6,
                              border: "1px solid var(--color-border)",
                              padding: "0.2rem 0.5rem",
                              background: "var(--color-card)",
                              color: "var(--color-text)"
                            }}
                          />
                          {" "}
                          <span
                            className="category category-edit"
                            ref={categoryRef}
                            tabIndex={0}
                            style={{
                              textDecoration: categoryMenuOpen ? "underline" : "none",
                              cursor: "pointer",
                              position: "relative"
                            }}
                            onMouseEnter={e => isEditing && (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={e => isEditing && (e.currentTarget.style.textDecoration = "none")}
                            onClick={e => {
                              if (isEditing) setCategoryMenuOpen(!categoryMenuOpen);
                            }}
                          >
                            {editCategory}
                            {categoryMenuOpen && isEditing && (
                              <div className="category-menu" style={{
                                left: "50%",
                                transform: "translateX(-50%)",
                                top: "1.8rem"
                              }}>
                                {categories.map(cat => (
                                  <div
                                    key={cat}
                                    className="category-menu-item"
                                    onClick={() => {
                                      setEditCategory(cat);
                                      setCategoryMenuOpen(false);
                                    }}
                                  >
                                    {cat}
                                  </div>
                                ))}
                              </div>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          {item.name}
                          {item.category !== "None" && (
                            <span className="category">{item.category}</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="days-left" style={{ marginTop: "0.15rem" }}>
                      {daysLeft < 0 ? (
                        <span style={{ color: "var(--color-danger)" }}>{Math.abs(daysLeft)} days overdue</span>
                      ) : (
                        <span>{getTimeLeftDisplay(daysLeft, viewMode)}</span>
                      )}
                    </div>
                    <div className="meta-grey" style={{ position: "relative" }}>
                      {isEditing ? (
                        <>
                          <span
                            className="verb-select"
                            ref={verbRef}
                            tabIndex={0}
                            style={{
                              textDecoration: verbMenuOpen ? "underline" : "none",
                              cursor: "pointer",
                              position: "relative"
                            }}
                            onMouseEnter={e => isEditing && (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={e => isEditing && (e.currentTarget.style.textDecoration = "none")}
                            onClick={e => {
                              if (isEditing) setVerbMenuOpen(!verbMenuOpen);
                            }}
                          >
                            {editVerb}
                            {verbMenuOpen && isEditing && (
                              <div className="verb-menu" style={{
                                left: "50%",
                                transform: "translateX(-50%)",
                                top: "1.8rem"
                              }}>
                                {verbs.map(v => (
                                  <div
                                    key={v}
                                    className="verb-menu-item"
                                    onClick={() => {
                                      setEditVerb(v);
                                      setVerbMenuOpen(false);
                                    }}
                                  >
                                    {v}
                                  </div>
                                ))}
                              </div>
                            )}
                          </span>
                          {" every "}
                          <span
                            className="interval-edit"
                            tabIndex={0}
                            style={{
                              textDecoration: intervalDialogOpen ? "underline" : "none",
                              cursor: "pointer"
                            }}
                            onMouseEnter={e => isEditing && (e.currentTarget.style.textDecoration = "underline")}
                            onMouseLeave={e => isEditing && (e.currentTarget.style.textDecoration = "none")}
                            onClick={e => {
                              if (isEditing) setIntervalDialogOpen(true);
                            }}
                          >
                            {editInterval} {editIntervalUnit.toLowerCase()}
                            {intervalDialogOpen && (
                              <div className="interval-dialog" ref={intervalDialogRef}>
                                <input
                                  type="number"
                                  min={1}
                                  value={editInterval}
                                  onChange={e => setEditInterval(Number(e.target.value))}
                                  style={{
                                    width: 60,
                                    marginRight: 8,
                                    background: "var(--color-card)",
                                    color: "var(--color-text)"
                                  }}
                                />
                                <select value={editIntervalUnit} onChange={e => setEditIntervalUnit(e.target.value)}>
                                  {intervalUnits.map(u => (
                                    <option key={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{item.verb} every <b>{item.replacementInterval}</b> {(item.intervalUnit || "Days").toLowerCase()}.</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="actions-row" style={{ alignItems: "flex-start", marginLeft: "0.5rem" }}>
                    {!isEditing ? (
                      <>
                        <button
                          className="icon-btn"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => handleEdit(item)}
                        >
                          {/* Pencil icon */}
                          <svg width="20" height="20" fill="none" stroke={iconColor} strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                        <button
                          className="icon-btn"
                          title="Replace now"
                          aria-label="Replace now"
                          onClick={() => handleReplace(item.id)}
                        >
                          {/* Refresh icon */}
                          <svg width="20" height="20" fill="none" stroke={iconColor} strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M4 4v5h5" />
                            <path d="M19 20v-5h-5" />
                            <path d="M5 9a9 9 0 0 1 14 6" />
                            <path d="M19 15a9 9 0 0 1-14-6" />
                          </svg>
                        </button>
                        <button
                          className="icon-btn"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => setDeleteId(item.id)}
                        >
                          {/* Trash icon */}
                          <svg width="20" height="20" fill="none" stroke={iconColor} strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="modal-btn"
                          onClick={() => handleEditSave(item.id)}
                        >
                          Save
                        </button>
                        <button className="modal-btn" onClick={handleEditCancel}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="meta-row">
                  <div></div>
                  <div className={`meta-info${isEditing ? " edit-meta-info" : ""}`}>
                    {isEditing ? (
                      <>
                        <div>
                          <span className="calendar-label">Next:</span>
                          <input
                            type="date"
                            value={editNextDate}
                            onChange={e => {
                              setEditNextDate(e.target.value);
                              setEditInterval(
                                calculateDaysBetween(
                                  editLastDate,
                                  e.target.value,
                                  editIntervalUnit || "Days"
                                )
                              );
                            }}
                            className="calendar-date"
                            style={{
                              background: "var(--color-card)",
                              color: "var(--color-text)"
                            }}
                          />
                        </div>
                        <div style={{ marginTop: "0.5rem" }}>
                          <span className="calendar-label">Last:</span>
                          <input
                            type="date"
                            value={editLastDate}
                            onChange={e => {
                              setEditLastDate(e.target.value);
                              setEditInterval(
                                calculateDaysBetween(
                                  e.target.value,
                                  editNextDate,
                                  editIntervalUnit || "Days"
                                )
                              );
                            }}
                            className="calendar-date"
                            style={{
                              background: "var(--color-card)",
                              color: "var(--color-text)"
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        Next: {nextDate}<br />
                        Last: {new Date(item.lastReplaced + "T00:00:00").toLocaleDateString()}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="card-divider" />
            </React.Fragment>
          );
        })}
        {deleteId !== null && (
          <div className="modal-overlay">
            <div className="modal-dialog" ref={modalRef}>
              <div className="modal-title">Delete Item</div>
              <div style={{ marginBottom: "1.5rem" }}>
                Are you sure you want to delete this item?
              </div>
              <div className="modal-btn-row">
                <button
                  className="modal-btn"
                  onClick={() => handleDelete(deleteId)}
                >
                  Delete
                </button>
                <button className="modal-btn" onClick={() => setDeleteId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <SpeedInsights />
    </div>
  );
};

export default App;
