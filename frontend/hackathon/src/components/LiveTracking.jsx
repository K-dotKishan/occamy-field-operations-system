import { useEffect, useState, useRef } from "react"
import { MapPin, Activity, AlertCircle, CheckCircle2, Zap } from "lucide-react"
import { api } from "../api"

export default function LiveTracking({ onLocationUpdate }) {
  const [isTracking, setIsTracking] = useState(false)
  const [location, setLocation] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [accuracy, setAccuracy] = useState(null)
  const [activity, setActivity] = useState("TRAVEL")
  const [trackingStatus, setTrackingStatus] = useState("idle")
  const [message, setMessage] = useState("")
  const trackingIntervalRef = useRef(null)
  const geolocationWatchRef = useRef(null)
  // Throttle: only send one DB write per 10 seconds regardless of how often
  // watchPosition fires. This prevents pool exhaustion on Atlas M0.
  const lastSentRef = useRef(0)
  const THROTTLE_MS = 10000

  const startTracking = () => {
    if (!navigator.geolocation) {
      setMessage("❌ Geolocation not supported on this device")
      return
    }

    setIsTracking(true)
    setTrackingStatus("tracking")
    setMessage("📍 Starting real-time location tracking...")

    geolocationWatchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy: acc } = position.coords

        setLocation({ lat: latitude, lng: longitude })
        setAccuracy(Math.round(acc))

        // Throttle DB writes — skip if last write was less than 10s ago
        const now = Date.now()
        if (now - lastSentRef.current < THROTTLE_MS) return
        lastSentRef.current = now

        try {
          await api("/field/location/track", "POST", {
            lat: latitude,
            lng: longitude,
            accuracy: acc,
            activity: activity
          })

          setLastUpdate(new Date().toLocaleTimeString())
          setMessage(`✅ Location updated at ${new Date().toLocaleTimeString()}`)
          if (onLocationUpdate) onLocationUpdate()
        } catch (err) {
          console.error("Failed to track location:", err)
          setMessage("⚠️ Failed to sync location with server")
        }
      },
      (error) => {
        console.error("Geolocation error:", error)
        if (error.code === 1) {
          setMessage(`❌ Permission denied. Enable location access.`)
          setTrackingStatus("stopped")
          setIsTracking(false)
        } else {
          setMessage(`⚠️ GPS weak: ${error.message} - Retrying...`)
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 30000
      }
    )
  }

  // Stop tracking
  const stopTracking = () => {
    if (geolocationWatchRef.current) {
      navigator.geolocation.clearWatch(geolocationWatchRef.current)
      geolocationWatchRef.current = null
    }

    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current)
    }

    setIsTracking(false)
    setTrackingStatus("stopped")
    setMessage("🛑 Tracking stopped")
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (geolocationWatchRef.current) {
        navigator.geolocation.clearWatch(geolocationWatchRef.current)
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="text-blue-600" size={24} />
          <div>
            <h3 className="text-lg font-bold text-gray-800">Live Location Tracking</h3>
            <p className="text-sm text-gray-500">Real-time GPS position sharing with admin</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isTracking ? (
            <>
              <Zap className="animate-pulse text-yellow-500" size={20} />
              <span className="text-sm font-semibold text-yellow-600">TRACKING ACTIVE</span>
            </>
          ) : (
            <span className="text-sm text-gray-500">Inactive</span>
          )}
        </div>
      </div>

      {/* Activity Selection */}
      <div className="grid grid-cols-4 gap-2">
        {["TRAVEL", "MEETING", "SAMPLE", "SALE"].map((act) => (
          <button
            key={act}
            onClick={() => setActivity(act)}
            className={`px-3 py-2 rounded text-sm font-semibold transition ${activity === act
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            disabled={isTracking}
          >
            {act}
          </button>
        ))}
      </div>

      {/* Status Messages */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${message.includes("❌") || message.includes("⚠️")
          ? "bg-red-100 text-red-700"
          : message.includes("🛑")
            ? "bg-orange-100 text-orange-700"
            : "bg-green-100 text-green-700"
          }`}>
          {message.includes("❌") || message.includes("⚠️") ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          {message}
        </div>
      )}

      {/* Current Location Display */}
      {location && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Latitude</p>
              <p className="text-lg font-mono font-bold text-gray-800">{location.lat.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Longitude</p>
              <p className="text-lg font-mono font-bold text-gray-800">{location.lng.toFixed(6)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Accuracy</p>
              <p className="text-sm text-gray-700">
                {accuracy ? `±${accuracy} meters` : "Calculating..."}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Activity</p>
              <p className="text-sm text-blue-600 font-semibold">{activity}</p>
            </div>
          </div>

          {lastUpdate && (
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Last Update</p>
              <p className="text-sm text-gray-700">{lastUpdate}</p>
            </div>
          )}

          {/* Map View */}
          <iframe
            title="current-location"
            width="100%"
            height="250"
            loading="lazy"
            src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&z=16&output=embed`}
            className="rounded mt-3"
          />
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        {!isTracking ? (
          <button
            onClick={startTracking}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Zap size={18} />
            Start Real-Time Tracking
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Activity size={18} />
            Stop Tracking
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-3 rounded text-sm text-blue-700">
        <p className="font-semibold">💡 How it works:</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
          <li>Your location is tracked every 5-10 seconds</li>
          <li>Admins can see your real-time position on the map</li>
          <li>Activity type helps categorize your location data</li>
          <li>Battery optimized - works in background</li>
        </ul>
      </div>
    </div>
  )
}
