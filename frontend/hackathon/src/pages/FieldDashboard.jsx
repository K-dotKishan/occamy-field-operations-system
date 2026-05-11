import { useState, useEffect } from "react"
import { api, syncPendingRequests, getOfflineQueueStatus } from "../api"
import LiveTracking from "../components/LiveTracking"
import { MapPin, Users, Package, TrendingUp, Calendar, Camera, X, Upload, Wifi, WifiOff, RefreshCw } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

export default function FieldDashboard() {
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
      alert("Cannot sync: No internet connection")
      return
    }

    setIsSyncing(true)
    try {
      const result = await syncPendingRequests()
      alert(`Sync Complete: ${result.count} items uploaded. ${result.failed > 0 ? result.failed + ' failed.' : ''}`)
      checkQueue()
      loadSummary() // Refresh data after sync
    } catch (err) {
      alert("Sync failed")
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

  const startDay = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported")
      return
    }

    const odometer = prompt("Enter starting odometer reading (km):")
    if (!odometer) return

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }
        setLocation(coords)

        try {
          await api("/field/attendance/start", "POST", {
            location: coords,
            odometer: parseFloat(odometer)
          })
          alert("Day started successfully!")
          setActiveDay(true)
          loadSummary()
        } catch (err) {
          alert("Failed to start day")
        }
      },
      () => alert("Location permission denied")
    )
  }

  const endDay = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported")
      return
    }

    const odometer = prompt("Enter ending odometer reading (km):")
    if (!odometer) return

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }

        try {
          await api("/field/attendance/end", "POST", {
            location: coords,
            odometer: parseFloat(odometer)
          })
          alert("Day ended successfully!")
          setActiveDay(false)
          loadSummary()
        } catch (err) {
          alert("Failed to end day")
        }
      },
      () => alert("Location permission denied")
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-gray-800 mb-2">Field Officer Dashboard</h2>
          <p className="text-gray-600">Track your daily activities and performance</p>
        </div>
        {activeDay !== null && (
          <div className={`px-6 py-3 rounded-2xl shadow-lg font-bold ${activeDay
            ? 'bg-green-100 text-green-800 border-2 border-green-300'
            : 'bg-gray-100 text-gray-600'
            }`}>
            {activeDay ? '🟢 Day Active' : '⚫ Day Ended'}
          </div>
        )}
      </div>

      {/* Today's Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard label="Meetings" value={summary?.meetings ?? 0} icon="Meetings" color="blue" />
          <SummaryCard label="Samples" value={summary?.samples ?? 0} icon="Samples" color="purple" />
          <SummaryCard label="Sales" value={summary?.sales ?? 0} icon="Sales" color="green" />
          <SummaryCard label="Revenue" value={`Rs.${(summary?.revenue ?? 0).toLocaleString()}`} icon="Revenue" color="emerald" />
          <SummaryCard label="Distance" value={`${summary?.distanceTraveled ?? 0} km`} icon="Distance" color="amber" />
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {!activeDay ? (
          <ActionButton
            icon={<MapPin size={24} />}
            label="Start Day"
            subtitle="Mark attendance & GPS"
            color="from-blue-500 to-blue-700"
            onClick={startDay}
          />
        ) : (
          <ActionButton
            icon={<MapPin size={24} />}
            label="End Day"
            subtitle="Complete attendance"
            color="from-red-500 to-red-700"
            onClick={endDay}
          />
        )}

        <ActionButton
          icon={<Users size={24} />}
          label="Log Meeting"
          subtitle="Record interactions"
          color="from-indigo-500 to-indigo-700"
          onClick={() => setShowForm('meeting')}
          disabled={!activeDay}
        />

        <ActionButton
          icon={<Package size={24} />}
          label="Distribute Sample"
          subtitle="Track sample distribution"
          color="from-purple-500 to-purple-700"
          onClick={() => setShowForm('sample')}
          disabled={!activeDay}
        />

        <ActionButton
          icon={<TrendingUp size={24} />}
          label="Record Sale"
          subtitle="Log new transaction"
          color="from-emerald-500 to-emerald-700"
          onClick={() => setShowForm('sale')}
          disabled={!activeDay}
        />

        <ActionButton
          icon={<span className="text-2xl">💬</span>}
          label="Send Message"
          subtitle="Send updates to admin"
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

function SummaryCard({ label, value, icon, color }) {
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

  const handleSubmit = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported")
      return
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const formDataToSend = new FormData()

        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }

        // Add location
        formDataToSend.append('location', JSON.stringify(location))

        // Add form fields based on meeting type
        Object.keys(formData).forEach(key => {
          if (meetingType === "ONE_TO_ONE" && key.startsWith('meeting')) return
          if (meetingType === "GROUP" && (key === 'personName' || key === 'contactNumber')) return
          formDataToSend.append(key, formData[key])
        })

        // Add business potential for one-to-one
        if (meetingType === "ONE_TO_ONE") {
          formDataToSend.append('businessPotential', JSON.stringify({
            estimatedVolume: formData.estimatedVolume,
            likelihood: formData.likelihood
          }))
        }

        // Add photos
        photos.forEach(photo => {
          formDataToSend.append('photos', photo)
        })

        try {
          const endpoint = meetingType === "ONE_TO_ONE"
            ? "/field/meeting/one-to-one"
            : "/field/meeting/group"

          await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formDataToSend
          })

          alert("Meeting logged successfully!")
          onClose()
        } catch (err) {
          console.error("Meeting log error:", err)
          alert("Failed to log meeting: " + (err.message || "Unknown error"))
        }
      },
      () => alert("Location permission denied")
    )
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-indigo-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">Log Meeting</h2>
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
          One-to-One
        </button>
        <button
          onClick={() => setMeetingType("GROUP")}
          className={`flex-1 py-2 rounded-lg font-bold transition-all ${meetingType === "GROUP"
            ? 'bg-purple-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          Group Meeting
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        {meetingType === "ONE_TO_ONE" ? (
          <>
            <Input label="Person Name" value={formData.personName} onChange={v => setFormData({ ...formData, personName: v })} required />
            <Input label="Contact Number" type="tel" value={formData.contactNumber} onChange={v => setFormData({ ...formData, contactNumber: v })} />
            <Select label="Category" value={formData.category} onChange={v => setFormData({ ...formData, category: v })} options={["FARMER", "SELLER", "INFLUENCER", "VETERINARIAN", "DISTRIBUTOR", "DEALER", "RETAIL_OUTLET", "KVK", "FPO", "DDB"]} />
            <Input label="Estimated Volume (kg)" type="number" value={formData.estimatedVolume} onChange={v => setFormData({ ...formData, estimatedVolume: v })} />
            <Select label="Business Likelihood" value={formData.likelihood} onChange={v => setFormData({ ...formData, likelihood: v })} options={["LOW", "MEDIUM", "HIGH"]} />
            <Input label="Date of Receipt" type="date" value={formData.dateOfReceipt} onChange={v => setFormData({ ...formData, dateOfReceipt: v })} />
            <Input label="Date of Sale" type="date" value={formData.dateOfSale} onChange={v => setFormData({ ...formData, dateOfSale: v })} />
            <Input label="Quantity Received" type="number" value={formData.quantityReceived} onChange={v => setFormData({ ...formData, quantityReceived: v })} />
            <Input label="Quantity Sold" type="number" value={formData.quantitySold} onChange={v => setFormData({ ...formData, quantitySold: v })} />
          </>
        ) : (
          <>
            <Input label="Village" value={formData.village} onChange={v => setFormData({ ...formData, village: v })} required />
            <Input label="Number of Attendees" type="number" value={formData.attendeesCount} onChange={v => setFormData({ ...formData, attendeesCount: v })} required />
            <Select label="Category" value={formData.category} onChange={v => setFormData({ ...formData, category: v })} options={["FARMER", "SELLER", "INFLUENCER", "VETERINARIAN", "DISTRIBUTOR", "DEALER", "RETAIL_OUTLET", "KVK", "FPO", "DDB"]} />
            <Select label="Meeting Type" value={formData.meetingType} onChange={v => setFormData({ ...formData, meetingType: v })} options={["DEMO", "TRAINING", "FEEDBACK", "AWARENESS"]} />
            <Input label="Date of Receipt" type="date" value={formData.dateOfReceipt} onChange={v => setFormData({ ...formData, dateOfReceipt: v })} />
            <Input label="Date of Sale" type="date" value={formData.dateOfSale} onChange={v => setFormData({ ...formData, dateOfSale: v })} />
            <Input label="Quantity Received" type="number" value={formData.quantityReceived} onChange={v => setFormData({ ...formData, quantityReceived: v })} />
            <Input label="Quantity Sold" type="number" value={formData.quantitySold} onChange={v => setFormData({ ...formData, quantitySold: v })} />
          </>
        )}

        <Input label="District" value={formData.district} onChange={v => setFormData({ ...formData, district: v })} />
        <Input label="State" value={formData.state} onChange={v => setFormData({ ...formData, state: v })} />
        <Textarea label="Notes" value={formData.notes} onChange={v => setFormData({ ...formData, notes: v })} rows={4} />

        <FileUpload label="Photos" onChange={setPhotos} accept="image/*" multiple />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.followUpRequired}
            onChange={e => setFormData({ ...formData, followUpRequired: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm font-semibold text-gray-700">Requires Follow-up</span>
        </label>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all">
          Cancel
        </button>
        <button onClick={handleSubmit} className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all shadow-lg">
          Save Meeting
        </button>
      </div>
    </div>
  )
}

/* ================= SAMPLE FORM ================= */

function SampleForm({ onClose }) {
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

  const handleSubmit = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported")
      return
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const formDataToSend = new FormData()

        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }

        formDataToSend.append('location', JSON.stringify(location))

        Object.keys(formData).forEach(key => {
          formDataToSend.append(key, formData[key])
        })

        photos.forEach(photo => {
          formDataToSend.append('photos', photo)
        })

        try {
          await fetch(`${API_URL}/field/sample`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formDataToSend
          })

          alert("Sample distribution logged!")
          onClose()
        } catch (err) {
          console.error("Sample log error:", err)
          alert("Failed to log sample: " + (err.message || "Unknown error"))
        }
      },
      () => alert("Location permission denied")
    )
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-purple-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">Distribute Sample</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        <Input label="Product Name" value={formData.productName} onChange={v => setFormData({ ...formData, productName: v })} required />
        <Input label="Product SKU" value={formData.productSKU} onChange={v => setFormData({ ...formData, productSKU: v })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Quantity" type="number" value={formData.quantity} onChange={v => setFormData({ ...formData, quantity: v })} required />
          <Select label="Unit" value={formData.unit} onChange={v => setFormData({ ...formData, unit: v })} options={["kg", "litre", "packet", "unit"]} />
        </div>

        <Input label="Recipient Name" value={formData.recipientName} onChange={v => setFormData({ ...formData, recipientName: v })} required />
        <Input label="Recipient Contact" type="tel" value={formData.recipientContact} onChange={v => setFormData({ ...formData, recipientContact: v })} />
        <Select label="Recipient Category" value={formData.recipientCategory} onChange={v => setFormData({ ...formData, recipientCategory: v })} options={["FARMER", "SELLER", "INFLUENCER", "VETERINARIAN"]} />
        <Select label="Purpose" value={formData.purpose} onChange={v => setFormData({ ...formData, purpose: v })} options={["TRIAL", "DEMO", "TRAINING", "FOLLOWUP"]} />

        <Input label="Village" value={formData.village} onChange={v => setFormData({ ...formData, village: v })} />
        <Input label="District" value={formData.district} onChange={v => setFormData({ ...formData, district: v })} />
        <Input label="State" value={formData.state} onChange={v => setFormData({ ...formData, state: v })} />

        <FileUpload label="Photos" onChange={setPhotos} accept="image/*" multiple />
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all">
          Cancel
        </button>
        <button onClick={handleSubmit} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold transition-all shadow-lg">
          Save Sample
        </button>
      </div>
    </div>
  )
}

