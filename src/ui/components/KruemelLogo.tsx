interface KruemelLogoProps {
  /** Whether the Krümel waves and blinks; `false` for the switch "Krümel bewegt sich". */
  readonly moving: boolean;
}

/**
 * The Krümel of the app icon in the header (E2-4c), as decoration only: hidden from screen readers,
 * the name "Krümel" next to it stays text. At the start it tilts and sweeps once, then it blinks
 * about every nine seconds. Moved by CSS only (`app.css`, `.kruemel-logo`), still with
 * `prefers-reduced-motion` and with `moving = false`. The drawing follows `public/icon.svg`.
 */
export function KruemelLogo({ moving }: KruemelLogoProps) {
  return (
    <svg
      class={`kruemel-logo${moving ? "" : " kruemel-logo--still"}`}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="512" height="512" rx="112" fill="#5530D9" />
      <circle cx="240" cy="270" r="185" fill="#6A4DF4" />
      <g class="kruemel-logo__broom">
        <path d="M446 96 L386 318" stroke="#15131F" stroke-width="26" stroke-linecap="round" />
        <path d="M446 96 L386 318" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" />
        <path
          d="M336 300 L428 324 L414 432 L310 404 Z"
          fill="#FFD166"
          stroke="#15131F"
          stroke-width="9"
          stroke-linejoin="round"
        />
        <path d="M338 300 L426 324" stroke="#15131F" stroke-width="16" stroke-linecap="round" />
        <path
          d="M350 340 L336 404 M374 346 L362 412 M398 352 L388 418"
          stroke="#15131F"
          stroke-width="6"
          stroke-linecap="round"
        />
      </g>
      <g class="kruemel-logo__figure">
        <g transform="translate(-24 0)">
          <path
            d="M150 250 C140 190 190 150 245 158 C280 135 340 150 360 195 C400 210 410 265 385 300 C395 350 350 395 300 392 C270 415 215 410 190 385 C140 380 118 330 140 300 C120 285 128 260 150 250 Z"
            fill="#F2B661"
          />
          <circle cx="200" cy="225" r="6" fill="#C98A3A" />
          <circle cx="332" cy="232" r="5" fill="#C98A3A" />
          <circle cx="305" cy="358" r="6" fill="#C98A3A" />
          <circle cx="182" cy="338" r="5" fill="#C98A3A" />
          <circle cx="256" cy="190" r="4" fill="#C98A3A" />
          <ellipse cx="225" cy="268" rx="22" ry="26" fill="#FFFFFF" />
          <ellipse cx="290" cy="268" rx="22" ry="26" fill="#FFFFFF" />
          <circle cx="229" cy="273" r="12" fill="#15131F" />
          <circle cx="294" cy="273" r="12" fill="#15131F" />
          <circle cx="233" cy="268" r="4" fill="#FFFFFF" />
          <circle cx="298" cy="268" r="4" fill="#FFFFFF" />
          {/* The eyelids: as high as the eyes, closed for a moment by the blink. */}
          <ellipse class="kruemel-logo__lid" cx="225" cy="268" rx="23" ry="27" fill="#F2B661" />
          <ellipse class="kruemel-logo__lid" cx="290" cy="268" rx="23" ry="27" fill="#F2B661" />
          <ellipse cx="198" cy="308" rx="15" ry="9" fill="#F28B6B" opacity="0.65" />
          <ellipse cx="320" cy="308" rx="15" ry="9" fill="#F28B6B" opacity="0.65" />
          <path
            d="M234 316 Q258 340 282 316"
            stroke="#15131F"
            stroke-width="8"
            stroke-linecap="round"
            fill="none"
          />
        </g>
      </g>
    </svg>
  );
}
