export const TERMINAL_ANIM_STYLES = `
@keyframes flash-green {
  0%   { background-color: rgba(68,223,163,0.35); }
  60%  { background-color: rgba(68,223,163,0.15); }
  100% { background-color: transparent; }
}
@keyframes flash-red {
  0%   { background-color: rgba(239,68,68,0.35); }
  60%  { background-color: rgba(239,68,68,0.15); }
  100% { background-color: transparent; }
}
@keyframes tick-up {
  0%   { transform: translateY(6px); opacity: 0; }
  100% { transform: translateY(0);   opacity: 1; }
}
@keyframes tick-down {
  0%   { transform: translateY(-6px); opacity: 0; }
  100% { transform: translateY(0);    opacity: 1; }
}
@keyframes arrow-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}
@keyframes refresh-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}
.price-flash-green { animation: flash-green 1.2s ease-out forwards; }
.price-flash-red   { animation: flash-red   1.2s ease-out forwards; }
.price-tick-up     { animation: tick-up   0.25s ease-out forwards; }
.price-tick-down   { animation: tick-down 0.25s ease-out forwards; }
.arrow-pulse       { animation: arrow-pulse 1s ease-in-out 3; }
.refresh-pulse     { animation: refresh-pulse 0.6s ease-in-out infinite; }
`;