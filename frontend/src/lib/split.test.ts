import { computeBalances, splitEqually } from './split';
import { formatSigned, parseAmount } from './money';

describe('splitEqually', () => {
  it('splits evenly when possible', () => {
    expect(splitEqually(9000, ['a', 'b', 'c']).map((s) => s.amount)).toEqual([3000, 3000, 3000]);
  });

  it('gives leftover cents to the first participants in join order', () => {
    const shares = splitEqually(10000, ['a', 'b', 'c']);
    expect(shares.map((s) => s.amount)).toEqual([3334, 3333, 3333]);
    expect(shares.map((s) => s.extraCents)).toEqual([1, 0, 0]);
    expect(splitEqually(1002, ['a', 'b', 'c', 'd']).map((s) => s.amount)).toEqual([251, 251, 250, 250]);
  });

  it('preserves every minor unit', () => {
    for (let total = 1; total < 500; total += 7) {
      for (let n = 1; n <= 7; n += 1) {
        const ids = Array.from({ length: n }, (_, i) => `m${i}`);
        expect(splitEqually(total, ids).reduce((sum, s) => sum + s.amount, 0)).toBe(total);
      }
    }
  });

  it('rejects empty participants and non-positive totals', () => {
    expect(() => splitEqually(100, [])).toThrow();
    expect(() => splitEqually(0, ['a'])).toThrow();
    expect(() => splitEqually(1.5, ['a'])).toThrow();
  });
});

describe('computeBalances', () => {
  it('matches the spec example', () => {
    const balances = computeBalances(['A', 'B', 'C'], [{ payerId: 'A', amountMinor: 9000, participantIds: ['A', 'B', 'C'] }]);
    expect(Object.fromEntries(balances)).toEqual({ A: 6000, B: -3000, C: -3000 });
  });

  it('credits a payer who is not among the participants with the full amount', () => {
    const balances = computeBalances(['A', 'B', 'C'], [{ payerId: 'A', amountMinor: 5000, participantIds: ['B', 'C'] }]);
    expect(Object.fromEntries(balances)).toEqual({ A: 5000, B: -2500, C: -2500 });
  });

  it('uses join order for remainders even when participants are listed differently', () => {
    const balances = computeBalances(['A', 'B', 'C'], [{ payerId: 'B', amountMinor: 1000, participantIds: ['C', 'B', 'A'] }]);
    expect(Object.fromEntries(balances)).toEqual({ A: -334, B: 667, C: -333 });
  });

  it('reproduces the design sample and sums to zero', () => {
    const members = ['dana', 'anna', 'ben', 'chiara'];
    const balances = computeBalances(members, [
      { payerId: 'dana', amountMinor: 9000, participantIds: ['dana', 'anna', 'ben'] },
      { payerId: 'ben', amountMinor: 1000, participantIds: ['dana', 'anna', 'ben'] },
      { payerId: 'dana', amountMinor: 5000, participantIds: ['anna', 'chiara'] },
      { payerId: 'anna', amountMinor: 10000, participantIds: members },
    ]);
    expect(members.map((m) => formatSigned(balances.get(m)!))).toEqual(['+81.66', '+16.67', '−48.33', '−50.00']);
    expect([...balances.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('parseAmount', () => {
  it('parses decimal input into minor units', () => {
    expect(parseAmount('12')).toBe(1200);
    expect(parseAmount('12.5')).toBe(1250);
    expect(parseAmount('12,05')).toBe(1205);
    expect(parseAmount(' 0.01 ')).toBe(1);
  });

  it('rejects invalid input', () => {
    for (const input of ['', 'abc', '-5', '1.234', '1e3', '.5']) expect(parseAmount(input)).toBeNull();
  });
});
