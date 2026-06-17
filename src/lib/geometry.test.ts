import { describe, it, expect } from 'vitest';
import { objectiveValue } from './geometry';

describe('objectiveValue', () => {
  it('计算 c·p', () => {
    expect(objectiveValue([30, 20], { x: 4, y: 0 })).toBe(120);
    expect(objectiveValue([30, 20], { x: 8/3, y: 8/3 })).toBeCloseTo(400/3, 6);
  });
});
