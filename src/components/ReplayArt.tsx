import { useId } from "react";

/** Decorative SVGs stay crisp at every size and never intercept controls. */
export function ReplayArt({ variant = 0 }: { variant?: number }) {
  const id = useId().replace(/:/g, "");
  const colors = [
    ["#ff643f", "#ffdf69", "#e93aae", "#7134f5"],
    ["#ffb446", "#ff4b8e", "#a236ff", "#ffe577"],
    ["#622afa", "#df51db", "#ffda75", "#fa4171"],
    ["#ff603d", "#ffdd62", "#a546ef", "#ed3597"],
    ["#f74691", "#ffb755", "#ffe57f", "#7835f0"],
    ["#7534ed", "#ed3bba", "#ff714c", "#ffd76b"],
  ][variant % 6];
  const outline = Array.from({ length: 240 }, (_, i) => {
    const angle = (i / 240) * Math.PI * 2;
    const radius = 153 + 20 * Math.cos(angle * (variant % 2 ? 7 : 8));
    return `${i ? "L" : "M"}${(200 + Math.cos(angle) * radius).toFixed(2)},${(200 + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ") + " Z M 200,88 A 112,112 0 1,0 200,312 A 112,112 0 1,0 200,88 Z";
  const star = Array.from({ length: 24 }, (_, i) => {
    const angle = i * Math.PI / 12;
    const radius = i % 2 ? 28 : 80;
    return `${90 + Math.cos(angle) * radius},${90 + Math.sin(angle) * radius}`;
  }).join(" ");

  return (
    <div className={`replay-art replay-art-${variant}`} aria-hidden="true">
      <svg className="replay-flower" viewBox="0 0 400 400" focusable="false">
        <defs>
          <linearGradient id={`${id}-flower`} x1="0" y1="0" x2="1" y2="1">
            {colors.map((color, index) => <stop key={index} offset={`${index * 100 / 3}%`} stopColor={color} />)}
          </linearGradient>
        </defs>
        <path d={outline} fill={`url(#${id}-flower)`} fillRule="evenodd" />
      </svg>
      <svg className="replay-ribbon" viewBox="0 0 520 220" fill="none" focusable="false">
        <defs>
          <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor={colors[3]} />
            <stop offset=".35" stopColor={colors[2]} />
            <stop offset=".62" stopColor={colors[0]} />
            <stop offset=".85" stopColor={colors[1]} />
            <stop offset="1" stopColor={colors[0]} />
          </linearGradient>
        </defs>
        <path d="M-40 135 C40 -70 145 270 245 105 S390 20 560 115" stroke={`url(#${id}-ribbon)`} strokeWidth="46" strokeLinecap="round" />
      </svg>
      <svg className="replay-burst" viewBox="0 0 180 180" focusable="false">
        <polygon points={star} fill={colors[3]} />
      </svg>
    </div>
  );
}
