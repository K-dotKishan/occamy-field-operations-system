import { useEffect, useState } from "react"
import { api } from "../api"
import LiveTrackingMap from "../components/LiveTrackingMap"
import {
  MapPin, Users, TrendingUp, Package, Calendar,
  Download, Filter, Map as MapIcon, BarChart3
} from "lucide-react"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts"

export default function AdminDashboard() {
  const [adminData, setAdminData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview') // overview, analytics, map, reports
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadDashboard()
  }, [dateRange])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const data = await api(`/admin/dashboard?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`)
      setAdminData(data || {})
    } catch (err) {
      console.error("Failed to load dashboard")
      setAdminData({})
    } finally {
      setLoading(false)
    }
  }

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-gray-800 mb-2">Admin Control Center</h2>
          <p className="text-gray-600 text-sm sm:text-base">Comprehensive operations analytics & insights</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={e => setDateRange({...dateRange, startDate: e.target.value})}
            className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-green-500 outline-none"
          />
          <span className="hidden sm:flex items-center text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={e => setDateRange({...dateRange, endDate: e.target.value})}
            className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-green-500 outline-none"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-lg overflow-x-auto">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<BarChart3 size={18} />} label="Overview" />
        <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<TrendingUp size={18} />} label="Analytics" />
        <TabButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<MapIcon size={18} />} label="Map View" />
        <TabButton active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} icon={<span>💬</span>} label="Messages" />
        <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<Download size={18} />} label="Reports" />
      </div>

      {loading && (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-green-600 border-t-transparent"></div>
          <p className="text-gray-500 mt-4">Loading dashboard data…</p>
        </div>
      )}

      {!loading && adminData && (
        <>
          {activeTab === 'overview' && <OverviewTab data={adminData} colors={COLORS} />}
          {activeTab === 'analytics' && <AnalyticsTab data={adminData} colors={COLORS} />}
          {activeTab === 'map' && <MapTab />}
          {activeTab === 'messages' && <MessagesTab />}
          {activeTab === 'reports' && <ReportsTab data={adminData} />}
        </>
      )}
    </div>
  )
}

/* ================= TAB COMPONENTS ================= */

