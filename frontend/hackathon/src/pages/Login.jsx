

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import { auth, googleProvider, isFirebaseConfigured } from "../firebaseConfig"
import { signInWithPopup } from "firebase/auth"
import { Mail, Lock, User, Phone, Eye, EyeOff, Shield, Globe, ArrowRight, CheckCircle } from "lucide-react"
import occamyLogo from "../assets/occamylogo.jpg"

/* ===== OCCAMY COLOR TOKENS ===== */
const C = {
  bg: '#FDF8E1',
  navy: '#3E3E5C',
  teal: '#4A6D7C',
  green: '#7FB069',
  card: '#FFFFFF',
  border: '#D8D5C5',
  text: '#3E3E5C',
  muted: '#7A7490',
  inputBg: '#EAF1FF',
}

export default function Login() {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", password: "", role: "USER" });
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [resetStep, setResetStep] = useState(1)
  const [resetEmail, setResetEmail] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [resetLoading, setResetLoading] = useState(false)

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSocialLogin = async (providerName) => {
    if (isFirebaseConfigured && providerName === "Google") {
      setIsLoading(true)
      try {
        const result = await signInWithPopup(auth, googleProvider)
        const data = await api("/auth/mock-social-login", "POST", { email: result.user.email, provider: "Google" })
        completeLogin(data)
      } catch (err) {
        setIsLoading(false)
        if (err.code !== 'auth/popup-closed-by-user') openSimulationModal(providerName)
      }
      return
    }
    openSimulationModal(providerName)
  }

  const openSimulationModal = (provider) => { setSelectedProvider(provider); setShowSocialModal(true) }

  const confirmSocialLogin = async () => {
    setIsLoading(true); setShowSocialModal(false)
    try {
      await new Promise(r => setTimeout(r, 600))
      const data = await api("/auth/mock-social-login", "POST", { provider: selectedProvider })
      completeLogin(data)
    } catch (err) { setIsLoading(false); alert("Login failed: " + (err.error || err.message)) }
  }

  const completeLogin = (data) => {
    localStorage.setItem("token", data.token)
    localStorage.setItem("role", data.role)
    if (data.user) {
      localStorage.setItem("userId", data.user.id)
      localStorage.setItem("name", data.user.name)
    }
    setTimeout(() => {
      setIsLoading(false)
      if (data.role === "FIELD_OFFICER") navigate("/field-dashboard")
      else if (data.role === "ADMIN") navigate("/admin-dashboard")
      else navigate("/dashboard")
    }, 800)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsLoading(true)
    try {
      if (isSignup) {
        await api("/auth/signup", "POST", formData)
        setTimeout(() => { setIsLoading(false); alert("Account created! Please login."); setIsSignup(false); setFormData({ name: "", phone: "", email: "", password: "", role: "USER" }) }, 1500)
      } else {
        const data = await api("/auth/login", "POST", { email: formData.email, password: formData.password })
        completeLogin(data)
      }
    } catch (err) { setIsLoading(false); alert(err.error || "Authentication failed") }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setResetLoading(true)
    try {
      const res = await api("/auth/forgot-password", "POST", { email: resetEmail })
      if (res.demoToken) { setResetToken(res.demoToken); alert(`DEMO Token: ${res.demoToken}`) }
      setResetStep(2)
    } catch (err) { alert(err.error || "Failed to send reset link") }
    finally { setResetLoading(false) }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault(); setResetLoading(true)
    try {
      await api("/auth/reset-password", "POST", { email: resetEmail, token: resetToken, newPassword })
      alert("Password reset successful! Please login.")
      setShowForgotModal(false); setResetStep(1); setResetEmail(""); setResetToken(""); setNewPassword("")
    } catch (err) { alert(err.error || "Failed to reset password") }
    finally { setResetLoading(false) }
  }

  const inputStyle = {
    width: '100%', padding: '14px 44px',
    border: `1.5px solid ${C.border}`, borderRadius: '16px',
    outline: 'none', background: C.inputBg, color: C.navy,
    fontSize: '14px', fontFamily: 'Poppins, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }
  const onFocus = (e) => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 3px rgba(62,62,92,0.1)` }
  const onBlur = (e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none' }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Poppins', sans-serif", display: 'flex', overflowX: 'hidden', position: 'relative' }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;900&display=swap" rel="stylesheet" />

      {/* BACKGROUND WATERMARK (Restored to looking exactly like your original) */}
      <div style={{ position: 'fixed', bottom: '10%', left: '-2%', pointerEvents: 'none', zIndex: 0, opacity: 0.06 }}>
        <h1 style={{ fontSize: '160px', fontWeight: '900', color: C.navy, margin: 0, lineHeight: 0.8 }}>Occamy</h1>
        <h1 style={{ fontSize: '100px', fontWeight: '400', color: C.navy, margin: 0 }}>BioScience</h1>
      </div>

      {/* Background pattern */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.04, backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233E3E5C' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />

      {/* ===== LEFT PANEL (Restored 48% Split) ===== */}
      <div className="left-panel-wrap">
        <div style={{ padding: '20px 52px 40px', position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: '40px' }}>
            <img src={occamyLogo} alt="Occamy BioScience"
              style={{ height: '110px', width: 'auto', maxWidth: '260px', objectFit: 'contain', objectPosition: 'left center', display: 'block', mixBlendMode: 'multiply' }} />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: '800', color: C.navy, lineHeight: '1.2', margin: 0 }}>
              Economic, Social,<br />Health and<br />Environmental<br />Impact
            </h1>
          </div>

          {/* Official Content Request */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: C.green, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Chawanprash for Livestock
            </div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: C.teal, fontStyle: 'italic', marginTop: '4px' }}>
              Animal Healthy Nation Wealthy
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '28px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', border: `1px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield size={20} color={C.teal} /></div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: C.teal, lineHeight: 1 }}>5000+</div>
                <div style={{ fontSize: '12px', color: C.muted, fontWeight: '500', marginTop: '4px' }}>Farmers Benefited</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', border: `1px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={20} color={C.teal} /></div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: C.teal, lineHeight: 1 }}>15000+</div>
                <div style={{ fontSize: '12px', color: C.muted, fontWeight: '500', marginTop: '4px' }}>Animals' Health Improved</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '36px', maxWidth: '380px' }}>
            <p style={{ fontSize: '14px', color: C.muted, lineHeight: '1.75', margin: 0 }}>
              Occamy's interventions are designed to support <strong style={{ color: C.teal }}>One Health Objectives</strong> and here's the four dimensional impact we are able to achieve:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { icon: <Shield size={15} color={C.teal} />, label: 'Human Health & Nutrition' },
              { icon: <Globe size={15} color={C.green} />, label: 'Animal Health & Welfare' },
              { icon: <CheckCircle size={15} color={C.teal} />, label: 'Environmental Sustainability' },
              { icon: <CheckCircle size={15} color='#F5A623' />, label: 'Economic Empowerment' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: C.card, border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: C.navy }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL (Expanded Form) ===== */}
      <div className="right-panel-wrap">
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <img src={occamyLogo} alt="Occamy BioScience"
              style={{ height: '90px', width: 'auto', maxWidth: '220px', objectFit: 'contain', mixBlendMode: 'multiply', display: 'block' }} />
          </div>

          <div style={{ display: 'flex', gap: '6px', background: C.bg, borderRadius: '18px', padding: '6px', marginBottom: '26px', border: `1.5px solid ${C.border}` }}>
            {['Login', 'Sign Up'].map((t, i) => {
              const active = (i === 0) ? !isSignup : isSignup
              return (
                <button key={t} onClick={() => setIsSignup(i === 1)}
                  style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: '600', fontSize: '14px', transition: 'all 0.25s ease', background: active ? C.navy : 'transparent', color: active ? '#fff' : C.muted, boxShadow: active ? '0 2px 8px rgba(62,62,92,0.25)' : 'none' }}>
                  {t}
                </button>
              )
            })}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: C.navy, margin: '0 0 4px' }}>
              {isSignup ? 'Create Account' : 'Welcome Back 👋'}
            </h2>
            <p style={{ fontSize: '13px', color: C.muted, margin: 0 }}>
              {isSignup ? 'Join the Occamy field network today.' : 'Sign in to your Occamy dashboard.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isSignup && (
              <>
                <FieldInput icon={<User size={16} color={C.muted} />} type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
                <FieldInput icon={<Phone size={16} color={C.muted} />} type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </>
            )}
            <FieldInput icon={<Mail size={16} color={C.muted} />} type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleChange} required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />

            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Lock size={16} color={C.muted} /></div>
              <input type={showPassword ? 'text' : 'password'} name="password" placeholder="Password" value={formData.password} onChange={handleChange} required style={{ ...inputStyle, paddingRight: '44px' }} onFocus={onFocus} onBlur={onBlur} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {isSignup && (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><User size={16} color={C.muted} /></div>
                <select name="role" value={formData.role} onChange={handleChange} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                  <option value="USER">👤 Customer (Buy Products)</option>
                  <option value="FIELD_OFFICER">🚜 Field Officer</option>
                </select>
              </div>
            )}

            {!isSignup && (
              <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                <button type="button" onClick={() => setShowForgotModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: C.teal, fontFamily: 'Poppins, sans-serif', fontWeight: '500' }}>
                  Forgot Password?
                </button>
              </div>
            )}

            <button type="submit" disabled={isLoading}
              style={{ width: '100%', padding: '15px', border: 'none', borderRadius: '18px', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: '700', fontSize: '15px', color: '#fff', background: isLoading ? C.muted : C.navy, boxShadow: `0 5px 20px rgba(62,62,92,0.2)`, transition: 'all 0.25s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '4px', opacity: isLoading ? 0.75 : 1 }}>
              {isLoading ? 'Please wait...' : (isSignup ? 'Create Account' : 'Login to Dashboard')} <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <span style={{ fontSize: '12px', color: C.muted, fontWeight: '500' }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <SocialBtn label="Google" onClick={() => handleSocialLogin('Google')} icon={<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>} />
            <SocialBtn label="Microsoft" onClick={() => handleSocialLogin('Microsoft')} icon={<svg width="16" height="16" fill="#00A4EF" viewBox="0 0 24 24"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/></svg>} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '24px', borderTop: `1px solid ${C.border}`, paddingTop: '18px', width: '100%', maxWidth: '540px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.navy, letterSpacing: '0.5px', marginBottom: '10px' }}>Validations</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="badge">PCB Maharashtra</div>
                <div className="badge">#startupindia</div>
                <div className="badge">Make in India</div>
                <div className="badge dark">NDDB Services</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.navy, letterSpacing: '0.5px', marginBottom: '10px' }}>Available on</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="badge">Amazon</div>
                <div className="badge">IndiaMart</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS RENDERED AS BEFORE */}
      {showForgotModal && <ForgotModal C={C} onClose={() => setShowForgotModal(false)} resetStep={resetStep} resetEmail={resetEmail} setResetEmail={setResetEmail} resetToken={resetToken} setResetToken={setResetToken} newPassword={newPassword} setNewPassword={setNewPassword} handleForgotPassword={handleForgotPassword} handleResetPassword={handleResetPassword} resetLoading={resetLoading} onFocus={onFocus} onBlur={onBlur} inputStyle={inputStyle} />}
      {showSocialModal && <SocialModal C={C} provider={selectedProvider} onClose={() => setShowSocialModal(false)} onConfirm={confirmSocialLogin} />}

      <style>{`
        * { box-sizing: border-box; }
        .left-panel-wrap {
          flex: 0 0 48%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .right-panel-wrap {
          flex: 0 0 52%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 40px;
          overflow-y: auto;
        }

        .form-card {
          background: #FFFFFF;
          border-radius: 36px;
          padding: 32px 45px; /* Increased side padding for "expanded" look */
          box-shadow: 0 14px 60px rgba(62,62,92,0.16);
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 540px; /* Restored to a balanced expanded width */
        }

        .badge { font-size: 9px; padding: 4px 8px; background: #fff; border: 1px solid #D8D5C5; border-radius: 6px; font-weight: 600; color: #7A7490; }
        .badge.dark { background: #7B1818; color: #fff; border: none; }

        @media (max-width: 900px) {
          .left-panel-wrap { display: none; }
          .right-panel-wrap { flex: 0 0 100%; }
          .form-card { max-width: 100%; padding: 30px 20px; }
        }
      `}</style>
    </div>
  )
}

