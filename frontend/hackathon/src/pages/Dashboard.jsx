import { socket } from "../socket"
import occamyLogo from "../assets/occamylogo.jpg"
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

/* Fix leaflet marker */
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png"
})

import { useEffect, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import {
  MapPin, ShoppingCart, Package, Users, TrendingUp, Calendar, LogOut,
  X, Menu, ChevronDown, ChevronUp, Home, BarChart3, User, Settings,
  Bell, Search, Sparkles, Zap, Target, Award, CheckCircle, AlertCircle,
  Navigation, Satellite, Layers, Eye, EyeOff, RefreshCw, Globe,
  Phone, Mail, Clock, DollarSign, Truck, CreditCard, Shield, Star,
  Camera, Upload, FileImage, Activity, Map
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from "recharts"

export default function Dashboard() {
  const navigate = useNavigate()
  const role = localStorage.getItem("role")
  const userId = localStorage.getItem("userId")
  const userName = localStorage.getItem("name") || "User"

  const [adminData, setAdminData] = useState(null)
  const [location, setLocation] = useState(null)
  const [loadingAdmin, setLoadingAdmin] = useState(false)

  // Field officer states
  const [fieldStats, setFieldStats] = useState(null)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [meetingType, setMeetingType] = useState("")
  const [showSaleForm, setShowSaleForm] = useState(false)

  // User states
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showOrderModal, setShowOrderModal] = useState(false)

  // Mobile states
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [isScrolled, setIsScrolled] = useState(false)
  const [pulseAnimation, setPulseAnimation] = useState(false)

  // Live Tracking States
  const [watchId, setWatchId] = useState(null)
  const [liveUsers, setLiveUsers] = useState({})
  const [livePaths, setLivePaths] = useState({})
  const [localPath, setLocalPath] = useState([]) // Field officer's own path
  const [isTracking, setIsTracking] = useState(false)
  const [showMap, setShowMap] = useState(true)
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629])
  const [mapZoom, setMapZoom] = useState(5)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)

  // Photo state
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Field attendance states
  const [activeAttendance, setActiveAttendance] = useState(null)
  const [isEndingDay, setIsEndingDay] = useState(false)
  const [canEndDay, setCanEndDay] = useState(false)          // time-gate flag
  const [endDayCountdown, setEndDayCountdown] = useState("") // human-readable remaining time
  const menuRef = useRef(null) // Ref for mobile menu click outside detection

  /* ================= AUTH + DATA LOAD ================= */
  useEffect(() => {
    if (!role) {
      navigate("/login")
      return
    }

    if (role === "ADMIN") {
      loadAdminData()
      // Load initial field officers data
      loadFieldOfficers()
    } else if (role === "USER") {
      loadProducts()
      loadOrders()
    } else if (role === "FIELD") {
      // Immediately restore from localStorage to avoid flash of "no session"
      const cached = localStorage.getItem("activeAttendance")
      if (cached) {
        try { setActiveAttendance(JSON.parse(cached)) } catch (_) {}
      }
      loadFieldData()
    }

    // Welcome animation
    setPulseAnimation(true)
    const timer = setTimeout(() => setPulseAnimation(false), 2000)
    return () => clearTimeout(timer)
  }, [role, navigate])

  /* ================= AUTO SCROLL LOGIC ================= */
  useEffect(() => {
    if (showMeetingForm) {
      setTimeout(() => {
        const id = meetingType === "ONE_TO_ONE" ? "meeting-form-one" : "meeting-form-group"
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [showMeetingForm, meetingType])

  useEffect(() => {
    if (showSaleForm) {
      setTimeout(() => {
        const el = document.getElementById("sale-form")
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
    }
  }, [showSaleForm])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  /* ================= CLICK OUTSIDE DETECTION (MOBILE MENU) ================= */
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        // If click is outside the menu container, close it
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isMenuOpen])

  /* ================= GPS AUTO SEND FOR FIELD OFFICER ================= */
  useEffect(() => {
    if (role !== "FIELD") return
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(async (pos) => {
      try {
        await api("/field/location", "POST", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        })
      } catch (err) {
        console.log("GPS send failed")
      }
    })

    return () => navigator.geolocation.clearWatch(watchId)
  }, [role])

  /* ================= TIME-GATE: ENABLE END DAY AFTER 7 HOURS ================= */
  useEffect(() => {
    if (!activeAttendance?.startTime) {
      setCanEndDay(false)
      setEndDayCountdown("")
      return
    }

    const MIN_MS = 7 * 60 * 60 * 1000 // 7 hours in ms

    const tick = () => {
      const elapsed = Date.now() - new Date(activeAttendance.startTime).getTime()
      const remaining = MIN_MS - elapsed

      if (remaining <= 0) {
        setCanEndDay(true)
        setEndDayCountdown("")
      } else {
        setCanEndDay(false)
        const h = Math.floor(remaining / (1000 * 60 * 60))
        const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
        const s = Math.floor((remaining % (1000 * 60)) / 1000)
        setEndDayCountdown(`${h}h ${m}m ${s}s`)
      }
    }

    tick() // run immediately
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeAttendance?.startTime])

  /* ================= SOCKET CONNECTIONS ================= */
  useEffect(() => {
    if (role !== "ADMIN") return

    socket.on("admin-location-update", (data) => {
      setLiveUsers(prev => ({
        ...prev,
        [data.userId]: {
          ...data,
          name: data.name || `Field Officer ${data.userId?.slice(-4) || 'Unknown'}`,
          lastUpdate: new Date(),
          status: 'active',
          battery: data.battery || Math.floor(Math.random() * 100) // Mock battery
        }
      }))

      setLivePaths(prev => {
        const existingPath = prev[data.userId] || []
        const newPath = [...existingPath, [data.lat, data.lng]]

        // Keep only last 100 points for performance
        if (newPath.length > 100) {
          newPath.shift()
        }

        return {
          ...prev,
          [data.userId]: newPath
        }
      })
    })

    socket.on("field-status-change", (data) => {
      setLiveUsers(prev => ({
        ...prev,
        [data.userId]: {
          ...prev[data.userId],
          status: data.status,
          lastUpdate: new Date()
        }
      }))
    })

    return () => {
      socket.off("admin-location-update")
      socket.off("field-status-change")
    }
  }, [role])

  /* ================= LOAD FUNCTIONS ================= */
  const loadAdminData = async () => {
    setLoadingAdmin(true)
    try {
      // Pass wide date range to get ALL historical data (not just last 30 days)
      const today = new Date().toISOString().split('T')[0]
      const data = await api(`/admin/dashboard?startDate=2000-01-01&endDate=${today}`)
      setAdminData(data || {})
    } catch (error) {
      console.error("Failed to load admin data:", error)
      setAdminData({})
    } finally {
      setLoadingAdmin(false)
    }
  }

  const loadFieldOfficers = async () => {
    try {
      const data = await api("/admin/field-officers")
      // Initialize live users with offline status
      const initialUsers = {}
      data.forEach(officer => {
        initialUsers[officer._id] = {
          ...officer,
          status: 'offline',
          lastUpdate: new Date(),
          lat: officer.lastLocation?.lat || 20.5937,
          lng: officer.lastLocation?.lng || 78.9629
        }
      })
      setLiveUsers(initialUsers)
    } catch (error) {
      console.error("Failed to load field officers:", error)
    }
  }

  const loadFieldData = async () => {
    try {
      const data = await api("/field/dashboard")
      // Set field officer's last known location
      if (data.lastLocation) {
        setLocation(data.lastLocation)
      }
      // Check if there's an active attendance session
      if (data.activeAttendance) {
        setActiveAttendance(data.activeAttendance)
        // Persist to localStorage so a hard reload doesn't flash "no session"
        localStorage.setItem("activeAttendance", JSON.stringify(data.activeAttendance))

        // Auto-resume tracking if attendance is active (no endTime)
        if (!data.activeAttendance.endTime) {
          console.log("Resuming active tracking session...")
          // Using setTimeout to ensure startLiveTracking is available and state updates have processed
          setTimeout(() => startLiveTracking(false), 500)
        }
      } else {
        // No active session on server — clear any stale localStorage entry
        localStorage.removeItem("activeAttendance")
        setActiveAttendance(null)
      }

      // Fetch Stats Summary
      const summary = await api("/field/summary")
      setFieldStats(summary.today)
    } catch (error) {
      console.error("Failed to load field data:", error)
      // On network error, restore from localStorage so the UI doesn't reset
      const cached = localStorage.getItem("activeAttendance")
      if (cached) {
        try { setActiveAttendance(JSON.parse(cached)) } catch (_) {}
      }
    }
  }

  const loadProducts = async () => {
    try {
      const data = await api("/inventory")
      setProducts(data || [])
    } catch (error) {
      console.error("Failed to load products:", error)
      setProducts([])
    }
  }

  const loadOrders = async () => {
    try {
      const data = await api("/inventory/orders")
      setOrders(data || [])
    } catch (error) {
      console.error("Failed to load orders:", error)
      setOrders([])
    }
  }

  /* ================= PHOTO UPLOAD FUNCTIONS ================= */
  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadPhoto = async () => {
    if (!photo) return ""

    try {
      const formData = new FormData()
      formData.append("photo", photo)

      const res = await fetch(`${API_URL}/field/upload-photo`, {
        method: "POST",
        body: formData
      })

      const data = await res.json()
      return data.photoUrl || ""
    } catch (error) {
      console.error("Photo upload failed:", error)
      return ""
    }
  }

  /* ================= LIVE TRACKING FUNCTIONS ================= */
  const startLiveTracking = (notify = true) => {
    if (!navigator.geolocation) {
      if (notify) showNotification("error", "Geolocation not supported by your browser")
      return
    }

    if (isTracking) {
      showNotification("info", "Tracking already active")
      return
    }

    setIsTracking(true)

    // Notify admin that tracking started
    socket.emit("field-status-change", {
      userId: userId,
      status: 'active',
      name: userName
    })

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        let currentDist = 0

        // Call API to track distance and persist
        try {
          const res = await api("/field/location/track", "POST", {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            activity: "TRAVEL"
          })

          if (res.success && res.totalDistance !== undefined) {
            currentDist = res.totalDistance
            setFieldStats(prev => ({
              ...prev,
              distanceTraveled: res.totalDistance
            }))
          }
        } catch (e) {
          console.error("Tracking API error:", e)
        }

        const payload = {
          userId: userId,
          name: userName,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          battery: Math.floor(Math.random() * 100), // Mock battery level
          time: new Date().toISOString(),
          distanceTravelled: currentDist,
          totalDistance: currentDist
        }

        setLocation(payload)
        socket.emit("field-location-update", payload)

        // Update map center for field officer's own view
        if (role === "FIELD") {
          setMapCenter([payload.lat, payload.lng])
          setMapZoom(18)

          setLocalPath(prev => {
            const newPath = [...prev, [payload.lat, payload.lng]]
            if (newPath.length > 500) newPath.shift()
            return newPath
          })
        }
      },
      (error) => {
        console.error("Geolocation error:", error)
        if (notify) showNotification("error", "Unable to get location: " + error.message)
        stopLiveTracking()
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    )

    setWatchId(id)
    if (notify) showNotification("success", "Live tracking started. Distance is being recorded.")
  }

  const stopLiveTracking = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
    setIsTracking(false)

    // Notify admin that tracking stopped
    socket.emit("field-status-change", {
      userId: userId,
      status: 'offline',
      name: userName
    })

    showNotification("info", "Live tracking stopped")
  }

  /* ================= FIELD: START DAY ================= */
  const startDay = async () => {
    if (!navigator.geolocation) {
      showNotification("error", "Geolocation not supported")
      return
    }

    // setPulseAnimation(true) - Removed to prevent notification obscuring

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        })
      })

      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      }

      setLocation(coords)

      // Start attendance
      const attendanceRecord = await api("/field/attendance/start", "POST", {
        location: coords,
        timestamp: new Date().toISOString()
      })

      // Start live tracking automatically
      startLiveTracking(false)

      // Show success message
      showNotification("success", "Attendance started successfully! Live tracking active.")
      const newAttendance = { ...attendanceRecord, startTime: attendanceRecord.startTime || new Date().toISOString() }
      setActiveAttendance(newAttendance)
      // Persist so page reload doesn't lose the session
      localStorage.setItem("activeAttendance", JSON.stringify(newAttendance))

    } catch (error) {
      console.error("Error starting day:", error)
      const errorMsg = error?.error || error?.message || "Unknown error"
      showNotification("error", "Failed to start attendance: " + errorMsg)
      // setPulseAnimation(false)
    }
  }

  /* ================= FIELD: END DAY ================= */
  const endDay = async () => {
    if (!navigator.geolocation) {
      showNotification("error", "Geolocation not supported")
      return
    }

    // Client-side time-gate guard (mirrors backend)
    if (!canEndDay) {
      showNotification("warning", `Day End locked. ${endDayCountdown} remaining before you can end the day.`)
      return
    }

    // Distance verification: warn if no distance was recorded
    const currentDistance = fieldStats?.distanceTraveled || 0
    if (currentDistance === 0 && isTracking) {
      showNotification("warning", "No distance recorded yet. GPS tracking is active — please wait a moment and try again.")
      return
    }

    setIsEndingDay(true)

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000
        })
      })

      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }

      // End attendance — backend will validate time-gate and capture final distance
      const result = await api("/field/attendance/end", "POST", {
        location: coords,
        timestamp: new Date().toISOString()
      })

      // Stop live tracking
      stopLiveTracking()

      // Clear active attendance state and localStorage
      setActiveAttendance(null)
      localStorage.removeItem("activeAttendance")

      const dist = result?.summary?.totalDistance ?? currentDistance
      const hrs = result?.summary?.durationHours ?? ""
      showNotification("success", `Day ended! Distance: ${parseFloat(dist).toFixed(2)} km${hrs ? ` | Duration: ${hrs}h` : ""}. See you tomorrow.`)
      setIsEndingDay(false)

    } catch (error) {
      console.error("Error ending day:", error)
      const errorMsg = error?.error || error?.message || "Unknown error"
      // Surface time-gate errors clearly
      if (error?.code === "TIME_GATE" || errorMsg.includes("locked") || errorMsg.includes("hours")) {
        showNotification("warning", errorMsg)
      } else {
        showNotification("error", "Failed to end day: " + errorMsg)
      }
      setIsEndingDay(false)
    }
  }

  /* ================= UI FUNCTIONS ================= */
  const openMeetingForm = (type) => {
    setMeetingType(type)
    setShowMeetingForm(true)
  }

  const openOrderModal = (product) => {
    setSelectedProduct(product)
    setShowOrderModal(true)
  }

  const logout = () => {
    if (role === "FIELD" && isTracking) {
      stopLiveTracking()
    }
    localStorage.clear()
    socket.disconnect()
    navigate("/login")
  }

  const showNotification = (type, message) => {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.custom-notification')
    existingNotifications.forEach(n => n.remove())

    const notification = document.createElement('div')
    notification.className = `custom-notification fixed top-20 right-4 z-[3000] animate-slideInRight ${type === 'success'
      ? 'bg-gradient-to-r from-emerald-500 to-green-600'
      : type === 'error'
        ? 'bg-gradient-to-r from-red-500 to-rose-600'
        : type === 'warning'
          ? 'bg-gradient-to-r from-amber-500 to-orange-600'
          : 'bg-gradient-to-r from-blue-500 to-cyan-600'
      } text-white px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 transform hover:scale-105 transition-transform duration-300`

    notification.innerHTML = `
      ${type === 'success' ? '<div class="animate-bounce">🎉</div>' :
        type === 'error' ? '<div class="animate-pulse">⚠️</div>' :
          type === 'warning' ? '<div class="animate-pulse">🔔</div>' :
            '<div class="animate-pulse">ℹ️</div>'}
      <div>
        <p class="font-bold text-sm">${type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : type === 'warning' ? 'Warning!' : 'Info!'}</p>
        <p class="text-xs opacity-90">${message}</p>
      </div>
    `

    document.body.appendChild(notification)

    setTimeout(() => {
      notification.classList.add('animate-fadeOut')
      setTimeout(() => notification.remove(), 300)
    }, 3000)
  }

  /* ================= MAP FUNCTIONS ================= */
  const refreshLiveData = () => {
    if (role === "ADMIN") {
      loadFieldOfficers()
      showNotification("info", "Field officers data refreshed")
    }
  }

  const focusOnUser = (userId) => {
    const user = liveUsers[userId]
    if (user) {
      setMapCenter([user.lat, user.lng])
      setMapZoom(15)
      showNotification("info", `Focused on ${user.name}`)
    }
  }

  const clearPaths = () => {
    setLivePaths({})
    showNotification("info", "All travel paths cleared")
  }

  const toggleMapFullscreen = () => {
    setIsMapFullscreen(!isMapFullscreen)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'idle': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-500'
      case 'meeting': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Active'
      case 'idle': return 'Idle'
      case 'offline': return 'Offline'
      case 'meeting': return 'In Meeting'
      default: return 'Unknown'
    }
  }

  /* ================= STATS CALCULATION ================= */
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371 // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const calculateMapStats = () => {
    const activeOfficers = Object.values(liveUsers).filter(u => u.status === 'active').length
    const totalOfficers = Object.keys(liveUsers).length

    const totalDistance = Object.values(livePaths).reduce((sum, path) => {
      if (path.length < 2) return sum

      let pathDistance = 0
      for (let i = 1; i < path.length; i++) {
        pathDistance += calculateDistance(
          path[i - 1][0], path[i - 1][1],
          path[i][0], path[i][1]
        )
      }
      return sum + pathDistance
    }, 0)

    return { activeOfficers, totalOfficers, totalDistance: totalDistance.toFixed(2) }
  }

  const mapStats = calculateMapStats()

  return (
    <div className={`min-h-screen bg-[#FDF8E1] overflow-x-hidden ${isMapFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Click Outside Handler for Mobile Menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}

      {/* Animated Background Elements */}
      {!isMapFullscreen && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none hidden sm:block">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-100 rounded-full mix-blend-multiply opacity-20"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-100 rounded-full mix-blend-multiply opacity-20"></div>
        </div>
      )}

      {/* ================= ENHANCED NAVBAR ================= */}
      {!isMapFullscreen && (
        <nav className={`bg-gradient-to-r from-[#3E3E5C] via-[#4A6D7C] to-[#3E3E5C] text-white transition-all duration-300 fixed top-0 left-0 right-0 z-[2000] ${isScrolled ? 'shadow-lg py-3' : 'py-4'
          }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 rounded-xl bg-white bg-opacity-10 hover:bg-opacity-20 transition-all duration-300 hover:rotate-90 active:scale-95"
              >
                <Menu size={24} />
              </button>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-md overflow-hidden border border-white/20">
                  <img
                    src={occamyLogo}
                    alt="Occamy Bioscience"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-sm sm:text-2xl font-black tracking-tight leading-none text-white">OCCAMY BIOSCIENCE</h1>
                  <p className="text-[10px] sm:text-xs text-[#D8D5C5] font-medium tracking-wide opacity-90">Sustainable Agriculture</p>
                </div>
              </div>

              {/* Live Tracking Status */}
              {(role === "FIELD" || role === "ADMIN") && (
                <div className="hidden lg:flex items-center gap-4 animate-fadeIn">
                  {role === "FIELD" && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${isTracking
                      ? 'bg-gradient-to-r from-[#7FB069] to-[#4A6D7C] animate-pulse'
                      : 'bg-gradient-to-r from-gray-500 to-gray-600'
                      }`}>
                      <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-white animate-ping' : 'bg-gray-300'}`}></div>
                      <span>{isTracking ? 'LIVE TRACKING' : 'OFFLINE'}</span>
                    </div>
                  )}

                  {role === "ADMIN" && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-blue-500 to-cyan-600">
                      <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
                      <span>LIVE MAP</span>
                      <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs">
                        {mapStats.activeOfficers}/{mapStats.totalOfficers} active
                      </span>
                    </div>
                  )}

                  <button
                    onClick={logout}
                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 px-4 py-2 rounded-full font-bold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2 group text-sm"
                  >
                    <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              )}

              {role === "USER" && (
                <div className="hidden lg:flex items-center gap-4">
                  <button
                    onClick={logout}
                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 px-4 py-2 rounded-full font-bold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl active:scale-95 flex items-center gap-2 group text-sm"
                  >
                    <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
                    <span>Logout</span>
                  </button>
                </div>
              )}

              <button
                onClick={logout}
                className="lg:hidden bg-gradient-to-r from-red-500 to-rose-600 p-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div ref={menuRef} className="lg:hidden bg-gradient-to-b from-[#3E3E5C] to-[#4A6D7C] mt-2 mx-4 px-4 py-4 rounded-2xl shadow-xl animate-slideInDown z-50 fixed left-0 right-0 top-16">
              <div className="flex flex-col gap-2">
                {/* Dynamic Menu Items based on Role */}
                {role === "ADMIN" && (
                  <>
                    {/* Removed redundant Dashboard link */}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false)
                        refreshLiveData()
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-white transition-all"
                    >
                      <RefreshCw size={20} />
                      <span className="font-medium">Refresh Data</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false)
                        toggleMapFullscreen()
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-white transition-all"
                    >
                      <Globe size={20} />
                      <span className="font-medium">{isMapFullscreen ? 'Exit Fullscreen' : 'Map Fullscreen'}</span>
                    </button>
                  </>
                )}

                {role === "FIELD" && (
                  <>
                    {/* Removed redundant Dashboard link */}
                    {!activeAttendance ? (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false)
                          startDay()
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-white transition-all"
                      >
                        <MapPin size={20} />
                        <span className="font-medium">Start Day</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false)
                          endDay()
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-red-300 transition-all bg-red-500/10"
                      >
                        <LogOut size={20} />
                        <span className="font-medium">End Day</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setIsMenuOpen(false)
                        openMeetingForm("ONE_TO_ONE")
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-white transition-all"
                    >
                      <Users size={20} />
                      <span className="font-medium">Log 1:1 Meeting</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false)
                        openMeetingForm("GROUP")
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-white transition-all"
                    >
                      <Users size={20} className="rotate-12" />
                      <span className="font-medium">Log Group Meeting</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false)
                        setShowSaleForm(true)
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-white transition-all"
                    >
                      <TrendingUp size={20} />
                      <span className="font-medium">Record Sale</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false)
                        isTracking ? stopLiveTracking() : startLiveTracking()
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-white transition-all"
                    >
                      <Navigation size={20} />
                      <span className="font-medium">{isTracking ? 'Stop Tracking' : 'Start Tracking'}</span>
                    </button>
                  </>
                )}

                {role === "USER" && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab('dashboard')
                        setIsMenuOpen(false)
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-white bg-opacity-20 shadow-lg' : 'hover:bg-white hover:bg-opacity-10'} text-white`}
                    >
                      <Home size={20} />
                      <span className="font-medium">Marketplace</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('orders')
                        setIsMenuOpen(false)
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-white bg-opacity-20 shadow-lg' : 'hover:bg-white hover:bg-opacity-10'} text-white`}
                    >
                      <Package size={20} />
                      <span className="font-medium">My Orders</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('profile')
                        setIsMenuOpen(false)
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-white bg-opacity-20 shadow-lg' : 'hover:bg-white hover:bg-opacity-10'} text-white`}
                    >
                      <User size={20} />
                      <span className="font-medium">My Profile</span>
                    </button>
                  </>
                )}

                {/* Divider */}
                <div className="h-px bg-white/20 my-2"></div>

                <button
                  onClick={logout}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:bg-opacity-10 text-red-200 hover:text-red-100 transition-all"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </nav>
      )
      }

      {/* Bottom Navigation for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[2000] px-6 py-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center max-w-md mx-auto">

          {/* Admin Bottom Nav */}
          {role === "ADMIN" && (
            <>
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  if (isMapFullscreen) toggleMapFullscreen()
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${!isMapFullscreen ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-500'}`}
              >
                <Home size={24} strokeWidth={!isMapFullscreen ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Home</span>
              </button>

              <button
                onClick={toggleMapFullscreen}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isMapFullscreen ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-500'}`}
              >
                <Map size={24} strokeWidth={isMapFullscreen ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Live Map</span>
              </button>

              <button
                onClick={refreshLiveData}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-gray-400 hover:text-emerald-600 transition-all active:scale-95"
              >
                <RefreshCw size={24} />
                <span className="text-[10px] font-bold">Refresh</span>
              </button>
            </>
          )}

          {/* Field Officer Bottom Nav */}
          {role === "FIELD" && (
            <>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-emerald-600"
              >
                <Home size={24} strokeWidth={2.5} />
                <span className="text-[10px] font-bold">Home</span>
              </button>

              <button
                onClick={() => openMeetingForm("ONE_TO_ONE")}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-gray-500 hover:text-indigo-600 transition-all"
              >
                <Users size={24} />
                <span className="text-[10px] font-bold">Meeting</span>
              </button>

              {/* Removed Dollar Icon Button */}

              <button
                onClick={() => {
                  const locationSection = document.getElementById('field-location-section');
                  if (locationSection) {
                    locationSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else {
                    // Fallback if not rendered yet
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                  }
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-gray-500 hover:text-emerald-600 transition-all"
              >
                <MapPin size={24} />
                <span className="text-[10px] font-bold">Path</span>
              </button>

              <button
                onClick={() => setIsMenuOpen(true)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl text-gray-500 hover:text-gray-800 transition-all"
              >
                <Menu size={24} />
                <span className="text-[10px] font-bold">Menu</span>
              </button>
            </>
          )}

        </div>
      </div>

      <main className={`p-4 sm:p-6 max-w-7xl mx-auto pt-24 lg:pt-24 ${!isMapFullscreen ? 'pb-24 lg:pb-6' : 'p-0 h-screen'}`}>
        {/* ================= ADMIN DASHBOARD WITH MAP ================= */}
        {role === "ADMIN" && (
          <>
            {!isMapFullscreen && (
              <div className="hidden sm:block mb-6 mt-2">
                <p className="text-base sm:text-lg text-gray-600 font-medium animate-slideInLeft flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Monitor field operations in real-time
                </p>
              </div>
            )}

            {loadingAdmin ? (
              <div className="text-center py-20 animate-pulse">
                <div className="relative inline-block">
                  <div className="w-16 h-16 border-4 border-emerald-200 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-500 mt-4">Loading dashboard data...</p>
              </div>
            ) : (
              <>
                {/* Stats Cards - Only show when not in fullscreen */}
                {!isMapFullscreen && (
                  <>
                    {/* Main Stats Grid - All with same blue color */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 mb-6">
                      <StatCard
                        label="USERS"
                        value={adminData?.stats?.totalUsers || 6}
                        icon={<Users size={20} />}
                        color="from-blue-500 to-cyan-600"
                      />
                      {/* FIELD TRACKING - Replaced Active Field */}
                      <div
                        onClick={() => navigate('/admin/field-officers')}
                        className="cursor-pointer transition-transform hover:scale-105"
                      >
                        <StatCard
                          label="FIELD TRACKING"
                          value={adminData?.users?.filter(u => u.role === 'FIELD').length || 0}
                          icon={<Map size={20} />}
                          color="from-blue-500 to-cyan-600"
                          delay={100}
                          live={true}
                        />
                      </div>

                      {/* SALES */}
                      <div
                        onClick={() => navigate('/admin-dashboard')}
                        className="cursor-pointer transition-transform hover:scale-105"
                      >
                        <StatCard
                          label="SALES"
                          value={adminData?.stats?.totalSales || 0}
                          icon={<TrendingUp size={20} />}
                          color="from-blue-500 to-indigo-600"
                          delay={300}
                        />
                      </div>

                      {/* REVENUE */}
                      <div
                        onClick={() => navigate('/admin-dashboard')}
                        className="cursor-pointer transition-transform hover:scale-105"
                      >
                        <StatCard
                          label="REVENUE"
                          value={`₹${(adminData?.stats?.totalRevenue || 0).toLocaleString()}`}
                          icon={<DollarSign size={20} />}
                          color="from-blue-600 to-blue-800"
                          delay={400}
                        />
                      </div>
                    </div>

                    {/* Quick Actions Grid - MOVED UP since metrics removed */}

                  </>
                )}

                {/* Live Map Section */}
                <div className={`bg-gradient-to-br from-white to-gray-50 rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 mb-6 sm:mb-8 animate-fadeIn ${isMapFullscreen ? 'h-screen rounded-none' : 'p-4 sm:p-6'
                  }`}>
                  {!isMapFullscreen && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                      <div>
                        <h3 className="text-lg sm:text-xl font-black text-gray-800 flex items-center gap-2">
                          <Satellite className="text-blue-500 animate-pulse" size={20} />
                          Live Field Tracking Map
                        </h3>
                        <p className="text-xs text-gray-600">
                          Real-time location tracking of field officers
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-gray-600">Active ({Object.keys(liveUsers).length})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                          <span className="text-gray-600">Path</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                          <span className="text-gray-600">Offline</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Map Controls */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={refreshLiveData}
                      className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 px-4 py-2 rounded-xl text-white font-bold text-sm flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg"
                    >
                      <RefreshCw size={16} />
                      Refresh
                    </button>
                    <button
                      onClick={() => setShowMap(!showMap)}
                      className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 px-4 py-2 rounded-xl text-white font-bold text-sm flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg"
                    >
                      {showMap ? <EyeOff size={16} /> : <Eye size={16} />}
                      {showMap ? 'Hide Map' : 'Show Map'}
                    </button>
                    <button
                      onClick={toggleMapFullscreen}
                      className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 px-4 py-2 rounded-xl text-white font-bold text-sm flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg"
                    >
                      <Globe size={16} />
                      {isMapFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </button>
                  </div>

                  {showMap && (
                    <div id="map-section" className={`relative rounded-xl overflow-hidden border-2 border-gray-200 ${isMapFullscreen ? 'h-full' : 'h-[500px]'
                      }`}>
                      <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: "100%", width: "100%" }}
                        scrollWheelZoom={true}
                        zoomControl={!isMapFullscreen}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />

                        {/* Field Officer Self-Tracking View */}
                        {(role === "FIELD" && location) && (
                          <>
                            <Marker
                              position={[location.lat, location.lng]}
                              icon={L.divIcon({
                                className: 'custom-marker',
                                html: `
                                  <div class="relative">
                                    <div class="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 animate-pulse rounded-full flex items-center justify-center text-white font-bold shadow-xl border-2 border-white">
                                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                                      </svg>
                                    </div>
                                    <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                                  </div>
                                `,
                                iconSize: [40, 40],
                                iconAnchor: [20, 40]
                              })}
                            >
                              <Popup>
                                <div className="p-2">
                                  <p className="font-bold">You are here</p>
                                  <p className="text-xs text-gray-500">Live Location</p>
                                </div>
                              </Popup>
                            </Marker>

                            {localPath.length > 1 && (
                              <Polyline
                                positions={localPath}
                                pathOptions={{ color: '#10b981', weight: 4, opacity: 0.8 }}
                              />
                            )}
                          </>
                        )}

                        {/* Active Field Officers from Socket (Admin View) */}
                        {Object.values(liveUsers).map((user) => (
                          <Marker
                            key={user.userId}
                            position={[user.lat, user.lng]}
                            icon={L.divIcon({
                              className: 'custom-marker',
                              html: `
                                <div class="relative">
                                  <div class="w-10 h-10 bg-gradient-to-r ${user.status === 'active' ? 'from-green-500 to-emerald-600 animate-pulse' :
                                  user.status === 'meeting' ? 'from-blue-500 to-cyan-600' :
                                    'from-gray-500 to-gray-700'
                                } rounded-full flex items-center justify-center text-white font-bold shadow-xl border-2 border-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                                    </svg>
                                  </div>
                                  <div class="absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(user.status)
                                } rounded-full border-2 border-white"></div>
                                </div>
                              `,
                              iconSize: [40, 40],
                              iconAnchor: [20, 40]
                            })}
                          >
                            <Popup>
                              <div className="p-3 min-w-[200px]">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="font-bold text-gray-800">{user.name}</p>
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.status === 'active' ? 'bg-green-100 text-green-800' :
                                    user.status === 'meeting' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                    {getStatusText(user.status)}
                                  </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <MapPin size={12} className="text-gray-500" />
                                    <span>📍 {user.lat.toFixed(4)}, {user.lng.toFixed(4)}</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <TrendingUp size={12} className="text-gray-500" />
                                    <span>📏 {(user.distanceTravelled || user.totalDistance || 0).toFixed(2)} km</span>
                                  </div>

                                  {user.speed && (
                                    <div className="flex items-center gap-2">
                                      <Navigation size={12} className="text-gray-500" />
                                      <span>🚀 Speed: {(user.speed * 3.6).toFixed(1)} km/h</span>
                                    </div>
                                  )}

                                  {user.battery && (
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${user.battery > 50 ? 'bg-green-500' :
                                        user.battery > 20 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}></div>
                                      <span>🔋 Battery: {user.battery}%</span>
                                    </div>
                                  )}

                                  <div className="pt-2 border-t">
                                    <p className="text-xs text-gray-500">
                                      Last update: {new Date(user.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => focusOnUser(user.userId)}
                                  className="mt-3 w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                                >
                                  Focus on Map
                                </button>
                              </div>
                            </Popup>
                          </Marker>
                        ))}

                        {/* Travel Paths */}
                        {Object.entries(livePaths).map(([id, path]) => (
                          path.length > 1 && (
                            <Polyline
                              key={id}
                              positions={path}
                              pathOptions={{
                                color: '#10b981',
                                weight: 3,
                                opacity: 0.7,
                                dashArray: '5, 10'
                              }}
                            />
                          )
                        ))}
                      </MapContainer>

                      {/* Map Controls */}
                      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
                        <button
                          onClick={() => setMapCenter([20.5937, 78.9629])}
                          className="bg-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-110"
                          title="Reset View"
                        >
                          <Navigation size={20} />
                        </button>
                        <button
                          onClick={refreshLiveData}
                          className="bg-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-110"
                          title="Refresh Data"
                        >
                          <RefreshCw size={20} />
                        </button>
                        <button
                          onClick={clearPaths}
                          className="bg-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-110"
                          title="Clear Paths"
                        >
                          <Layers size={20} />
                        </button>
                        {!isMapFullscreen && (
                          <button
                            onClick={toggleMapFullscreen}
                            className="bg-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-all hover:scale-110"
                            title="Fullscreen"
                          >
                            <Globe size={20} />
                          </button>
                        )}
                      </div>

                      {/* Live Status Panel */}
                      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg max-w-xs">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                            <div className="absolute top-0 left-0 w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>
                          <div>
                            <p className="font-bold text-sm">Live Tracking Active</p>
                            <p className="text-xs text-gray-600">
                              {mapStats.activeOfficers} field officers online
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Total Distance:</span>
                            <span className="text-sm font-bold text-blue-700">{mapStats.totalDistance} km</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Active Officers:</span>
                            <span className="text-sm font-bold text-green-700">{mapStats.activeOfficers}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Offline Officers:</span>
                            <span className="text-sm font-bold text-gray-700">{mapStats.totalOfficers - mapStats.activeOfficers}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Field Officers List - Only show when not in fullscreen */}
                  {!isMapFullscreen && Object.keys(liveUsers).length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Users size={16} />
                        Field Officers ({Object.keys(liveUsers).length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.values(liveUsers).map((user) => (
                          <div
                            key={user.userId}
                            className="bg-gradient-to-r from-white to-gray-50 p-3 rounded-lg border border-gray-200 hover:shadow-md transition-all cursor-pointer hover:border-blue-300 group"
                            onClick={() => focusOnUser(user.userId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${user.status === 'active' ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                                    user.status === 'meeting' ? 'bg-gradient-to-r from-blue-500 to-cyan-600' :
                                      'bg-gradient-to-r from-gray-500 to-gray-700'
                                    }`}>
                                    {user.name?.charAt(0) || 'F'}
                                  </div>
                                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(user.status)} rounded-full border-2 border-white`}></div>
                                </div>
                                <div>
                                  <p className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{user.name}</p>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' :
                                      user.status === 'meeting' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                      {getStatusText(user.status)}
                                    </span>
                                    {user.battery && (
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        🔋 {user.battery}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="text-gray-400 group-hover:text-blue-500 transition-colors" size={16} />
                            </div>

                            <div className="mt-2 text-xs text-gray-600">
                              <p className="truncate">📍 {user.lat.toFixed(4)}, {user.lng.toFixed(4)}</p>
                              <p className="truncate mt-1">📏 Distance: {(user.distanceTravelled || user.totalDistance || 0).toFixed(2)} km</p>
                              <p className="text-gray-500 mt-1">
                                Last seen: {new Date(user.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Charts and Data Sections - Only show when not in fullscreen */}
                {!isMapFullscreen && (
                  <>
                    <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 mb-6">
                      {/* Sales Chart */}
                      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl sm:rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 p-4 sm:p-8 border border-gray-100 animate-fadeIn">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg sm:text-xl font-black text-gray-800 flex items-center gap-2">
                            <TrendingUp className="text-blue-500" size={20} />
                            Sales Overview
                          </h3>
                          <span className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">
                            This Month
                          </span>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={adminData?.salesChart || []}>
                            <XAxis dataKey="type" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                background: 'linear-gradient(135deg, #ffffff, #f0f9ff)',
                                border: '2px solid #3b82f6',
                                borderRadius: '12px',
                                fontSize: '12px',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                              }}
                            />
                            <Bar
                              dataKey="count"
                              fill="url(#salesGradient)"
                              radius={[8, 8, 0, 0]}
                              animationBegin={300}
                              animationDuration={1500}
                            />
                            <defs>
                              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.9} />
                              </linearGradient>
                            </defs>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Meeting Distribution */}
                      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl sm:rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 p-4 sm:p-8 border border-gray-100 animate-fadeIn animation-delay-200">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg sm:text-xl font-black text-gray-800 flex items-center gap-2">
                            <Users className="text-blue-500" size={20} />
                            Meeting Distribution
                          </h3>
                          <span className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">
                            Active
                          </span>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'One-to-One', value: (adminData?.meetings || []).filter(m => m.type === 'ONE_TO_ONE').length },
                                { name: 'Group', value: (adminData?.meetings || []).filter(m => m.type === 'GROUP').length }
                              ]}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              label
                              animationBegin={300}
                              animationDuration={1500}
                            >
                              <Cell fill="url(#pieGradient1)" />
                              <Cell fill="url(#pieGradient2)" />
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: 'linear-gradient(135deg, #ffffff, #f0f9ff)',
                                border: '2px solid #3b82f6',
                                borderRadius: '12px',
                                fontSize: '12px',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                              }}
                            />
                            <defs>
                              <linearGradient id="pieGradient1" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#2563eb" />
                              </linearGradient>
                              <linearGradient id="pieGradient2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#06b6d4" />
                                <stop offset="100%" stopColor="#0891b2" />
                              </linearGradient>
                            </defs>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Data Tables */}
                    <div className="grid lg:grid-cols-2 gap-6">
                      <EnhancedDataSection title="Recent Meetings" icon={<Calendar size={16} />} count={(adminData?.meetings || []).length}>
                        {(adminData?.meetings || []).slice(0, 5).map((m, index) => (
                          <EnhancedMeetingRow key={m._id} meeting={m} delay={index * 100} />
                        ))}
                      </EnhancedDataSection>

                      <EnhancedDataSection title="Recent Attendance" icon={<MapPin size={16} />} count={(adminData?.attendance || []).length}>
                        {(adminData?.attendance || [])
                          .slice()
                          .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                          .slice(0, 10)
                          .map((a, index) => (
                            <EnhancedAttendanceRow key={a._id} attendance={a} delay={index * 100} />
                          ))}
                      </EnhancedDataSection>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ================= FIELD OFFICER DASHBOARD ================= */}
        {role === "FIELD" && (
          <>
            <h2 className="text-2xl sm:text-4xl font-black mb-6 text-gray-800 animate-fadeIn">
              Field Officer Dashboard
              <span className="ml-3 inline-block">🚜</span>
            </h2>

            {/* Live Tracking Status */}
            <div className="mb-6">
              <div className={`bg-gradient-to-br ${isTracking
                ? 'from-green-500 to-emerald-600'
                : 'from-gray-500 to-gray-600'
                } text-white p-4 sm:p-6 rounded-xl shadow-lg`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${isTracking ? 'bg-white/20 animate-pulse' : 'bg-gray-400/20'
                      }`}>
                      <Navigation size={28} />
                    </div>
                    <div>
                      <p className="font-bold text-lg sm:text-xl">
                        {isTracking ? 'Live Tracking Active' : 'Tracking Offline'}
                      </p>
                      <p className="text-sm opacity-90 mt-1">
                        {isTracking
                          ? 'Your location is being shared with admin in real-time'
                          : 'Start tracking to share your location with admin'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-white animate-ping' : 'bg-gray-300'}`}></div>
                      <span className="text-sm font-bold">{isTracking ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                    <button
                      onClick={isTracking ? stopLiveTracking : startLiveTracking}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 ${isTracking
                        ? 'bg-white/20 hover:bg-white/30 border border-white/30'
                        : 'bg-white text-gray-800 hover:bg-gray-100'
                        }`}
                    >
                      {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Stats Grid - Only Sales and Distance */}
            <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6">
              <StatCard
                label="SALES"
                value={fieldStats?.sales || 0}
                icon={<TrendingUp size={20} />}
                color="from-emerald-500 to-teal-600"
                delay={200}
              />
              <StatCard
                label="DISTANCE"
                value={`${(fieldStats?.distanceTraveled || 0).toFixed(2)} km`}
                icon={<Navigation size={20} />}
                color="from-orange-500 to-amber-600"
                delay={300}
              />
            </div>

            {/* Action Grid - Only Start/End Day and Record Sale */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 mb-6">
              {!activeAttendance ? (
                <ActionButton
                  icon={<MapPin size={20} />}
                  label="Start Day"
                  subtitle="Mark attendance"
                  color="from-blue-500 to-cyan-600"
                  onClick={startDay}
                  delay={0}
                />
              ) : (
                <ActionButton
                  icon={<MapPin size={20} />}
                  label="End Day"
                  subtitle={canEndDay ? "Close attendance" : (endDayCountdown ? `Locked: ${endDayCountdown}` : "Close attendance")}
                  color={canEndDay ? "from-red-500 to-rose-600" : "from-gray-400 to-gray-500"}
                  onClick={endDay}
                  disabled={isEndingDay || !canEndDay}
                  delay={0}
                />
              )}
              {/* Removed Meetings and Samples */}
              <ActionButton
                icon={<Users size={20} />}
                label="One-to-One"
                subtitle="Individual meeting"
                color="from-blue-500 to-cyan-600"
                onClick={() => openMeetingForm("ONE_TO_ONE")}
                delay={150}
              />
              <ActionButton
                icon={<Users size={20} className="rotate-12" />}
                label="Group"
                subtitle="Group session"
                color="from-blue-500 to-cyan-600"
                onClick={() => openMeetingForm("GROUP")}
                delay={300}
              />
              <ActionButton
                icon={<TrendingUp size={20} />}
                label="Record Sale"
                subtitle="New transaction"
                color="from-blue-500 to-cyan-600"
                onClick={() => setShowSaleForm(true)}
                delay={450}
              />
            </div>

            {/* Location Display */}
            {location && (
              <div id="field-location-section" className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 sm:p-6 rounded-xl shadow-lg border-2 border-blue-200 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="font-bold text-blue-900 flex items-center gap-2 text-lg">
                      <MapPin size={24} className="text-blue-600" />
                      Current Location
                    </p>
                    <p className="text-sm text-blue-700">
                      {isTracking ? 'Live location tracking active' : 'Last recorded location'}
                    </p>
                  </div>
                  <span className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full font-bold shadow-sm">
                    {isTracking ? 'LIVE TRACKING' : 'STATIC'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm hover:shadow transition-all">
                    <p className="text-xs text-gray-500 mb-1">Latitude</p>
                    <p className="font-mono font-bold text-blue-700 text-lg">{location.lat?.toFixed(6)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm hover:shadow transition-all">
                    <p className="text-xs text-gray-500 mb-1">Longitude</p>
                    <p className="font-mono font-bold text-blue-700 text-lg">{location.lng?.toFixed(6)}</p>
                  </div>
                </div>

                {location.accuracy && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-blue-900 font-medium">Location Accuracy</span>
                      <span className="text-sm font-bold text-blue-700">±{location.accuracy?.toFixed(1)} meters</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, 100 - (location.accuracy / 50) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Mini Map for Field Officer */}
                <div className="rounded-lg overflow-hidden border-2 border-gray-300 h-64 shadow-lg">
                  <MapContainer
                    center={[location.lat, location.lng]}
                    zoom={15}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker
                      position={[location.lat, location.lng]}
                      icon={L.divIcon({
                        className: 'custom-marker',
                        html: `
                          <div class="relative">
                            <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold shadow-xl border-4 border-white animate-pulse">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                              </svg>
                            </div>
                            <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                          </div>
                        `,
                        iconSize: [48, 48],
                        iconAnchor: [24, 48]
                      })}
                    >
                      <Popup>
                        <div className="p-2">
                          <p className="font-bold">Your Current Location</p>
                          <p className="text-sm">Accuracy: ±{location.accuracy?.toFixed(1)}m</p>
                          {location.speed && (
                            <p className="text-sm">Speed: {(location.speed * 3.6).toFixed(1)} km/h</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>

                    {/* Accuracy circle */}
                    {location.accuracy && (
                      <Circle
                        center={[location.lat, location.lng]}
                        radius={location.accuracy}
                        pathOptions={{
                          fillColor: '#3b82f6',
                          fillOpacity: 0.1,
                          color: '#3b82f6',
                          weight: 1,
                          opacity: 0.5
                        }}
                      />
                    )}
                  </MapContainer>
                </div>
              </div>
            )}

            {/* Meeting and Sale Forms */}
            {showMeetingForm && meetingType === "ONE_TO_ONE" && (
              <EnhancedFieldMeetingOne onClose={() => setShowMeetingForm(false)} />
            )}
            {showMeetingForm && meetingType === "GROUP" && (
              <EnhancedFieldMeetingGroup onClose={() => setShowMeetingForm(false)} />
            )}
            {showSaleForm && (
              <EnhancedSaleForm onClose={() => setShowSaleForm(false)} />
            )}
          </>
        )}

        {/* ================= USER MARKETPLACE ================= */}
        {role === "USER" && (
          <div className="space-y-6 animate-fadeIn">
            {/* VIEW: DASHBOARD (Marketplace) */}
            {activeTab === 'dashboard' && (
              <>
                {/* Enhanced Header with Animation */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="relative">
                    <h2 className="text-2xl sm:text-4xl font-black text-gray-800 mb-1 animate-fadeIn">
                      Product Marketplace
                      <span className="ml-3 inline-block">🛒</span>
                    </h2>
                    <p className="text-sm text-gray-600 animate-slideInLeft animation-delay-100">
                      Browse and order premium agricultural products
                    </p>
                    <div className="absolute -top-2 -right-2 w-16 h-16 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full blur-xl opacity-30"></div>
                  </div>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="bg-gradient-to-br from-white to-gray-50 px-5 py-3 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-2 border-blue-200 animate-fadeIn w-full sm:w-auto"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-500 font-semibold tracking-wider">MY ORDERS</div>
                        <div className="text-xl sm:text-2xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                          {orders.length}
                        </div>
                      </div>
                      <div className="ml-4 p-2 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-xl">
                        <ShoppingCart size={20} className="text-blue-600" />
                      </div>
                    </div>
                  </button>
                </div>

                {/* Animated Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {products.map((product, index) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      onOrder={openOrderModal}
                      delay={index * 100}
                    />
                  ))}
                </div>
              </>
            )}

            {/* VIEW: ORDERS */}
            {activeTab === 'orders' && (
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl sm:rounded-3xl shadow-md hover:shadow-xl transition-all duration-300 p-4 sm:p-8 border border-gray-100 animate-fadeIn">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-2">
                    <Sparkles size={20} className="text-blue-500 animate-spin-slow" />
                    My Orders
                  </h3>
                  <span className="text-xs px-3 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full font-bold animate-pulse">
                    {orders.length} total
                  </span>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-10">
                    <ShoppingCart size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">No orders yet. Start shopping!</p>
                    <button
                      onClick={() => setActiveTab('dashboard')}
                      className="mt-4 text-blue-600 font-bold hover:underline"
                    >
                      Browse Products
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {orders.map((order, index) => (
                      <OrderItem
                        key={order._id}
                        order={order}
                        delay={index * 50}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW: ANALYTICS (Placeholder) */}
            {activeTab === 'analytics' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center animate-fadeIn">
                <BarChart3 size={64} className="mx-auto text-blue-200 mb-4" />
                <h3 className="text-2xl font-black text-gray-800 mb-2">Analytics Coming Soon</h3>
                <p className="text-gray-500">Track your spending and purchase history here.</p>
              </div>
            )}

            {/* VIEW: PROFILE (Placeholder) */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 animate-fadeIn">
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl">
                    {userName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-gray-800">{userName}</h2>
                    <p className="text-green-600 font-medium">Verified Customer</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Account Role</p>
                    <p className="font-bold text-gray-800">{role}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">User ID</p>
                    <p className="font-mono text-gray-800 text-sm">{userId}</p>
                  </div>
                </div>

                <button width="full" className="w-full mt-6 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors" onClick={logout}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Order Modal */}
      {
        showOrderModal && selectedProduct && (
          <EnhancedOrderModal
            product={selectedProduct}
            onClose={() => {
              setShowOrderModal(false)
              setSelectedProduct(null)
            }}
            onSuccess={() => {
              loadProducts()
              loadOrders()
              showNotification("success", "Order placed successfully!")
            }}
          />
        )
      }

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideInDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 20px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        
        @keyframes scaleX {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-slideInRight {
          animation: slideInRight 0.5s ease-out;
        }
        
        .animate-slideInLeft {
          animation: slideInLeft 0.5s ease-out;
        }
        
        .animate-slideInUp {
          animation: slideInUp 0.5s ease-out;
        }
        
        .animate-slideInDown {
          animation: slideInDown 0.5s ease-out;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
        
        .animate-fadeOut {
          animation: fadeOut 0.3s ease-out;
        }
        
        .animate-pulse-ring {
          animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-scaleX {
          animation: scaleX 0.3s ease-out;
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div >
  )
}

/* ================= STAT CARD COMPONENT ================= */
function StatCard({ label, value, icon, color, delay = 0, live = false }) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={`bg-gradient-to-br ${color} text-white p-4 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300 animate-fadeIn group relative overflow-hidden`}
    >
      {live && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
          <div className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full"></div>
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <p className="text-xs font-bold opacity-80 tracking-wider">{label}</p>
        <div className="bg-white bg-opacity-20 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
          {icon}
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-black truncate">{value ?? "—"}</p>
      <div className="h-1 w-0 group-hover:w-full bg-white bg-opacity-30 transition-all duration-500 mt-2 rounded-full"></div>
    </div>
  )
}

/* ================= ACTION BUTTON COMPONENT ================= */
function ActionButton({ icon, label, subtitle, color, onClick, delay = 0, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ animationDelay: `${delay}ms` }}
      className={`bg-gradient-to-br ${color} text-white p-4 sm:p-5 rounded-xl shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300 animate-fadeIn flex flex-col items-center justify-center group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="relative">
        <div className="bg-white bg-opacity-20 p-2 sm:p-3 rounded-lg group-hover:rotate-12 transition-transform duration-300">
          {icon}
        </div>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping opacity-60"></div>
      </div>
      <div className="text-center mt-2 sm:mt-3">
        <p className="font-bold text-sm sm:text-base">{label}</p>
        <p className="text-xs opacity-90 mt-0.5">{subtitle}</p>
      </div>
      <div className="absolute inset-0 rounded-xl border-2 border-white border-opacity-0 group-hover:border-opacity-30 transition-all duration-300"></div>
    </button>
  )
}
/* ================= PRODUCT CARD COMPONENT ================= */
function ProductCard({ product, onOrder, delay = 0 }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fadeIn"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg overflow-hidden border border-gray-100 transition-all duration-500 transform ${isHovered ? 'scale-105 shadow-2xl' : ''
        }`}>
        <div className="h-40 bg-gradient-to-br from-blue-100 via-cyan-100 to-sky-100 flex items-center justify-center relative overflow-hidden">
          {product.name.toLowerCase().includes("bovi") || product.name.toLowerCase().includes("mineral") ? (
            <img
              src="https://m.media-amazon.com/images/I/41ZJ0uMz6CL._SX300_SY300_.jpg"
              alt={product.name}
              className={`h-full w-full object-contain mix-blend-multiply transition-transform duration-500 ${isHovered ? 'scale-110' : ''}`}
            />
          ) : (
            <Package
              size={48}
              className={`text-blue-600 transition-transform duration-500 ${isHovered ? 'scale-125 rotate-12' : ''
                }`}
            />
          )}
          {product.quantity < 10 && (
            <div className="absolute top-3 right-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse shadow-lg z-10">
              Low Stock
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-gray-800 mb-1 text-sm truncate">{product.name}</h3>
          <p className="text-xs text-gray-600 mb-3 truncate">{product.category}</p>
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-lg font-black bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                ₹{product.price}
              </p>
              <p className="text-xs text-gray-500">per {product.unit}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-700">Stock: {product.quantity}</p>
              <p className="text-xs text-gray-500">{product.unit}s</p>
            </div>
          </div>
          <button
            onClick={() => onOrder(product)}
            disabled={product.quantity === 0}
            className={`w-full py-2 rounded-lg font-bold transition-all duration-300 flex items-center justify-center gap-2 text-sm ${product.quantity > 0
              ? 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
          >
            <ShoppingCart size={16} className={product.quantity > 0 ? 'animate-bounce' : ''} />
            {product.quantity > 0 ? 'Order Now' : 'Out of Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================= ORDER ITEM COMPONENT ================= */
function OrderItem({ order, delay = 0 }) {
  const statusColors = {
    PENDING: 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800',
    CONFIRMED: 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800',
    SHIPPED: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800',
    DELIVERED: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800',
    CANCELLED: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800'
  }

  const statusIcons = {
    PENDING: '⏳',
    CONFIRMED: '✅',
    SHIPPED: '🚚',
    DELIVERED: '📦',
    CANCELLED: '❌'
  }

  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fadeIn"
    >
      <div className="flex justify-between items-center p-3 sm:p-4 bg-gradient-to-r from-white to-gray-50 rounded-lg hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 border border-gray-200">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm truncate">{order.productName}</p>
          <p className="text-xs text-gray-600 mt-1">
            Qty: {order.quantity} × ₹{order.price}
          </p>
          <p className="text-xs text-gray-400 mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex flex-col items-end gap-1 ml-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusColors[order.status]} shadow-sm`}>
            {statusIcons[order.status]} {order.status}
          </span>
          <p className="text-sm font-bold text-gray-800">₹{order.quantity * order.price}</p>
        </div>
      </div>
    </div>
  )
}

/* ================= ENHANCED ORDER MODAL ================= */
function EnhancedOrderModal({ product, onClose, onSuccess }) {
  const [quantity, setQuantity] = useState(1)
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState("COD")

  const total = product.price * quantity

  const handleSubmit = async () => {
    if (!address || !phone) {
      setError("Please fill in all fields")
      return
    }

    if (phone.length < 10) {
      setError("Please enter a valid 10-digit phone number")
      return
    }

    setError("")
    setLoading(true)
    setStep(2)

    try {
      const orderData = {
        productId: product._id,
        productName: product.name,
        quantity,
        deliveryAddress: address,
        phoneNumber: phone,
        paymentMethod,
        totalAmount: total
      }

      const response = await api("/inventory/order", "POST", orderData)

      // Simulate processing delay
      setTimeout(() => {
        setStep(3)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 1500)
      }, 1000)
    } catch (err) {
      setError(err.error || err.message || "Failed to place order")
      setStep(1)
      setLoading(false)
    }
  }

  return (
    <div className="fixed top-20 inset-x-0 bottom-0 bg-black bg-opacity-50 flex items-end justify-center p-4 z-[3000] backdrop-blur-sm sm:items-center sm:p-6 sm:inset-0 sm:top-0">
      <div className="bg-white rounded-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-full overflow-y-auto animate-slideInUp">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 p-4 sm:p-6 flex justify-between items-center">
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-2">
            {step === 1 && "Place Order"}
            {step === 2 && "Processing..."}
            {step === 3 && "Success!"}
          </h2>
          {step === 1 && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {/* Loading/Processing Steps */}
          {step === 2 && (
            <div className="text-center py-8">
              <div className="relative inline-block mb-6">
                <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-lg font-bold text-gray-800 mb-2">Processing your order</p>
              <p className="text-sm text-gray-600 animate-pulse">Please wait a moment...</p>
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">Verifying product availability</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse animation-delay-200"></div>
                  <span className="text-sm text-gray-600">Processing payment</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse animation-delay-400"></div>
                  <span className="text-sm text-gray-600">Creating order confirmation</span>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8 animate-fadeIn">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-ring">
                <CheckCircle size={40} className="text-white" />
              </div>
              <p className="text-xl font-bold text-gray-800 mb-2">Order Placed Successfully!</p>
              <p className="text-sm text-gray-600 mb-6">Your order has been confirmed and is being processed.</p>
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl border-2 border-blue-200">
                <p className="font-bold text-gray-800 mb-1">Order #{Math.floor(Math.random() * 10000)}</p>
                <p className="text-sm text-gray-600">Estimated delivery: 3-5 business days</p>
              </div>
            </div>
          )}

          {/* Order Form - Step 1 */}
          {step === 1 && (
            <>
              {/* Product Info */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 sm:p-6 rounded-xl mb-6 border-2 border-blue-200 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-200 rounded-full opacity-20"></div>
                <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-cyan-200 rounded-full opacity-20"></div>
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{product.name}</h3>
                    <p className="text-sm text-gray-600">{product.category}</p>
                  </div>
                  <span className="text-xs px-3 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full font-bold">
                    Stock: {product.quantity}
                  </span>
                </div>
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <span className="text-2xl font-black text-blue-700">₹{product.price}</span>
                    <span className="text-sm text-gray-600">/{product.unit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold text-gray-700">4.8</span>
                    <span className="text-xs text-gray-500">(128 reviews)</span>
                  </div>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center text-gray-600 hover:from-gray-200 hover:to-gray-300 transition-all active:scale-95 shadow-sm"
                    disabled={quantity <= 1}
                  >
                    <span className="text-2xl font-bold">-</span>
                  </button>
                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      min="1"
                      max={product.quantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(product.quantity, parseInt(e.target.value) || 1)))}
                      className="w-full text-center px-4 py-3 text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">Max: {product.quantity} units</p>
                  </div>
                  <button
                    onClick={() => setQuantity(Math.min(product.quantity, quantity + 1))}
                    className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-200 rounded-xl flex items-center justify-center text-blue-700 hover:from-blue-200 hover:to-cyan-300 transition-all active:scale-95 shadow-sm"
                    disabled={quantity >= product.quantity}
                  >
                    <span className="text-2xl font-bold">+</span>
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">Payment Method</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <button
                    onClick={() => navigate('/admin/field-officers')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col items-center gap-2 group"
                  >
                    <div className="bg-blue-50 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                      <Users size={24} className="text-blue-600" />
                    </div>
                    <span className="font-semibold text-gray-700 text-sm">Field Officers</span>
                  </button>

                  <button
                    onClick={() => navigate('/admin-charts')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col items-center gap-2 group"
                  >
                    <div className="bg-green-50 p-3 rounded-full group-hover:bg-green-100 transition-colors">
                      <BarChart3 size={24} className="text-green-600" />
                    </div>
                    <span className="font-semibold text-gray-700 text-sm">Analytics</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("COD")}
                    className={`p-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${paymentMethod === "COD"
                      ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50'
                      : 'border-gray-200 hover:border-blue-300'
                      }`}
                  >
                    <Truck size={24} className={paymentMethod === "COD" ? "text-blue-600" : "text-gray-400"} />
                    <span className="font-bold text-sm">Cash on Delivery</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("ONLINE")}
                    className={`p-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${paymentMethod === "ONLINE"
                      ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50'
                      : 'border-gray-200 hover:border-blue-300'
                      }`}
                  >
                    <CreditCard size={24} className={paymentMethod === "ONLINE" ? "text-blue-600" : "text-gray-400"} />
                    <span className="font-bold text-sm">Online Payment</span>
                  </button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter 10-digit phone number"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 text-gray-400" size={20} />
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter complete delivery address with landmarks"
                      rows="3"
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Total Amount */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 sm:p-6 rounded-xl mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Price ({quantity} × ₹{product.price})</span>
                    <span className="font-bold">₹{product.price * quantity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Delivery Charges</span>
                    <span className="font-bold text-blue-600">FREE</span>
                  </div>
                  <div className="pt-3 border-t border-gray-300">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-800">Total Amount:</span>
                      <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        ₹{total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-2 mb-6 text-sm text-gray-600">
                <Shield size={16} className="text-blue-600" />
                <span>Secure transaction • 100% Safe Payment</span>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 text-red-700 p-4 rounded-xl mb-6 flex items-start gap-3 animate-shake">
                  <AlertCircle size={20} className="mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Error</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 rounded-xl font-bold transition-all shadow-sm hover:shadow active:scale-95 text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || product.quantity === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {loading ? "Processing..." : "Confirm Order"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================= ENHANCED DATA SECTION ================= */
function EnhancedDataSection({ title, icon, children, count }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-6 flex justify-between items-center hover:bg-gray-50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white p-2 rounded-lg group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-left">{title}</h3>
            <p className="text-xs text-gray-500">{count} records</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">
            New
          </span>
          {isExpanded ?
            <ChevronUp size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" /> :
            <ChevronDown size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
          }
        </div>
      </button>

      {isExpanded && (
        <div className="max-h-64 overflow-y-auto border-t border-gray-100 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  )
}

/* ================= ENHANCED MEETING ROW ================= */
function EnhancedMeetingRow({ meeting, delay = 0 }) {
  const typeColors = {
    'ONE_TO_ONE': 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800',
    'GROUP': 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800'
  }

  const typeIcons = {
    'ONE_TO_ONE': '👤',
    'GROUP': '👥'
  }

  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fadeIn"
    >
      <div className="p-3 sm:p-4 border-b border-gray-100 hover:bg-gray-50 transition-all duration-300 group">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm truncate group-hover:text-blue-700 transition-colors">
              {meeting.userId?.name || "Field Officer"}
            </p>
            <p className="text-xs text-gray-600 truncate">{meeting.category || "N/A"}</p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${typeColors[meeting.type] || 'bg-gray-100 text-gray-800'} ml-2 shadow-sm flex items-center gap-1`}>
            {typeIcons[meeting.type]} {meeting.type}
          </span>
        </div>
        {meeting.village && (
          <p className="text-xs text-gray-500 mb-1 truncate flex items-center gap-1">
            <MapPin size={10} />
            {meeting.village} • {meeting.attendeesCount} attendees
          </p>
        )}
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-400 truncate">{new Date(meeting.createdAt).toLocaleString()}</p>
          {meeting.notes && (
            <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 italic">
              " {meeting.notes} "
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================= ENHANCED ATTENDANCE ROW ================= */
function EnhancedAttendanceRow({ attendance, delay = 0 }) {
  const isActive = !attendance.endTime
  const durationMs = attendance.endTime
    ? new Date(attendance.endTime) - new Date(attendance.startTime)
    : Date.now() - new Date(attendance.startTime)
  const durationH = Math.floor(durationMs / (1000 * 60 * 60))
  const durationM = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fadeIn"
    >
      <div className="p-3 sm:p-4 border-b border-gray-100 hover:bg-gray-50 transition-all duration-300 group">
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-gray-800 text-sm truncate group-hover:text-blue-700">
            {attendance.userId?.name || "Field Officer"}
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {isActive ? '🟢 Active' : '✅ Completed'}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate mb-2">{attendance.userId?.email}</p>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {new Date(attendance.startTime).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            🕐 {new Date(attendance.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {attendance.endTime ? (
            <span className="flex items-center gap-1">
              → {new Date(attendance.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span className="text-green-600 font-semibold">→ ongoing</span>
          )}
          <span className="flex items-center gap-1 font-semibold text-blue-600">
            ⏱ {durationH}h {durationM}m
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mt-1 text-xs">
          <span className="flex items-center gap-1 text-orange-600 font-semibold">
            📏 {parseFloat(attendance.totalDistance || 0).toFixed(2)} km
          </span>
          {attendance.startLocation?.lat && (
            <span className="flex items-center gap-1 text-gray-400">
              <MapPin size={10} />
              {attendance.startLocation.lat.toFixed(3)}, {attendance.startLocation.lng.toFixed(3)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================= CHEVRON RIGHT ICON ================= */
function ChevronRight({ className, size = 16 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

/* ================= ENHANCED FIELD MEETING ONE ================= */
function EnhancedFieldMeetingOne({ onClose }) {
  const [notes, setNotes] = useState("")
  const [category, setCategory] = useState("FARMER")
  const [personName, setPersonName] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  // Dynamic Fields State
  const [landSize, setLandSize] = useState("")
  const [cropType, setCropType] = useState("")
  const [shopName, setShopName] = useState("")
  const [monthlyTurnover, setMonthlyTurnover] = useState("")
  const [socialHandle, setSocialHandle] = useState("")
  const [followerCount, setFollowerCount] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [territory, setTerritory] = useState("")

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadPhoto = async () => {
    if (!photo) return ""

    try {
      const formData = new FormData()
      formData.append("photo", photo)

      const res = await fetch(`${API_URL}/field/upload-photo`, {
        method: "POST",
        body: formData
      })

      const data = await res.json()
      return data.photoUrl || ""
    } catch (error) {
      console.error("Photo upload failed:", error)
      return ""
    }
  }

  const submit = async () => {
    if (!personName.trim()) {
      showNotification("error", "Please enter name")
      return
    }

    if (!navigator.geolocation) {
      showNotification("error", "Geolocation not supported")
      return
    }

    setLoading(true)

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        })
      })

      // Upload photo if exists
      let photoUrl = ""
      if (photo) {
        photoUrl = await uploadPhoto()
      }

      const meetingData = {
        type: "ONE_TO_ONE",
        category,
        personName: personName.trim(),
        contactNumber: phone.trim() || undefined,
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        },
        notes: notes.trim() || undefined,
        photoUrl: photoUrl || undefined,
        timestamp: new Date().toISOString(),

        // Dynamic Fields
        landSize: category === "FARMER" ? landSize : undefined,
        cropType: category === "FARMER" ? cropType : undefined,
        shopName: (category === "SELLER" || category === "DEALER") ? shopName : undefined,
        monthlyTurnover: (category === "SELLER" || category === "DEALER") ? monthlyTurnover : undefined,
        socialHandle: category === "INFLUENCER" ? socialHandle : undefined,
        followerCount: category === "INFLUENCER" ? followerCount : undefined,
        agencyName: category === "DISTRIBUTOR" ? agencyName : undefined,
        territory: category === "DISTRIBUTOR" ? territory : undefined,
      }

      await api("/field/meeting", "POST", meetingData)

      showNotification("success", "Meeting logged successfully!")
      setNotes("")
      setPersonName("")
      setPhone("")
      setPhoto(null)
      setPhotoPreview(null)
      setLoading(false)
      onClose()
    } catch (error) {
      console.error("Error logging meeting:", error)
      const errorMsg = error?.error || error?.message || "Unknown error"
      showNotification("error", "Failed to log meeting: " + errorMsg)
      setLoading(false)
    }
  }

  return (
    <div id="meeting-form-one" className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl mb-6 sm:mb-8 border-2 border-indigo-200 animate-slideInUp">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800">One-to-One Meeting</h2>
          <p className="text-sm text-gray-600 mt-1">Log individual meetings</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
        >
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4 sm:space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
          >
            <option value="FARMER">Farmer</option>
            <option value="SELLER">Seller</option>
            <option value="INFLUENCER">Influencer</option>
            <option value="DISTRIBUTOR">Distributor</option>
            <option value="DEALER">Dealer</option>
            <option value="VETERINARIAN">Veterinarian</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            {category === 'FARMER' ? 'Farmer Name' :
              category === 'SELLER' ? 'Seller Name' :
                category === 'INFLUENCER' ? 'Influencer Name' :
                  category === 'DISTRIBUTOR' ? 'Distributor Name' :
                    'Name'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={personName}
            onChange={e => setPersonName(e.target.value)}
            placeholder="Enter full name"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Enter phone number (optional)"
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
        </div>

        {/* Dynamic Fields based on Category */}
        {category === "FARMER" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Land Size (Acres)</label>
              <input
                type="text"
                value={landSize}
                onChange={e => setLandSize(e.target.value)}
                placeholder="e.g. 5"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Main Crop</label>
              <input
                type="text"
                value={cropType}
                onChange={e => setCropType(e.target.value)}
                placeholder="e.g. Wheat"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {(category === "SELLER" || category === "DEALER") && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Shop Name</label>
              <input
                type="text"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="e.g. Kisan Kendra"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Monthly Turnover</label>
              <input
                type="text"
                value={monthlyTurnover}
                onChange={e => setMonthlyTurnover(e.target.value)}
                placeholder="e.g. 5 Lakhs"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {category === "INFLUENCER" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Social Handle</label>
              <input
                type="text"
                value={socialHandle}
                onChange={e => setSocialHandle(e.target.value)}
                placeholder="@username"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Followers</label>
              <input
                type="text"
                value={followerCount}
                onChange={e => setFollowerCount(e.target.value)}
                placeholder="e.g. 10k"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {category === "DISTRIBUTOR" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Agency Name</label>
              <input
                type="text"
                value={agencyName}
                onChange={e => setAgencyName(e.target.value)}
                placeholder="Agency Name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Territory</label>
              <input
                type="text"
                value={territory}
                onChange={e => setTerritory(e.target.value)}
                placeholder="e.g. Patna District"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Meeting Photo (Optional)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 transition-all hover:border-indigo-500 focus-within:border-indigo-500">
            <div className="flex flex-col items-center justify-center gap-3">
              {photoPreview ? (
                <div className="relative w-full">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setPhoto(null)
                      setPhotoPreview(null)
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Camera size={32} className="text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Click to upload meeting photo</p>
                    <p className="text-xs text-gray-500">Supports JPG, PNG, WEBP</p>
                  </div>
                </>
              )}
              <label className="cursor-pointer">
                <div className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-bold text-sm hover:from-indigo-600 hover:to-purple-700 transition-all">
                  {photoPreview ? 'Change Photo' : 'Choose Photo'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Meeting Notes</label>
          <textarea
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            placeholder="Enter meeting details, discussion points, outcomes, feedback..."
            rows="5"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          className="flex-1 py-3 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 rounded-xl font-bold transition-all shadow-sm hover:shadow"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={loading || !personName.trim()}
          className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Meeting"}
        </button>
      </div>
    </div>
  )
}

/* ================= ENHANCED FIELD MEETING GROUP ================= */
function EnhancedFieldMeetingGroup({ onClose }) {
  const [village, setVillage] = useState("")
  const [count, setCount] = useState(0)
  const [category, setCategory] = useState("FARMER")
  const [topic, setTopic] = useState("")
  const [loading, setLoading] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadPhoto = async () => {
    if (!photo) return ""

    try {
      const formData = new FormData()
      formData.append("photo", photo)

      const res = await fetch(`${API_URL}/field/upload-photo`, {
        method: "POST",
        body: formData
      })

      const data = await res.json()
      return data.photoUrl || ""
    } catch (error) {
      console.error("Photo upload failed:", error)
      return ""
    }
  }

  const submit = async () => {
    if (!village.trim()) {
      showNotification("error", "Please enter village name")
      return
    }

    if (count === 0) {
      showNotification("error", "Please enter number of attendees")
      return
    }

    if (!navigator.geolocation) {
      showNotification("error", "Geolocation not supported")
      return
    }

    setLoading(true)

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        })
      })

      // Upload photo if exists
      let photoUrl = ""
      if (photo) {
        photoUrl = await uploadPhoto()
      }

      const meetingData = {
        type: "GROUP",
        category,
        village: village.trim(),
        attendeesCount: count,
        topic: topic.trim() || undefined,
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        },
        photoUrl: photoUrl || undefined,
        timestamp: new Date().toISOString()
      }

      await api("/field/meeting", "POST", meetingData)

      showNotification("success", "Group meeting logged successfully!")
      setVillage("")
      setCount(0)
      setTopic("")
      setPhoto(null)
      setPhotoPreview(null)
      setLoading(false)
      onClose()
    } catch (error) {
      console.error("Error logging group meeting:", error)
      const errorMsg = error?.error || error?.message || "Unknown error"
      showNotification("error", "Failed to log meeting: " + errorMsg)
      setLoading(false)
    }
  }

  return (
    <div id="meeting-form-group" className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl mb-6 sm:mb-8 border-2 border-purple-200 animate-slideInUp">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800">Group Meeting</h2>
          <p className="text-sm text-gray-600 mt-1">Log group sessions with multiple farmers</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
        >
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4 sm:space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
          >
            <option value="FARMER">Farmers</option>
            <option value="SELLER">Sellers</option>
            <option value="INFLUENCER">Influencers</option>
            <option value="DISTRIBUTOR">Distributors</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Village Name <span className="text-red-500">*</span>
          </label>
          <input
            placeholder="Enter village name"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            value={village}
            onChange={e => setVillage(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Meeting Topic</label>
          <input
            placeholder="e.g., New Pesticide Training, Crop Rotation Seminar"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            value={topic}
            onChange={e => setTopic(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Number of Attendees <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            placeholder="How many people attended?"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            value={count}
            onChange={e => setCount(parseInt(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Meeting Photo (Optional)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 transition-all hover:border-purple-500 focus-within:border-purple-500">
            <div className="flex flex-col items-center justify-center gap-3">
              {photoPreview ? (
                <div className="relative w-full">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setPhoto(null)
                      setPhotoPreview(null)
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Camera size={32} className="text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Click to upload group photo</p>
                    <p className="text-xs text-gray-500">Supports JPG, PNG, WEBP</p>
                  </div>
                </>
              )}
              <label className="cursor-pointer">
                <div className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-bold text-sm hover:from-purple-600 hover:to-pink-700 transition-all">
                  {photoPreview ? 'Change Photo' : 'Choose Photo'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          className="flex-1 py-3 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 rounded-xl font-bold transition-all shadow-sm hover:shadow"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={loading || !village.trim() || count === 0}
          className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Meeting"}
        </button>
      </div>
    </div>
  )
}

/* ================= ENHANCED SALE FORM ================= */
function EnhancedSaleForm({ onClose }) {
  const [formData, setFormData] = useState({
    productName: "",
    quantity: 1,
    price: 0,
    saleType: "B2C",
    farmerName: "",
    distributorName: "",
    village: "",
    district: "",
    state: "",
    notes: ""
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)

  const totalAmount = formData.quantity * formData.price

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadPhoto = async () => {
    if (!photo) return ""

    try {
      const formData = new FormData()
      formData.append("photo", photo)

      const res = await fetch(`${API_URL}/field/upload-photo`, {
        method: "POST",
        body: formData
      })

      const data = await res.json()
      return data.photoUrl || ""
    } catch (error) {
      console.error("Photo upload failed:", error)
      return ""
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.productName.trim()) {
      newErrors.productName = "Product name is required"
    }

    if (formData.quantity <= 0) {
      newErrors.quantity = "Quantity must be greater than 0"
    }

    if (formData.price <= 0) {
      newErrors.price = "Price must be greater than 0"
    }

    if (formData.saleType === "B2C" && !formData.farmerName.trim()) {
      newErrors.farmerName = "Farmer/Customer Name is required"
    }

    if (formData.saleType === "B2B" && !formData.distributorName.trim()) {
      newErrors.distributorName = "Distributor Name is required"
    }

    console.log("Validation errors:", newErrors, "Form Data:", formData)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      showNotification("error", "Please fix the errors in the form")
      return
    }

    if (!navigator.geolocation) {
      showNotification("error", "Geolocation not supported")
      return
    }

    setLoading(true)

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000
        })
      })

      // Upload photo if exists
      let photoUrl = ""
      if (photo) {
        photoUrl = await uploadPhoto()
      }

      const saleData = {
        ...formData,
        totalAmount,
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        },
        photoUrl: photoUrl || undefined,
        timestamp: new Date().toISOString()
      }

      console.log("Submitting sale data:", saleData)

      const response = await api("/field/sale", "POST", saleData)
      console.log("Sale response:", response)

      showNotification("success", "Sale recorded successfully!")
      setFormData({
        productName: "",
        quantity: 1,
        price: 0,
        saleType: "B2C",
        farmerName: "",
        distributorName: "",
        village: "",
        district: "",
        state: "",
        notes: ""
      })
      setErrors({})
      setPhoto(null)
      setPhotoPreview(null)
      setLoading(false)
      onClose()
    } catch (error) {
      console.error("Error recording sale:", error)
      let errorMessage = "Unknown error occurred"

      if (error?.error) {
        errorMessage = error.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error?.details) {
        errorMessage = `${error.message} - ${error.details}`
      } else {
        errorMessage = JSON.stringify(error)
      }

      console.error("Full error details:", error)
      showNotification("error", "Failed to record sale: " + errorMessage)
      setLoading(false)
    }
  }

  return (
    <div id="sale-form" className="bg-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl p-6 sm:p-8 border-2 border-blue-200 mb-6 sm:mb-8 animate-slideInUp">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800">Record Sale</h2>
          <p className="text-sm text-gray-600 mt-1">Log new sales transaction</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-4 sm:space-y-5">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Sale Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFormData({ ...formData, saleType: "B2C" })
                setErrors({}) // Clear errors on switch
              }}
              className={`flex-1 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold transition-all ${formData.saleType === "B2C"
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              B2C (Customer)
            </button>
            <button
              onClick={() => {
                setFormData({ ...formData, saleType: "B2B" })
                setErrors({}) // Clear errors on switch
              }}
              className={`flex-1 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold transition-all ${formData.saleType === "B2B"
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              B2B (Distributor)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Product Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={formData.productName}
            onChange={e => setFormData({ ...formData, productName: e.target.value })}
            placeholder="e.g., Pesticide XYZ, Fertilizer ABC, Seeds Type"
            className={`w-full px-4 py-3 border-2 rounded-lg sm:rounded-xl focus:ring-2 outline-none transition-all ${errors.productName
              ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
          />
          {errors.productName && (
            <p className="text-red-500 text-xs mt-1">{errors.productName}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Quantity <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-lg sm:rounded-xl focus:ring-2 outline-none transition-all ${errors.quantity
                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
            />
            {errors.quantity && (
              <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Price <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              placeholder="Per unit"
              className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-lg sm:rounded-xl focus:ring-2 outline-none transition-all ${errors.price
                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
            />
            {errors.price && (
              <p className="text-red-500 text-xs mt-1">{errors.price}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Total Amount</label>
            <div className="px-3 sm:px-4 py-2 sm:py-3 bg-blue-50 border-2 border-blue-300 rounded-lg sm:rounded-xl">
              <p className="text-lg sm:text-2xl font-black text-blue-700">₹{totalAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {formData.saleType === "B2C" && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Customer Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.farmerName}
              onChange={e => setFormData({ ...formData, farmerName: e.target.value })}
              placeholder="Enter customer name"
              className={`w-full px-4 py-3 border-2 rounded-lg sm:rounded-xl focus:ring-2 outline-none transition-all ${errors.farmerName
                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
            />
            {errors.farmerName && (
              <p className="text-red-500 text-xs mt-1">{errors.farmerName}</p>
            )}
          </div>
        )}

        {formData.saleType === "B2B" && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Distributor Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.distributorName}
              onChange={e => setFormData({ ...formData, distributorName: e.target.value })}
              placeholder="Enter distributor name"
              className={`w-full px-4 py-3 border-2 rounded-lg sm:rounded-xl focus:ring-2 outline-none transition-all ${errors.distributorName
                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
            />
            {errors.distributorName && (
              <p className="text-red-500 text-xs mt-1">{errors.distributorName}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Sale Photo (Optional)</label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 transition-all hover:border-blue-500 focus-within:border-blue-500">
            <div className="flex flex-col items-center justify-center gap-3">
              {photoPreview ? (
                <div className="relative w-full">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setPhoto(null)
                      setPhotoPreview(null)
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <Camera size={32} className="text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Click to upload product photo</p>
                    <p className="text-xs text-gray-500">Supports JPG, PNG, WEBP</p>
                  </div>
                </>
              )}
              <label className="cursor-pointer">
                <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg font-bold text-sm hover:from-blue-600 hover:to-cyan-700 transition-all">
                  {photoPreview ? 'Change Photo' : 'Choose Photo'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Village</label>
            <input
              type="text"
              value={formData.village}
              onChange={e => setFormData({ ...formData, village: e.target.value })}
              placeholder="Village"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg sm:rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">District</label>
            <input
              type="text"
              value={formData.district}
              onChange={e => setFormData({ ...formData, district: e.target.value })}
              placeholder="District"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg sm:rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">State</label>
            <input
              type="text"
              value={formData.state}
              onChange={e => setFormData({ ...formData, state: e.target.value })}
              placeholder="State"
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg sm:rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add any notes, feedback, or special instructions..."
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg sm:rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onClose}
          className="flex-1 py-3 bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 rounded-xl font-bold transition-all shadow-sm hover:shadow"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
        >
          {loading ? "Recording..." : "Record Sale"}
        </button>
      </div>
    </div>
  )
}

/* ================= SHOW NOTIFICATION FUNCTION ================= */
function showNotification(type, message) {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.custom-notification')
  existingNotifications.forEach(n => n.remove())

  const notification = document.createElement('div')
  notification.className = `custom-notification animate-slideInRight ${type === 'success'
    ? 'bg-gradient-to-r from-green-600 to-emerald-600'
    : type === 'error'
      ? 'bg-gradient-to-r from-red-500 to-rose-600'
      : type === 'warning'
        ? 'bg-gradient-to-r from-amber-500 to-orange-600'
        : 'bg-gradient-to-r from-green-600 to-emerald-600'
    } text-white px-6 py-4 rounded-2xl shadow-lg flex items-center gap-3 transform hover:scale-105 transition-transform duration-300`

  // Force styles to ensure visibility over navbar
  notification.style.setProperty('position', 'fixed', 'important')
  notification.style.setProperty('top', '120px', 'important') // Explicitly below navbar
  notification.style.setProperty('right', '16px', 'important')
  notification.style.setProperty('z-index', '2147483647', 'important') // Max Z-Index

  notification.innerHTML = `
    ${type === 'success' ? '<div class="animate-bounce">🎉</div>' :
      type === 'error' ? '<div class="animate-pulse">⚠️</div>' :
        type === 'warning' ? '<div class="animate-pulse">🔔</div>' :
          '<div class="animate-pulse">ℹ️</div>'}
    <div>
      <p class="font-bold text-sm">${type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : type === 'warning' ? 'Warning!' : 'Info!'}</p>
      <p class="text-xs opacity-90">${message}</p>
    </div>
  `

  document.body.appendChild(notification)

  setTimeout(() => {
    notification.classList.add('animate-fadeOut')
    setTimeout(() => notification.remove(), 300)
  }, 3000)
}