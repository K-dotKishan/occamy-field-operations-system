import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import occamyLogo from '../assets/occamylogo.jpg'
import { TrendingUp, Package, LogOut, Menu, Navigation, Warehouse, Plus, X, RefreshCw } from 'lucide-react'

const MIN_DAY_HOURS = 7
const C = { bg:'#FDF8E1', navy:'#3E3E5C', teal:'#4A6D7C', green:'#7FB069', card:'#FFFFFF', border:'#D8D5C5', muted:'#7A7490', inputBg:'#EAF1FF' }

const fmtTime = (iso) => { if (!iso) return '—'; return new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) }
const fmtDate = (iso) => { if (!iso) return '—'; return new Date(iso).toLocaleDateString() }
const fmtDist = (n) => parseFloat(n || 0).toFixed(2)

function notify(type, msg) {
  document.querySelectorAll('.dist-notif').forEach(n => n.remove())
  const el = document.createElement('div')
  el.className = 'dist-notif'
  const bg = type==='success' ? C.green : type==='error' ? '#e53e3e' : type==='warning' ? '#d97706' : C.teal
  el.style.cssText = 'position:fixed;top:80px;right:16px;z-index:9999;background:'+bg+';color:#fff;padding:14px 20px;border-radius:14px;font-family:Poppins,sans-serif;font-size:13px;font-weight:600;box-shadow:0 8px 32px rgba(0,0,0,.18);max-width:320px;'
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(() => el.remove(), 300) }, 3500)
}

const LS = { display:'block', fontSize:11, fontWeight:700, color:C.muted, marginBottom:4 }
const BP = { background:C.navy, color:'#fff', border:'none', borderRadius:12, padding:'11px 22px', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13 }
const BS = { background:C.inputBg, color:C.navy, border:'1.5px solid '+C.border, borderRadius:12, padding:'11px 22px', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13 }