function SocialBtn({ label, icon, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '13px', border: `1.5px solid ${C.border}`, borderRadius: '16px', background: C.card, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: '500', fontSize: '13px', color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
      {icon} {label}
    </button>
  )
}

function FieldInput({ icon, style, onFocus, onBlur, ...props }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{icon}</div>
      <input {...props} style={style} onFocus={onFocus} onBlur={onBlur} />
    </div>
  )
}

/* Modals same as before */
function ForgotModal({ C, onClose, resetStep, handleForgotPassword, handleResetPassword, resetEmail, setResetEmail, resetToken, setResetToken, newPassword, setNewPassword, resetLoading, inputStyle, onFocus, onBlur }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '400px' }}>
        <h3 style={{ margin: '0 0 15px', color: C.navy }}>Reset Password</h3>
        {resetStep === 1 ? (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="email" placeholder="Email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            <button type="submit" disabled={resetLoading} style={{ padding: '12px', borderRadius: '12px', border: 'none', background: C.navy, color: '#fff', fontWeight: '700' }}>Send Link</button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="text" placeholder="Token" value={resetToken} onChange={e => setResetToken(e.target.value)} required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            <button type="submit" disabled={resetLoading} style={{ padding: '12px', borderRadius: '12px', border: 'none', background: C.navy, color: '#fff', fontWeight: '700' }}>Update</button>
          </form>
        )}
        <button onClick={onClose} style={{ marginTop: '10px', width: '100%', background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}

function SocialModal({ C, provider, onClose, onConfirm }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '340px', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 10px', color: C.navy }}>Continue with {provider}</h3>
        <button onClick={onConfirm} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: C.navy, color: '#fff', fontWeight: '700', cursor: 'pointer' }}>Confirm</button>
        <button onClick={onClose} style={{ marginTop: '10px', background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}