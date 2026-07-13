import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

export default function LanguageToggle() {
  const { i18n } = useTranslation()
  const location = useLocation()
  const isHindi = i18n.language?.startsWith('hi')

  // Login page → dark button on light background
  // Field dashboard → dark button on light background
  // All other pages (distributor, admin, etc.) → light button on dark navbar
  const isLoginPage = location.pathname === '/login'
  const isFieldPage = location.pathname === '/field-dashboard'
  const useDarkStyle = isLoginPage || isFieldPage

  const style = useDarkStyle
    ? {
        background: '#3E3E5C',
        border: '1.5px solid #3E3E5C',
        borderRadius: '8px',
        padding: '6px 14px',
        cursor: 'pointer',
        color: '#fff',
        fontFamily: 'Poppins, sans-serif',
        fontWeight: 700,
        fontSize: '13px',
        letterSpacing: '0.5px',
        lineHeight: 1.4,
        boxShadow: '0 2px 8px rgba(62,62,92,0.25)',
        transition: 'background 0.2s',
      }
    : {
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.35)',
        borderRadius: '8px',
        padding: '5px 11px',
        cursor: 'pointer',
        color: '#fff',
        fontFamily: 'Poppins, sans-serif',
        fontWeight: 700,
        fontSize: '13px',
        letterSpacing: '0.3px',
        lineHeight: 1.4,
        transition: 'background 0.2s',
        flexShrink: 0,
      }

  return (
    <button
      onClick={() => i18n.changeLanguage(isHindi ? 'en' : 'hi')}
      title={isHindi ? 'Switch to English' : 'हिंदी में बदलें'}
      style={style}
    >
      {isHindi ? 'EN' : 'हि'}
    </button>
  )
}