/* ================= SALE FORM ================= */

function SaleForm({ onClose }) {
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

  const totalAmount = formData.quantity * formData.pricePerUnit

  const handleSubmit = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported")
      return
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const formDataToSend = new FormData()

        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }

        formDataToSend.append('location', JSON.stringify(location))
        formDataToSend.append('saleType', saleType)

        Object.keys(formData).forEach(key => {
          formDataToSend.append(key, formData[key])
        })

        photos.forEach(photo => {
          formDataToSend.append('photos', photo)
        })

        try {
          await fetch(`${API_URL}/field/sale`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formDataToSend
          })

          alert("Sale recorded successfully!")
          onClose()
        } catch (err) {
          console.error("Sale log error:", err)
          alert("Failed to record sale: " + (err.message || "Unknown error"))
        }
      },
      () => alert("Location permission denied")
    )
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-emerald-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">Record Sale</h2>
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
          B2C (Farmer)
        </button>
        <button
          onClick={() => setSaleType("B2B")}
          className={`flex-1 py-2 rounded-lg font-bold transition-all ${saleType === "B2B"
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          B2B (Distributor)
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        <Input label="Product Name" value={formData.productName} onChange={v => setFormData({ ...formData, productName: v })} required />
        <Input label="Product SKU" value={formData.productSKU} onChange={v => setFormData({ ...formData, productSKU: v })} />
        <Input label="Pack Size" value={formData.packSize} onChange={v => setFormData({ ...formData, packSize: v })} placeholder="e.g., 1kg, 5kg, 500ml" />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Quantity" type="number" value={formData.quantity} onChange={v => setFormData({ ...formData, quantity: v })} required />
          <Input label="Price per Unit (₹)" type="number" value={formData.pricePerUnit} onChange={v => setFormData({ ...formData, pricePerUnit: v })} required />
        </div>

        <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200">
          <p className="text-sm text-gray-600">Total Amount</p>
          <p className="text-3xl font-black text-emerald-700">₹{totalAmount.toLocaleString()}</p>
        </div>

        <Input label={saleType === "B2C" ? "Farmer Name" : "Distributor Name"} value={formData.customerName} onChange={v => setFormData({ ...formData, customerName: v })} required />
        <Input label="Contact Number" type="tel" value={formData.customerContact} onChange={v => setFormData({ ...formData, customerContact: v })} />

        {saleType === "B2B" && (
          <Select label="Distributor Type" value={formData.distributorType} onChange={v => setFormData({ ...formData, distributorType: v })} options={["RETAILER", "WHOLESALER", "AGENT", "OTHER"]} />
        )}

        <Select label="Payment Mode" value={formData.paymentMode} onChange={v => setFormData({ ...formData, paymentMode: v })} options={["CASH", "UPI", "CREDIT", "BANK_TRANSFER"]} />

        <Input label="Village" value={formData.village} onChange={v => setFormData({ ...formData, village: v })} />
        <Input label="District" value={formData.district} onChange={v => setFormData({ ...formData, district: v })} />
        <Input label="State" value={formData.state} onChange={v => setFormData({ ...formData, state: v })} />

        <Textarea label="Notes" value={formData.notes} onChange={v => setFormData({ ...formData, notes: v })} rows={3} />

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isRepeatOrder}
            onChange={e => setFormData({ ...formData, isRepeatOrder: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm font-semibold text-gray-700">Repeat Order</span>
        </label>

        <FileUpload label="Photos" onChange={setPhotos} accept="image/*" multiple />
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all">
          Cancel
        </button>
        <button onClick={handleSubmit} className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl font-bold transition-all shadow-lg">
          Save Sale
        </button>
      </div>
    </div>
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
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-500 cursor-pointer transition-all">
        <Upload size={20} className="text-gray-400" />
        <span className="text-sm text-gray-600">Click to upload {multiple ? 'photos' : 'photo'}</span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={e => onChange(Array.from(e.target.files))}
          className="hidden"
        />
      </label>
    </div>
  )
}

/* ================= MESSAGE TO ADMIN FORM ================= */

function MessageToAdminForm({ onClose, currentSummary }) {
  const [messageText, setMessageText] = useState("")
  const [messageType, setMessageType] = useState("UPDATE")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = () => {
    if (!messageText.trim()) {
      alert("Please enter a message")
      return
    }

    if (!navigator.geolocation) {
      alert("Geolocation not supported")
      return
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: "" // Can be enhanced with reverse geocoding
        }

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

          if (!response.ok) {
            throw new Error("Failed to send message")
          }

          alert("Message sent to admin successfully!")
          setMessageText("")
          onClose()
        } catch (err) {
          console.error("Error sending message:", err)
          alert("Failed to send message. Please try again.")
        } finally {
          setIsLoading(false)
        }
      },
      () => alert("Location permission denied")
    )
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-cyan-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black text-gray-800">Send Message to Admin</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Message Type Selector */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-3">Message Type</label>
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
          <label className="block text-sm font-bold text-gray-700 mb-2">Message *</label>
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            placeholder="Type your message here..."
            rows={6}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all resize-none"
          />
          <p className="text-xs text-gray-500 mt-2">{messageText.length} / 500 characters</p>
        </div>

        {/* Info Display */}
        <div className="bg-cyan-50 border-2 border-cyan-200 p-4 rounded-xl">
          <p className="text-sm font-semibold text-gray-700 mb-2">📊 Information to be sent:</p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>✓ Your current location (GPS)</li>
            <li>✓ Distance travelled today: {currentSummary?.distanceTraveled || 0} km</li>
            <li>✓ Message type: {messageType}</li>
            <li>✓ Timestamp</li>
          </ul>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !messageText.trim()}
          className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50"
        >
          {isLoading ? "Sending..." : "Send Message"}
        </button>
      </div>
    </div>
  )
}