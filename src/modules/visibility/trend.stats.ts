/**
 * Pure statistical utility functions for trend analysis.
 * Community: computeDelta, computeEWMA, computeOverallDirection
 * Commercial: computeControlLimits, detectAnomaly, computeSignificance, computeCredibleInterval
 */

export function computeDelta(
  current: number,
  previous: number
): { delta: number; changeRate: number | null; direction: 'up' | 'down' | 'stable' } {
  const delta = current - previous;
  const changeRate = previous === 0 ? null : (delta / previous) * 100;

  let direction: 'up' | 'down' | 'stable';
  if (delta > 0) direction = 'up';
  else if (delta < 0) direction = 'down';
  else direction = 'stable';

  return { delta, changeRate, direction };
}

export function computeEWMA(values: number[], alpha = 0.3): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [values[0]];

  const result: number[] = [];

  // Seed: SMA of first min(3, N) points
  const seedCount = Math.min(3, values.length);
  const seed = values.slice(0, seedCount).reduce((a, b) => a + b, 0) / seedCount;
  result.push(seed);

  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }

  return result;
}

export function computeOverallDirection(first: number, last: number): 'up' | 'down' | 'stable' {
  if (last > first) return 'up';
  if (last < first) return 'down';
  return 'stable';
}

/**
 * Spearman's rank correlation coefficient with tie-aware average ranks.
 *
 * Returns `{ rho: null, n: 0 }` when the input is empty or has no valid numeric
 * pairs. Returns `{ rho: null, n }` when all x values (or all y values) are
 * identical — the coefficient is mathematically undefined because the variance
 * of the ranks is zero.
 *
 * Sign is preserved; callers may use it to derive a direction.
 */
export function computeSpearmanRho(pairs: Array<[number, number]>): {
  rho: number | null;
  n: number;
} {
  const cleaned = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = cleaned.length;
  if (n === 0) return { rho: null, n: 0 };

  const xs = cleaned.map(([x]) => x);
  const ys = cleaned.map(([, y]) => y);

  const xRanks = rankWithTies(xs);
  const yRanks = rankWithTies(ys);

  const meanX = xRanks.reduce((a, b) => a + b, 0) / n;
  const meanY = yRanks.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xRanks[i] - meanX;
    const dy = yRanks[i] - meanY;
    num += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) {
    return { rho: null, n };
  }

  return { rho: num / Math.sqrt(varX * varY), n };
}

/**
 * Assign average ranks (1-based) to an array of numbers. Tied values receive
 * the mean of the tied rank positions.
 */
function rankWithTies(values: number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && indexed[j + 1].v === indexed[i].v) {
      j++;
    }
    const avg = (i + j + 2) / 2; // 1-based average rank across [i..j]
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].i] = avg;
    }
    i = j + 1;
  }
  return ranks;
}

// --- Commercial functions ---

export function computeControlLimits(
  ewmaValues: number[],
  k = 2.5
): { upper: number[]; lower: number[] } {
  if (ewmaValues.length < 2) {
    return {
      upper: ewmaValues.map(() => Infinity),
      lower: ewmaValues.map(() => -Infinity),
    };
  }

  // Compute rolling residuals (difference between consecutive EWMA values)
  const residuals: number[] = [];
  for (let i = 1; i < ewmaValues.length; i++) {
    residuals.push(ewmaValues[i] - ewmaValues[i - 1]);
  }

  // Rolling standard deviation of residuals
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < ewmaValues.length; i++) {
    if (i < 2) {
      // Not enough history for meaningful limits
      upper.push(Infinity);
      lower.push(-Infinity);
      continue;
    }

    const availableResiduals = residuals.slice(0, i);
    const mean = availableResiduals.reduce((a, b) => a + b, 0) / availableResiduals.length;
    const variance =
      availableResiduals.reduce((sum, r) => sum + (r - mean) ** 2, 0) / availableResiduals.length;
    const sigma = Math.sqrt(variance);

    upper.push(ewmaValues[i] + k * sigma);
    lower.push(ewmaValues[i] - k * sigma);
  }

  return { upper, lower };
}

export function detectAnomaly(
  value: number,
  ewma: number,
  upper: number,
  lower: number
): { isAnomaly: boolean; direction: 'above' | 'below' | null } {
  if (value > upper) return { isAnomaly: true, direction: 'above' };
  if (value < lower) return { isAnomaly: true, direction: 'below' };
  return { isAnomaly: false, direction: null };
}

export function computeSignificance(
  currentCount: number,
  currentTotal: number,
  previousCount: number,
  previousTotal: number
): { isSignificant: boolean; pValue: number } {
  if (currentTotal === 0 || previousTotal === 0) {
    return { isSignificant: false, pValue: 1 };
  }

  const p1 = currentCount / currentTotal;
  const p2 = previousCount / previousTotal;
  const pPooled = (currentCount + previousCount) / (currentTotal + previousTotal);

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / currentTotal + 1 / previousTotal));

  if (se === 0) {
    return { isSignificant: false, pValue: 1 };
  }

  const z = (p1 - p2) / se;
  if (z === 0) {
    return { isSignificant: false, pValue: 1 };
  }
  // Two-tailed p-value using normal CDF approximation
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return { isSignificant: pValue < 0.05, pValue };
}

export function computeCredibleInterval(
  count: number,
  total: number,
  confidence = 0.95
): { lower: number; upper: number } {
  if (total === 0) {
    return { lower: 0, upper: 1 };
  }

  // Wilson score interval
  const p = count / total;
  const z = normalQuantile((1 + confidence) / 2);
  const z2 = z * z;
  const n = total;

  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

// --- Internal helpers ---

/** Standard normal CDF approximation (Abramowitz and Stegun) */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp((-absX * absX) / 2);

  return 0.5 * (1.0 + sign * y);
}

/** Approximate inverse normal CDF (rational approximation) */
function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Rational approximation for central region
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}
