import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import occamyLogo from "../assets/occamylogo.jpg"
import {
  Users, TrendingUp, Package, MapPin, ArrowLeft,
  RefreshCw, Navigation, Search, X, Calendar
} from "lucide-react"

/* ── helpers ─────────────────────────────────────────────── */
const fmtDist = (n) => parseFloat(n || 0).toFixed(2)
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "—"

export default function AdminFieldOfficers() {
  const navigate = useNavigate()
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selected, setSelected]       = useState(null)
  const [meetings, setMeetings]       = useState([])
  const [meetLoading, setMeetLoading] = useState(false)
  const [isScrolled, setIsScrolled]   = useState(false)

  useEffect(() => {
    const h = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener("scroll", h)
    return () => window.removeEventListener("scroll", h)
  }, [])

  useEffect(() => {
    const role = localStorage.getItem("role")
    if (!role) { navigate("/login"); return }
    if (role !== "ADMIN") { navigate("/dashboard"); return }
  }, [])

  const loadOfficers = useCallback(async () => {
    try {
      const d = await api("/admin/field-officers")
      // Handle both response shapes: new { officers, summary } and legacy flat array
      if (Array.isArray(d)) {
        // Old format — wrap it
        setData({ officers: d, summary: { totalOfficers: d.length, activeNow: d.filter(o => o.isOnline || o.isActive).length, totalMeetingsToday: 0, totalSamplesToday: 0, totalFleetDistance: 0 } })
      } else {
        setData(d)
      }
    } catch (err) {
      console.error("Failed to load field officers:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOfficers() }, [loadOfficers])

  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(loadOfficers, 10000)
    return () => clearInterval(iv)
  }, [autoRefresh, loadOfficers])

  const openDetail = async (officer) => {
    setSelected(officer)
    setMeetLoading(true)
    try {
      const m = await api(`/admin/field-officers/${officer._id}/meetings`)
      setMeetings(m || [])
    } catch (_) { setMeetings([]) }
    finally { setMeetLoading(false) }
  }

  const filtered = (data?.officers || []).filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.phone || "").includes(search) ||
    (o.email || "").toLowerCase().includes(search.toLowerCase())
  )

  const s = data?.summary || {}

  return (
    <div style={{ minHeight: "100vh", background: "#FDF8E1", fontFamily: "Poppins, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;900&display=swap" rel="stylesheet" />

      {/* NAVBAR */}
      <nav style={{
        background: "linear-gradient(135deg, #3E3E5C 0%, #4A6D7C 100%)",
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 2000,
        padding: isScrolled ? "10px 20px" : "14px 20px",
        boxShadow: isScrolled ? "0 4px 20px rgba(62,62,92,.3)" : "none",
        transition: "all .3s"
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => navigate("/dashboard")}
              style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>
              <ArrowLeft size={16} /> Back
            </button>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,.2)" }} />
            <div style={{ width: 38, height: 38, borderRadius: 9, overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src={occamyLogo} alt="Occamy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div className="fo-brand">
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 14, lineHeight: 1.1 }}>OCCAMY BIOSCIENCE</div>
              <div style={{ color: "rgba(255,255,255,.65)", fontSize: 10, fontWeight: 500 }}>Field Officer Control Center</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {autoRefresh && (
              <div style={{ background: "#7FB069", borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#fff" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "ping 1s infinite" }} /> LIVE
              </div>
            )}
            <button onClick={() => navigate("/admin-dashboard")}
              style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: "#fff", fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 12 }}>
              Admin Panel
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "88px 16px 48px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: "clamp(18px, 5vw, 28px)", fontWeight: 900, color: "#3E3E5C", margin: 0, lineHeight: 1.2 }}>Field Officer Control Center</h1>
          <p style={{ color: "#7A7490", fontSize: 13, margin: "4px 0 0" }}>
            Real-time activity tracking, meeting logs, and performance analytics
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ width: 48, height: 48, border: "4px solid #dbeafe", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
            <p style={{ color: "#7A7490", marginTop: 16, fontSize: 14 }}>Loading field officer data…</p>
          </div>
        ) : (
          <>
            {/* KPI STAT ROW — 2 cols on mobile, 5 on desktop */}
            <div className="kpi-grid" style={{ display: "grid", gap: 12, marginBottom: 28 }}>
              {[
                { label: "TOTAL FIELD OFFICERS", value: s.totalOfficers ?? 0,       grad: "linear-gradient(135deg,#3b758c,#1797a6)",  icon: <Users size={22} /> },
                { label: "ACTIVE NOW (GPS ON)",   value: s.activeNow ?? 0,           grad: "linear-gradient(135deg,#3b758c,#1797a6)",  icon: <Navigation size={22} /> },
                { label: "MEETINGS TODAY",         value: s.totalMeetingsToday ?? 0,  grad: "linear-gradient(135deg,#3b758c,#1797a6)",  icon: <Calendar size={22} /> },
                { label: "SAMPLES DISTRIBUTED",   value: s.totalSamplesToday ?? 0,   grad: "linear-gradient(135deg,#3b758c,#1797a6)",  icon: <Package size={22} /> },
                { label: "TOTAL DISTANCE",         value: fmtDist(s.totalFleetDistance) + " km", grad: "linear-gradient(135deg,#3b758c,#1797a6)", icon: <MapPin size={22} /> },
              ].map(k => (
                <div key={k.label} style={{ background: k.grad, borderRadius: 18, padding: "16px 14px", color: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,.12)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, opacity: .8, letterSpacing: .4, lineHeight: 1.3 }}>{k.label}</span>
                    <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 8, padding: 5 }}>{k.icon}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* SEARCH + CONTROLS */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#7A7490" }} />
                <input type="text" placeholder="Search by name, phone or email…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: "100%", padding: "10px 36px 10px 36px", border: "2px solid #D8D5C5", borderRadius: 12, outline: "none", background: "#EAF1FF", color: "#3E3E5C", fontSize: 13, fontFamily: "Poppins, sans-serif", boxSizing: "border-box" }} />
                {search && (
                  <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#7A7490" }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <button onClick={loadOfficers}
                style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", cursor: "pointer", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button onClick={() => setAutoRefresh(p => !p)}
                style={{ background: autoRefresh ? "#dcfce7" : "#f3f4f6", color: autoRefresh ? "#16a34a" : "#6b7280", border: autoRefresh ? "2px solid #86efac" : "2px solid #e5e7eb", borderRadius: 12, padding: "10px 18px", cursor: "pointer", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 13 }}>
                {autoRefresh ? "⏸ Live ON" : "▶ Live OFF"}
              </button>
            </div>

            {/* DATA TABLE — scrollable on mobile */}
            <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 4px 24px rgba(62,62,92,.1)", overflow: "hidden", border: "1px solid #dbeafe" }}>
              {/* Table header bar */}
              <div style={{ background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)", padding: "14px 16px", borderBottom: "1px solid #dbeafe", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "#3b82f6", borderRadius: 8, padding: "6px 8px", display: "flex" }}><Users size={16} color="#fff" /></div>
                  <span style={{ fontWeight: 800, color: "#3E3E5C", fontSize: 15 }}>Field Officer Fleet</span>
                  <span style={{ color: "#7A7490", fontSize: 13 }}>({filtered.length} of {data?.officers?.length || 0})</span>
                </div>
                {autoRefresh && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#16a34a", fontWeight: 700 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                    Auto-refreshing
                  </span>
                )}
              </div>

              {/* Scrollable table wrapper */}
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ minWidth: 640 }}>
                  {/* Column headers */}
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.2fr", gap: 8, padding: "10px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .5 }}>
                    <div>Field Officer</div>
                    <div>Live Status</div>
                    <div>Meetings</div>
                    <div>Samples</div>
                    <div>Distance</div>
                    <div>Actions</div>
                  </div>

                  {filtered.length === 0 && (
                    <div style={{ padding: "48px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>🚜</div>
                      <p style={{ color: "#7A7490", fontWeight: 600, fontSize: 14 }}>
                        {search ? `No officers match "${search}"` : "No field officers registered yet"}
                      </p>
                    </div>
                  )}

                  {filtered.map((o, idx) => (
                    <div key={o._id} style={{
                      display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1.2fr",
                      gap: 8, padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
                      background: idx % 2 === 0 ? "#fff" : "#fafafa", alignItems: "center", transition: "background .15s"
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafafa"}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: o.isActive ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#9ca3af,#6b7280)",
                          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 14
                        }}>
                          {o.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: "#3E3E5C", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                          <div style={{ fontSize: 11, color: "#7A7490", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.phone || o.email}</div>
                          {(o.state || o.district) && (
                            <div style={{ fontSize: 10, color: "#9ca3af" }}>{[o.district, o.state].filter(Boolean).join(", ")}</div>
                          )}
                        </div>
                      </div>
                      <div>
                        {o.isActive ? (
                          <div>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 700 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} /> GPS ON
                            </span>
                            {o.startTime && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>Since {fmtTime(o.startTime)}</div>}
                          </div>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "#f3f4f6", color: "#6b7280", fontSize: 11, fontWeight: 700 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af" }} /> Offline
                          </span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16, color: "#9333ea" }}>{o.meetingsToday || 0}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>meeting{o.meetingsToday !== 1 ? "s" : ""}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16, color: "#f97316" }}>{o.samplesToday || 0}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>sample{o.samplesToday !== 1 ? "s" : ""}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: o.isActive ? "#0d9488" : "#6b7280" }}>{fmtDist(o.totalDistance)} km</div>
                        {o.lastLocationTime && <div style={{ fontSize: 10, color: "#9ca3af" }}>{fmtTime(o.lastLocationTime)}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => openDetail(o)}
                          style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 11 }}>
                          View
                        </button>
                        {o.lastLocation?.lat && (
                          <button onClick={() => navigate(`/dashboard?locate=${o._id}`)}
                            style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 11 }}>
                            Locate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* DETAIL MODAL */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSelected(null)}>
          <div style={{ background: "#fff", borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,.2)", width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", padding: "20px 20px", borderRadius: "24px 24px 0 0", color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 900 }}>{selected.name}</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.phone} • {selected.email}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: selected.isActive ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.2)", color: selected.isActive ? "#bbf7d0" : "rgba(255,255,255,.7)" }}>
                      {selected.isActive ? "🟢 GPS Active" : "⚫ Offline"}
                    </span>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.2)", color: "#fff" }}>
                      📏 {fmtDist(selected.totalDistance)} km today
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, borderBottom: "1px solid #f3f4f6" }}>
              {[
                { label: "Meetings Today", value: selected.meetingsToday ?? 0, color: "#9333ea" },
                { label: "Samples Today",  value: selected.samplesToday ?? 0,  color: "#f97316" },
                { label: "Distance Today", value: fmtDist(selected.totalDistance) + " km", color: "#0d9488" },
              ].map(k => (
                <div key={k.label} style={{ padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: "clamp(16px, 4vw, 22px)", fontWeight: 900, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: "#7A7490", marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Meeting history */}
            <div style={{ padding: "16px 16px" }}>
              <h4 style={{ margin: "0 0 16px", color: "#3E3E5C", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={16} color="#9333ea" /> Meeting History
              </h4>
              {meetLoading && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ width: 32, height: 32, border: "4px solid #dbeafe", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
                </div>
              )}
              {!meetLoading && meetings.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#7A7490" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <p style={{ fontSize: 13 }}>No meetings recorded yet</p>
                </div>
              )}
              {!meetLoading && meetings.map(m => {
                // Human-readable category label
                const catLabel = {
                  FARMER: "Farmer", SELLER: "Seller", INFLUENCER: "Influencer",
                  VETERINARIAN: "Vet", DISTRIBUTOR: "Distributor", DEALER: "Dealer",
                  DAIRY_COLLECTION_CENTER: "Dairy Center", RETAIL_OUTLET: "Retail Outlet",
                  KVK: "KVK", FPO: "FPO"
                }[m.category] || m.category || "—"

                // Category badge colour
                const catColor = {
                  DAIRY_COLLECTION_CENTER: { bg: "#dbeafe", text: "#1d4ed8" },
                  RETAIL_OUTLET:           { bg: "#fef3c7", text: "#92400e" },
                  KVK:                     { bg: "#d1fae5", text: "#065f46" },
                  FPO:                     { bg: "#ede9fe", text: "#5b21b6" },
                  FARMER:                  { bg: "#dcfce7", text: "#166534" },
                  VETERINARIAN:            { bg: "#fee2e2", text: "#991b1b" },
                }[m.category] || { bg: "#f3f4f6", text: "#374151" }

                return (
                  <div key={m._id} style={{ padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "#3E3E5C", fontSize: 14 }}>
                          {m.type === "ONE_TO_ONE" ? (m.personName || "1:1 Meeting") : `Group Meeting — ${m.village || "Unknown"}`}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
                          {/* Category badge */}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: catColor.bg, color: catColor.text }}>
                            {catLabel}
                          </span>
                          {/* Sample given badge */}
                          {m.productSampleGiven && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fef9c3", color: "#854d0e" }}>
                              📦 Sample Given
                            </span>
                          )}
                          {m.productSampleAvailable && !m.productSampleGiven && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f0fdf4", color: "#166534" }}>
                              ✅ Sample Available
                            </span>
                          )}
                          {/* Meeting type badge */}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: m.type === "ONE_TO_ONE" ? "#ede9fe" : "#dbeafe", color: m.type === "ONE_TO_ONE" ? "#7c3aed" : "#1d4ed8" }}>
                            {m.type === "ONE_TO_ONE" ? "1:1" : "GROUP"}
                          </span>
                        </div>
                        {m.type === "ONE_TO_ONE" && m.contactNumber && (
                          <div style={{ fontSize: 11, color: "#7A7490", marginTop: 3 }}>{m.contactNumber}</div>
                        )}
                        {m.type === "GROUP" && (
                          <div style={{ fontSize: 11, color: "#7A7490", marginTop: 3 }}>{m.attendeesCount || 0} attendees</div>
                        )}
                        {m.village && (
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.village}{m.district ? `, ${m.district}` : ""}</div>
                        )}
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{new Date(m.createdAt).toLocaleString()}</div>
                        {m.notes && (
                          <div style={{ fontSize: 11, color: "#6b7280", fontStyle: "italic", marginTop: 2 }}>
                            "{m.notes.slice(0, 100)}{m.notes.length > 100 ? "…" : ""}"
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ping { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.4); } }
        * { box-sizing: border-box; }
        .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        .fo-brand { display: block; }
        @media (min-width: 640px) {
          .kpi-grid { grid-template-columns: repeat(5, 1fr); }
        }
        @media (max-width: 480px) {
          .fo-brand { display: none; }
          main { padding-top: 76px !important; }
        }
      `}</style>
    </div>
  )
}