export default function DistributorDashboard() {
  const navigate = useNavigate()
  const userName = localStorage.getItem('name') || 'Distributor'
  const [activeTab, setActiveTab] = useState('home')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeAttendance, setActiveAttendance] = useState(null)
  const [isStartingDay, setIsStartingDay] = useState(false)
  const [isEndingDay, setIsEndingDay] = useState(false)
  const [canEndDay, setCanEndDay] = useState(false)
  const [endDayCountdown, setEndDayCountdown] = useState('')
  const [isTracking, setIsTracking] = useState(false)
  const [watchId, setWatchId] = useState(null)
  const [distanceTraveled, setDistanceTraveled] = useState(0)
  const [stats, setStats] = useState({ sales:0, revenue:0, distanceTraveled:0, totalStock:0 })
  const [inventory, setInventory] = useState([])
  const [showInvForm, setShowInvForm] = useState(false)
  const [invForm, setInvForm] = useState({ productName:'', productSKU:'', packSize:'', quantityReceived:'', pricePerUnit:'', notes:'' })
  const [invLoading, setInvLoading] = useState(false)
  const [sales, setSales] = useState([])
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [saleForm, setSaleForm] = useState({ productName:'', packSize:'', quantity:'', pricePerUnit:'', saleType:'B2C', farmerName:'', farmerContact:'', distributorName:'', distributorContact:'', distributorType:'', paymentMode:'CASH', village:'', district:'', state:'', notes:'' })
  const [saleLoading, setSaleLoading] = useState(false)
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const menuRef = useRef(null)

  const inp = { width:'100%', padding:'11px 14px', border:'1.5px solid '+C.border, borderRadius:'12px', outline:'none', background:C.inputBg, color:C.navy, fontSize:'14px', fontFamily:'Poppins,sans-serif' }
  const onF = (e) => { e.target.style.borderColor=C.navy; e.target.style.boxShadow='0 0 0 3px rgba(62,62,92,.1)' }
  const onB = (e) => { e.target.style.borderColor=C.border; e.target.style.boxShadow='none' }

  // scroll listener
  useEffect(() => {
    const h = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  // click-outside menu
  useEffect(() => {
    if (!isMenuOpen) return
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [isMenuOpen])

  // auth guard + restore session from localStorage immediately (prevents Absent flash)
  useEffect(() => {
    const role = localStorage.getItem('role')
    if (!role) { navigate('/login'); return }
    if (role !== 'DISTRIBUTOR') { navigate('/dashboard'); return }
    const cached = localStorage.getItem('dist_activeAttendance')
    if (cached) { try { setActiveAttendance(JSON.parse(cached)) } catch (_) {} }
    loadAll()
  }, [])

  // 7-hour time-gate countdown
  useEffect(() => {
    if (!activeAttendance?.startTime) { setCanEndDay(false); setEndDayCountdown(''); return }
    const MIN_MS = MIN_DAY_HOURS * 60 * 60 * 1000
    const tick = () => {
      const elapsed = Date.now() - new Date(activeAttendance.startTime).getTime()
      const remaining = MIN_MS - elapsed
      if (remaining <= 0) { setCanEndDay(true); setEndDayCountdown('') }
      else {
        setCanEndDay(false)
        const h = Math.floor(remaining / (1000*60*60))
        const m = Math.floor((remaining % (1000*60*60)) / (1000*60))
        const s = Math.floor((remaining % (1000*60)) / 1000)
        setEndDayCountdown(h+'h '+m+'m '+s+'s')
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [activeAttendance?.startTime])

  // data loader - server is source of truth; localStorage is fallback on network error
  const loadAll = async () => {
    try {
      const [dash, sum] = await Promise.all([api('/distributor/dashboard'), api('/distributor/summary')])
      if (dash.activeAttendance) {
        setActiveAttendance(dash.activeAttendance)
        localStorage.setItem('dist_activeAttendance', JSON.stringify(dash.activeAttendance))
        if (!dash.activeAttendance.endTime) startTracking(false)
      } else {
        setActiveAttendance(null)
        localStorage.removeItem('dist_activeAttendance')
      }
      if (sum.today) { setStats(sum.today); setDistanceTraveled(sum.today.distanceTraveled || 0) }
    } catch (_) {
      // network error: keep cached attendance so user isn't marked absent
      const cached = localStorage.getItem('dist_activeAttendance')
      if (cached) { try { setActiveAttendance(JSON.parse(cached)) } catch (_) {} }
    }
    try { const d = await api('/distributor/inventory'); setInventory(d || []) } catch (_) {}
    try { const d = await api('/distributor/sales'); setSales(d || []) } catch (_) {}
    try { const d = await api('/distributor/attendance'); setAttendanceHistory(d || []) } catch (_) {}
  }

  const startTracking = (doNotify = true) => {
    if (!navigator.geolocation || isTracking) return
    setIsTracking(true)
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const res = await api('/distributor/location/track', 'POST', { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, activity: 'TRAVEL' })
          if (res.totalDistance !== undefined) {
            setDistanceTraveled(res.totalDistance)
            setStats(prev => ({ ...prev, distanceTraveled: res.totalDistance }))
          }
        } catch (_) {}
      },
      () => stopTracking(),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
    setWatchId(id)
    if (doNotify) notify('success', 'Live GPS tracking started.')
  }

  const stopTracking = () => {
    if (watchId) { navigator.geolocation.clearWatch(watchId); setWatchId(null) }
    setIsTracking(false)
  }

  const startDay = async () => {
    if (!navigator.geolocation) { notify('error', 'Geolocation not supported'); return }
    setIsStartingDay(true)
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 }))
      const rec = await api('/distributor/attendance/start', 'POST', { location: { lat: pos.coords.latitude, lng: pos.coords.longitude } })
      const att = { ...rec, startTime: rec.startTime || new Date().toISOString() }
      setActiveAttendance(att)
      localStorage.setItem('dist_activeAttendance', JSON.stringify(att))
      startTracking(false)
      notify('success', 'Day started! GPS tracking active.')
    } catch (err) { notify('error', 'Failed to start day: ' + (err?.error || err?.message || 'Unknown')) }
    finally { setIsStartingDay(false) }
  }

  const endDay = async () => {
    if (!canEndDay) { notify('warning', 'Day End locked. ' + endDayCountdown + ' remaining.'); return }
    if (!navigator.geolocation) { notify('error', 'Geolocation not supported'); return }
    setIsEndingDay(true)
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 }))
      const result = await api('/distributor/attendance/end', 'POST', { location: { lat: pos.coords.latitude, lng: pos.coords.longitude } })
      stopTracking()
      setActiveAttendance(null)
      localStorage.removeItem('dist_activeAttendance')
      const dist = result?.summary?.totalDistance ?? distanceTraveled
      notify('success', 'Day ended! Distance: ' + fmtDist(dist) + ' km')
      loadAll()
    } catch (err) {
      const msg = err?.error || err?.message || 'Unknown'
      if (err?.code === 'TIME_GATE' || msg.includes('locked') || msg.includes('hours')) notify('warning', msg)
      else notify('error', 'Failed to end day: ' + msg)
    } finally { setIsEndingDay(false) }
  }

  const submitInventory = async (e) => {
    e.preventDefault()
    if (!invForm.productName || !invForm.quantityReceived) { notify('error', 'Product name and quantity required'); return }
    setInvLoading(true)
    try {
      await api('/distributor/inventory', 'POST', invForm)
      notify('success', 'Stock received: ' + invForm.quantityReceived + ' units of ' + invForm.productName)
      setInvForm({ productName:'', productSKU:'', packSize:'', quantityReceived:'', pricePerUnit:'', notes:'' })
      setShowInvForm(false)
      loadAll()
    } catch (err) { notify('error', err?.error || 'Failed to update inventory') }
    finally { setInvLoading(false) }
  }

  const submitSale = async (e) => {
    e.preventDefault()
    if (!saleForm.productName || !saleForm.quantity || !saleForm.saleType) { notify('error', 'Product, quantity and sale type required'); return }
    setSaleLoading(true)
    try {
      await api('/distributor/sale', 'POST', saleForm)
      const total = (parseFloat(saleForm.pricePerUnit) || 0) * (parseFloat(saleForm.quantity) || 0)
      notify('success', 'Sale recorded: Rs.' + total.toLocaleString())
      setSaleForm({ productName:'', packSize:'', quantity:'', pricePerUnit:'', saleType:'B2C', farmerName:'', farmerContact:'', distributorName:'', distributorContact:'', distributorType:'', paymentMode:'CASH', village:'', district:'', state:'', notes:'' })
      setShowSaleForm(false)
      loadAll()
    } catch (err) { notify('error', err?.error || 'Failed to record sale') }
    finally { setSaleLoading(false) }
  }

  const logout = () => { stopTracking(); localStorage.clear(); navigate('/login') }

  const TABS = [
    { id:'home', label:'Dashboard' },
    { id:'inventory', label:'Inventory' },
    { id:'sales', label:'Sales' },
    { id:'attendance', label:'Attendance' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:'Poppins,sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;900&display=swap" rel="stylesheet" />

      {/* NAVBAR */}
      <nav style={{ background:'linear-gradient(135deg,'+C.navy+' 0%,'+C.teal+' 100%)', position:'fixed', top:0, left:0, right:0, zIndex:2000, padding: isScrolled ? '10px 20px' : '14px 20px', boxShadow: isScrolled ? '0 4px 20px rgba(62,62,92,.3)' : 'none', transition:'all .3s' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:10, padding:'8px 10px', cursor:'pointer', color:'#fff', display:'flex' }}>
            <Menu size={22} />
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src={occamyLogo} alt="Occamy" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            </div>
            <div>
              <div style={{ color:'#fff', fontWeight:900, fontSize:15, lineHeight:1.1 }}>OCCAMY BIOSCIENCE</div>
              <div style={{ color:'rgba(255,255,255,.7)', fontSize:10, fontWeight:500 }}>Distributor Portal</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {isTracking && (
              <div style={{ background:C.green, borderRadius:20, padding:'5px 12px', display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:'#fff' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} /> LIVE
              </div>
            )}
            <button onClick={logout} style={{ background:'#e53e3e', border:'none', borderRadius:'50%', width:36, height:36, cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <div ref={menuRef} style={{ background:'linear-gradient(180deg,'+C.navy+' 0%,'+C.teal+' 100%)', margin:'10px 0 0', borderRadius:16, padding:'12px 16px', display:'flex', flexDirection:'column', gap:4 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setIsMenuOpen(false) }}
                style={{ background: activeTab===t.id ? 'rgba(255,255,255,.2)' : 'transparent', border:'none', borderRadius:10, padding:'10px 14px', cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', gap:10, fontFamily:'Poppins,sans-serif', fontWeight:600, fontSize:14, textAlign:'left' }}>
                {t.label}
              </button>
            ))}
            <div style={{ height:1, background:'rgba(255,255,255,.2)', margin:'6px 0' }} />
            <button onClick={logout} style={{ background:'transparent', border:'none', borderRadius:10, padding:'10px 14px', cursor:'pointer', color:'rgba(255,100,100,.9)', display:'flex', alignItems:'center', gap:10, fontFamily:'Poppins,sans-serif', fontWeight:600, fontSize:14 }}>
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        )}
      </nav>

      {/* MAIN */}
      <main style={{ maxWidth:1200, margin:'0 auto', padding:'88px 16px 40px' }}>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:26, fontWeight:900, color:C.navy, margin:0 }}>Welcome, {userName} 👋</h1>
          <p style={{ color:C.muted, fontSize:13, margin:'4px 0 0' }}>Distributor Portal — Occamy Bioscience</p>
        </div>

        {/* TAB NAV */}
        <div style={{ display:'flex', gap:8, background:C.card, borderRadius:18, padding:6, marginBottom:24, boxShadow:'0 4px 20px rgba(62,62,92,.1)', overflowX:'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'10px 12px', borderRadius:12, border:'none', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, whiteSpace:'nowrap', background: activeTab===t.id ? C.navy : 'transparent', color: activeTab===t.id ? '#fff' : C.muted, boxShadow: activeTab===t.id ? '0 4px 14px rgba(62,62,92,.25)' : 'none', transition:'all .2s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ATTENDANCE BANNER */}
        <div style={{ background: activeAttendance ? 'linear-gradient(135deg,'+C.green+' 0%,'+C.teal+' 100%)' : 'linear-gradient(135deg,#718096 0%,#4a5568 100%)', borderRadius:18, padding:'18px 22px', marginBottom:24, color:'#fff', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ background:'rgba(255,255,255,.2)', borderRadius:12, padding:10 }}><Navigation size={24} /></div>
            <div>
              <div style={{ fontWeight:800, fontSize:16 }}>{activeAttendance ? 'Day Active — GPS Tracking ON' : 'Day Not Started'}</div>
              <div style={{ fontSize:12, opacity:.85, marginTop:2 }}>
                {activeAttendance
                  ? 'Started at ' + fmtTime(activeAttendance.startTime) + ' • ' + fmtDist(distanceTraveled) + ' km traveled'
                  : 'Click Start Day to begin attendance and GPS tracking'}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {!activeAttendance ? (
              <button onClick={startDay} disabled={isStartingDay}
                style={{ background:'#fff', color:C.navy, border:'none', borderRadius:12, padding:'10px 20px', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, cursor: isStartingDay ? 'not-allowed' : 'pointer', opacity: isStartingDay ? .7 : 1 }}>
                {isStartingDay ? 'Starting...' : 'Start Day'}
              </button>
            ) : (
              <button onClick={endDay} disabled={isEndingDay || !canEndDay}
                title={!canEndDay ? 'Locked: ' + endDayCountdown + ' remaining' : 'End your work day'}
                style={{ background: canEndDay ? '#fff' : 'rgba(255,255,255,.3)', color: canEndDay ? '#e53e3e' : 'rgba(255,255,255,.7)', border:'none', borderRadius:12, padding:'10px 20px', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, cursor: (isEndingDay || !canEndDay) ? 'not-allowed' : 'pointer' }}>
                {isEndingDay ? 'Ending...' : canEndDay ? 'End Day' : 'Locked: ' + endDayCountdown}
              </button>
            )}
          </div>
        </div>

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:14, marginBottom:24 }}>
              {[
                { label:'TODAY SALES', value: stats.sales, color: C.teal },
                { label:'REVENUE', value: 'Rs.' + (stats.revenue || 0).toLocaleString(), color: C.green },
                { label:'DISTANCE', value: fmtDist(stats.distanceTraveled) + ' km', color:'#8b5cf6' },
                { label:'TOTAL STOCK', value: stats.totalStock, color:'#f59e0b' },
              ].map(k => (
                <div key={k.label} style={{ background:C.card, borderRadius:16, padding:'18px 16px', boxShadow:'0 4px 16px rgba(62,62,92,.08)', borderLeft:'4px solid '+k.color }}>
                  <div style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:.5, marginBottom:8 }}>{k.label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.navy }}>{k.value ?? '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:24 }}>
              <button onClick={() => { setActiveTab('inventory'); setShowInvForm(true) }}
                style={{ background:'linear-gradient(135deg,'+C.teal+' 0%,'+C.navy+' 100%)', border:'none', borderRadius:16, padding:'18px 16px', cursor:'pointer', color:'#fff', display:'flex', flexDirection:'column', alignItems:'center', gap:8, fontFamily:'Poppins,sans-serif' }}>
                <Warehouse size={28} />
                <span style={{ fontWeight:700, fontSize:13 }}>Receive Stock</span>
                <span style={{ fontSize:11, opacity:.8 }}>Record inward inventory</span>
              </button>
              <button onClick={() => { setActiveTab('sales'); setShowSaleForm(true) }}
                style={{ background:'linear-gradient(135deg,'+C.green+' 0%,'+C.teal+' 100%)', border:'none', borderRadius:16, padding:'18px 16px', cursor:'pointer', color:'#fff', display:'flex', flexDirection:'column', alignItems:'center', gap:8, fontFamily:'Poppins,sans-serif' }}>
                <TrendingUp size={28} />
                <span style={{ fontWeight:700, fontSize:13 }}>Record Sale</span>
                <span style={{ fontSize:11, opacity:.8 }}>B2B or B2C transaction</span>
              </button>
            </div>
            <SectionCard title="Recent Sales" onRefresh={loadAll}>
              {sales.length === 0 && <EmptyRow msg="No sales recorded yet" />}
              {sales.slice(0,5).map(s => <SaleRow key={s._id} sale={s} />)}
            </SectionCard>
          </>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:900, color:C.navy, margin:0 }}>Inventory Management</h2>
              <button onClick={() => setShowInvForm(!showInvForm)} style={{ background:C.navy, color:'#fff', border:'none', borderRadius:12, padding:'10px 18px', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                <Plus size={16} /> Receive Stock
              </button>
            </div>
            {showInvForm && (
              <div style={{ background:C.card, borderRadius:18, padding:24, marginBottom:20, boxShadow:'0 8px 32px rgba(62,62,92,.12)', border:'1.5px solid '+C.border }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                  <h3 style={{ margin:0, color:C.navy, fontWeight:800, fontSize:16 }}>Record Stock Received (Mall / Inward)</h3>
                  <button onClick={() => setShowInvForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }}><X size={20} /></button>
                </div>
                <form onSubmit={submitInventory} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
                  <div><label style={LS}>Product Name *</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="e.g. Occamy Bovicare" value={invForm.productName} onChange={e => setInvForm({...invForm, productName:e.target.value})} required /></div>
                  <div><label style={LS}>SKU</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Product SKU" value={invForm.productSKU} onChange={e => setInvForm({...invForm, productSKU:e.target.value})} /></div>
                  <div><label style={LS}>Pack Size</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="e.g. 1kg, 5L" value={invForm.packSize} onChange={e => setInvForm({...invForm, packSize:e.target.value})} /></div>
                  <div><label style={LS}>Quantity Received *</label><input style={inp} onFocus={onF} onBlur={onB} type="number" min="0.01" step="0.01" placeholder="Units received" value={invForm.quantityReceived} onChange={e => setInvForm({...invForm, quantityReceived:e.target.value})} required /></div>
                  <div><label style={LS}>Price per Unit (Rs.)</label><input style={inp} onFocus={onF} onBlur={onB} type="number" min="0" step="0.01" placeholder="MRP / cost" value={invForm.pricePerUnit} onChange={e => setInvForm({...invForm, pricePerUnit:e.target.value})} /></div>
                  <div><label style={LS}>Notes</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Optional notes" value={invForm.notes} onChange={e => setInvForm({...invForm, notes:e.target.value})} /></div>
                  <div style={{ gridColumn:'1 / -1', display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
                    <button type="button" onClick={() => setShowInvForm(false)} style={BS}>Cancel</button>
                    <button type="submit" disabled={invLoading} style={{...BP, opacity: invLoading ? .7 : 1}}>{invLoading ? 'Saving...' : 'Save Stock'}</button>
                  </div>
                </form>
              </div>
            )}
            <SectionCard title="Current Inventory" onRefresh={loadAll}>
              {inventory.length === 0 && <EmptyRow msg="No inventory records yet. Click Receive Stock to add." />}
              {inventory.map(item => (
                <div key={item._id} style={{ padding:'14px 18px', borderBottom:'1px solid '+C.border, display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                  <div>
                    <div style={{ fontWeight:700, color:C.navy, fontSize:14 }}>{item.productName}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{item.packSize || '—'}{item.productSKU ? ' • '+item.productSKU : ''}</div>
                    <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>Updated: {fmtDate(item.lastUpdated)}</div>
                  </div>
                  <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                    <Metric label="Received" value={item.quantityReceived || 0} color={C.teal} />
                    <Metric label="Distributed" value={item.quantityDistributed || 0} color="#8b5cf6" />
                    <Metric label="In Stock" value={item.currentStock || 0} color={item.currentStock > 0 ? C.green : '#e53e3e'} />
                  </div>
                </div>
              ))}
            </SectionCard>
          </>
        )}

        {/* SALES TAB */}
        {activeTab === 'sales' && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:900, color:C.navy, margin:0 }}>Sales Records</h2>
              <button onClick={() => setShowSaleForm(!showSaleForm)} style={{ background:C.green, color:'#fff', border:'none', borderRadius:12, padding:'10px 18px', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                <Plus size={16} /> Record Sale
              </button>
            </div>
            {showSaleForm && (
              <div style={{ background:C.card, borderRadius:18, padding:24, marginBottom:20, boxShadow:'0 8px 32px rgba(62,62,92,.12)', border:'1.5px solid '+C.border }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                  <h3 style={{ margin:0, color:C.navy, fontWeight:800, fontSize:16 }}>Record Sale Transaction</h3>
                  <button onClick={() => setShowSaleForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }}><X size={20} /></button>
                </div>
                <form onSubmit={submitSale} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
                  <div><label style={LS}>Sale Type *</label>
                    <select style={inp} onFocus={onF} onBlur={onB} value={saleForm.saleType} onChange={e => setSaleForm({...saleForm, saleType:e.target.value})}>
                      <option value="B2C">B2C — Direct to Farmer</option>
                      <option value="B2B">B2B — To Retailer / Dealer</option>
                    </select>
                  </div>
                  <div><label style={LS}>Product Name *</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Product name" value={saleForm.productName} onChange={e => setSaleForm({...saleForm, productName:e.target.value})} required /></div>
                  <div><label style={LS}>Pack Size</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="e.g. 1kg" value={saleForm.packSize} onChange={e => setSaleForm({...saleForm, packSize:e.target.value})} /></div>
                  <div><label style={LS}>Quantity *</label><input style={inp} onFocus={onF} onBlur={onB} type="number" min="0.01" step="0.01" placeholder="Units sold" value={saleForm.quantity} onChange={e => setSaleForm({...saleForm, quantity:e.target.value})} required /></div>
                  <div><label style={LS}>Price per Unit (Rs.)</label><input style={inp} onFocus={onF} onBlur={onB} type="number" min="0" step="0.01" placeholder="Selling price" value={saleForm.pricePerUnit} onChange={e => setSaleForm({...saleForm, pricePerUnit:e.target.value})} /></div>
                  {saleForm.saleType === 'B2C' ? (
                    <>
                      <div><label style={LS}>Farmer Name</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Farmer name" value={saleForm.farmerName} onChange={e => setSaleForm({...saleForm, farmerName:e.target.value})} /></div>
                      <div><label style={LS}>Farmer Contact</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Phone number" value={saleForm.farmerContact} onChange={e => setSaleForm({...saleForm, farmerContact:e.target.value})} /></div>
                    </>
                  ) : (
                    <>
                      <div><label style={LS}>Retailer / Dealer Name</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Business name" value={saleForm.distributorName} onChange={e => setSaleForm({...saleForm, distributorName:e.target.value})} /></div>
                      <div><label style={LS}>Contact</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Phone number" value={saleForm.distributorContact} onChange={e => setSaleForm({...saleForm, distributorContact:e.target.value})} /></div>
                      <div><label style={LS}>Dealer Type</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="retailer / wholesaler" value={saleForm.distributorType} onChange={e => setSaleForm({...saleForm, distributorType:e.target.value})} /></div>
                    </>
                  )}
                  <div><label style={LS}>Payment Mode</label>
                    <select style={inp} onFocus={onF} onBlur={onB} value={saleForm.paymentMode} onChange={e => setSaleForm({...saleForm, paymentMode:e.target.value})}>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CREDIT">Credit</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                  <div><label style={LS}>Village</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Village" value={saleForm.village} onChange={e => setSaleForm({...saleForm, village:e.target.value})} /></div>
                  <div><label style={LS}>District</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="District" value={saleForm.district} onChange={e => setSaleForm({...saleForm, district:e.target.value})} /></div>
                  <div><label style={LS}>State</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="State" value={saleForm.state} onChange={e => setSaleForm({...saleForm, state:e.target.value})} /></div>
                  <div style={{ gridColumn:'1 / -1' }}><label style={LS}>Notes</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Optional notes" value={saleForm.notes} onChange={e => setSaleForm({...saleForm, notes:e.target.value})} /></div>
                  <div style={{ gridColumn:'1 / -1', display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
                    <button type="button" onClick={() => setShowSaleForm(false)} style={BS}>Cancel</button>
                    <button type="submit" disabled={saleLoading} style={{...BP, background:C.green, opacity: saleLoading ? .7 : 1}}>{saleLoading ? 'Saving...' : 'Record Sale'}</button>
                  </div>
                </form>
              </div>
            )}
            <SectionCard title="All Sales" onRefresh={loadAll}>
              {sales.length === 0 && <EmptyRow msg="No sales recorded yet." />}
              {sales.map(s => <SaleRow key={s._id} sale={s} />)}
            </SectionCard>
          </>
        )}

        {/* SALES TAB */}
        {activeTab === 'sales' && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:900, color:C.navy, margin:0 }}>Sales Records</h2>
              <button onClick={() => setShowSaleForm(!showSaleForm)} style={{ background:C.green, color:'#fff', border:'none', borderRadius:12, padding:'10px 18px', cursor:'pointer', fontFamily:'Poppins,sans-serif', fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                <Plus size={16} /> Record Sale
              </button>
            </div>
            {showSaleForm && (
              <div style={{ background:C.card, borderRadius:18, padding:24, marginBottom:20, boxShadow:'0 8px 32px rgba(62,62,92,.12)', border:'1.5px solid '+C.border }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                  <h3 style={{ margin:0, color:C.navy, fontWeight:800, fontSize:16 }}>Record Sale Transaction</h3>
                  <button onClick={() => setShowSaleForm(false)} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted }}><X size={20} /></button>
                </div>
                <form onSubmit={submitSale} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
                  <div><label style={LS}>Sale Type *</label>
                    <select style={inp} onFocus={onF} onBlur={onB} value={saleForm.saleType} onChange={e => setSaleForm({...saleForm, saleType:e.target.value})}>
                      <option value="B2C">B2C — Direct to Farmer</option>
                      <option value="B2B">B2B — To Retailer / Dealer</option>
                    </select>
                  </div>
                  <div><label style={LS}>Product Name *</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Product name" value={saleForm.productName} onChange={e => setSaleForm({...saleForm, productName:e.target.value})} required /></div>
                  <div><label style={LS}>Pack Size</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="e.g. 1kg" value={saleForm.packSize} onChange={e => setSaleForm({...saleForm, packSize:e.target.value})} /></div>
                  <div><label style={LS}>Quantity *</label><input style={inp} onFocus={onF} onBlur={onB} type="number" min="0.01" step="0.01" placeholder="Units sold" value={saleForm.quantity} onChange={e => setSaleForm({...saleForm, quantity:e.target.value})} required /></div>
                  <div><label style={LS}>Price per Unit (Rs.)</label><input style={inp} onFocus={onF} onBlur={onB} type="number" min="0" step="0.01" placeholder="Selling price" value={saleForm.pricePerUnit} onChange={e => setSaleForm({...saleForm, pricePerUnit:e.target.value})} /></div>
                  {saleForm.saleType === 'B2C' ? (
                    <>
                      <div><label style={LS}>Farmer Name</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Farmer name" value={saleForm.farmerName} onChange={e => setSaleForm({...saleForm, farmerName:e.target.value})} /></div>
                      <div><label style={LS}>Farmer Contact</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Phone number" value={saleForm.farmerContact} onChange={e => setSaleForm({...saleForm, farmerContact:e.target.value})} /></div>
                    </>
                  ) : (
                    <>
                      <div><label style={LS}>Retailer / Dealer Name</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Business name" value={saleForm.distributorName} onChange={e => setSaleForm({...saleForm, distributorName:e.target.value})} /></div>
                      <div><label style={LS}>Contact</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Phone number" value={saleForm.distributorContact} onChange={e => setSaleForm({...saleForm, distributorContact:e.target.value})} /></div>
                      <div><label style={LS}>Dealer Type</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="retailer / wholesaler" value={saleForm.distributorType} onChange={e => setSaleForm({...saleForm, distributorType:e.target.value})} /></div>
                    </>
                  )}
                  <div><label style={LS}>Payment Mode</label>
                    <select style={inp} onFocus={onF} onBlur={onB} value={saleForm.paymentMode} onChange={e => setSaleForm({...saleForm, paymentMode:e.target.value})}>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CREDIT">Credit</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>
                  <div><label style={LS}>Village</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Village" value={saleForm.village} onChange={e => setSaleForm({...saleForm, village:e.target.value})} /></div>
                  <div><label style={LS}>District</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="District" value={saleForm.district} onChange={e => setSaleForm({...saleForm, district:e.target.value})} /></div>
                  <div><label style={LS}>State</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="State" value={saleForm.state} onChange={e => setSaleForm({...saleForm, state:e.target.value})} /></div>
                  <div style={{ gridColumn:'1 / -1' }}><label style={LS}>Notes</label><input style={inp} onFocus={onF} onBlur={onB} placeholder="Optional notes" value={saleForm.notes} onChange={e => setSaleForm({...saleForm, notes:e.target.value})} /></div>
                  <div style={{ gridColumn:'1 / -1', display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
                    <button type="button" onClick={() => setShowSaleForm(false)} style={BS}>Cancel</button>
                    <button type="submit" disabled={saleLoading} style={{...BP, background:C.green, opacity: saleLoading ? .7 : 1}}>{saleLoading ? 'Saving...' : 'Record Sale'}</button>
                  </div>
                </form>
              </div>
            )}
            <SectionCard title="All Sales (newest first)" onRefresh={loadAll}>
              {sales.length === 0 && <EmptyRow msg="No sales recorded yet." />}
              {sales.map(s => <SaleRow key={s._id} sale={s} />)}
            </SectionCard>
          </>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.navy, marginBottom:16 }}>Attendance History</h2>
            <SectionCard title="Records (newest first)" onRefresh={loadAll}>
              {attendanceHistory.length === 0 && <EmptyRow msg="No attendance records yet." />}
              {attendanceHistory.map(a => {
                const isActive = !a.endTime
                const dMs = a.endTime
                  ? new Date(a.endTime) - new Date(a.startTime)
                  : Date.now() - new Date(a.startTime)
                const dH = Math.floor(dMs / (1000*60*60))
                const dM = Math.floor((dMs % (1000*60*60)) / (1000*60))
                return (
                  <div key={a._id} style={{ padding:'14px 18px', borderBottom:'1px solid '+C.border, display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:10 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:20, background: isActive ? '#dcfce7' : '#f3f4f6', color: isActive ? '#16a34a' : '#6b7280' }}>
                          {isActive ? 'Active' : 'Completed'}
                        </span>
                        <span style={{ fontSize:12, color:C.muted }}>{fmtDate(a.startTime)}</span>
                      </div>
                      <div style={{ fontSize:13, color:C.navy }}>
                        {fmtTime(a.startTime)} {a.endTime ? '→ ' + fmtTime(a.endTime) : '→ ongoing'}
                      </div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Duration: {dH}h {dM}m</div>
                    </div>
                    <Metric label="Distance" value={fmtDist(a.totalDistance) + ' km'} color={C.teal} />
                  </div>
                )
              })}
            </SectionCard>
          </>
        )}
      </main>

      <style>{`
        * { box-sizing: border-box; }
        @media (max-width: 600px) { main { padding-top: 80px !important; } }
      `}</style>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

function SectionCard({ title, children, onRefresh }) {
  return (
    <div style={{ background:'#fff', borderRadius:18, boxShadow:'0 4px 20px rgba(62,62,92,.08)', overflow:'hidden', marginBottom:20 }}>
      <div style={{ background:'linear-gradient(135deg,#f8f9fa 0%,#f1f3f5 100%)', padding:'14px 18px', borderBottom:'1px solid #D8D5C5', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#3E3E5C' }}>{title}</h3>
        {onRefresh && (
          <button onClick={onRefresh} style={{ background:'none', border:'none', cursor:'pointer', color:'#7A7490', display:'flex', alignItems:'center', gap:4, fontSize:12, fontFamily:'Poppins,sans-serif', fontWeight:600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        )}
      </div>
      <div style={{ maxHeight:480, overflowY:'auto' }}>{children}</div>
    </div>
  )
}

function Metric({ label, value, color }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:18, fontWeight:900, color }}>{value}</div>
      <div style={{ fontSize:10, color:'#7A7490', fontWeight:600 }}>{label}</div>
    </div>
  )
}

function SaleRow({ sale }) {
  const tc = sale.saleType === 'B2C'
    ? { bg:'#dcfce7', text:'#16a34a' }
    : { bg:'#dbeafe', text:'#1d4ed8' }
  return (
    <div style={{ padding:'12px 18px', borderBottom:'1px solid #D8D5C5', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, color:'#3E3E5C', fontSize:14 }}>{sale.productName}</div>
        <div style={{ fontSize:12, color:'#7A7490' }}>
          {sale.quantity}{sale.packSize ? ' x ' + sale.packSize : ''} &bull; {sale.saleType === 'B2C' ? (sale.farmerName || 'Farmer') : (sale.distributorName || 'Dealer')}
        </div>
        {sale.village && (
          <div style={{ fontSize:11, color:'#7A7490' }}>{sale.village}{sale.district ? ', ' + sale.district : ''}</div>
        )}
        <div style={{ fontSize:11, color:'#7A7490', marginTop:2 }}>{new Date(sale.createdAt).toLocaleString()}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:16, fontWeight:900, color:'#7FB069' }}>Rs.{(sale.totalAmount || 0).toLocaleString()}</div>
        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:tc.bg, color:tc.text }}>{sale.saleType}</span>
      </div>
    </div>
  )
}

function EmptyRow({ msg }) {
  return (
    <div style={{ padding:'32px 18px', textAlign:'center', color:'#7A7490', fontSize:13 }}>
      <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
      {msg}
    </div>
  )
}
