import assert from 'node:assert/strict';
import { buildTrace, DEFAULTS, EXPERIMENTS, JAVA, parseInput } from '../src/lib/difference.ts';
const methods = ['diff', 'brute'];
let cases = 0, seed = 20261010;
const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
function oracle(lesson, p) {
  if (lesson === 'capacity') {
    // Unit-distance exhaustive ground truth for small coordinates, independent of event scanning.
    const loads = Array.from({ length: Math.max(0, ...p.ops.map(t => t[1])) + 1 }, (_, x) => p.ops.filter(t => t[0] <= x && x < t[1]).reduce((sum, t) => sum + t[2], 0));
    return { peak: Math.max(0, ...loads), violation: loads.findIndex(v => v > p.capacity) };
  }
  const values = p.base.map((base, i) => base + p.ops.filter(([l, r]) => l <= i && i <= r).reduce((sum, op) => sum + op[2], 0));
  return lesson === 'range' ? values : values.map(v => { while (v < 0) v += 26; while (v >= 26) v -= 26; return String.fromCharCode(97 + v); });
}
function check(lesson, p) {
  const expected = oracle(lesson, p), input = JSON.stringify(p);
  for (const method of methods) {
    const trace = buildTrace(lesson, p, method), last = trace.at(-1);
    assert.equal(JSON.stringify(p), input, 'trace must not mutate inputs');
    if (lesson === 'capacity') { assert.equal(last.peak, expected.peak); assert.equal(last.violation, expected.violation < 0 ? null : expected.violation); }
    else assert.deepEqual(last.values, expected);
    for (let i = 1; i < trace.length; i++) {
      assert.notEqual(trace[i].values, trace[i - 1].values); assert.notEqual(trace[i].diff, trace[i - 1].diff);
      const s = trace[i];
      if (method === 'diff' && s.phase === 'accumulate') assert.equal(s.active, Object.entries(s.diff).filter(([x]) => Number(x) <= s.index).reduce((sum, [, v]) => sum + v, 0));
    }
    if (method === 'diff' && lesson !== 'capacity') {
      assert.equal(last.writes, p.ops.length * 2 + (lesson === 'range' ? p.base.length : 0));
      assert.equal(last.scans, p.base.length); assert.equal(last.values.length, p.base.length);
    }
  }
  cases++;
}
for (const lesson of ['range', 'capacity', 'shift']) { check(lesson, DEFAULTS[lesson]); check(lesson, EXPERIMENTS[lesson]); }
for (let n = 1; n <= 6; n++) for (let l = 0; l < n; l++) for (let r = l; r < n; r++) for (const v of [-99, -27, -1, 0, 1, 26, 99]) {
  for (const lesson of ['range', 'shift']) {
    const base = Array.from({ length: n }, (_, i) => lesson === 'range' ? i % 3 - 1 : i * 5 % 26);
    const word = base.map(c => String.fromCharCode(c + 97)).join('');
    check(lesson, { base, word, ops: [[l, r, v]], capacity: 0 });
    check(lesson, { base, word, ops: [[l, r, v], [l, r, -v]], capacity: 0 });
  }
}
for (let c = 0; c < 1200; c++) {
  const n = 1 + random(12), ops = Array.from({ length: random(9) }, () => { const l = random(n); return [l, l + random(n - l), random(199) - 99]; });
  const base = Array.from({ length: n }, () => random(199) - 99);
  check('range', { base, word: '', ops, capacity: 0 });
  const codes = base.map(n => (n % 26 + 26) % 26);
  check('shift', { base: codes, word: codes.map(n => String.fromCharCode(97 + n)).join(''), ops, capacity: 0 });
  check('capacity', { base: [], word: '', ops: ops.map(([l, r, v]) => [l, r + 1, Math.abs(v) + 1]), capacity: random(200) });
}
for (const method of methods) {
  const large = buildTrace('capacity', { base: [], word: '', ops: [[0, 1e9, 2], [1e9 - 1, 1e9, 3]], capacity: 4 }, method).at(-1);
  assert.equal(large.peak, 5); assert.equal(large.violation, 1e9 - 1);
}
assert.deepEqual(buildTrace('range', EXPERIMENTS.range, 'diff', 'boundary').at(-1).values, [2, 0, 0]);
assert.equal(buildTrace('capacity', EXPERIMENTS.capacity, 'diff', 'exit').at(-1).peak, 4);
assert.equal(buildTrace('shift', EXPERIMENTS.shift, 'diff', 'modulo').at(-1).values.join(''), '`');
assert.deepEqual(parseInput('range', '[3，−1]', '0,1,−2; 1,1,3', '').ops, [[0,1,-2], [1,1,3]]);
assert.equal(parseInput('capacity', '', '0,1000000000,2', '2').ops[0][1], 1e9);
assert.deepEqual(parseInput('range', '1', '', '').ops, []);
for (const raw of ['', '[]', '1,,2', '1.5', '100', '[1,2', Array(13).fill(0).join(',')]) assert.throws(() => parseInput('range', raw, '', ''));
for (const raw of ['A', '你好', '', 'a'.repeat(13)]) assert.throws(() => parseInput('shift', raw, '', ''));
for (const raw of ['1,0,1', '-1,0,1', '0,3,1', '0,1,1.5', '0,1,100', '0,1', '0,,1', Array(9).fill('0,0,1').join(';')]) assert.throws(() => parseInput('range', '0,0,0', raw, ''));
for (const raw of ['1,1,2', '0,1000000001,2', '0,1,0', '0,1,-1']) assert.throws(() => parseInput('capacity', '', raw, '2'));
for (const cap of ['-1', '1000', '1.5', '']) assert.throws(() => parseInput('capacity', '', '', cap));
console.log(`Passed ${cases} scenarios for both methods, sparse coordinates, snapshots, phase invariants, input bounds and three faults.`);
if (process.argv.includes('--java')) {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'difference-java-'));
  const array = a => `new int[]{${a.join(',')}}`, ops = a => `new int[][]{${a.map(t => `{${t.join(',')}}`).join(',')}}`;
  try {
    for (const lesson of ['range', 'capacity', 'shift']) for (const method of methods) {
      writeFileSync(join(dir, 'Solution.java'), JAVA[lesson][method]);
      const examples = [DEFAULTS[lesson], EXPERIMENTS[lesson]];
      if (lesson === 'range') examples.push({ base: [2147483647, -2147483648], word: '', ops: [[0,1,2147483647],[0,0,2147483647]] });
      if (lesson === 'shift') examples.push({ base: [0,25], word: 'az', ops: [[0,1,-2147483648],[0,1,-2147483648]] });
      if (lesson === 'capacity') examples.push({ ops: [[0,2147483647,2147483647],[1,2147483647,2147483647]], capacity: 0 });
      const assertions = examples.map(p => {
        if (lesson === 'range') {
          const expected = p.base.map((v,i) => v + p.ops.filter(([l,r]) => l<=i && i<=r).reduce((s,t)=>s+t[2],0));
          return `if (!java.util.Arrays.equals(new Solution().rangeAdd(${array(p.base)},${ops(p.ops)}),new long[]{${expected.map(v=>v+'L')}})) throw new AssertionError();`;
        }
        if (lesson === 'capacity') {
          const peak = Math.max(0,...p.ops.flatMap(t=>[t[0],t[1]]).map(x=>p.ops.filter(t=>t[0]<=x&&x<t[1]).reduce((s,t)=>s+t[2],0)));
          return `if(new Solution().peakPassengers(${ops(p.ops)})!=${peak}L) throw new AssertionError();`;
        }
        const expected = p.base.map((v,i) => String.fromCharCode(97 + ((v+p.ops.filter(([l,r])=>l<=i&&i<=r).reduce((s,t)=>s+t[2],0))%26+26)%26)).join('');
        return `if(!new Solution().shift("${p.word}",${ops(p.ops)}).equals("${expected}")) throw new AssertionError();`;
      });
      writeFileSync(join(dir, 'Test.java'), `class Test {public static void main(String[] args){${assertions.join('\n')}}}`);
      execFileSync('javac', ['Solution.java', 'Test.java'], {cwd:dir}); execFileSync('java', ['-cp',dir,'Test']);
      console.log(`Java passed: ${lesson}/${method}`);
    }
  } finally { rmSync(dir, { recursive:true,force:true }); }
}
