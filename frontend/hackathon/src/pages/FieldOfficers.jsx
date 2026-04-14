import { useState, useEffect } from "react"
import { ArrowLeft, Search, MapPin, Navigation, Battery, Phone, Mail, User, Calendar } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"

export default function FieldOfficers() {
    const navigate = useNavigate()
    const [officers, setOfficers] = useState([])
    const [filteredOfficers, setFilteredOfficers] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        totalDistance: 0
    })

    useEffect(() => {
        loadOfficers()
        // Refresh every 30 seconds
        const interval = setInterval(loadOfficers, 30000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        filterOfficers()
    }, [searchQuery, officers])

    const loadOfficers = async () => {
        try {
            const data = await api("/admin/field-officers")
            setOfficers(data)

            // Calculate stats
            const total = data.length
            const active = data.filter(o => o.isOnline).length
            const totalDistance = data.reduce((sum, o) => sum + (o.totalDistance || 0), 0)

            setStats({ total, active, totalDistance })
            setLoading(false)
        } catch (err) {
            console.error("Failed to load officers:", err)
            setLoading(false)
        }
    }

    const filterOfficers = () => {
        if (!searchQuery.trim()) {
            setFilteredOfficers(officers)
            return
        }

        const query = searchQuery.toLowerCase()
        const filtered = officers.filter(o =>
            o.name.toLowerCase().includes(query) ||
            o.email.toLowerCase().includes(query) ||
            o.phone.toLowerCase().includes(query)
        )
        setFilteredOfficers(filtered)
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <ArrowLeft size={24} className="text-gray-600" />
                            </button>
                            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Field Officer Tracking</h1>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full text-blue-700 text-xs sm:text-sm font-medium">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                Active: {stats.active}/{stats.total}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search */}
                <div className="mb-8 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search officers by name, email, or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                    />
                </div>

                {/* Officers Grid */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredOfficers.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        <User size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No field officers found matching your search.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredOfficers.map((officer) => (
                            <div
                                key={officer._id}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300"
                            >
                                <div className="p-6">
                                    {/* Header with Name and Status */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${officer.isOnline ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-gray-400 to-gray-600'
                                                }`}>
                                                {officer.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{officer.name}</h3>
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${officer.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${officer.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                                                    {officer.isOnline ? 'Active Now' : 'Offline'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between py-2 border-b border-gray-50">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Navigation size={18} className="text-blue-500" />
                                                <span className="text-sm">Distance Today</span>
                                            </div>
                                            <span className="font-bold text-gray-900">
                                                {(officer.totalDistance || 0).toFixed(2)} km
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between py-2 border-b border-gray-50">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Calendar size={18} className="text-purple-500" />
                                                <span className="text-sm">Meetings Today</span>
                                            </div>
                                            <span className="font-bold text-gray-900">
                                                {officer.meetingsToday || 0}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                                            <Phone size={16} />
                                            {officer.phone}
                                        </div>

                                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                                            <Mail size={16} />
                                            {officer.email}
                                        </div>

                                        {officer.lastLocation && (
                                            <div className="bg-gray-50 rounded-lg p-3 mt-3">
                                                <div className="flex items-start gap-2">
                                                    <MapPin size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-xs text-gray-500 font-medium mb-1">Last Known Location</p>
                                                        <p className="text-sm text-gray-700 truncate">
                                                            {officer.lastLocation.lat.toFixed(6)}, {officer.lastLocation.lng.toFixed(6)}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {new Date(officer.lastUpdate).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
