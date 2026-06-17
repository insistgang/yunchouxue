import { describe, it, expect } from 'vitest';
import { encodeState, decodeState } from './urlState';

const defaults = { demo: 'lp', params: { c1: 30, c2: 20 }, step: 0 };

describe('urlState', () => {
  it('encode 产出稳定 query', () => {
    expect(encodeState({ demo: 'lp', params: { c1: 30, c2: 20 }, step: 2 }))
      .toBe('demo=lp&c1=30&c2=20&step=2');
  });
  it('decode 还原状态', () => {
    expect(decodeState('demo=lp&c1=10&c2=5&step=1', 'lp', defaults))
      .toEqual({ demo: 'lp', params: { c1: 10, c2: 5 }, step: 1 });
  });
  it('非法/越界回退默认（step 负、未知参数）', () => {
    expect(decodeState('demo=lp&c1=abc&step=-3', 'lp', defaults)).toEqual(defaults);
  });
  it('demo 不匹配回退默认', () => {
    expect(decodeState('demo=xx&step=1', 'lp', defaults)).toEqual(defaults);
  });
});
