import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { api, syncPendingRequests, getOfflineQueueStatus } from "../api"
import LiveTracking from "../components/LiveTracking"
import LanguageToggle from "../components/LanguageToggle"
import { MapPin, Users, Package, TrendingUp, Calendar, Camera, X, Upload, Wifi, WifiOff, RefreshCw, LogOut } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

// ─── GPS helper ───────────────────────────────────────────────────────────────
// Tries to get the device location with a 5-second timeout.
// If GPS is unavailable or times out, resolves with {lat:0, lng:0} so forms
// always submit — location is optional metadata, not a blocker.
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: 0, lng: 0 })
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()    => resolve({ lat: 0, lng: 0 }),
      { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }
    )
  })
}

export default function FieldDashboard() {
  const { t, i18n } = useTranslation()
  const [location, setLocation] = useState(null)
  const [activeDay, setActiveDay] = useState(null)
  const [showForm, setShowForm] = useState(null) // 'meeting', 'sample', 'sale', 'message'
  const [summary, setSummary] = useState(null)

  // Offline State
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [queueStatus, setQueueStatus] = useState({ count: 0, hasPending: false })
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // Initial Load
    loadSummary()
    checkQueue()

    // Network Listeners
    const handleOnline = () => { setIsOnline(true); checkQueue(); }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check queue periodically
    const interval = setInterval(checkQueue, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  const checkQueue = () => {
    setQueueStatus(getOfflineQueueStatus())
  }

  const handleSync = async () => {
    if (!isOnline) {
      alert(t('field.cannotSync'))
      return
    }

    setIsSyncing(true)
    try {
      const result = await syncPendingRequests()
      alert(`Sync Complete: ${result.count} items uploaded. ${result.failed > 0 ? result.failed + ' failed.' : ''}`)
      checkQueue()
      loadSummary()
    } catch (err) {
      alert(t('field.syncFailed'))
    } finally {
      setIsSyncing(false)
    }
  }

  const loadSummary = async () => {
    try {
      const data = await api("/field/summary")
      if (data && data.today) {
        setSummary(data.today)
        setActiveDay(data.today.isActive)
      }
    } catch (err) {
      console.error("Failed to load summary", err)
    }
  }

  const startDay = async () => {
    const odometer = prompt(t('field.odometerStart'))
    if (!odometer) return

    const coords = await getLocation()
    setLocation(coords)

    try {
      await api("/field/attendance/start", "POST", {
        location: coords,
        odometer: parseFloat(odometer)
      })
      alert(t('field.attendanceStart'))
      setActiveDay(true)
      loadSummary()
    } catch (err) {
      alert(t('field.saleFailed') + (err?.error || err?.message || "Unknown error"))
    }
  }

  const endDay = async () => {
    const odometer = prompt(t('field.odometerEnd'))
    if (!odometer) return

    const coords = await getLocation()

    try {
      await api("/field/attendance/end", "POST", {
        location: coords,
        odometer: parseFloat(odometer)
      })
      alert(t('field.attendanceEnd'))
      setActiveDay(false)
      loadSummary()
    } catch (err) {
      alert(t('field.saleFailed') + (err?.error || err?.message || "Unknown error"))
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-gray-800 mb-2">{t('field.fieldOfficer')}</h2>
          <p className="text-gray-600">{t('field.fieldOfficerSub')}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          {activeDay !== null && (
            <div className={`px-6 py-3 rounded-2xl shadow-lg font-bold ${activeDay
              ? 'bg-green-100 text-green-800 border-2 border-green-300'
              : 'bg-gray-100 text-gray-600'
              }`}>
              {activeDay ? t('field.dayActive') : t('field.dayEnded')}
            </div>
          )}
        </div>
      </div>

      {/* Today's Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard label={t('field.meetings')} value={summary?.meetings ?? 0} icon={<Users size={24} />} />
          <SummaryCard label={t('field.samples')} value={summary?.samples ?? 0} icon={<Package size={24} />} />
          <SummaryCard label={t('field.salesLabel')} value={summary?.sales ?? 0} icon={<TrendingUp size={24} />} />
          <SummaryCard label={t('field.revenue')} value={`Rs.${(summary?.revenue ?? 0).toLocaleString()}`} icon={<span className="text-xl font-black">₹</span>} />
          <SummaryCard label={t('field.distance')} value={`${summary?.distanceTraveled ?? 0} km`} icon={<MapPin size={24} />} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {!activeDay ? (
          <ActionButton
            icon={<MapPin size={24} />}
            label={t('field.startDay')}
            subtitle={t('field.startDaySub')}
            color="from-blue-500 to-blue-700"
            onClick={startDay}
          />
        ) : (
          <ActionButton
            icon={<MapPin size={24} />}
            label={t('field.endDay')}
            subtitle={t('field.endDaySub')}
            color="from-red-500 to-red-700"
            onClick={endDay}
          />
        )}

        <ActionButton
          icon={<Users size={24} />}
          label={t('field.logMeeting')}
          subtitle={t('field.logMeetingSub')}
          color="from-indigo-500 to-indigo-700"
          onClick={() => setShowForm('meeting')}
          disabled={!activeDay}
        />

        <ActionButton
          icon={<Package size={24} />}
          label={t('field.distributeSample')}
          subtitle={t('field.distributeSampleSub')}
          color="from-purple-500 to-purple-700"
          onClick={() => setShowForm('sample')}
          disabled={!activeDay}
        />

        <ActionButton
          icon={<TrendingUp size={24} />}
          label={t('field.recordSale')}
          subtitle={t('field.recordSaleSub')}
          color="from-emerald-500 to-emerald-700"
          onClick={() => setShowForm('sale')}
          disabled={!activeDay}
        />

        <ActionButton
          icon={<span className="text-2xl">💬</span>}
          label={t('field.sendMessage')}
          subtitle={t('field.sendMessageSub')}
          color="from-cyan-500 to-blue-700"
          onClick={() => setShowForm('message')}
          disabled={!activeDay}
        />
      </div>

      {/* Live Tracking */}
      {activeDay && <LiveTracking onLocationUpdate={loadSummary} />}

      {/* Forms */}
      {showForm === 'meeting' && <MeetingForm onClose={() => { setShowForm(null); loadSummary(); }} />}
      {showForm === 'sample' && <SampleForm onClose={() => { setShowForm(null); loadSummary(); }} />}
      {showForm === 'sale' && <SaleForm onClose={() => { setShowForm(null); loadSummary(); }} />}
      {showForm === 'message' && <MessageToAdminForm onClose={() => { setShowForm(null); loadSummary(); }} currentSummary={summary} />}
    </div>
  )
}

/* ================= COMPONENTS ================= */

function ActionButton({ icon, label, subtitle, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-gradient-to-br from-[#3b758c] to-[#1797a6] text-white p-6 rounded-2xl shadow-md hover:opacity-90 transition-all duration-300 group ${disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="bg-white bg-opacity-20 p-3 rounded-xl group-hover:rotate-12 transition-transform">
          {icon}
        </div>
        <div className="text-center">
          <p className="font-black text-lg">{label}</p>
          <p className="text-xs opacity-90">{subtitle}</p>
        </div>
      </div>
    </button>
  )
}

function SummaryCard({ label, value, icon }) {
  return (
    <div className="bg-gradient-to-br from-[#3b758c] to-[#1797a6] text-white p-6 rounded-2xl shadow-md hover:opacity-90 transition-all">
      <div className="flex justify-between items-start mb-2">
        <span className="text-3xl">{icon}</span>
      </div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs opacity-80 font-semibold mt-1">{label}</p>
    </div>
  )
}

/* ================= MEETING FORM ================= */

function MeetingForm({ onClose }) {
  const { t } = useTranslation()
  const [meetingType, setMeetingType] = useState("ONE_TO_ONE")
  const [formData, setFormData] = useState({
    personName: "",
    contactNumber: "",
    category: "FARMER",
    village: "",
    district: "",
    state: "",
    attendeesCount: 0,
    meetingType: "DEMO",
    estimatedVolume: 0,
    likelihood: "MEDIUM",
    notes: "",
    followUpRequired: false,
    dateOfReceipt: "",
    dateOfSale: "",
    quantityReceived: 0,
    quantitySold: 0,
  })
  const [photos, setPhotos] = useState([])

  const handleSubmit = async () => {
    const location = await getLocation()
    const formDataToSend = new FormData()

    formDataToSend.append('location', JSON.stringify(location))

    if (meetingType === "ONE_TO_ONE") {
      // Only send ONE_TO_ONE relevant fields
      formDataToSend.append('personName',      formData.personName)
      formDataToSend.append('contactNumber',   formData.contactNumber)
      formDataToSend.append('category',        formData.category)
      formDataToSend.append('village',         formData.village)
      formDataToSend.append('district',        formData.district)
      formDataToSend.append('state',           formData.state)
      formDataToSend.append('notes',           formData.notes)
      formDataToSend.append('followUpRequired', String(formData.followUpRequired))
      formDataToSend.append('businessPotential', JSON.stringify({
        estimatedVolume: formData.estimatedVolume,
        likelihood: formData.likelihood
      }))
    } else {
      // Only send GROUP relevant fields
      formDataToSend.append('village',         formData.village)
      formDataToSend.append('district',        formData.district)
      formDataToSend.append('state',           formData.state)
      formDataToSend.append('attendeesCount',  formData.attendeesCount)
      formDataToSend.append('meetingType',     formData.meetingType)
      formDataToSend.append('category',        formData.category)
      formDataToSend.append('notes',           formData.notes)
    }

    // Add photos
    photos.forEach(photo => {
      formDataToSend.append('photos', photo)
    })

    try {
      const endpoint = meetingType === "ONE_TO_ONE"
        ? "/field/meeting/one-to-one"
        : "/field/meeting/group"

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formDataToSend
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

      alert(t('field.meetingLogged'))
      onClose()
    } catch (err) {
      console.error("Meeting log error:", err)
      alert(t('field.meetingFailed') + (err.message || "Unknown error"))
    }
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-indigo-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">{t('meeting.title')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      {/* Meeting Type Selector */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setMeetingType("ONE_TO_ONE")}
          className={`flex-1 py-2 rounded-lg font-bold transition-all ${meetingType === "ONE_TO_ONE"
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          {t('meeting.oneToOne')}
        </button>
        <button
          onClick={() => setMeetingType("GROUP")}
          className={`flex-1 py-2 rounded-lg font-bold transition-all ${meetingType === "GROUP"
            ? 'bg-purple-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          {t('meeting.group')}
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        {meetingType === "ONE_TO_ONE" ? (
          <>
            <Input label={t('meeting.personName')} value={formData.personName} onChange={v => setFormData({ ...formData, personName: v })} required />
            <Input label={t('meeting.contactNumber')} type="tel" value={formData.contactNumber} onChange={v => setFormData({ ...formData, contactNumber: v })} />
            <Select label={t('meeting.category')} value={formData.category} onChange={v => setFormData({ ...formData, category: v })} options={["FARMER", "SELLER", "INFLUENCER", "VETERINARIAN", "DISTRIBUTOR", "DEALER", "RETAIL_OUTLET", "KVK", "FPO", "DDB"]} />
            <Input label={t('meeting.estimatedVolume')} type="number" value={formData.estimatedVolume} onChange={v => setFormData({ ...formData, estimatedVolume: v })} />
            <Select label={t('meeting.likelihood')} value={formData.likelihood} onChange={v => setFormData({ ...formData, likelihood: v })} options={["LOW", "MEDIUM", "HIGH"]} />
            <Input label={t('meeting.dateOfReceipt')} type="date" value={formData.dateOfReceipt} onChange={v => setFormData({ ...formData, dateOfReceipt: v })} />
            <Input label={t('meeting.dateOfSale')} type="date" value={formData.dateOfSale} onChange={v => setFormData({ ...formData, dateOfSale: v })} />
            <Input label={t('meeting.quantityReceived')} type="number" value={formData.quantityReceived} onChange={v => setFormData({ ...formData, quantityReceived: v })} />
            <Input label={t('meeting.quantitySold')} type="number" value={formData.quantitySold} onChange={v => setFormData({ ...formData, quantitySold: v })} />
          </>
        ) : (
          <>
            <Input label={t('meeting.village')} value={formData.village} onChange={v => setFormData({ ...formData, village: v })} required />
            <Input label={t('meeting.numAttendees')} type="number" value={formData.attendeesCount} onChange={v => setFormData({ ...formData, attendeesCount: v })} required />
            <Select label={t('meeting.category')} value={formData.category} onChange={v => setFormData({ ...formData, category: v })} options={["FARMER", "SELLER", "INFLUENCER", "VETERINARIAN", "DISTRIBUTOR", "DEALER", "RETAIL_OUTLET", "KVK", "FPO", "DDB"]} />
            <Select label={t('meeting.meetingType')} value={formData.meetingType} onChange={v => setFormData({ ...formData, meetingType: v })} options={["DEMO", "TRAINING", "FEEDBACK", "AWARENESS"]} />
            <Input label={t('meeting.dateOfReceipt')} type="date" value={formData.dateOfReceipt} onChange={v => setFormData({ ...formData, dateOfReceipt: v })} />
            <Input label={t('meeting.dateOfSale')} type="date" value={formData.dateOfSale} onChange={v => setFormData({ ...formData, dateOfSale: v })} />
            <Input label={t('meeting.quantityReceived')} type="number" value={formData.quantityReceived} onChange={v => setFormData({ ...formData, quantityReceived: v })} />
            <Input label={t('meeting.quantitySold')} type="number" value={formData.quantitySold} onChange={v => setFormData({ ...formData, quantitySold: v })} />
          </>
        )}

        <Input label={t('meeting.district')} value={formData.district} onChange={v => setFormData({ ...formData, district: v })} />
        <Input label={t('meeting.state')} value={formData.state} onChange={v => setFormData({ ...formData, state: v })} />
        <Textarea label={t('meeting.notes')} value={formData.notes} onChange={v => setFormData({ ...formData, notes: v })} rows={4} />
        <FileUpload label={t('meeting.photos')} onChange={setPhotos} accept="image/*" multiple />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.followUpRequired}
            onChange={e => setFormData({ ...formData, followUpRequired: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm font-semibold text-gray-700">{t('meeting.followUp')}</span>
        </label>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all">
          {t('common.cancel')}
        </button>
        <button onClick={handleSubmit} className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all shadow-lg">
          {t('field.saveMeeting')}
        </button>
      </div>
    </div>
  )
}

/* ================= SAMPLE FORM ================= */

function SampleForm({ onClose }) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    productName: "",
    productSKU: "",
    quantity: 0,
    unit: "kg",
    recipientName: "",
    recipientContact: "",
    recipientCategory: "FARMER",
    purpose: "TRIAL",
    village: "",
    district: "",
    state: "",
    notes: ""
  })
  const [photos, setPhotos] = useState([])

  const handleSubmit = async () => {
    const location = await getLocation()
    const formDataToSend = new FormData()

    formDataToSend.append('location', JSON.stringify(location))

    Object.keys(formData).forEach(key => {
      formDataToSend.append(key, formData[key])
    })

    photos.forEach(photo => {
      formDataToSend.append('photos', photo)
    })

    try {
      const res = await fetch(`${API_URL}/field/sample`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formDataToSend
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

      alert(t('field.sampleLogged'))
      onClose()
    } catch (err) {
      console.error("Sample log error:", err)
      alert(t('field.sampleFailed') + (err.message || "Unknown error"))
    }
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-purple-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">{t('sample.title')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        <Input label={t('sample.productName')} value={formData.productName} onChange={v => setFormData({ ...formData, productName: v })} required />
        <Input label={t('sample.productSKU')} value={formData.productSKU} onChange={v => setFormData({ ...formData, productSKU: v })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('sample.quantity')} type="number" value={formData.quantity} onChange={v => setFormData({ ...formData, quantity: v })} required />
          <Select label={t('sample.unit')} value={formData.unit} onChange={v => setFormData({ ...formData, unit: v })} options={["kg", "litre", "packet", "unit"]} />
        </div>
        <Input label={t('sample.recipientName')} value={formData.recipientName} onChange={v => setFormData({ ...formData, recipientName: v })} required />
        <Input label={t('sample.recipientContact')} type="tel" value={formData.recipientContact} onChange={v => setFormData({ ...formData, recipientContact: v })} />
        <Select label={t('sample.recipientCategory')} value={formData.recipientCategory} onChange={v => setFormData({ ...formData, recipientCategory: v })} options={["FARMER", "SELLER", "INFLUENCER", "VETERINARIAN"]} />
        <Select label={t('sample.purpose')} value={formData.purpose} onChange={v => setFormData({ ...formData, purpose: v })} options={["TRIAL", "DEMO", "TRAINING", "FOLLOWUP"]} />
        <Input label={t('sample.village')} value={formData.village} onChange={v => setFormData({ ...formData, village: v })} />
        <Input label={t('sample.district')} value={formData.district} onChange={v => setFormData({ ...formData, district: v })} />
        <Input label={t('sample.state')} value={formData.state} onChange={v => setFormData({ ...formData, state: v })} />
        <FileUpload label={t('sample.photos')} onChange={setPhotos} accept="image/*" multiple />
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all">
          {t('common.cancel')}
        </button>
        <button onClick={handleSubmit} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold transition-all shadow-lg">
          {t('field.saveSample')}
        </button>
      </div>
    </div>
  )
}

/* ================= SALE FORM ================= */

function SaleForm({ onClose }) {
  const { t } = useTranslation()
  const [saleType, setSaleType] = useState("B2C")
  const [formData, setFormData] = useState({
    productName: "",
    productSKU: "",
    packSize: "1kg",
    quantity: 1,
    pricePerUnit: 0,
    customerName: "",
    customerContact: "",
    distributorType: "",
    paymentMode: "CASH",
    isRepeatOrder: false,
    village: "",
    district: "",
    state: "",
    notes: ""
  })
  const [photos, setPhotos] = useState([])
  const [showPreview, setShowPreview] = useState(false)

  const totalAmount = formData.quantity * formData.pricePerUnit

  const handleSubmit = async () => {
    const location = await getLocation()
    const formDataToSend = new FormData()

    formDataToSend.append('location', JSON.stringify(location))
    formDataToSend.append('saleType', saleType)

    Object.keys(formData).forEach(key => {
      formDataToSend.append(key, formData[key])
    })

    // totalAmount is derived — not in formData, must be appended explicitly
    formDataToSend.append('totalAmount', totalAmount)

    photos.forEach(photo => {
      formDataToSend.append('photos', photo)
    })

    try {
      const res = await fetch(`${API_URL}/field/sale`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formDataToSend
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

      alert(t('field.saleLogged'))
      onClose()
    } catch (err) {
      console.error("Sale log error:", err)
      alert(t('field.saleFailed') + (err.message || "Unknown error"))
    }
  }

  // ── Preview rows helper ───────────────────────────────────────────────────
  const PreviewRow = ({ label, value }) => value ? (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span className="text-sm font-bold text-gray-800 text-right max-w-xs">{value}</span>
    </div>
  ) : null

  return (
    <>
      {/* ── PREVIEW MODAL ─────────────────────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-y-auto" style={{ maxHeight: '90vh' }}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className={`px-3 py-1 rounded-full text-xs font-black ${saleType === 'B2C' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {saleType}
                </div>
                <h2 className="text-xl font-black text-gray-800">{t('sale.orderPreview')}</h2>
              </div>

              {/* Total highlight */}
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 mb-5 text-center">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{t('sale.totalAmount')}</p>
                <p className="text-4xl font-black text-emerald-700">₹{totalAmount.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{formData.quantity} × ₹{formData.pricePerUnit} per unit</p>
              </div>

              <div className="space-y-0">
                <PreviewRow label={t('sale.product')} value={formData.productName} />
                <PreviewRow label={t('sale.sku')} value={formData.productSKU} />
                <PreviewRow label={t('sale.packSize')} value={formData.packSize} />
                <PreviewRow label={t('sale.quantity')} value={formData.quantity} />
                <PreviewRow label={t('sale.pricePerUnit')} value={formData.pricePerUnit ? `₹${formData.pricePerUnit}` : null} />
                <PreviewRow label={saleType === 'B2C' ? t('sale.farmerName') : t('sale.distributorName')} value={formData.customerName} />
                <PreviewRow label={t('sale.contact')} value={formData.customerContact} />
                {saleType === 'B2B' && <PreviewRow label={t('sale.distributorType')} value={formData.distributorType} />}
                <PreviewRow label={t('sale.paymentMode')} value={formData.paymentMode} />
                <PreviewRow label={t('sale.village')} value={formData.village} />
                <PreviewRow label={t('sale.district')} value={formData.district} />
                <PreviewRow label={t('sale.state')} value={formData.state} />
                <PreviewRow label={t('sale.notes')} value={formData.notes} />
                <PreviewRow label={t('sale.repeatOrder')} value={formData.isRepeatOrder ? t('common.save') : null} />
                {photos.length > 0 && <PreviewRow label={t('sale.photos')} value={`${photos.length} attached`} />}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all"
                >
                  {t('sale.editBack')}
                </button>
                <button
                  onClick={() => { setShowPreview(false); handleSubmit() }}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl font-bold transition-all shadow-lg"
                >
                  {t('sale.confirmSubmit')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM ──────────────────────────────────────────────────────────── */}
      <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-emerald-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">{t('sale.title')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      {/* Sale Type Selector */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setSaleType("B2C")}
          className={`flex-1 py-2 rounded-lg font-bold transition-all ${saleType === "B2C"
            ? 'bg-emerald-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          {t('sale.b2cFarmer')}
        </button>
        <button
          onClick={() => setSaleType("B2B")}
          className={`flex-1 py-2 rounded-lg font-bold transition-all ${saleType === "B2B"
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          {t('sale.b2bDistributor')}
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        <Input label={t('sale.productName')} value={formData.productName} onChange={v => setFormData({ ...formData, productName: v })} required />
        <Input label={t('sale.productSKU')} value={formData.productSKU} onChange={v => setFormData({ ...formData, productSKU: v })} />
        <Input label={t('sale.packSize')} value={formData.packSize} onChange={v => setFormData({ ...formData, packSize: v })} placeholder="e.g., 1kg, 5kg, 500ml" />

        <div className="grid grid-cols-2 gap-4">
          <Input label={t('sale.quantity')} type="number" value={formData.quantity} onChange={v => setFormData({ ...formData, quantity: v })} required />
          <Input label={t('sale.pricePerUnit')} type="number" value={formData.pricePerUnit} onChange={v => setFormData({ ...formData, pricePerUnit: v })} required />
        </div>

        <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200">
          <p className="text-sm text-gray-600">{t('sale.totalAmount')}</p>
          <p className="text-3xl font-black text-emerald-700">₹{totalAmount.toLocaleString()}</p>
        </div>

        <Input label={saleType === "B2C" ? t('sale.farmerName') : t('sale.distributorName')} value={formData.customerName} onChange={v => setFormData({ ...formData, customerName: v })} required />
        <Input label={t('sale.contactNumber')} type="tel" value={formData.customerContact} onChange={v => setFormData({ ...formData, customerContact: v })} />

        {saleType === "B2B" && (
          <Select label={t('sale.distributorType')} value={formData.distributorType} onChange={v => setFormData({ ...formData, distributorType: v })} options={["RETAILER", "WHOLESALER", "AGENT", "OTHER"]} />
        )}

        <Select label={t('sale.paymentMode')} value={formData.paymentMode} onChange={v => setFormData({ ...formData, paymentMode: v })} options={["CASH", "UPI", "CREDIT", "BANK_TRANSFER"]} />

        <Input label={t('sale.village')} value={formData.village} onChange={v => setFormData({ ...formData, village: v })} />
        <Input label={t('sale.district')} value={formData.district} onChange={v => setFormData({ ...formData, district: v })} />
        <Input label={t('sale.state')} value={formData.state} onChange={v => setFormData({ ...formData, state: v })} />

        <Textarea label={t('sale.notes')} value={formData.notes} onChange={v => setFormData({ ...formData, notes: v })} rows={3} />

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={formData.isRepeatOrder} onChange={e => setFormData({ ...formData, isRepeatOrder: e.target.checked })} className="w-4 h-4" />
          <span className="text-sm font-semibold text-gray-700">{t('sale.repeatOrder')}</span>
        </label>

        <FileUpload label={t('sale.photos')} onChange={setPhotos} accept="image/*" multiple />
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all">
          {t('common.cancel')}
        </button>
        <button onClick={() => setShowPreview(true)} className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl font-bold transition-all shadow-lg">
          {t('sale.previewSave')}
        </button>
      </div>
    </div>
    </>
  )
}

/* ================= FORM COMPONENTS ================= */

function Input({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
      />
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 4 }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
      />
    </div>
  )
}

function FileUpload({ label, onChange, accept, multiple = false }) {
  const { t } = useTranslation()
  const [previews, setPreviews] = useState([])

  const handleChange = (e) => {
    const newFiles = Array.from(e.target.files)
    e.target.value = "" // allow re-selecting same file
    if (!multiple) {
      // single mode — replace
      const file = newFiles[0]
      if (!file) return
      setPreviews([{ file, url: URL.createObjectURL(file) }])
      onChange([file])
    } else {
      // multi mode — append
      const newPreviews = newFiles.map(f => ({ file: f, url: URL.createObjectURL(f) }))
      setPreviews(prev => {
        const updated = [...prev, ...newPreviews]
        onChange(updated.map(p => p.file))
        return updated
      })
    }
  }

  const remove = (index) => {
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index].url)
      const updated = prev.filter((_, i) => i !== index)
      onChange(updated.map(p => p.file))
      return updated
    })
  }

  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">
        {label} {multiple && previews.length > 0 && <span className="text-indigo-600 font-normal">— {previews.length} selected</span>}
      </label>
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 hover:border-indigo-500 transition-all">
        <div className="flex gap-2 justify-center">
          {/* Gallery */}
          <label className="cursor-pointer flex-1">
            <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-bold text-sm hover:from-indigo-600 hover:to-purple-700 transition-all text-center">
              <Upload size={14} />
              {t('common.gallery')}
            </div>
            <input type="file" accept={accept} multiple={multiple} onChange={handleChange} className="hidden" />
          </label>
          {/* Camera — rear camera on mobile */}
          <label className="cursor-pointer flex-1">
            <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-bold text-sm hover:from-emerald-600 hover:to-teal-700 transition-all text-center">
              <Camera size={14} />
              {t('common.takePhoto')}
            </div>
            <input type="file" accept={accept} capture="environment" onChange={handleChange} className="hidden" />
          </label>
        </div>
        {/* Thumbnail grid */}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {previews.map((p, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '1' }}>
                <img src={p.url} alt={`photo-${i}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        {previews.length === 0 && (
          <p className="text-xs text-center text-gray-400 mt-2">
            {multiple ? t('common.multiplePhotos') : t('common.singlePhoto')}
          </p>
        )}
      </div>
    </div>
  )
}

/* ================= MESSAGE TO ADMIN FORM ================= */

function MessageToAdminForm({ onClose, currentSummary }) {
  const { t } = useTranslation()
  const [messageText, setMessageText] = useState("")
  const [messageType, setMessageType] = useState("UPDATE")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!messageText.trim()) {
      alert(t('message.messageLabel').replace(' *','') + " required")
      return
    }

    const location = await getLocation()
    const distanceTravelled = currentSummary?.distanceTraveled || 0

    const messageData = {
      text: messageText,
      location,
      distanceTravelled,
      status: messageType,
      timestamp: new Date()
    }

    try {
      setIsLoading(true)
      const response = await fetch(`${API_URL}/admin/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(messageData)
      })

      if (!response.ok) throw new Error("Failed to send message")

      alert(t('field.messageSent'))
      setMessageText("")
      onClose()
    } catch (err) {
      console.error("Error sending message:", err)
      alert(t('field.messageFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-cyan-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">{t('message.title')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Message Type Selector */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-3">{t('message.messageType')}</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {["UPDATE", "ALERT", "LOCATION", "MEETING", "SALE"].map(type => (
              <button
                key={type}
                onClick={() => setMessageType(type)}
                className={`py-2 px-3 rounded-lg font-bold text-sm transition-all ${messageType === type
                  ? "bg-cyan-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Message Text */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">{t('message.messageLabel')}</label>
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            placeholder={t('message.placeholder')}
            rows={6}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all resize-none"
          />
          <p className="text-xs text-gray-500 mt-2">{messageText.length} / 500 characters</p>
        </div>

        {/* Info Display */}
        <div className="bg-cyan-50 border-2 border-cyan-200 p-4 rounded-xl">
          <p className="text-sm font-semibold text-gray-700 mb-2">{t('message.infoTitle')}</p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>{t('message.infoLocation')}</li>
            <li>{t('message.infoDistance')}{currentSummary?.distanceTraveled || 0} km</li>
            <li>{t('message.infoType')}{messageType}</li>
            <li>{t('message.infoTimestamp')}</li>
          </ul>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !messageText.trim()}
          className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50"
        >
          {isLoading ? t('message.sending') : t('message.send')}
        </button>
      </div>
    </div>
  )
}