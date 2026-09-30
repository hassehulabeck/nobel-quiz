/** Decorative gold medal with laurel sprigs. No text; hidden from assistive tech. */
export function NobelMedal({ className }: { className?: string }) {
  const leaves = [0, 1, 2, 3, 4, 5];
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {[-1, 1].map((side) => (
        <g key={side} transform={`translate(100 104) scale(${side} 1)`}>
          <path
            d="M-2 78 C-50 70 -84 34 -80 -20"
            fill="none"
            stroke="#6f9a5a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {leaves.map((i) => {
            const t = i / 5;
            const x = -2 - 78 * Math.sin(t * 1.25) * 0.98;
            const y = 78 - 98 * t;
            return (
              <ellipse
                key={i}
                cx={x - 6}
                cy={y}
                rx="13"
                ry="5.5"
                fill={i % 2 ? "#8db872" : "#6f9a5a"}
                transform={`rotate(${-35 - i * 8} ${x - 6} ${y})`}
              />
            );
          })}
        </g>
      ))}
      <circle cx="100" cy="100" r="58" fill="#f2b632" />
      <circle cx="100" cy="100" r="58" fill="none" stroke="#c98a10" strokeWidth="4" />
      <circle cx="100" cy="100" r="47" fill="#f8d36a" />
      <circle cx="100" cy="100" r="47" fill="none" stroke="#c98a10" strokeWidth="1.5" />
      {/* Stylised profile bust */}
      <path
        d="M84 130 C84 112 90 106 92 98 C88 96 87 90 89 84 C91 74 100 70 108 74 C115 78 116 88 113 93 L117 99 L112 101 C113 108 111 114 114 130 Z"
        fill="#c98a10"
      />
      <path d="M78 130 H122" stroke="#c98a10" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
