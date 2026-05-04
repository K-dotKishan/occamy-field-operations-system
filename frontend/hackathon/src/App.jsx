import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Dashboard from "./pages/Dashboard"
import AdminDashboard from "./pages/AdminDashboard"
import FieldDashboard from "./pages/FieldDashboard"
import FieldOfficers from "./pages/FieldOfficers"
import AdminCharts from "./pages/AdminCharts"
import Inventory from "./pages/Inventory"
import DistributorDashboard from "./pages/DistributorDashboard"
import AdminDistributors from "./pages/AdminDistributors"
import ProtectedRoute from "./components/ProtectedRoute"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin-dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/field-officers" element={<ProtectedRoute><FieldOfficers /></ProtectedRoute>} />
        <Route path="/admin/distributors" element={<ProtectedRoute><AdminDistributors /></ProtectedRoute>} />
        <Route path="/field-dashboard" element={<ProtectedRoute><FieldDashboard /></ProtectedRoute>} />
        <Route path="/admin-charts" element={<ProtectedRoute><AdminCharts /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/distributor-dashboard" element={<ProtectedRoute><DistributorDashboard /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}
