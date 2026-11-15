// Ilustrasi tumpukan buku dan buku terbuka (gambar vektor buatan sendiri, tanpa foto dari internet)
export default function IlustrasiBuku({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 240" className={className} role="img" aria-label="Ilustrasi tumpukan buku">
      <defs>
        <linearGradient id="hal-kiri" x1="0" x2="1">
          <stop offset="0" stopColor="#fffaf2" />
          <stop offset="1" stopColor="#efe2cc" />
        </linearGradient>
        <linearGradient id="hal-kanan" x1="1" x2="0">
          <stop offset="0" stopColor="#fffaf2" />
          <stop offset="1" stopColor="#efe2cc" />
        </linearGradient>
      </defs>
      {/* bayangan */}
      <ellipse cx="160" cy="222" rx="118" ry="10" fill="#000" opacity="0.12" />
      {/* tumpukan buku */}
      <rect x="62" y="186" width="196" height="30" rx="5" fill="#6c431f" />
      <rect x="62" y="186" width="196" height="6" rx="3" fill="#57371c" />
      <rect x="70" y="194" width="180" height="16" rx="2" fill="#fbf6ee" />
      <rect x="78" y="156" width="170" height="30" rx="5" fill="#2f5d50" />
      <rect x="86" y="164" width="154" height="16" rx="2" fill="#fbf6ee" />
      <rect x="196" y="156" width="10" height="30" fill="#d9b26b" />
      <rect x="70" y="128" width="182" height="28" rx="5" fill="#b97b34" />
      <rect x="78" y="135" width="166" height="14" rx="2" fill="#fbf6ee" />
      <rect x="100" y="128" width="8" height="28" fill="#875424" />
      {/* buku terbuka */}
      <path d="M160 120 C 132 98, 96 96, 66 104 L 66 34 C 96 26, 132 28, 160 50 Z" fill="url(#hal-kiri)" stroke="#d8c3a2" strokeWidth="1.5" />
      <path d="M160 120 C 188 98, 224 96, 254 104 L 254 34 C 224 26, 188 28, 160 50 Z" fill="url(#hal-kanan)" stroke="#d8c3a2" strokeWidth="1.5" />
      <path d="M160 50 L 160 120" stroke="#c7ad86" strokeWidth="2" />
      <path d="M58 108 C 92 98, 130 100, 160 124 C 190 100, 228 98, 262 108 L 262 116 C 228 106, 190 108, 160 130 C 130 108, 92 106, 58 116 Z" fill="#875424" />
      {/* baris tulisan */}
      <g stroke="#d6c3a5" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M84 50 C 104 46, 124 48, 142 58" />
        <path d="M84 62 C 104 58, 124 60, 142 70" />
        <path d="M84 74 C 104 70, 124 72, 142 82" />
        <path d="M84 86 C 100 83, 112 84, 124 88" />
        <path d="M178 58 C 196 48, 216 46, 236 50" />
        <path d="M178 70 C 196 60, 216 58, 236 62" />
        <path d="M178 82 C 196 72, 216 70, 236 74" />
        <path d="M196 88 C 208 84, 220 83, 236 86" />
      </g>
      {/* daun kecil */}
      <path d="M268 186 C 286 160, 300 150, 304 128 C 290 140, 274 152, 268 186 Z" fill="#2f5d50" opacity="0.85" />
      <path d="M268 186 C 262 164, 266 148, 280 134" stroke="#2f5d50" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  )
}
