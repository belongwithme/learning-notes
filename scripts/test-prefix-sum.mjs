import assert from 'node:assert/strict';
import { buildPrefixTrace, DEFAULTS, EXAMPLES, parseParameters } from '../src/lib/prefix-sum.ts';

function intervals(nums) {
  return nums.flatMap((_, l) => nums.slice(l).map((_, offset) => {
    const r = l + offset;
    return { l, r, sum: nums.slice(l, r + 1).reduce((a, b) => a + b, 0) };
  }));
}
let cases = 0;
function check(nums, k, lesson) {
  const p = { nums, k, left: 0, right: nums.length - 1 };
  const expected = intervals(nums).filter(item => lesson === 'count' ? item.sum === k : item.sum % k === 0);
  const traces = ['optimized', 'brute'].map(method => buildPrefixTrace(lesson, p, method));
  for (const trace of traces) {
    assert.equal(trace.at(-1).ans, expected.length);
    assert.deepEqual(trace.at(-1).intervals.map(pair => pair.join(',')).sort(), expected.map(({ l, r }) => `${l},${r}`).sort());
    assert.equal(trace[0].ans, 0);
  }
  assert.equal(traces[0].length, nums.length * 5 + 1);
  assert.equal(traces[0].at(-1).queries, nums.length);
  assert.equal(traces[0].at(-1).updates, nums.length);
  assert.equal(traces[1].at(-1).checks, nums.length * (nums.length + 1) / 2);
  for (const step of traces[0]) {
    const expectedMap = {};
    for (let t = 0; t <= step.historyEnd; t++) {
      const sum = nums.slice(0, t).reduce((a, b) => a + b, 0);
      const key = lesson === 'count' ? sum : (sum % k + k) % k;
      expectedMap[key] = (expectedMap[key] ?? 0) + 1;
    }
    assert.deepEqual(step.counts, expectedMap);
    if (step.phase === 'accumulate') { assert.equal(step.hit, null); assert.equal(step.need, null); }
    if (step.phase === 'query') assert.equal(step.hit, expectedMap[step.need] ?? 0);
    if (step.index !== null) assert.equal(step.cur, nums.slice(0, step.index + 1).reduce((a, b) => a + b, 0));
  }
  assert.deepEqual(traces[0][0].counts, { 0: 1 });
  cases++;
}
for (let length = 1; length <= 6; length++) {
  for (let code = 0; code < 3 ** length; code++) {
    let number = code;
    const nums = Array.from({ length }, () => { const n = number % 3 - 1; number = Math.floor(number / 3); return n; });
    for (const k of [-2, -1, 0, 1, 2]) check(nums, k, 'count');
    for (const k of [1, 2, 3, 5]) check(nums, k, 'divisible');
    for (const item of intervals(nums)) {
      const p = { nums, k: 0, left: item.l, right: item.r };
      for (const method of ['optimized', 'brute']) assert.equal(buildPrefixTrace('range', p, method).at(-1).ans, item.sum);
      const reuse = buildPrefixTrace('range', p, 'optimized', 'none', true);
      assert.equal(reuse.length, 4); assert.equal(reuse.at(-1).ans, item.sum); assert.equal(reuse.at(-1).builds, 0);
    }
  }
}
for (const lesson of ['count', 'divisible']) {
  check(DEFAULTS[lesson].nums, DEFAULTS[lesson].k, lesson);
  check(Array(12).fill(0), lesson === 'count' ? 0 : 1, lesson);
  check([-99, 99, -99, 99], lesson === 'count' ? 0 : 99, lesson);
}
assert.equal(buildPrefixTrace('range', DEFAULTS.range, 'optimized').at(-1).ans, 2);
assert.equal(buildPrefixTrace('range', { nums: [5], left: 0, right: 0, k: 1 }, 'optimized', 'boundary').at(-1).ans, 0);
for (const [fault, result] of [['none', 1], ['sentinel', 0], ['order', 2]]) {
  assert.equal(buildPrefixTrace('count', { nums: [0], k: 0, left: 0, right: 0 }, 'optimized', fault).at(-1).ans, result);
}
assert.equal(buildPrefixTrace('divisible', { nums: [-1, 5], k: 5, left: 0, right: 1 }, 'optimized', 'modulo').at(-1).ans, 0);
assert.deepEqual(parseParameters('range', '[ 2，-1，3 ]', '1', '2', '').nums, [2, -1, 3]);
assert.deepEqual(parseParameters('count', '[−1，5]', '', '', '−1'), { nums: [-1, 5], left: 0, right: 1, k: -1 });
for (const raw of ['', '[]', '1,,2', '1.5', '100', '-100', '[1,2', Array(13).fill(0).join(',')]) assert.throws(() => parseParameters('count', raw, '', '', '0'));
for (const [l, r] of [['-1', '1'], ['1', '0'], ['0', '3'], ['', '2'], ['0.5', '1']]) assert.throws(() => parseParameters('range', '1,2,3', l, r, ''));
for (const k of ['0', '-1', '1000', '1.5', '']) assert.throws(() => parseParameters('divisible', '1,2', '', '', k));
assert.throws(() => parseParameters('count', '1,2', '', '', '-1000'));
console.log(`Passed ${cases} count/divisibility scenarios, every interval of 1,092 arrays, prefix reuse, phase invariants, faults and input limits.`);

if (process.argv.includes('--java')) {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'prefix-java-'));
  try {
    for (const lesson of ['range', 'count', 'divisible']) for (const method of ['optimized', 'brute']) {
      const className = lesson === 'range' && method === 'optimized' ? 'NumArray' : 'Solution';
      writeFileSync(join(dir, `${className}.java`), EXAMPLES[lesson][method]);
      const invoke = (nums, k, left, right) => lesson === 'range'
        ? method === 'optimized' ? `new NumArray(${nums}).sumRange(${left},${right})` : `new Solution().sumRange(${nums},${left},${right})`
        : `new Solution().${lesson === 'count' ? 'countSubarraysSumK' : 'countDivisibleByK'}(${nums},${k})`;
      const assertions = [];
      const examples = lesson === 'range' ? [[2,-1,3], [5], [-9,-2], [2147483647,2147483647]]
        : [DEFAULTS[lesson].nums, [0,0,0], [-1,5], [1,-1,1], [2147483647,2147483647]];
      for (const nums of examples) {
        const ks = lesson === 'count' ? [0, 3, -1] : [1, 5];
        for (const k of ks) {
          const literal = `new int[]{${nums.join(',')}}`;
          const expected = lesson === 'range' ? nums.reduce((a,b)=>a+b,0) : intervals(nums).filter(item=>lesson==='count'?item.sum===k:item.sum%k===0).length;
          assertions.push(`if (${invoke(literal,k,0,nums.length-1)} != ${expected}L) throw new AssertionError("${lesson}/${method}");`);
        }
      }
      if (method === 'optimized' && lesson !== 'range') assertions.push(`if (${invoke('new int[100000]',lesson==='count'?0:1,0,99999)} != 5000050000L) throw new AssertionError("long result");`);
      writeFileSync(join(dir, 'Test.java'), `class Test { public static void main(String[] args) { ${assertions.join('\n')} } }`);
      execFileSync('javac', [`${className}.java`, 'Test.java'], { cwd: dir });
      execFileSync('java', ['-cp', dir, 'Test']);
      console.log(`Java passed: ${lesson}/${method}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
