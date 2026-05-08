// src/pages/office/OfficeStaff.jsx
// Staff and profile management for the office role.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import useAuth from "../../hooks/useAuth";
import { btn, text } from "../../styles/components";

const ROLE_CONFIG = {
  user:   { label: "User",   bg: "rgba(107,114,128,0.2)", color: "var(--muted)" },
  clerk:  { label: "Clerk",  bg: "rgba(59,130,246,0.15)", color: "#3b82f6"      },
  office: { label: "Office", bg: "rgba(245,158,11,0.15)", color: "var(--gold)"  },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] ?? { label: role, bg: "var(--pit)", color: "var(--muted)" };
  return (
    <span style={{
      fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700,
      letterSpacing: "0.2em", textTransform: "uppercase",
      background: cfg.bg, color: cfg.color, padding: "3px 8px", borderRadius: 2,
    }}>
      {cfg.label}
    </span>
  );
}

const fmt = (d) => d
  ? new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

const fmtTime = (d) => d
  ? new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
  : "Never";

export default function OfficeStaff() {
  const { user: currentUser } = useAuth();

  const [profiles,     setProfiles]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [roleFilter,   setRoleFilter]   = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [search,       setSearch]       = useState("");

  // Drawer state
  const [drawerProfile, setDrawerProfile] = useState(null);
  const [editRole,      setEditRole]      = useState("");
  const [editPhone,     setEditPhone]     = useState("");
  const [editActive,    setEditActive]    = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saveError,     setSaveError]     = useState("");
  const [saveSuccess,   setSaveSuccess]   = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, email, phone, role, is_active, created_at, last_seen_at")
      .order("created_at", { ascending: false });
    setProfiles(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const filtered = profiles.filter((p) => {
    if (roleFilter !== "all"   && p.role !== roleFilter)                             return false;
    if (activeFilter === "active"   && !p.is_active)                                return false;
    if (activeFilter === "inactive" &&  p.is_active)                                return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.username?.toLowerCase().includes(q) && !p.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openDrawer = (profile) => {
    setDrawerProfile(profile);
    setEditRole(profile.role);
    setEditPhone(profile.phone ?? "");
    setEditActive(profile.is_active);
    setSaveError("");
    setSaveSuccess("");
  };

  const handleSave = async () => {
    if (!drawerProfile) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    const roleChanged = editRole !== drawerProfile.role;

    if (roleChanged && drawerProfile.id === currentUser?.id) {
      setSaveError("You cannot change your own role.");
      setSaving(false);
      return;
    }

    if (roleChanged && !window.confirm(
      `Change ${drawerProfile.username}'s role from ${drawerProfile.role.toUpperCase()} to ${editRole.toUpperCase()}? This will immediately alter their access permissions.`
    )) {
      setSaving(false);
      return;
    }

    const { error: err } = await supabase
      .from("profiles")
      .update({
        role:      editRole,
        phone:     editPhone.trim() || null,
        is_active: editActive,
      })
      .eq("id", drawerProfile.id);

    setSaving(false);
    if (err) { setSaveError(err.message); return; }

    setSaveSuccess("Profile updated.");
    setTimeout(() => setSaveSuccess(""), 3000);
    loadProfiles();

    // Update the drawer's cached profile
    setDrawerProfile((prev) => ({
      ...prev,
      role:      editRole,
      phone:     editPhone,
      is_active: editActive,
    }));
  };

  // Stats
  const roleCount = { user: 0, clerk: 0, office: 0 };
  profiles.forEach((p) => { if (roleCount[p.role] !== undefined) roleCount[p.role]++; });
  const activeCount = profiles.filter((p) => p.is_active).length;

  return (
    <div style={s.page}>

      {/* ── Page head ── */}
      <div style={s.head}>
        <div>
          <div style={s.eyebrow}>Accounts</div>
          <h1 style={s.title}>Staff</h1>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Total",    val: profiles.length,    color: "var(--bone)" },
            { label: "Active",   val: activeCount,        color: "#22c55e"     },
            { label: "Clerks",   val: roleCount.clerk,    color: "#3b82f6"     },
            { label: "Office",   val: roleCount.office,   color: "var(--gold)" },
          ].map(({ label, val, color }) => (
            <div key={label} style={s.miniStat}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color, letterSpacing: "0.04em" }}>{val}</span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={s.filterBar}>
        <input
          style={{ ...s.searchInput, width: 240 }}
          placeholder="Search by username or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "user", "clerk", "office"].map((r) => (
            <button
              key={r}
              style={{
                ...s.filterBtn,
                background: roleFilter === r ? "var(--fire)" : "transparent",
                color:      roleFilter === r ? "#000"        : "var(--muted)",
                border:     roleFilter === r ? "1px solid var(--fire)" : "1px solid var(--pit)",
              }}
              onClick={() => setRoleFilter(r)}
            >
              {r === "all" ? "All Roles" : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "active", "inactive"].map((a) => (
            <button
              key={a}
              style={{
                ...s.filterBtn,
                background: activeFilter === a ? "rgba(34,197,94,0.15)" : "transparent",
                color:      activeFilter === a ? "#22c55e"              : "var(--muted)",
                border:     activeFilter === a ? "1px solid #22c55e"    : "1px solid var(--pit)",
              }}
              onClick={() => setActiveFilter(a)}
            >
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.1em", marginLeft: "auto" }}>
          {filtered.length} of {profiles.length} profiles
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ padding: "0 24px 48px", overflowX: "auto" }}>
        {loading ? (
          <div style={s.empty}>Loading staff…</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No profiles match the current filters.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {["Username", "Email", "Role", "Active", "Phone", "Created", "Last Seen", ""].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => openDrawer(p)}>
                  <td style={{ ...s.td, fontWeight: 600 }}>
                    @{p.username ?? "—"}
                    {p.id === currentUser?.id && (
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--fire)", letterSpacing: "0.2em", marginLeft: 6 }}>YOU</span>
                    )}
                  </td>
                  <td style={{ ...s.td, color: "var(--muted)" }}>{p.email ?? "—"}</td>
                  <td style={s.td}><RoleBadge role={p.role} /></td>
                  <td style={s.td}>
                    <span style={{
                      fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.2em", textTransform: "uppercase",
                      color: p.is_active ? "#22c55e" : "var(--muted)",
                    }}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: "var(--muted)" }}>{p.phone ?? "—"}</td>
                  <td style={{ ...s.td, color: "var(--muted)" }}>{fmt(p.created_at)}</td>
                  <td style={{ ...s.td, color: "var(--muted)" }}>{fmtTime(p.last_seen_at)}</td>
                  <td style={s.td}>
                    <button style={s.editBtn}>Edit →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit Drawer ── */}
      {drawerProfile && (
        <div style={s.overlay} onClick={(e) => { if (e.target === e.currentTarget) setDrawerProfile(null); }}>
          <div style={s.drawer}>
            {/* Drawer head */}
            <div style={s.drawerHead}>
              <div>
                <div style={s.eyebrow}>Edit Profile</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--bone)", letterSpacing: "0.04em" }}>
                  @{drawerProfile.username}
                </div>
              </div>
              <button style={s.closeBtn} onClick={() => setDrawerProfile(null)}>✕</button>
            </div>

            {/* Read-only identity fields */}
            <div style={s.infoGrid}>
              <InfoRow label="User ID"    val={drawerProfile.id.slice(0, 16) + "…"} />
              <InfoRow label="Email"      val={drawerProfile.email ?? "—"} />
              <InfoRow label="Username"   val={drawerProfile.username ?? "—"} />
              <InfoRow label="Created"    val={fmt(drawerProfile.created_at)} />
              <InfoRow label="Last Seen"  val={fmtTime(drawerProfile.last_seen_at)} />
            </div>

            <div style={s.divider} />

            {/* Editable fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Role */}
              <div style={s.field}>
                <label style={s.label}>Role</label>
                <select
                  style={s.input}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  disabled={drawerProfile.id === currentUser?.id}
                >
                  <option value="user">User — customer</option>
                  <option value="clerk">Clerk — counter operator</option>
                  <option value="office">Office — back-office manager</option>
                </select>
                {drawerProfile.id === currentUser?.id && (
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)" }}>
                    You cannot change your own role.
                  </div>
                )}
                {editRole !== drawerProfile.role && (
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--gold)" }}>
                    ⚠ Changing this role will immediately alter access permissions.
                  </div>
                )}
              </div>

              {/* Phone */}
              <div style={s.field}>
                <label style={s.label}>Phone</label>
                <input
                  style={s.input}
                  type="tel"
                  placeholder="+27 …"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>

              {/* Active toggle */}
              <div style={s.field}>
                <label style={s.label}>Account Status</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { val: true,  label: "Active"   },
                    { val: false, label: "Inactive" },
                  ].map(({ val, label }) => (
                    <button
                      key={String(val)}
                      style={{
                        flex: 1, padding: "10px 0",
                        background: editActive === val
                          ? (val ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.12)")
                          : "#161616",
                        border: editActive === val
                          ? `1px solid ${val ? "#22c55e" : "var(--ember)"}`
                          : "1px solid var(--pit)",
                        borderRadius: 3, cursor: "pointer",
                        fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700,
                        letterSpacing: "0.1em",
                        color: editActive === val
                          ? (val ? "#22c55e" : "var(--ember)")
                          : "var(--muted)",
                      }}
                      onClick={() => setEditActive(val)}
                      disabled={drawerProfile.id === currentUser?.id}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {drawerProfile.id === currentUser?.id && (
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--muted)" }}>
                    You cannot deactivate your own account.
                  </div>
                )}
              </div>
            </div>

            {saveError   && <div style={{ ...text.error, marginTop: 8 }}>{saveError}</div>}
            {saveSuccess && <div style={{ ...text.error, color: "#22c55e", marginTop: 8 }}>{saveSuccess}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button style={s.ghostBtn} onClick={() => setDrawerProfile(null)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ ...btn.primary, ...btn.sm, flex: 1, opacity: saving ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, val }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--bone)" }}>{val}</span>
    </div>
  );
}

