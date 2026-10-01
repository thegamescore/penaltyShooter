export const immersiveQuery = '(max-width: 1024px), (hover: none) and (pointer: coarse)';

// Keep the goal, aiming area and ball in view without stretching the artwork.
export function pitchView(width: number, height: number, immersive: boolean) {
  if (!immersive) return { scaleX: width / 1000, scaleY: height / 720, x: 0, y: 0 };
  // Leave room for the shooting prompt above the crossbar in landscape.
  const topInset = height < 300 ? 24 : 0;
  const availableHeight = height - topInset;
  const scale = Math.min(width / 640, availableHeight / 580);
  return { scaleX: scale, scaleY: scale, x: width / 2 - 500 * scale, y: topInset + availableHeight / 2 - 400 * scale };
}
