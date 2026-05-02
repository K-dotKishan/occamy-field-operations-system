/**
 * Occamy Bioscience — Official Corporate Color Palette
 * Single source of truth for all brand colors.
 * Use these tokens in both JS (inline styles / className helpers)
 * and reference the matching CSS variables defined in index.css.
 */
export const C = {
  /** Page background — warm cream */
  bg: '#FDF8E1',
  /** Primary brand navy — headings, navbar */
  navy: '#3E3E5C',
  /** Secondary teal — accents, links */
  teal: '#4A6D7C',
  /** Brand green — CTAs, success states */
  green: '#7FB069',
  /** Card / surface white */
  card: '#FFFFFF',
  /** Subtle border */
  border: '#D8D5C5',
  /** Body text */
  text: '#3E3E5C',
  /** Muted / placeholder text */
  muted: '#7A7490',
  /** Input background */
  inputBg: '#EAF1FF',
}

/**
 * Tailwind-compatible gradient strings built from the palette.
 * Use with template literals: `bg-gradient-to-r ${G.navbarBg}`
 */
export const G = {
  /** Navbar gradient — navy → teal */
  navbarBg: 'from-[#3E3E5C] via-[#4A6D7C] to-[#3E3E5C]',
  /** Primary button / CTA */
  primaryBtn: 'from-[#7FB069] to-[#4A6D7C]',
  /** Page background gradient */
  pageBg: 'from-[#FDF8E1] via-[#F5F0D0] to-[#EAF1FF]',
}
