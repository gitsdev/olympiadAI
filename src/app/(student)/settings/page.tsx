"use client";

import { useState } from "react";
import {
  BookOpen, Target, Bell, Mail, Users, Globe,
  PencilLine, LogOut, Zap, Check, X, Loader2, Save, Lock,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { OABadge, OACard, OAAvatar, OAButton, OASubjectDot, type Subject } from "@/components/ui";
import { logout, changePassword } from "@/actions/auth";
import { updateProfile } from "@/actions/student";
import { useStudent } from "@/contexts/StudentContext";
import type { Board } from "@/types/database";

const ALL_SUBJECTS: Subject[] = ["Mathematics", "Science", "English", "General Knowledge", "Cyber"];

const TOGGLES = [
  { Icon: Bell,  title: "Practice reminders",         sub: "A nudge if you haven't practiced by 6pm", defaultOn: true  },
  { Icon: Mail,  title: "Weekly progress email",      sub: "Sent to your parent every Sunday",         defaultOn: true  },
  { Icon: Users, title: "Show me on the leaderboard", sub: "Compete with your batch",                  defaultOn: true  },
  { Icon: Globe, title: "Sound effects",              sub: "Plays on correct answers and badges",      defaultOn: false },
];

export default function SettingsPage() {
  const user = useStudent();

  /* ── edit state ── */
  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(user.name);
  const [board, setBoard]       = useState<Board>(user.board as Board);
  const [cls, setCls]           = useState(user.cls);
  const [subjects, setSubjects] = useState<Subject[]>(user.subjects as Subject[]);
  const [goal, setGoal]         = useState(30);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  /* ── change password state ── */
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword]   = useState("");
  const [newPassword, setNewPassword]           = useState("");
  const [confirmPassword, setConfirmPassword]   = useState("");
  const [pwSaving, setPwSaving]                 = useState(false);
  const [pwError, setPwError]                   = useState("");
  const [pwSuccess, setPwSuccess]               = useState(false);

  function openPasswordChange() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwError("");
    setPwSuccess(false);
    setChangingPassword(true);
  }

  function cancelPasswordChange() {
    setChangingPassword(false);
    setPwError("");
  }

  async function submitPasswordChange() {
    if (newPassword.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setPwError("New passwords don't match."); return; }
    setPwSaving(true);
    setPwError("");
    const formData = new FormData();
    formData.set("current_password", currentPassword);
    formData.set("password", newPassword);
    formData.set("confirm_password", confirmPassword);
    const result = await changePassword(formData);
    setPwSaving(false);
    if (result.error) { setPwError(result.error); return; }
    setPwSuccess(true);
    setChangingPassword(false);
  }

  function openEdit() {
    setName(user.name);
    setBoard(user.board as Board);
    setCls(user.cls);
    setSubjects(user.subjects as Subject[]);
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  function toggleSubject(s: Subject) {
    setSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function save() {
    if (!name.trim()) { setError("Name cannot be empty."); return; }
    if (subjects.length === 0) { setError("Select at least one subject."); return; }
    setSaving(true);
    setError("");
    const result = await updateProfile({ fullName: name.trim(), board, classLevel: cls, subjects });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setEditing(false);
  }

  const level = Math.max(1, Math.floor(user.totalPoints / 500) + 1);

  return (
    <AppShell title="Settings" subtitle="Account & preferences">
      <div className="max-w-[720px] mx-auto px-4 sm:px-7 py-6 pb-10 flex flex-col gap-4">

        {/* ── Profile card ── */}
        <OACard style={{ padding: "22px 24px" }}>
          {!editing ? (
            /* View mode */
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <OAAvatar name={user.name} size={56} />
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-[19px] sm:text-[21px] tracking-tight truncate" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.015em" }}>
                    {user.name}
                  </h2>
                  <p className="text-[13px] mt-0.5 truncate" style={{ color: "var(--fg-muted)" }}>{user.email || "—"}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <OABadge tone="cobalt">{user.board}</OABadge>
                    <OABadge tone="neutral">Class {user.cls}</OABadge>
                    <OABadge tone="gold" className="gap-1.5"><Zap size={11} />Level {level}</OABadge>
                  </div>
                </div>
              </div>
              <OAButton variant="secondary" size="sm" onClick={openEdit} className="self-start sm:self-auto">
                <PencilLine size={14} /> Edit
              </OAButton>
            </div>
          ) : (
            /* Edit mode */
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <OAAvatar name={name || user.name} size={52} />
                <div className="flex-1">
                  <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--ink-700)" }}>Full name</p>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
                    style={{ background: "var(--surface)", color: "var(--ink-900)" }}
                  />
                </div>
              </div>

              {/* Board */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--ink-700)" }}>Board</p>
                <div className="flex gap-2.5">
                  {(["CBSE", "ICSE"] as Board[]).map((b) => (
                    <button
                      key={b}
                      onClick={() => setBoard(b)}
                      className="flex-1 py-2.5 rounded-[var(--r-md)] border-[1.5px] text-[14px] font-semibold cursor-pointer transition-all duration-[140ms]"
                      style={{
                        borderColor: board === b ? "var(--cobalt-400)" : "var(--line-300)",
                        background:  board === b ? "var(--cobalt-50)"  : "var(--surface)",
                        color:       board === b ? "var(--cobalt-700)" : "var(--ink-700)",
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--ink-700)" }}>Class</p>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[1,2,3,4,5,6,7,8,9,10].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCls(c)}
                      className="py-2 rounded-[var(--r-md)] border-[1.5px] text-[13px] font-bold cursor-pointer transition-all duration-[140ms]"
                      style={{
                        fontFamily:  "var(--font-mono)",
                        borderColor: cls === c ? "var(--cobalt-400)" : "var(--line-300)",
                        background:  cls === c ? "var(--cobalt-50)"  : "var(--surface)",
                        color:       cls === c ? "var(--cobalt-700)" : "var(--ink-700)",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-[13px] px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <OAButton variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                  <X size={14} /> Cancel
                </OAButton>
                <span className="flex-1" />
                <OAButton variant="primary" size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? "Saving…" : "Save profile"}
                </OAButton>
              </div>
            </div>
          )}
        </OACard>

        {/* ── Subjects ── */}
        <OACard style={{ padding: "20px 24px" }}>
          <SettingHeader Icon={BookOpen} title="Subjects" sub="Choose what OlympiadAI prepares you for." />
          <div className="flex flex-wrap gap-2.5 mt-3.5">
            {ALL_SUBJECTS.map((s) => {
              const on = subjects.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleSubject(s)}
                  className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold px-3.5 py-2 rounded-full border-[1.5px] cursor-pointer transition-all duration-[140ms]"
                  style={{
                    borderColor: on ? "var(--cobalt-300)" : "var(--line-300)",
                    background:  on ? "var(--cobalt-50)"  : "var(--surface)",
                    color:       on ? "var(--cobalt-700)" : "var(--ink-700)",
                  }}
                >
                  <OASubjectDot subject={s} size={8} />
                  {s}
                  {on && <Check size={12} style={{ color: "var(--cobalt-600)" }} />}
                </button>
              );
            })}
          </div>
        </OACard>

        {/* ── Change password ── */}
        <OACard style={{ padding: "20px 24px" }}>
          <SettingHeader Icon={Lock} title="Password" sub="Change the password you use to sign in." />

          {pwSuccess && !changingPassword && (
            <p className="text-[13px] px-3 py-2 rounded-[var(--r-md)] mt-3.5 max-w-[360px]" style={{ background: "var(--success-bg)", color: "var(--success-tx)" }}>
              Password updated.
            </p>
          )}

          {!changingPassword ? (
            <OAButton variant="secondary" size="sm" onClick={openPasswordChange} className="mt-3.5">
              <Lock size={14} /> Change password
            </OAButton>
          ) : (
            <div className="flex flex-col gap-3.5 mt-4 max-w-[360px]">
              <div>
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--ink-700)" }}>Current password</p>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
                  style={{ background: "var(--surface)", color: "var(--ink-900)" }}
                />
              </div>
              <div>
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--ink-700)" }}>New password</p>
                <input
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
                  style={{ background: "var(--surface)", color: "var(--ink-900)" }}
                />
              </div>
              <div>
                <p className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--ink-700)" }}>Confirm new password</p>
                <input
                  type="password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full border border-[var(--line-300)] rounded-[var(--r-md)] px-3 py-[9px] text-[14px] outline-none focus:border-[var(--cobalt-400)] focus:ring-2 focus:ring-[var(--cobalt-500)]/20 transition-colors"
                  style={{ background: "var(--surface)", color: "var(--ink-900)" }}
                />
              </div>

              {pwError && (
                <p className="text-[13px] px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
                  {pwError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <OAButton variant="ghost" size="sm" onClick={cancelPasswordChange} disabled={pwSaving}>
                  <X size={14} /> Cancel
                </OAButton>
                <span className="flex-1" />
                <OAButton variant="primary" size="sm" onClick={submitPasswordChange} disabled={pwSaving}>
                  {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {pwSaving ? "Updating…" : "Update password"}
                </OAButton>
              </div>
            </div>
          )}
        </OACard>

        {/* ── Daily goal ── */}
        <OACard style={{ padding: "20px 24px" }}>
          <SettingHeader Icon={Target} title="Daily study goal" sub="Your streak counts a day complete when you hit this." />
          <div className="flex items-center gap-4 mt-4">
            <input
              type="range" min={10} max={90} step={5} value={goal}
              onChange={(e) => setGoal(+e.target.value)}
              className="flex-1"
              style={{ accentColor: "var(--cobalt-500)" }}
            />
            <span className="font-bold text-[22px] w-[78px] text-right"
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-900)" }}>
              {goal} min
            </span>
          </div>
        </OACard>

        {/* ── Toggles ── */}
        <OACard noPadding className="px-6">
          {TOGGLES.map((t, i) => (
            <ToggleRow key={t.title} {...t} last={i === TOGGLES.length - 1} />
          ))}
        </OACard>

        {/* ── Actions ── */}
        <div className="flex flex-wrap gap-2.5">
          <OAButton variant="ghost" size="md" onClick={() => logout()} style={{ color: "var(--danger)" }}>
            <LogOut size={16} /> Log out
          </OAButton>
          <span className="flex-1" />
          <OAButton
            variant="primary" size="md"
            disabled={saving}
            onClick={async () => {
              if (subjects.length === 0) { setError("Select at least one subject."); return; }
              setSaving(true);
              setError("");
              const result = await updateProfile({
                fullName: name.trim() || user.name,
                board,
                classLevel: cls,
                subjects,
              });
              setSaving(false);
              if (result.error) setError(result.error);
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </OAButton>
        </div>

        {error && !editing && (
          <p className="text-[13px] px-3 py-2 rounded-[var(--r-md)]" style={{ background: "var(--danger-bg)", color: "var(--danger-tx)" }}>
            {error}
          </p>
        )}
      </div>
    </AppShell>
  );
}

function SettingHeader({ Icon, title, sub }: { Icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={19} style={{ color: "var(--brand)", marginTop: 2 }} />
      <div>
        <h3 className="font-bold text-[16.5px]" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>{sub}</p>
      </div>
    </div>
  );
}

function ToggleRow({ Icon, title, sub, defaultOn, last }: {
  Icon: React.ElementType; title: string; sub: string; defaultOn: boolean; last?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center gap-3 py-[15px]"
      style={{ borderBottom: last ? "none" : "1px solid var(--line-200)" }}>
      <Icon size={18} style={{ color: "var(--ink-500)" }} />
      <div className="flex-1">
        <p className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</p>
        <p className="text-[12.5px] mt-0.5" style={{ color: "var(--fg-muted)" }}>{sub}</p>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        className="w-[42px] h-6 rounded-full border-none cursor-pointer p-0.5 flex items-center transition-colors duration-[180ms]"
        style={{ background: on ? "var(--cobalt-500)" : "var(--line-300)" }}
        aria-checked={on} role="switch"
      >
        <span className="w-5 h-5 rounded-full bg-white shadow-[var(--shadow-sm)]"
          style={{ transform: on ? "translateX(18px)" : "none", transition: "transform 180ms var(--ease-out)" }} />
      </button>
    </div>
  );
}
