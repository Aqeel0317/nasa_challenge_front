// Animated illustration of a Punjab farm morning, drawn in SVG and animated with CSS.
// Everything here is original artwork: a farmer walking to the field with a kassi
// (spade), a woman picking cotton, an elder on a charpai checking his phone, a
// buffalo grazing, a tube-well filling the channel, a tractor in the far field,
// a brick-kiln chimney and the village beyond. Motion stops for reduced-motion users.

const WHEAT = Array.from({ length: 46 }, (_, i) => ({
  x: 8 + i * 8.4 + ((i * 37) % 7),
  h: 58 + ((i * 53) % 22),
  d: ((i * 0.37) % 2.4).toFixed(2),
}));
const COTTON = [
  [835, 512], [880, 528], [930, 515], [985, 532], [1040, 512], [1095, 530], [1150, 514], [1185, 534],
];
const FAR_TREES = [30, 95, 380, 455, 520, 600, 690, 760, 850, 920, 1105, 1170];

export default function FarmScene({ label }) {
  return (
    <svg className="farm-scene" viewBox="0 0 1200 600" role="img" aria-label={label}
         preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bcdcef" />
          <stop offset="0.75" stopColor="#f3e6c4" />
        </linearGradient>
        <radialGradient id="sunGlow">
          <stop offset="0" stopColor="#ffe08a" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffe08a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="paddy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb8a4" />
          <stop offset="1" stopColor="#5f9f7e" />
        </linearGradient>
        <pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#d9b779" />
          <path d="M0 3H6M3 0V6" stroke="#b48d4c" strokeWidth="1.2" />
        </pattern>
      </defs>

      {/* sky, sun, clouds, birds */}
      <rect width="1200" height="600" fill="url(#sky)" />
      <circle cx="930" cy="150" r="130" fill="url(#sunGlow)" className="sun-glow" />
      <circle cx="930" cy="150" r="50" fill="#f8c94d" />
      <g className="cloud cloud-a" fill="#fff" opacity=".9">
        <ellipse cx="180" cy="95" rx="60" ry="18" /><ellipse cx="215" cy="82" rx="38" ry="20" /><ellipse cx="150" cy="86" rx="30" ry="15" />
      </g>
      <g className="cloud cloud-b" fill="#fff" opacity=".75">
        <ellipse cx="620" cy="140" rx="48" ry="14" /><ellipse cx="648" cy="130" rx="30" ry="15" />
      </g>
      <g className="birds" fill="none" stroke="#3d4a40" strokeWidth="2.2" strokeLinecap="round">
        <g transform="translate(300 170)"><path className="bird" d="M0 0q7 -7 14 0q7 -7 14 0" /></g>
        <g transform="translate(335 185)"><path className="bird b2" d="M0 0q6 -6 12 0q6 -6 12 0" /></g>
        <g transform="translate(320 200)"><path className="bird b3" d="M0 0q5 -5 10 0q5 -5 10 0" /></g>
      </g>

      {/* village on the horizon: flat-roofed houses, a small mosque, a kiln chimney */}
      <g className="village">
        <rect x="150" y="262" width="46" height="38" fill="#c89c6e" />
        <rect x="196" y="270" width="38" height="30" fill="#d8b183" />
        <rect x="236" y="258" width="52" height="42" fill="#c3936a" />
        <rect x="290" y="268" width="34" height="32" fill="#d6ae80" />
        <path d="M250 258a14 14 0 0 1 28 0Z" fill="#efe8d8" />
        <rect x="282" y="226" width="6" height="40" fill="#efe8d8" />
        <path d="M280 228h10l-5-10Z" fill="#efe8d8" />
      </g>
      <g className="kiln">
        <path d="M1040 300l6 -95h14l6 95Z" fill="#9b4f35" />
        <circle className="smoke s1" cx="1053" cy="196" r="9" fill="#d9d4cc" />
        <circle className="smoke s2" cx="1053" cy="196" r="12" fill="#e2ddd6" />
        <circle className="smoke s3" cx="1053" cy="196" r="10" fill="#d9d4cc" />
      </g>
      {FAR_TREES.map((x, i) => (
        <g key={x} transform={`translate(${x} 300)`}>
          <rect x="-2" y="-16" width="4" height="16" fill="#6b5236" />
          <ellipse cx="0" cy={-26 - (i % 3) * 3} rx={16 + (i % 2) * 6} ry={14 + (i % 3) * 2} fill={i % 2 ? "#5d7f4a" : "#6f8f52"} />
        </g>
      ))}

      {/* far fields: mustard in flower and green fields */}
      <path d="M0 300H520L470 360H0Z" fill="#e8c63e" />
      <path d="M0 312H500M0 326H488M0 340H478M0 352H470" stroke="#d4ab25" strokeWidth="2" />
      <path d="M520 300H1200V360H470Z" fill="#8ab456" />
      <path d="M515 312H1200M505 326H1200M495 340H1200" stroke="#78a046" strokeWidth="2" />

      {/* tractor crossing the far field */}
      <g className="tractor">
        <g transform="translate(0 322) scale(.62)">
          <rect x="18" y="8" width="58" height="22" rx="4" fill="#c8402e" />
          <rect x="56" y="-14" width="22" height="24" rx="2" fill="#c8402e" />
          <rect x="60" y="-10" width="14" height="12" fill="#bfe0f0" />
          <rect x="22" y="-4" width="5" height="14" fill="#4a4a4a" />
          <g className="wheel-spin" style={{ transformOrigin: "70px 34px" }}>
            <circle cx="70" cy="34" r="17" fill="#2e2e2e" /><circle cx="70" cy="34" r="7" fill="#d9a43a" />
            <path d="M70 17V51M53 34H87" stroke="#555" strokeWidth="3" />
          </g>
          <circle cx="26" cy="38" r="10" fill="#2e2e2e" /><circle cx="26" cy="38" r="4" fill="#d9a43a" />
          <circle className="dust" cx="-6" cy="44" r="6" fill="#d9c49a" />
        </g>
      </g>

      {/* paddy field with standing water, and the tube-well */}
      <path d="M470 360H1200V440H420Z" fill="url(#paddy)" />
      <g className="shimmer" stroke="#cfeee4" strokeWidth="2" strokeLinecap="round" opacity=".7">
        <path d="M560 380h40M700 395h55M880 378h45M1020 405h60M640 420h40M940 425h50" />
      </g>
      <g className="paddy-rows" stroke="#3f8a55" strokeWidth="3" strokeLinecap="round">
        {Array.from({ length: 30 }, (_, i) => (
          <path key={i} d={`M${505 + i * 23} 372v-8M${492 + i * 24} 392v-9M${480 + i * 25} 414v-10M${468 + i * 26} 434v-10`} />
        ))}
      </g>
      <g className="tubewell">
        <rect x="770" y="388" width="56" height="40" fill="#b8673f" />
        <path d="M766 390l32 -18 32 18Z" fill="#8f4a2e" />
        <rect x="787" y="402" width="14" height="26" fill="#5a3a26" />
        <rect x="826" y="410" width="22" height="7" fill="#7b7f84" />
        <path className="water-jet" d="M848 413q14 4 18 22" stroke="#7cc3e6" strokeWidth="7" fill="none" strokeLinecap="round" />
      </g>
      <path d="M862 438C900 470 980 480 1200 470V490C980 500 890 492 846 446Z" fill="#6fb3d6" />
      <path className="flow" d="M870 448C920 478 1000 484 1200 480" stroke="#d6f0fb" strokeWidth="3" fill="none" strokeDasharray="14 18" />

      {/* foreground earth */}
      <path d="M0 360H470L420 440H0Z" fill="#a7c96b" />
      <path d="M0 440H1200V600H0Z" fill="#c9a874" />
      <path d="M0 540H1200V600H0Z" fill="#b8925d" />

      {/* wheat field, swaying */}
      <g className="wheat">
        {WHEAT.map((w, i) => (
          <g key={i} transform={`translate(${w.x} 525)`}>
            <g className="stalk" style={{ animationDelay: `-${w.d}s` }}>
              <path d={`M0 0V-${w.h}`} stroke="#c49a3a" strokeWidth="2.2" />
              <ellipse cx="0" cy={-w.h - 8} rx="4.2" ry="11" fill="#e2b84a" />
              <path d={`M-3 -${w.h + 14}l-4 -10M3 -${w.h + 14}l4 -10`} stroke="#e2b84a" strokeWidth="1.4" />
            </g>
          </g>
        ))}
      </g>

      {/* sheesham tree with a charpai and an elder checking his phone */}
      <g className="tree">
        <rect x="628" y="380" width="16" height="100" fill="#6b4a30" />
        <g className="canopy">
          <ellipse cx="636" cy="370" rx="88" ry="52" fill="#4f7a3f" />
          <ellipse cx="590" cy="388" rx="46" ry="30" fill="#5d8a48" />
          <ellipse cx="690" cy="384" rx="50" ry="30" fill="#5d8a48" />
        </g>
      </g>
      <g className="charpai">
        <rect x="560" y="478" width="150" height="14" rx="2" fill="url(#weave)" stroke="#7a5230" strokeWidth="4" />
        <rect x="562" y="490" width="6" height="26" fill="#7a5230" /><rect x="702" y="490" width="6" height="26" fill="#7a5230" />
      </g>
      <g className="elder">
        <path d="M612 478v-34q0-12 14-12h12q14 0 14 12v34Z" fill="#f2efe6" />
        <path d="M640 478h36q6 0 6 6v22h-10v-16h-32Z" fill="#e6e2d6" />
        <circle cx="632" cy="418" r="12" fill="#a8774f" />
        <path d="M620 414q12 -16 26 -2q-2 -14 -14 -14q-12 0 -12 16Z" fill="#fbf8f0" />
        <path d="M622 412q11 -8 22 0" stroke="#e5ded0" strokeWidth="3" fill="none" />
        <path d="M624 424q8 12 16 0" fill="#d9d4ca" />
        <path d="M650 450l14 -16" stroke="#a8774f" strokeWidth="7" strokeLinecap="round" />
        <rect x="660" y="420" width="12" height="20" rx="2" fill="#2d3a33" transform="rotate(20 666 430)" />
        <rect className="phone-glow" x="662" y="422" width="8" height="15" rx="1" fill="#8fe3a8" transform="rotate(20 666 430)" />
      </g>

      {/* buffalo grazing */}
      <g className="buffalo">
        <rect x="430" y="490" width="7" height="34" fill="#2b2b2b" /><rect x="448" y="492" width="7" height="34" fill="#2b2b2b" />
        <rect x="502" y="490" width="7" height="34" fill="#2b2b2b" /><rect x="518" y="492" width="7" height="34" fill="#2b2b2b" />
        <ellipse cx="478" cy="482" rx="56" ry="27" fill="#353535" />
        <path className="tail" d="M534 474q12 10 6 34" stroke="#2b2b2b" strokeWidth="4" fill="none" strokeLinecap="round" />
        <g className="buffalo-head">
          <ellipse cx="418" cy="500" rx="17" ry="13" fill="#3d3d3d" />
          <path d="M412 488q-14 -10 -22 2M424 488q12 -12 22 -2" stroke="#8a8174" strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <circle cx="410" cy="502" r="2" fill="#bbb" />
        </g>
      </g>

      {/* cotton bushes and a woman picking cotton */}
      <g className="cotton">
        {COTTON.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <ellipse cx="0" cy="0" rx="26" ry="20" fill="#4b7f3d" />
            <circle cx="-10" cy="-8" r="5" fill="#fff" /><circle cx="9" cy="-12" r="5" fill="#fff" />
            <circle cx="14" cy="4" r="4.5" fill="#fff" /><circle cx="-4" cy="6" r="4" fill="#fff" />
          </g>
        ))}
      </g>
      <g className="picker" transform="translate(1012 535)">
        <path d="M-11 0v-38h22v38Z" fill="#f3c94a" />
        <path d="M-20 -36q20 6 40 0l-6 -46h-28Z" fill="#c8384f" />
        <g className="picking-arm" style={{ transformOrigin: "-12px -76px" }}>
          <path d="M-12 -76l-30 22" stroke="#a8774f" strokeWidth="7" strokeLinecap="round" />
        </g>
        <path d="M10 -74l12 30" stroke="#a8774f" strokeWidth="7" strokeLinecap="round" />
        <path d="M-4 -42q30 -6 30 12q-14 10 -30 2Z" fill="#f2efe6" />
        <circle cx="12" cy="-38" r="4" fill="#fff" /><circle cx="4" cy="-34" r="4" fill="#fff" />
        <circle cx="0" cy="-94" r="12" fill="#a8774f" />
        <path className="dupatta" d="M-14 -96q14 -22 30 -2q14 20 22 50q-14 -4 -22 -24q-4 -14 -14 -14q-10 2 -16 -10Z" fill="#2f8f7a" />
      </g>

      {/* farm track and a farmer walking with a kassi on his shoulder */}
      <path d="M0 548H1200" stroke="#a88352" strokeWidth="3" strokeDasharray="2 14" />
      <g className="walker">
        <g transform="translate(0 575)"><g className="walker-body">
          <g className="leg leg-a" style={{ transformOrigin: "0px -46px" }}>
            <path d="M-4 -46v42" stroke="#f1efe6" strokeWidth="11" strokeLinecap="round" />
            <ellipse cx="-2" cy="-2" rx="8" ry="3.5" fill="#5a3a26" />
          </g>
          <g className="leg leg-b" style={{ transformOrigin: "0px -46px" }}>
            <path d="M4 -46v42" stroke="#e7e4da" strokeWidth="11" strokeLinecap="round" />
            <ellipse cx="6" cy="-2" rx="8" ry="3.5" fill="#5a3a26" />
          </g>
          <path d="M-15 -42l4 -48h22l4 48Z" fill="#7d9cc4" />
          <path d="M12 -84l26 -40" stroke="#6b4a30" strokeWidth="4" />
          <path d="M33 -128l14 -6 4 12 -14 6Z" fill="#8a8f95" />
          <path d="M8 -84l12 20 10 -6" stroke="#a8774f" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <g className="arm-swing" style={{ transformOrigin: "-8px -84px" }}>
            <path d="M-8 -84l-6 30" stroke="#a8774f" strokeWidth="7" strokeLinecap="round" />
          </g>
          <circle cx="0" cy="-102" r="12" fill="#a8774f" />
          <path d="M-13 -106q13 -18 27 -1q-1 -12 -14 -13q-13 1 -13 14Z" fill="#f4f1ea" />
          <path d="M-12 -104q-10 8 -12 22" stroke="#f4f1ea" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g></g>
      </g>
    </svg>
  );
}