const s = {
  page: { minHeight: "100%", background: "var(--smoke)", paddingBottom: 60 },
  head: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    padding: "28px 24px 20px", borderBottom: "1px solid var(--pit)",
    flexWrap: "wrap", gap: 16,
  },
  eyebrow: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.35em", textTransform: "uppercase", color: "var(--fire)", marginBottom: 4,
  },
  title: {
    fontFamily: "var(--font-display)", fontSize: "clamp(32px, 5vw, 48px)",
    letterSpacing: "0.04em", color: "var(--bone)", margin: 0, lineHeight: 1,
  },
  miniStat: {
    display: "flex", flexDirection: "column", alignItems: "center",
    background: "var(--ash)", border: "1px solid var(--pit)", borderRadius: 3, padding: "8px 16px",
    minWidth: 64, gap: 2,
  },
  filterBar: {
    display: "flex", gap: 8, padding: "14px 24px", flexWrap: "wrap",
    borderBottom: "1px solid var(--pit)", alignItems: "center",
  },
  searchInput: {
    padding: "7px 12px", background: "#161616", border: "1px solid var(--pit)",
    borderRadius: 3, color: "var(--bone)", fontFamily: "var(--font-sans)", fontSize: 13,
    outline: "none", boxSizing: "border-box",
  },
  filterBtn: {
    fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.15em",
    textTransform: "uppercase", padding: "5px 10px", borderRadius: 2, cursor: "pointer",
    transition: "all 0.15s",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 700,
    letterSpacing: "0.25em", textTransform: "uppercase", color: "var(--muted)",
    padding: "10px 12px", textAlign: "left", borderBottom: "1px solid var(--pit)", whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 12px", borderBottom: "1px solid var(--pit)",
    fontSize: 13, color: "var(--bone)", fontFamily: "var(--font-sans)", verticalAlign: "middle",
  },
  editBtn: {
    background: "transparent", border: "1px solid var(--pit)", borderRadius: 2,
    color: "var(--fire)", fontFamily: "var(--font-body)", fontSize: 11,
    letterSpacing: "0.15em", textTransform: "uppercase", padding: "4px 10px", cursor: "pointer",
  },
  empty: {
    fontFamily: "var(--font-body)", fontSize: 13, color: "var(--muted)",
    letterSpacing: "0.1em", padding: "32px 0",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    zIndex: 500, display: "flex", justifyContent: "flex-end",
  },
  drawer: {
    width: 420, maxWidth: "100vw", background: "var(--ash)",
    borderLeft: "1px solid var(--pit)", padding: 28,
    overflowY: "auto", display: "flex", flexDirection: "column", gap: 16,
    boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
  },
  drawerHead: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  },
  closeBtn: {
    background: "transparent", border: "none", color: "var(--muted)",
    fontSize: 18, cursor: "pointer", padding: 4,
  },
  infoGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
  },
  divider: {
    height: 1, background: "var(--pit)", margin: "4px 0",
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--muted)",
  },
  input: {
    width: "100%", padding: "8px 12px", background: "#161616",
    border: "1px solid var(--pit)", borderRadius: 3, color: "var(--bone)",
    fontFamily: "var(--font-sans)", fontSize: 14, outline: "none", boxSizing: "border-box",
  },
  ghostBtn: {
    background: "transparent", border: "1px solid var(--pit)", borderRadius: 3,
    color: "var(--muted)", fontFamily: "var(--font-body)", fontSize: 11,
    letterSpacing: "0.15em", textTransform: "uppercase", padding: "8px 16px", cursor: "pointer",
  },
};