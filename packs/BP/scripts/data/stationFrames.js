// 1.1 工作台互動動畫: moving parts on the hand-worked stations, played as a short
// flip-book when a player uses the station. Custom blocks cannot play
// animations, so each moving part is drawn in `frames` positions (bones
// <bone>_0 .. <bone>_<frames-1>) and the `frame` block state shows one; the
// block keeps its own facing, so the parts always line up with it.
// Read by core/blockFrames.js, tools/gen_blocks.mjs and the model scripts.
//
// bone:     prefix of the frame bones in the block model
// frames:   positions in one cycle (frame 0 is the resting look)
// ticks:    game ticks each frame is shown
// cycles:   how many times the cycle plays per use
//
// Plain data: no @minecraft imports (scripts/ARCHITECTURE.md).

export const FRAME_STATE = "kaleidoscope_ranching:frame";

export const STATION_FRAMES = {
  // The crank turns twice for each mince (art_src/m4_scripts/blocks_m7.py).
  meat_grinder: { bone: "crank", frames: 4, ticks: 2, cycles: 2 },
  // The crank turns three times while the cream freezes.
  ice_cream_churn: { bone: "crank", frames: 4, ticks: 3, cycles: 3 },
  // The dasher plunges down and up three times when a batch goes in (blocks_m3.py).
  butter_churn: { bone: "plunger", frames: 4, ticks: 3, cycles: 3 },
  // The wheel turns and the treadle rocks when wool goes on by hand.
  spinning_wheel: { bone: "wheel", frames: 4, ticks: 2, cycles: 4 },
};
