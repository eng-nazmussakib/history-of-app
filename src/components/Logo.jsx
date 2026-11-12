export default function Logo() {
  return (
    <a className="logo" href="/" aria-label="History Of, home">
      <svg className="logo__mark" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="23" fill="#3b3631" />
        <circle cx="24" cy="24" r="19" fill="none" stroke="#e07b26" strokeWidth="1.5" />
        <line x1="24" y1="11" x2="24" y2="37" stroke="#b5aea1" strokeWidth="2" strokeDasharray="3 2.5" />
        <circle cx="24" cy="16" r="3" fill="#e07b26" />
        <circle cx="24" cy="24" r="3" fill="#f4efe4" />
        <circle cx="24" cy="32" r="3" fill="#e07b26" />
        <rect x="28" y="14.5" width="8" height="3" rx="1" fill="#d5d1c6" />
        <rect x="12" y="22.5" width="8" height="3" rx="1" fill="#d5d1c6" />
        <rect x="28" y="30.5" width="8" height="3" rx="1" fill="#d5d1c6" />
      </svg>
      <span className="logo__word">
        History <span className="logo__of">Of</span>
      </span>
    </a>
  );
}
