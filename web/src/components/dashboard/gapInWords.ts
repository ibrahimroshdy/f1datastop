/** "Leader" for the first, then "111 behind": the gap in words, never a bar. */
export const gapInWords = (leader: number, points: number, index: number) =>
  index === 0 ? "Leader" : `${Math.max(0, leader - points)} behind`;
