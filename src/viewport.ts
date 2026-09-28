export const immersiveQuery = '(max-width: 1024px), (hover: none) and (pointer: coarse)';

// Keep the goal, aiming area and ball in view without stretching the artwork.
export function pitchView(width: number, height: number, immersive: boolean) {
  if (!immersive) return { scaleX: width / 1000, scaleY: height / 720, x: 0, y: 0 };
  const scale = Math.min(width / 640, height / 580);
  return { scaleX: scale, scaleY: scale, x: width / 2 - 500 * scale, y: height / 2 - 400 * scale };
}
