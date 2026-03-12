export const getOrthogonalElbow = (
  pointer: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
) => {
  const optionA = { x: segmentStart.x, y: segmentEnd.y };
  const optionB = { x: segmentEnd.x, y: segmentStart.y };
  const distanceToA = (pointer.x - optionA.x) ** 2 + (pointer.y - optionA.y) ** 2;
  const distanceToB = (pointer.x - optionB.x) ** 2 + (pointer.y - optionB.y) ** 2;
  return distanceToA <= distanceToB ? optionA : optionB;
};

export const getSnappedIntermediatePoint = (
  pointer: { x: number; y: number },
  previousPoint: { x: number; y: number },
  nextPoint: { x: number; y: number },
) => {
  const optionA = { x: previousPoint.x, y: nextPoint.y };
  const optionB = { x: nextPoint.x, y: previousPoint.y };
  const distanceToA = (pointer.x - optionA.x) ** 2 + (pointer.y - optionA.y) ** 2;
  const distanceToB = (pointer.x - optionB.x) ** 2 + (pointer.y - optionB.y) ** 2;
  return distanceToA <= distanceToB ? optionA : optionB;
};

export const getDistanceSquaredToSegment = (
  point: { x: number; y: number },
  segmentStart: { x: number; y: number },
  segmentEnd: { x: number; y: number },
) => {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    const px = point.x - segmentStart.x;
    const py = point.y - segmentStart.y;
    return px * px + py * py;
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / segmentLengthSquared),
  );

  const projectionX = segmentStart.x + t * dx;
  const projectionY = segmentStart.y + t * dy;
  const distanceX = point.x - projectionX;
  const distanceY = point.y - projectionY;

  return distanceX * distanceX + distanceY * distanceY;
};

export default {
  getOrthogonalElbow,
  getSnappedIntermediatePoint,
  getDistanceSquaredToSegment,
};
