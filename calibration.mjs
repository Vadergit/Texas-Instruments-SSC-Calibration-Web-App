export function fit(points) {
  if (points.length < 2 || points.some(({raw, reference}) =>
    !Number.isFinite(raw) || !Number.isFinite(reference))) {
    throw new Error('Mindestens zwei vollständige, endliche Messpunkte sind erforderlich.');
  }
  const mean = key => points.reduce((sum, point) => sum + point[key], 0) / points.length;
  const x = mean('raw');
  const y = mean('reference');
  const variance = points.reduce((sum, point) => sum + (point.raw - x) ** 2, 0);
  if (!variance) throw new Error('Die Rohwerte müssen sich unterscheiden.');
  if (!Number.isFinite(variance)) throw new Error("Die Rohwerte liegen ausserhalb des unterstützten Bereichs.");
  const gain = points.reduce((sum, point) =>
    sum + (point.raw - x) * (point.reference - y), 0) / variance;
  const offset = y - gain * x;
  const residuals = points.map(({raw, reference}) => raw * gain + offset - reference);
  if (![gain, offset, ...residuals].every(Number.isFinite)) {
    throw new Error('Die Zahlen liegen ausserhalb des unterstützten Bereichs.');
  }
  return {gain, offset, residuals};
}
