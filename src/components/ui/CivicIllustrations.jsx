/**
 * Custom domain-crafted SVG illustrations in the FixGrid AI palette
 * (#245B45 Forest, #7DBE9E Sage, #D5EBDD Mint, #F07832 Orange, #FAF8EE Ivory)
 */

export function CivicBrandMark({ className = 'w-7 h-7' }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <rect width="36" height="36" rx="9" fill="#245B45" />
      <path
        d="M10 12.5H26M10 18.5H20M10 24.5H16"
        stroke="#D5EBDD"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="24.5" cy="22.5" r="4.5" fill="#F07832" />
      <circle cx="24.5" cy="22.5" r="1.8" fill="#FAF8EE" />
    </svg>
  );
}

export function MunicipalOpsIllustration({ className = 'w-full h-36' }) {
  return (
    <svg viewBox="0 0 340 140" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="332" height="132" rx="14" fill="#F5F1DC" stroke="#245B45" strokeOpacity="0.14" />
      {/* Subtle blueprint grid lines */}
      <path d="M24 34H316M24 70H316M24 106H316" stroke="#245B45" strokeOpacity="0.08" strokeDasharray="4 4" />
      {/* Municipal city hall silhouette */}
      <rect x="34" y="48" width="66" height="58" rx="6" fill="#D5EBDD" stroke="#245B45" strokeWidth="1.5" />
      <path d="M28 48L67 26L106 48H28Z" fill="#245B45" />
      <rect x="47" y="64" width="12" height="16" rx="2" fill="#FAF8EE" />
      <rect x="75" y="64" width="12" height="16" rx="2" fill="#FAF8EE" />
      <rect x="60" y="86" width="14" height="20" rx="2" fill="#245B45" />
      {/* Routing arrow & AI verification node */}
      <path d="M114 77H164" stroke="#F07832" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="4 4" />
      <circle cx="186" cy="77" r="20" fill="#FAF8EE" stroke="#245B45" strokeWidth="1.8" />
      <path d="M178 77L184 83L195 71" stroke="#F07832" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* SLA clock & dispatched crew */}
      <path d="M210 77H244" stroke="#245B45" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="248" y="46" width="62" height="60" rx="10" fill="#245B45" />
      <circle cx="279" cy="69" r="13" fill="#D5EBDD" />
      <path d="M279 62V69L284 72" stroke="#1A4332" strokeWidth="2" strokeLinecap="round" />
      <rect x="262" y="89" width="34" height="6" rx="3" fill="#7DBE9E" />
    </svg>
  );
}

export function InnovationEcosystemIllustration({ className = 'w-full h-36' }) {
  return (
    <svg viewBox="0 0 340 140" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="332" height="132" rx="14" fill="#FAF8EE" stroke="#245B45" strokeOpacity="0.14" />
      <circle cx="94" cy="70" r="42" fill="#D5EBDD" fillOpacity="0.7" />
      <circle cx="246" cy="70" r="42" fill="#DCEBF3" fillOpacity="0.8" />
      {/* Connected student nodes */}
      <circle cx="66" cy="64" r="14" fill="#245B45" />
      <circle cx="66" cy="61" r="5" fill="#FAF8EE" />
      <path d="M58 72C60 69 72 69 74 72" stroke="#FAF8EE" strokeWidth="2" strokeLinecap="round" />
      <circle cx="116" cy="54" r="13" fill="#F07832" />
      <circle cx="116" cy="51" r="4.5" fill="#FAF8EE" />
      <circle cx="108" cy="92" r="13" fill="#7DBE9E" />
      <circle cx="108" cy="89" r="4.5" fill="#1A4332" />
      {/* Bridge lines */}
      <path d="M132 58L192 70L124 90" stroke="#245B45" strokeWidth="1.8" strokeDasharray="3 3" />
      {/* Prototype board + Faculty seal */}
      <rect x="192" y="44" width="112" height="54" rx="10" fill="#FFFFFF" stroke="#245B45" strokeWidth="1.6" />
      <rect x="204" y="56" width="38" height="8" rx="3" fill="#D5EBDD" />
      <rect x="204" y="70" width="54" height="6" rx="3" fill="#DCEBF3" />
      <rect x="204" y="81" width="30" height="6" rx="3" fill="#F07832" fillOpacity="0.85" />
      <circle cx="280" cy="71" r="14" fill="#F07832" />
      <path d="M275 71L279 75L286 67" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PassportEmblemSvg({ className = 'w-14 h-14' }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="#245B45" stroke="#7DBE9E" strokeWidth="2" />
      <circle cx="32" cy="32" r="23" stroke="#D5EBDD" strokeOpacity="0.45" strokeDasharray="3 3" />
      <path
        d="M32 16L43 21V31C43 38.5 38.3 45.2 32 48C25.7 45.2 21 38.5 21 31V21L32 16Z"
        fill="#FAF8EE"
      />
      <path
        d="M27.5 31.5L30.8 34.8L37 28.2"
        stroke="#F07832"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyCanvasIllustration({ className = 'w-24 h-20' }) {
  return (
    <svg viewBox="0 0 120 90" fill="none" className={className} aria-hidden="true">
      <rect x="12" y="14" width="96" height="62" rx="10" fill="#D5EBDD" fillOpacity="0.55" stroke="#245B45" strokeOpacity="0.25" />
      <rect x="24" y="28" width="44" height="8" rx="4" fill="#245B45" fillOpacity="0.25" />
      <rect x="24" y="42" width="68" height="6" rx="3" fill="#245B45" fillOpacity="0.16" />
      <rect x="24" y="54" width="52" height="6" rx="3" fill="#245B45" fillOpacity="0.16" />
      <circle cx="88" cy="28" r="10" fill="#F07832" fillOpacity="0.85" />
      <path d="M84 28H92M88 24V32" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
