import { describe, it, expect } from 'vitest';
import { dilutionSeries } from '@/lib/research/calculators';

/**
 * Serial-dilution recipe tests.
 *
 * Corrected math: for a fixed per-tube total volume V at dilution factor D,
 *   transfer = V / D,  diluent = V * (D - 1) / D,  so transfer + diluent === V.
 * The previous formula produced a per-tube volume of V*D/(D-1) instead of V.
 */
describe('dilutionSeries', () => {
  it('per-tube transfer + diluent equals the entered total volume', () => {
    for (const [V, D] of [[100, 10], [200, 2], [50, 5], [1, 3]] as const) {
      const steps = dilutionSeries({ stockConcentration: 1000, dilutionFactor: D, steps: 3, finalVolumeMl: V });
      expect(steps.length).toBe(3);
      for (const s of steps) {
        expect((s.transferVolumeMl ?? 0) + (s.diluentVolumeMl ?? 0)).toBeCloseTo(V, 9);
      }
    }
  });

  it('each step concentration is the previous divided by the factor', () => {
    const steps = dilutionSeries({ stockConcentration: 1000, dilutionFactor: 10, steps: 3, finalVolumeMl: 100 });
    expect(steps[0].concentration).toBeCloseTo(100, 9);
    expect(steps[1].concentration).toBeCloseTo(10, 9);
    expect(steps[2].concentration).toBeCloseTo(1, 9);
  });

  it('caps at 20 steps and rejects invalid inputs', () => {
    expect(dilutionSeries({ stockConcentration: 1000, dilutionFactor: 2, steps: 50 }).length).toBe(20);
    expect(dilutionSeries({ stockConcentration: 0, dilutionFactor: 2, steps: 3 })).toEqual([]);
    expect(dilutionSeries({ stockConcentration: 1000, dilutionFactor: 1, steps: 3 })).toEqual([]);
    expect(dilutionSeries({ stockConcentration: 1000, dilutionFactor: 2, steps: 0 })).toEqual([]);
  });

  it('omits volumes when no final volume is supplied', () => {
    const steps = dilutionSeries({ stockConcentration: 1000, dilutionFactor: 10, steps: 2 });
    expect(steps[0].transferVolumeMl).toBeUndefined();
    expect(steps[0].diluentVolumeMl).toBeUndefined();
  });
});
