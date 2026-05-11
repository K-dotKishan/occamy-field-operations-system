import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import { X } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"

export default function FieldMeetingOne() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    personName: "",
    contactNumber: "",
    category: "FARMER",
    village: "",
    district: "",
    state: "",
    estimatedVolume: 0,
    likelihood: "MEDIUM",
    notes: "",
    productSampleAvailable: false,
    productSampleGiven: false
  })
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!formData.personName || !formData.contactNumber) {
      alert("Please fill in all required fields")
      return
    }

    if (!navigator.geolocation) {
      alert("Geolocation not supported")
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const formDataToSend = new FormData()
          
          const location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }

          formDataToSend.append('location', JSON.stringify(location))
          formDataToSend.append('type', 'ONE_TO_ONE')
          formDataToSend.append('personName', formData.personName)
          formDataToSend.append('contactNumber', formData.contactNumber)
          formDataToSend.append('category', formData.category)
          formDataToSend.append('village', formData.village)
          formDataToSend.append('district', formData.district)
          formDataToSend.append('state', formData.state)
          
          formDataToSend.append('businessPotential', JSON.stringify({
            estimatedVolume: formData.estimatedVolume,
            likelihood: formData.likelihood
          }))

          formDataToSend.append('notes', formData.notes)
          formDataToSend.append('productSampleAvailable', formData.productSampleAvailable)
          formDataToSend.append('productSampleGiven', formData.productSampleGiven)

          photos.forEach(photo => {
            formDataToSend.append('photos', photo)
          })

          await fetch(`${API_URL}/field/meeting/one-to-one`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formDataToSend
          })

          alert("One-to-One Meeting logged successfully!")
          navigate("/field-dashboard")
        } catch (err) {
          alert("Failed to log meeting")
        } finally {
          setLoading(false)
        }
      },
      () => {
        alert("Location permission denied")
        setLoading(false)
      }
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black text-gray-800">One-to-One Meeting</h2>
            <button 
              onClick={() => navigate("/field-dashboard")}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Person Name *</label>
              <input
                type="text"
                value={formData.personName}
                onChange={e => setFormData({...formData, personName: e.target.value})}
                placeholder="Enter person's name"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Contact Number *</label>
              <input
                type="tel"
                value={formData.contactNumber}
                onChange={e => setFormData({...formData, contactNumber: e.target.value})}
                placeholder="Enter contact number"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              >
                <option value="FARMER">Farmer</option>
                <option value="SELLER">Seller</option>
                <option value="INFLUENCER">Influencer</option>
                <option value="VETERINARIAN">Veterinarian</option>
                <option value="DAIRY_COLLECTION_CENTER">Dairy Collection Center</option>
                <option value="RETAIL_OUTLET">Retail Outlet</option>
                <option value="KVK">KVK</option>
                <option value="FPO">FPO</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="DEALER">Dealer</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Village</label>
                <input
                  type="text"
                  value={formData.village}
                  onChange={e => setFormData({...formData, village: e.target.value})}
                  placeholder="Village"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">District</label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={e => setFormData({...formData, district: e.target.value})}
                  placeholder="District"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={e => setFormData({...formData, state: e.target.value})}
                placeholder="State"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Estimated Volume (kg)</label>
              <input
                type="number"
                value={formData.estimatedVolume}
                onChange={e => setFormData({...formData, estimatedVolume: e.target.value})}
                placeholder="0"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Business Likelihood</label>
              <select
                value={formData.likelihood}
                onChange={e => setFormData({...formData, likelihood: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Product Sample Available</label>
                <select
                  value={formData.productSampleAvailable ? "yes" : "no"}
                  onChange={e => setFormData({...formData, productSampleAvailable: e.target.value === "yes"})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Product Sample Given</label>
                <select
                  value={formData.productSampleGiven ? "yes" : "no"}
                  onChange={e => setFormData({...formData, productSampleGiven: e.target.value === "yes"})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="Add meeting notes..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => navigate("/field-dashboard")}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50"
              >
                {loading ? "Saving..." : "Log Meeting"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
