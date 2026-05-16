import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import occamyLogo from "../assets/occamylogo.jpg"
import {
  Users, TrendingUp, Package, MapPin, ArrowLeft,
  RefreshCw, Navigation, Search, X, BarChart3
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from "recharts"

/* ── helpers ─────────────────────────────────────────────── */
const fmtDist  = (n) => parseFloat(n || 0).toFixed(2)
const fmtMoney = (n) => `₹${(n || 0).toLocaleString()}`
const fmtTime  = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"

export default function AdminDistributors() {
  const navigate = useNavigate()
  const [distData, setDistData]       = useState(null)
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedDist, setSelectedDist] = useState(null)
  const [distSales, setDistSales]     = useState([])
  const [distAnalytics, setDistAnalytics] = useState(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [monthlyChart, setMonthlyChart] = useState(null)
  const [isScrolled, setIsScrolled]   = useState(false)

  /* scroll shadow */
  useEffect(() => {
    const h = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener("scroll", h)
    return () => window.removeEventListener("scroll", h)
  }, [])

  /* auth guard */
  useEffect(() => {
    const role = localStorage.getItem("role")
    if (!role) { navigate("/login"); return }
    if (role !== "ADMIN") { navigate("/dashboard"); return }
  }, [])

  const loadDistributors = useCallback(async () => {
    try {
      const d = await api("/admin/distributors")
      setDistData(d)
    } catch (err) {
      console.error("Failed to load distributors:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDistributors() }, [loadDistributors])

  // Load monthly chart once on mount
  useEffect(() => {
    api("/admin/distributors/monthly-chart")
      .then(d => setMonthlyChart(d))
      .catch(() => {})
  }, [])

  /* auto-refresh every 10 s */
  useEffect(() => {
    if (!autoRefresh) return
    const iv = setInterval(loadDistributors, 10000)
    return () => clearInterval(iv)
  }, [autoRefresh, loadDistributors])

  const openDetail = async (dist) => {
    setSelectedDist(dist)
    setDistAnalytics(null)
    setSalesLoading(true)
    try {
      const [s, a] = await Promise.all([
        api(`/admin/distributors/${dist._id}/sales`),
        api(`/admin/distributors/${dist._id}/analytics?days=30`)
      ])
      setDistSales(s || [])
      setDistAnalytics(a || null)
    } catch (_) { setDistSales([]) }
    finally { setSalesLoading(false) }
  }

  const filtered = (distData?.distributors || []).filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.phone || "").includes(search) ||
    (d.email || "").toLowerCase().includes(search.toLowerCase())
  )

  const s = distData?.summary || {}

  /* ── RENDER ─────────────────────────────────────────────── */
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
          {/* Back + brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => navigate("/dashboard")}
              style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>
              <ArrowLeft size={16} /> Back
            </button>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,.2)" }} />
            <div style={{ width: 38, height: 38, borderRadius: 9, overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={occamyLogo} alt="Occamy" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 14, lineHeight: 1.1 }}>OCCAMY BIOSCIENCE</div>
              <div style={{ color: "rgba(255,255,255,.65)", fontSize: 10, fontWeight: 500 }}>Distributor Control Center</div>
            </div>
          </div>

          {/* Live indicator */}
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

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#3E3E5C", margin: 0 }}>
            Distributor Control Center
          </h1>
          <p style={{ color: "#7A7490", fontSize: 13, margin: "4px 0 0" }}>
            Real-time fleet tracking, sales monitoring and inventory management
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ width: 48, height: 48, border: "4px solid #e0e7ff", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
            <p style={{ color: "#7A7490", marginTop: 16, fontSize: 14 }}>Loading distributor data…</p>
          </div>
        ) : (
          <>
            {/* KPI STAT ROW */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 28 }}
                 className="sm:grid-cols-4">
              {[
                { label: "TOTAL DISTRIBUTORS", value: s.totalDistributors ?? 0,  grad: "linear-gradient(135deg,#3b758c,#1797a6)", icon: <Users size={22} /> },
                { label: "ACTIVE TODAY",        value: s.activeDistributors ?? 0, grad: "linear-gradient(135deg,#3b758c,#1797a6)", icon: <span style={{ fontSize: 18 }}>🟢</span> },
                { label: "TODAY'S REVENUE",     value: fmtMoney(s.totalTodayRevenue), grad: "linear-gradient(135deg,#3b758c,#1797a6)", icon: <TrendingUp size={22} /> },
                { label: "TOTAL STOCK",         value: s.totalStock ?? 0,          grad: "linear-gradient(135deg,#3b758c,#1797a6)", icon: <Package size={22} /> },
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

            {/* MONTHLY SALES OVERVIEW CHART */}
            {monthlyChart && (
              <div style={{ background: "#fff", borderRadius: 20, padding: "24px", marginBottom: 24, boxShadow: "0 4px 24px rgba(62,62,92,.08)", border: "1px solid #e0e7ff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 800, color: "#3E3E5C", fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      <BarChart3 size={18} color="#6366f1" /> Monthly Sales Overview — {monthlyChart.summary?.month}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#7A7490" }}>
                      All distributors combined · ₹{(monthlyChart.summary?.totalRevenue || 0).toLocaleString()} total · {monthlyChart.summary?.totalSales || 0} transactions
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyChart.chart || []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v, n) => [n === "revenue" ? `₹${v.toLocaleString()}` : v, n === "revenue" ? "Revenue" : "Qty Sold"]}
                      labelFormatter={l => `Date: ${l}`}
                      contentStyle={{ borderRadius: 10, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="quantity" name="Qty Sold" fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="revenue"  name="Revenue (₹)" fill="#14b8a6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* SEARCH + CONTROLS */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#7A7490" }} />
                <input
                  type="text"
                  placeholder="Search by name, phone or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: "100%", padding: "10px 36px 10px 36px", border: "2px solid #D8D5C5", borderRadius: 12, outline: "none", background: "#EAF1FF", color: "#3E3E5C", fontSize: 13, fontFamily: "Poppins, sans-serif", boxSizing: "border-box" }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#7A7490" }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <button onClick={loadDistributors}
                style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", cursor: "pointer", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button onClick={() => setAutoRefresh(p => !p)}
                style={{ background: autoRefresh ? "#dcfce7" : "#f3f4f6", color: autoRefresh ? "#16a34a" : "#6b7280", border: autoRefresh ? "2px solid #86efac" : "2px solid #e5e7eb", borderRadius: 12, padding: "10px 18px", cursor: "pointer", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 13 }}>
                {autoRefresh ? "⏸ Live ON" : "▶ Live OFF"}
              </button>
            </div>

            {/* DATA TABLE */}
            <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 4px 24px rgba(62,62,92,.1)", overflow: "hidden", border: "1px solid #e0e7ff" }}>
              {/* Table header bar */}
              <div style={{ background: "linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)", padding: "16px 20px", borderBottom: "1px solid #e0e7ff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "#6366f1", borderRadius: 8, padding: "6px 8px", display: "flex" }}><Users size={16} color="#fff" /></div>
                  <span style={{ fontWeight: 800, color: "#3E3E5C", fontSize: 15 }}>Distributor Fleet</span>
                  <span style={{ color: "#7A7490", fontSize: 13 }}>({filtered.length} of {distData?.distributors?.length || 0})</span>
                </div>
                {autoRefresh && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#16a34a", fontWeight: 700 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                    Auto-refreshing every 10s
                  </span>
                )}
              </div>

              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr", gap: 8, padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .5 }}>
                <div>Distributor</div>
                <div>Today Revenue</div>
                <div>Stock Level</div>
                <div>Actions</div>
              </div>

              {filtered.length === 0 && (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
                  <p style={{ color: "#7A7490", fontWeight: 600, fontSize: 14 }}>
                    {search ? `No distributors match "${search}"` : "No distributors registered yet"}
                  </p>
                </div>
              )}

              {filtered.map((d, idx) => (
                <div key={d._id} style={{
                  display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr",
                  gap: 8, padding: "14px 20px", borderBottom: "1px solid #f3f4f6",
                  background: idx % 2 === 0 ? "#fff" : "#fafafa",
                  alignItems: "center", transition: "background .15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#eef2ff"}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafafa"}
                >
                  {/* Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: d.isActive ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#9ca3af,#6b7280)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 900, fontSize: 14
                    }}>
                      {d.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#3E3E5C", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: "#7A7490", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.phone || d.email}</div>
                      {(d.state || d.district) && (
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>{[d.district, d.state].filter(Boolean).join(", ")}</div>
                      )}
                    </div>
                  </div>

                  {/* Revenue */}
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 14, color: "#0d9488" }}>{fmtMoney(d.todayRevenue)}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{d.todaySalesCount || 0} sale{d.todaySalesCount !== 1 ? "s" : ""}</div>
                  </div>

                  {/* Stock */}
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 14, color: d.totalStock > 0 ? "#9333ea" : "#ef4444" }}>
                      {d.totalStock ?? 0} units
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{d.productCount || 0} product{d.productCount !== 1 ? "s" : ""}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => openDetail(d)}
                      style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 11 }}>
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* DETAIL MODAL */}
      {selectedDist && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSelectedDist(null)}>
          <div style={{ background: "#fff", borderRadius: 24, boxShadow: "0 24px 80px rgba(0,0,0,.2)", width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ background: "linear-gradient(135deg, #6366f1 0%, #9333ea 100%)", padding: "24px 28px", borderRadius: "24px 24px 0 0", color: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{selectedDist.name}</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,.7)" }}>{selectedDist.phone} • {selectedDist.email}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: selectedDist.isActive ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.2)", color: selectedDist.isActive ? "#bbf7d0" : "rgba(255,255,255,.7)" }}>
                      {selectedDist.isActive ? "🟢 GPS Active" : "⚫ Offline"}
                    </span>
                    <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,.2)", color: "#fff" }}>
                      📏 {fmtDist(selectedDist.totalDistance)} km today
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedDist(null)} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, borderBottom: "1px solid #f3f4f6" }}>
              {[
                { label: "Today Revenue", value: fmtMoney(selectedDist.todayRevenue), color: "#0d9488" },
                { label: "Units in Stock", value: selectedDist.totalStock ?? 0, color: "#9333ea" },
                { label: "Sales Today",   value: selectedDist.todaySalesCount ?? 0, color: "#f97316" },
              ].map(k => (
                <div key={k.label} style={{ padding: "18px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: "#7A7490", marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Sales history */}
            <div style={{ padding: "20px 24px" }}>

              {/* Daily Sales Bar Chart */}
              {!salesLoading && distAnalytics?.dailyChart?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: "0 0 12px", color: "#3E3E5C", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    <BarChart3 size={16} color="#6366f1" /> Daily Sales — Last 30 Days
                  </h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={distAnalytics.dailyChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip
                        formatter={(v, n) => [n === "revenue" ? `₹${v.toLocaleString()}` : v, n === "revenue" ? "Revenue" : "Qty"]}
                        contentStyle={{ borderRadius: 8, fontSize: 11 }}
                      />
                      <Bar dataKey="quantity" name="Qty Sold" fill="#6366f1" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Inventory Summary — Received / Sold / Remaining */}
              {!salesLoading && distAnalytics?.inventorySummary?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: "0 0 12px", color: "#3E3E5C", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    <Package size={16} color="#9333ea" /> Stock Level (Received − Sold)
                  </h4>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f9fafb" }}>
                          {["Product", "Received", "Sold", "Remaining"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: .4, borderBottom: "1px solid #f3f4f6" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {distAnalytics.inventorySummary.map((item, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 600, color: "#3E3E5C" }}>{item.productName}{item.packSize ? ` (${item.packSize})` : ""}</td>
                            <td style={{ padding: "10px 12px", color: "#0d9488", fontWeight: 700 }}>{item.quantityReceived}</td>
                            <td style={{ padding: "10px 12px", color: "#f97316", fontWeight: 700 }}>{item.quantityDistributed}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 900, color: item.currentStock > 0 ? "#9333ea" : "#ef4444" }}>{item.currentStock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Sales List */}
              <h4 style={{ margin: "0 0 12px", color: "#3E3E5C", fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={16} color="#0d9488" /> Recent Sales
              </h4>
              {salesLoading && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ width: 32, height: 32, border: "4px solid #e0e7ff", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
                </div>
              )}
              {!salesLoading && distSales.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#7A7490" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
                  <p style={{ fontSize: 13 }}>No sales recorded yet</p>
                </div>
              )}
              {!salesLoading && distSales.map(s => (
                <div key={s._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#3E3E5C", fontSize: 13 }}>{s.productName}</div>
                    <div style={{ fontSize: 11, color: "#7A7490" }}>
                      {s.quantity}{s.packSize ? ` × ${s.packSize}` : ""} • {s.saleType === "B2C" ? (s.farmerName || "Farmer") : (s.distributorName || "Dealer")}
                    </div>
                    {s.village && <div style={{ fontSize: 10, color: "#9ca3af" }}>{s.village}{s.district ? `, ${s.district}` : ""}</div>}
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontWeight: 900, color: "#16a34a", fontSize: 14 }}>{fmtMoney(s.totalAmount)}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: s.saleType === "B2C" ? "#dcfce7" : "#dbeafe", color: s.saleType === "B2C" ? "#16a34a" : "#1d4ed8" }}>
                      {s.saleType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ping { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.4); } }
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          main { padding-top: 80px !important; }
        }
      `}</style>
    </div>
  )
}