function OverviewTab({ data, colors }) {
  return (
    <>
      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          label="TOTAL USERS"
          value={data.stats?.totalUsers}
          icon={<Users size={28} />}
          color="from-blue-500 to-blue-700"
        />
        <StatCard
          label="MEETINGS"
          value={data.stats?.totalMeetings}
          icon={<Calendar size={28} />}
          color="from-purple-500 to-purple-700"
          subtitle={`${data.stats?.conversionRate}% converted`}
        />
        <StatCard
          label="SALES"
          value={data.stats?.totalSales}
          icon={<TrendingUp size={28} />}
          color="from-emerald-500 to-emerald-700"
        />
        <StatCard
          label="SAMPLES"
          value={data.stats?.totalSamples}
          icon={<Package size={28} />}
          color="from-amber-500 to-amber-700"
        />
        <StatCard
          label="REVENUE"
          value={`₹${(data.stats?.totalRevenue || 0).toLocaleString()}`}
          icon={<span className="text-2xl">💰</span>}
          color="from-green-600 to-green-800"
          subtitle={`${data.stats?.totalDistance || 0}km traveled`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <ChartCard title="Sales Breakdown" icon={<TrendingUp className="text-green-600" />}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.salesChart || []}>
              <XAxis dataKey="type" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '2px solid #10b981',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
              <Bar dataKey="count" fill="#10b981" name="Sales Count" radius={[8, 8, 0, 0]} />
              <Bar dataKey="amount" fill="#3b82f6" name="Revenue (₹)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Meeting Types */}
        <ChartCard title="Meeting Distribution" icon={<Users className="text-purple-600" />}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.meetingChart || []}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="count"
                label={entry => `${entry.type}: ${entry.count}`}
              >
                {(data.meetingChart || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          {/* Recent admin messages summary */}
          {data.adminMessages && data.adminMessages.length > 0 && (
            <div className="mt-4 px-4">
              <p className="text-sm text-gray-500 font-semibold">Recent Messages ({data.adminMessages.length})</p>
              <div className="mt-2 grid gap-2">
                {data.adminMessages.slice(0,3).map(m => (
                  <div key={m._id} className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                    <div className="font-semibold">{m.officerName || 'Officer'}</div>
                    <div className="truncate">{m.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Data Tables */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Meetings */}
        <DataSection title="Recent Meetings" icon={<Calendar />}>
          {(data.meetings || []).length === 0 && <EmptyState />}
          {(data.meetings || []).slice(0, 10).map(m => (
            <MeetingRow key={m._id} meeting={m} />
          ))}
        </DataSection>

        {/* Recent Sales */}
        <DataSection title="Recent Sales" icon={<TrendingUp />}>
          {(data.sales || []).length === 0 && <EmptyState />}
          {(data.sales || []).slice(0, 10).map(s => (
            <SaleRow key={s._id} sale={s} />
          ))}
        </DataSection>
      </div>

      {/* Users Table */}
      <DataSection title="User Management" icon={<Users />}>
        {(data.users || []).length === 0 && <EmptyState />}
        {(data.users || []).map(u => (
          <UserRow key={u._id} user={u} />
        ))}
      </DataSection>
    </>
  )
}

function AnalyticsTab({ data, colors }) {
  return (
    <>
      {/* State-wise Performance */}
      <ChartCard title="State-wise Performance" icon={<MapPin className="text-blue-600" />}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data.stateData || []}>
            <XAxis dataKey="state" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip />
            <Legend />
            <Bar dataKey="meetings" fill="#8b5cf6" name="Meetings" />
            <Bar dataKey="sales" fill="#10b981" name="Sales" />
            <Bar dataKey="samples" fill="#f59e0b" name="Samples" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Conversion Funnel */}
      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <FunnelCard
          label="Farmers Contacted"
          value={data.stats?.totalFarmersContacted || 0}
          color="blue"
          percentage={100}
        />
        <FunnelCard
          label="Samples Distributed"
          value={data.stats?.totalSamples || 0}
          color="purple"
          percentage={((data.stats?.totalSamples / data.stats?.totalFarmersContacted) * 100) || 0}
        />
        <FunnelCard
          label="Converted to Sales"
          value={data.stats?.farmersConverted || 0}
          color="green"
          percentage={parseFloat(data.stats?.conversionRate || 0)}
        />
      </div>

      {/* Field Officer Performance */}
      <DataSection title="Field Officer Performance" icon={<Users />}>
        {(data.users || []).filter(u => u.role === 'FIELD').map(officer => (
          <OfficerPerformanceRow key={officer._id} officer={officer} data={data} />
        ))}
      </DataSection>
    </>
  )
}

function MapTab() {
  return <LiveTrackingMap />
}

function MessagesTab() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOfficer, setSelectedOfficer] = useState(null)

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const data = await api("/admin/messages")
      setMessages(data || [])
    } catch (err) {
      console.error("Failed to load messages:", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredMessages = selectedOfficer
    ? messages.filter(m => m.officerId === selectedOfficer)
    : messages

  const officers = [...new Set(messages.map(m => ({ id: m.officerId, name: m.officerName })))]

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      {/* Officers List */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 font-bold">
          Field Officers ({officers.length})
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          <button
            onClick={() => setSelectedOfficer(null)}
            className={`w-full p-4 text-left hover:bg-gray-50 transition ${!selectedOfficer ? 'bg-purple-50 border-l-4 border-purple-600' : ''}`}
          >
            <p className="font-semibold text-gray-800">All Messages</p>
            <p className="text-xs text-gray-500">{messages.length} messages</p>
          </button>
          {officers.map(officer => (
            <button
              key={officer.id}
              onClick={() => setSelectedOfficer(officer.id)}
              className={`w-full p-4 text-left hover:bg-gray-50 transition ${selectedOfficer === officer.id ? 'bg-purple-50 border-l-4 border-purple-600' : ''}`}
            >
              <p className="font-semibold text-gray-800">{officer.name}</p>
              <p className="text-xs text-gray-500">{messages.filter(m => m.officerId === officer.id).length} messages</p>
            </button>
          ))}
        </div>
      </div>

      {/* Messages Display */}
      <div className="lg:col-span-3 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 flex justify-between items-center">
          <h3 className="text-xl font-bold">Messages & Updates</h3>
          <button
            onClick={loadMessages}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition text-sm font-semibold"
          >
            🔄 Refresh
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
          </div>
        )}

        {!loading && filteredMessages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-6xl mb-2">💬</p>
              <p className="text-gray-500 font-semibold">No messages yet</p>
            </div>
          </div>
        )}

        {!loading && filteredMessages.length > 0 && (
          <div className="flex-1 overflow-y-auto divide-y">
            {filteredMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(msg => (
              <MessageCard key={msg._id} message={msg} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageCard({ message }) {
  return (
    <div className="p-6 hover:bg-gray-50 transition-colors border-b">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold">
              {message.officerName.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-800">{message.officerName}</p>
              <p className="text-xs text-gray-500">{message.officerPhone || 'No phone'}</p>
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-400">{new Date(message.timestamp).toLocaleString()}</span>
      </div>

      <div className="ml-13">
        <p className="text-gray-700 mb-3">{message.text}</p>

        {message.location && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3 rounded text-sm">
            <p className="text-gray-600"><strong>📍 Location:</strong> {message.location.address || `${message.location.lat.toFixed(4)}, ${message.location.lng.toFixed(4)}`}</p>
          </div>
        )}

        {message.distanceTravelled && (
          <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded text-sm">
            <p className="text-gray-600"><strong>📊 Distance Travelled:</strong> {message.distanceTravelled} km</p>
          </div>
        )}

        <div className="flex gap-3 mt-3 text-xs">
          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full">{message.status || 'UPDATE'}</span>
          {message.meetingType && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">{message.meetingType}</span>}
        </div>
      </div>
    </div>
  )
}

function ReportsTab({ data }) {
  const [reportType, setReportType] = useState('monthly')
  const [monthlyData, setMonthlyData] = useState(null)

  const generateMonthlyReport = async () => {
    const now = new Date()
    try {
      const report = await api(`/admin/analytics/monthly?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      setMonthlyData(report)
    } catch (err) {
      console.error("Failed to generate report")
    }
  }

  useEffect(() => {
    if (reportType === 'monthly') {
      generateMonthlyReport()
    }
  }, [reportType])

  return (
    <>
      <div className="grid md:grid-cols-3 gap-6">
        <ReportCard
          title="Monthly Report"
          description="Comprehensive monthly performance summary"
          onClick={() => setReportType('monthly')}
          active={reportType === 'monthly'}
        />
        <ReportCard
          title="Officer Performance"
          description="Individual field officer analytics"
          onClick={() => setReportType('officer')}
          active={reportType === 'officer'}
        />
        <ReportCard
          title="Geographic Analysis"
          description="State & village-wise breakdown"
          onClick={() => setReportType('geography')}
          active={reportType === 'geography'}
        />
      </div>

      {monthlyData && reportType === 'monthly' && (
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-gray-800">
              Monthly Report - {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <button className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg">
              <Download size={18} />
              Export PDF
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <MetricBox label="Meetings" value={monthlyData.summary.totalMeetings} />
            <MetricBox label="Sales" value={monthlyData.summary.totalSales} />
            <MetricBox label="Revenue" value={`₹${monthlyData.summary.totalRevenue.toLocaleString()}`} />
            <MetricBox label="Distance" value={`${monthlyData.summary.totalDistance}km`} />
            <MetricBox label="Villages" value={monthlyData.summary.uniqueVillages} />
          </div>

          {/* Daily Trend */}
          <div className="mb-8">
            <h4 className="font-bold text-lg mb-4">Daily Activity Trend</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData.dailyData}>
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="meetings" stroke="#8b5cf6" strokeWidth={2} name="Meetings" />
                <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2} name="Sales" />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Performers */}
          <div>
            <h4 className="font-bold text-lg mb-4">🏆 Top Performers</h4>
            <div className="space-y-2">
              {monthlyData.topPerformers.map((officer, idx) => (
                <div key={idx} className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏅'}</span>
                    <div>
                      <p className="font-bold text-gray-800">{officer.name}</p>
                      <p className="text-sm text-gray-600">{officer.sales} sales</p>
                    </div>
                  </div>
                  <p className="text-2xl font-black text-green-700">₹{officer.revenue.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ================= COMPONENTS ================= */

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${active
        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
        : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
      {icon}
      {label}
    </button>
  )
}

function StatCard({ label, value, icon, color, subtitle }) {
  return (
    <div className={`bg-gradient-to-br ${color} text-white p-6 rounded-2xl shadow-xl transform hover:scale-105 transition-all`}>
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-bold opacity-80 tracking-wider">{label}</p>
        <div className="bg-white bg-opacity-20 p-2 rounded-lg">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-black mb-1">{value ?? "—"}</p>
      {subtitle && <p className="text-xs opacity-80">{subtitle}</p>}
    </div>
  )
}

function ChartCard({ title, icon, children }) {
  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
      <h3 className="text-xl font-black mb-6 text-gray-800 flex items-center gap-3">
        <div className="bg-green-100 p-2 rounded-xl">
          {icon}
        </div>
        {title}
      </h3>
      {children}
    </div>
  )
}

function DataSection({ title, icon, children }) {
  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 border-b border-gray-200">
        <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
          <div className="bg-green-600 text-white p-2 rounded-xl">
            {icon}
          </div>
          {title}
        </h3>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function MeetingRow({ meeting }) {
  const typeColors = {
    'ONE_TO_ONE': 'bg-indigo-100 text-indigo-800',
    'GROUP': 'bg-purple-100 text-purple-800'
  }

  return (
    <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start mb-2 gap-4">
        <div className="flex-1">
          <p className="font-bold text-gray-800">{meeting.userId?.name || "Field Officer"}</p>
          <p className="text-sm text-gray-600">{meeting.category || "N/A"} • {meeting.village || 'N/A'}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${typeColors[meeting.type] || 'bg-gray-100 text-gray-800'}`}>
          {meeting.type}
        </span>
      </div>
      {meeting.type === 'GROUP' && meeting.attendeesCount && (
        <p className="text-xs text-gray-500 mb-1">👥 {meeting.attendeesCount} attendees</p>
      )}
      {meeting.adminMessage && (
        <p className="text-sm font-medium text-blue-700 bg-blue-50 p-2 rounded mb-2 border-l-4 border-blue-500">💬 {meeting.adminMessage}</p>
      )}
      {meeting.businessPotential && (
        <p className="text-xs text-green-600 mb-1">💼 Est. {meeting.businessPotential.estimatedVolume}kg • {meeting.businessPotential.likelihood} likelihood</p>
      )}
      {meeting.notes && (
        <p className="text-sm text-gray-600 italic line-clamp-2">"{meeting.notes}"</p>
      )}
      <p className="text-xs text-gray-400 mt-2">{new Date(meeting.createdAt).toLocaleString()}</p>
    </div>
  )
}

function SaleRow({ sale }) {
  const typeColors = {
    'B2C': 'bg-green-100 text-green-800',
    'B2B': 'bg-blue-100 text-blue-800'
  }

  return (
    <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <p className="font-bold text-gray-800">{sale.productName}</p>
          <p className="text-sm text-gray-600">
            {sale.quantity} × {sale.packSize} • {sale.saleType === 'B2C' ? sale.farmerName : sale.distributorName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-green-700">₹{sale.totalAmount.toLocaleString()}</p>
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${typeColors[sale.saleType]}`}>
            {sale.saleType}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-400">{sale.village}, {sale.district} • {new Date(sale.createdAt).toLocaleString()}</p>
    </div>
  )
}

function UserRow({ user }) {
  const roleColors = {
    'ADMIN': 'bg-red-100 text-red-800',
    'FIELD': 'bg-blue-100 text-blue-800',
    'USER': 'bg-green-100 text-green-800'
  }

  return (
    <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-gray-800">{user.name}</p>
          <p className="text-sm text-gray-600">{user.email}</p>
          <p className="text-xs text-gray-400">{user.phone} • {user.state}, {user.district}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleColors[user.role]}`}>
          {user.role}
        </span>
      </div>
    </div>
  )
}

function FunnelCard({ label, value, color, percentage }) {
  return (
    <div className={`bg-${color}-50 border-2 border-${color}-200 rounded-2xl p-6`}>
      <p className="text-sm font-semibold text-gray-600 mb-2">{label}</p>
      <p className="text-4xl font-black text-gray-800 mb-2">{value}</p>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div className={`bg-${color}-600 h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
      </div>
      <p className="text-xs text-gray-500">{percentage.toFixed(1)}% of funnel</p>
    </div>
  )
}

function OfficerPerformanceRow({ officer, data }) {
  const officerAttendance = (data.attendance || []).filter(a => a.userId?._id === officer._id)
  const officerMeetings = (data.meetings || []).filter(m => m.userId?._id === officer._id).length
  const officerSales = (data.sales || []).filter(s => s.userId?._id === officer._id)
  const totalDistance = officerAttendance.reduce((sum, a) => sum + (a.totalDistance || 0), 0)
  const revenue = officerSales.reduce((sum, s) => sum + s.totalAmount, 0)

  return (
    <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="font-bold text-gray-800">{officer.name}</p>
          <p className="text-sm text-gray-600">{officer.state}, {officer.district}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-4 sm:gap-6 text-center w-full sm:w-auto">
          <div>
            <p className="text-lg sm:text-2xl font-black text-purple-600">{officerMeetings}</p>
            <p className="text-xs text-gray-500">Meetings</p>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-black text-green-600">{officerSales.length}</p>
            <p className="text-xs text-gray-500">Sales</p>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-black text-blue-600">₹{revenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Revenue</p>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-black text-orange-600">{totalDistance.toFixed(2)}</p>
            <p className="text-xs text-gray-500">km Travelled</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportCard({ title, description, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`p-6 rounded-2xl border-2 transition-all text-left ${active
        ? 'bg-green-50 border-green-500 shadow-lg'
        : 'bg-white border-gray-200 hover:border-green-300'
        }`}
    >
      <h4 className="font-bold text-lg text-gray-800 mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  )
}

function MetricBox({ label, value }) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
      <p className="text-xs text-gray-500 font-semibold mb-1">{label}</p>
      <p className="text-2xl font-black text-gray-800">{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="p-8 text-center">
      <div className="text-6xl mb-4">📭</div>
      <p className="text-gray-400 font-semibold">No data available</p>
    </div>
  )
}