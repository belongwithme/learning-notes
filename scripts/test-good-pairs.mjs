import assert from 'node:assert/strict';
import { buildTrace, parseInput, gradeQuiz, DEFAULT_INPUT } from '../src/lib/good-pairs.ts';

// Independent combinatorial oracle, rather than duplicating the online scan.
function expected(nums) {
  return [...new Set(nums)].reduce((total, value) => {
    const count = nums.filter(n => n === value).length;
    return total + count * (count - 1) / 2;
  }, 0);
}

let cases = 0;
function verify(nums) {
  const optimized = buildTrace(nums, 'optimized');
  const brute = buildTrace(nums, 'brute');
  const answer = expected(nums);
  for (const trace of [optimized, brute]) {
    assert.equal(trace.at(-1).ans, answer);
    assert.equal(trace.at(-1).pairs.length, answer);
    assert.equal(new Set(trace.at(-1).pairs.map(pair => pair.join(','))).size, answer);
    for (const [i, j] of trace.at(-1).pairs) {
      assert.ok(i < j);
      assert.equal(nums[i], nums[j]);
    }
  }
  assert.equal(optimized.length, 4 * nums.length + 1);
  assert.equal(optimized.at(-1).queries, nums.length);
  assert.equal(optimized.at(-1).updates, nums.length);
  assert.equal(brute.at(-1).checks, nums.length * (nums.length - 1) / 2);
  const candidateOrder = brute.filter(step => step.phase === 'compare').map(step => [step.i, step.j]);
  assert.equal(new Set(candidateOrder.map(pair => pair.join(','))).size, candidateOrder.length);
  for (let j = 0; j < nums.length; j++) {
    const [select, query, add, update] = optimized.slice(j * 4 + 1, j * 4 + 5);
    assert.equal(select.left, null);
    assert.equal(select.contribution, null);
    assert.equal(select.historyEnd, j - 1);
    assert.equal(query.left, nums.slice(0, j).filter(value => value === nums[j]).length);
    assert.deepEqual(query.counts, select.counts);
    assert.equal(query.ans, select.ans);
    assert.deepEqual(add.counts, query.counts);
    assert.equal(add.ans, expected(nums.slice(0, j + 1)));
    assert.equal(update.historyEnd, j);
    assert.equal(update.ans, add.ans);
    for (const value of new Set(nums.slice(0, j + 1))) {
      assert.equal(update.counts[value], nums.slice(0, j + 1).filter(n => n === value).length);
    }
  }
  assert.deepEqual(optimized[0].counts, {}); // Later updates must not mutate earlier snapshots.
  cases++;
}
for (let length = 1; length <= 7; length++) {
  for (let code = 0; code < 3 ** length; code++) {
    let number = code;
    verify(Array.from({ length }, () => { const digit = number % 3; number = Math.floor(number / 3); return digit; }));
  }
}
for (const nums of [DEFAULT_INPUT, [1], [1, 2, 3], [7, 7, 7, 7], Array(12).fill(99), [0, 99, 0, 99]]) verify(nums);
assert.deepEqual(buildTrace(DEFAULT_INPUT, 'optimized').filter(s => s.phase === 'update').map(s => s.ans), [0, 0, 1, 3]);
assert.equal(buildTrace([1], 'optimized', true).at(-1).ans, 1);
assert.deepEqual(buildTrace([1], 'optimized', true).at(-1).pairs, [[0, 0]]);
for (const input of ['1,2,1,1', '[1,2,1,1]', ' [ 1， 2，1，1 ] ']) assert.deepEqual(parseInput(input), DEFAULT_INPUT);
assert.deepEqual(parseInput('0, +99, 01'), [0, 99, 1]);
for (const input of ['', '[]', '1,,2', '1，', '1.2', '1e1', 'NaN', '-1', '100', '[1,2', '1 2', '[[]]', Array(13).fill(1).join(',')]) {
  assert.throws(() => parseInput(input), undefined, input);
}
assert.deepEqual(gradeQuiz('1', '1', '2', 'self'), [true, true, true]);
assert.deepEqual(gradeQuiz('', '1', '', 'order'), [false, false, false]);
console.log(`Passed: ${cases} arrays, phase invariants, pair uniqueness, operation counts, input validation, wrong-order experiment and quiz grading.`);
