export type Lesson = 'range' | 'count' | 'divisible';
export type Method = 'optimized' | 'brute';
export type Fault = 'none' | 'boundary' | 'sentinel' | 'order' | 'modulo';
export interface Parameters { nums: number[]; left: number; right: number; k: number }
export interface PrefixStep {
  phase: string; index: number | null; prefix: (number | null)[];
  cur: number; need: number | null; hit: number | null; ans: number | null;
  counts: Record<number, number>; historyEnd: number; intervals: [number, number][];
  selected: number[]; prefixSelected: number[]; built: number;
  builds: number; reads: number; checks: number; queries: number; updates: number;
  title: string; explanation: string; lines: number[];
}
export const DEFAULTS: Record<Lesson, Parameters> = {
  range: { nums: [2, -1, 3], left: 1, right: 2, k: 3 },
  count: { nums: [1, 2, 1, 2], left: 0, right: 3, k: 3 },
  divisible: { nums: [4, 5, 0, -2, -3, 1], left: 0, right: 5, k: 5 },
};
export const LESSON_NAMES = { range: '静态区间和', count: '和为 K 的子数组', divisible: '可被 K 整除的子数组' };
export const EXAMPLES: Record<Lesson, Record<Method, string>> = {
  range: {
    optimized: `public class NumArray {
    private final long[] pre;
    public NumArray(int[] nums) {
        pre = new long[nums.length + 1];
        for (int i = 0; i < nums.length; i++) {
            pre[i + 1] = pre[i] + nums[i];
        }
    }
    public long sumRange(int left, int right) {
        long whole = pre[right + 1];
        long before = pre[left];
        return whole - before;
    }
}`,
    brute: `class Solution {
    public long sumRange(int[] nums, int left, int right) {
        long sum = 0L;
        for (int i = left; i <= right; i++) {
            sum += nums[i];
        }
        return sum;
    }
}`,
  },
  count: {
    optimized: `import java.util.HashMap;
import java.util.Map;
class Solution {
    public long countSubarraysSumK(int[] nums, int k) {
        Map<Long, Integer> freq = new HashMap<>();
        freq.put(0L, 1);
        long cur = 0L, ans = 0L;
        for (int x : nums) {
            cur += x;
            long need = cur - k;
            int hit = freq.getOrDefault(need, 0);
            ans += hit;
            freq.put(cur, freq.getOrDefault(cur, 0) + 1);
        }
        return ans;
    }
}`,
    brute: `class Solution {
    public long countSubarraysSumK(int[] nums, int k) {
        long ans = 0L;
        for (int left = 0; left < nums.length; left++) {
            long sum = 0L;
            for (int right = left; right < nums.length; right++) {
                sum += nums[right];
                if (sum == k) ans++;
            }
        }
        return ans;
    }
}`,
  },
  divisible: {
    optimized: `import java.util.HashMap;
import java.util.Map;
class Solution {
    public long countDivisibleByK(int[] nums, int k) {
        Map<Integer, Integer> freq = new HashMap<>();
        freq.put(0, 1);
        long cur = 0L, ans = 0L;
        for (int x : nums) {
            cur += x;
            int mod = (int) ((cur % k + k) % k);
            int hit = freq.getOrDefault(mod, 0);
            ans += hit;
            freq.put(mod, freq.getOrDefault(mod, 0) + 1);
        }
        return ans;
    }
}`,
    brute: `class Solution {
    public long countDivisibleByK(int[] nums, int k) {
        long ans = 0L;
        for (int left = 0; left < nums.length; left++) {
            long sum = 0L;
            for (int right = left; right < nums.length; right++) {
                sum += nums[right];
                if (sum % k == 0) ans++;
            }
        }
        return ans;
    }
}`,
  },
};

export function parseInteger(raw: string, name: string, min: number, max: number): number {
  const text = raw.trim().replaceAll('−', '-');
  if (!/^[+-]?\d+$/.test(text)) throw new Error(`${name}必须是整数。`);
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name}必须在 ${min}～${max} 之间。`);
  return value;
}
export function parseParameters(lesson: Lesson, raw: string, left: string, right: string, k: string): Parameters {
  let content = raw.trim();
  if (content.startsWith('[') && content.endsWith(']')) content = content.slice(1, -1);
  const parts = content.replaceAll('，', ',').split(',');
  if (parts.some(part => !part.trim())) throw new Error('数组不能为空，也不能包含空元素。');
  if (parts.length > 12) throw new Error('数组最多支持 12 个整数。');
  const nums = parts.map(part => parseInteger(part, '数组元素', -99, 99));
  const params = { nums, left: 0, right: nums.length - 1, k: 1 };
  if (lesson === 'range') {
    params.left = parseInteger(left, '左下标 l', 0, nums.length - 1);
    params.right = parseInteger(right, '右下标 r', 0, nums.length - 1);
    if (params.left > params.right) throw new Error('闭区间需要 l ≤ r，不能选择空区间。');
  } else params.k = parseInteger(k, 'K', lesson === 'divisible' ? 1 : -999, 999);
  return params;
}

/** Complete snapshots make backwards stepping independent of mutation order. */
export function buildPrefixTrace(lesson: Lesson, p: Parameters, method: Method, fault: Fault = 'none', reuse = false): PrefixStep[] {
  const { nums, left, right, k } = p;
  const allPrefix = [0];
  nums.forEach(x => allPrefix.push(allPrefix[allPrefix.length - 1] + x));
  let state: PrefixStep = {
    phase: 'initial', index: null, prefix: [0, ...nums.map(() => null)], cur: 0, need: null, hit: null,
    ans: lesson === 'range' ? null : 0, counts: lesson !== 'range' && method === 'optimized' && fault !== 'sentinel' ? { 0: 1 } : {},
    historyEnd: fault === 'sentinel' ? -1 : 0, intervals: [], selected: [], prefixSelected: [0], built: 0,
    builds: 0, reads: 0, checks: 0, queries: 0, updates: 0,
    title: '初始状态 · 尚未开始', explanation: lesson === 'range' ? 'pre[0] = 0 表示空前缀，其余位置尚未计算。'
      : method === 'brute' ? '准备枚举所有非空连续子数组。sum 每换一个左端点就清零。'
        : fault === 'sentinel' ? '故意漏掉 freq[0] = 1，频次表为空。' : '空前缀 P[0] = 0 已出现 1 次：freq[0] = 1。它不是一个可计数的空子数组。',
    lines: method === 'brute' ? [3] : lesson === 'range' ? [4] : [5, 6, 7],
  };
  const steps = [state];
  const push = (patch: Partial<PrefixStep>) => { state = { ...state, ...patch }; steps.push(state); };
  if (lesson === 'range') {
    if (method === 'brute') {
      for (let i = left; i <= right; i++) push({ phase: 'sum', index: i, ans: (state.ans ?? 0) + nums[i], reads: state.reads + 1,
        selected: [i], title: `累加 nums[${i}] = ${nums[i]}`,
        explanation: `区间 [${left},${right}]：sum：${state.ans ?? 0} → ${(state.ans ?? 0) + nums[i]}。不读取区间外元素。`, lines: [4, 5] });
    } else {
      if (reuse) {
        state = { ...state, prefix: [...allPrefix], built: nums.length, prefixSelected: [], lines: [],
          title: '复用已建好的前缀数组', explanation: '数组未变，无需重新构造 NumArray。本轮只执行区间查询，答案尚未计算。' };
        steps[0] = state;
      } else for (let i = 0; i < nums.length; i++) {
        const prefix = [...state.prefix]; prefix[i + 1] = allPrefix[i + 1];
        push({ phase: 'build', index: i, prefix, built: i + 1, builds: i + 1, selected: [i], prefixSelected: [i, i + 1],
          title: `构造 pre[${i + 1}] = ${allPrefix[i]} + (${nums[i]}) = ${allPrefix[i + 1]}`,
          explanation: `pre[${i + 1}] 覆盖原数组 [0,${i + 1})。注意：前缀下标表示元素个数，刚加入的原数组下标是 ${i}。`, lines: [5, 6] });
      }
      const r = fault === 'boundary' ? right : right + 1;
      push({ phase: 'read-right', index: null, selected: [], prefixSelected: [r], reads: 1, cur: allPrefix[r],
        title: `读取 pre[${r}] = ${allPrefix[r]}`,
        explanation: fault === 'boundary' ? `故意读 pre[r]，它不包含原数组右端点 nums[${right}]。`
          : `闭区间右端点 r=${right} 要包含在内，所以先取前 ${right + 1} 个元素的和。`, lines: [10] });
      push({ phase: 'read-left', prefixSelected: [left, r], reads: 2, need: allPrefix[left],
        title: `读取 pre[${left}] = ${allPrefix[left]}`, explanation: `这是区间左边 [0,${left}) 的和，下一步把它扣掉。`, lines: [11] });
      push({ phase: 'subtract', selected: Array.from({ length: right - left + 1 }, (_, i) => left + i), ans: allPrefix[r] - allPrefix[left],
        title: `${fault === 'boundary' ? '错误公式' : '区间和'}：${allPrefix[r]} − (${allPrefix[left]}) = ${allPrefix[r] - allPrefix[left]}`,
        explanation: fault === 'boundary' ? '漏掉右端点！[5] 的 [0,0] 应为 5，而 pre[0] − pre[0] 得到 0。'
          : `pre[${right + 1}] − pre[${left}] 消去共同的左段，留下闭区间 [${left},${right}]。`, lines: [12] });
    }
  } else if (method === 'brute') {
    for (let l = 0; l < nums.length; l++) {
      let sum = 0;
      for (let r = l; r < nums.length; r++) {
        sum += nums[r];
        const match = lesson === 'count' ? sum === k : sum % k === 0;
        push({ phase: 'check', index: r, cur: sum, hit: Number(match), ans: state.ans! + Number(match), checks: state.checks + 1,
          intervals: match ? [...state.intervals, [l, r]] : state.intervals,
          selected: Array.from({ length: r - l + 1 }, (_, i) => l + i), prefixSelected: [],
          title: `检查 [${l},${r}]，区间和 ${sum}：${match ? '满足条件' : '不满足条件'}`,
          explanation: `${r === l ? '换左端点，sum 从 0 开始。' : '保持左端点，向右延长并累加一个元素。'}本次新增 ${Number(match)} 段，累计 ${state.ans! + Number(match)} 段。`, lines: [4, ...(r === l ? [5] : []), 6, 7, 8] });
      }
    }
  } else {
    const keyFor = (value: number) => lesson === 'count' ? value : fault === 'modulo' ? value % k : (value % k + k) % k;
    for (let i = 0; i < nums.length; i++) {
      const cur = allPrefix[i + 1]; const ownKey = keyFor(cur);
      const prefix = [...state.prefix]; prefix[i + 1] = cur;
      push({ phase: 'accumulate', index: i, prefix, cur, need: null, hit: null, selected: [i], prefixSelected: [i + 1],
        title: `累计当前前缀 P[${i + 1}] = ${cur}`,
        explanation: `加入 nums[${i}] = ${nums[i]}。当前前缀已算出，但还未放入历史频次表。`, lines: [8, 9] });
      const update = () => {
        const before = state.counts[ownKey] ?? 0;
        push({ phase: 'update', counts: { ...state.counts, [ownKey]: before + 1 }, historyEnd: i + 1, updates: state.updates + 1,
          title: `记录当前${lesson === 'count' ? '前缀' : '余数'}：freq[${ownKey}]：${before} → ${before + 1}`,
          explanation: `${fault === 'order' ? '故意提前更新。' : ''}历史现已包含 P[${i + 1}]。${lesson === 'count' ? '记录的是 cur，不是刚才查询的 need。' : fault === 'modulo' ? '故意记录原始余数，负值可能与同余的正值被分开。' : '记录规范化余数，供后续前缀匹配。'}`, lines: [13] });
      };
      if (fault === 'order') update();
      const need = lesson === 'count' ? cur - k : ownKey;
      push({ phase: 'key', need,
        title: lesson === 'count' ? `目标历史前缀 need = ${cur} − (${k}) = ${need}` : `计算${fault === 'modulo' ? '未归一化的' : '规范化'}余数：${need}`,
        explanation: lesson === 'count' ? 'P[r+1] − P[l] = K，所以只需寻找值等于 cur − K 的历史前缀。'
          : fault === 'modulo' ? 'Java 的负余数会与数学上同余的正余数分到不同桶。' : `((cur % K) + K) % K 把余数放入 0～${k - 1}。相同余数的两个前缀相减，可被 K 整除。`, lines: [10] });
      const hit = state.counts[need] ?? 0;
      const prefixMatches: number[] = [];
      for (let l = fault === 'sentinel' ? 1 : 0; l <= i + Number(fault === 'order'); l++) if (keyFor(allPrefix[l]) === need) prefixMatches.push(l);
      push({ phase: 'query', hit, queries: state.queries + 1, prefixSelected: [i + 1, ...prefixMatches],
        title: `查询 freq[${need}]，命中 ${hit} 次`, explanation: '只读历史表；频次和累计答案都不改变。每个命中的历史前缀位置对应一个左边界。', lines: [11] });
      const added: [number, number][] = prefixMatches.map(l => [l, i]);
      push({ phase: 'add', ans: state.ans! + hit, intervals: [...state.intervals, ...added],
        title: `累加贡献：ans：${state.ans} → ${state.ans! + hit}`,
        explanation: fault === 'order' ? '错误计入空区间 [1,0]：当前前缀与自己相减，长度为 0，不是非空子数组。'
          : `本轮新增 ${hit} 段${added.length ? `：${added.map(([l, r]) => `[${l},${r}]`).join('、')}` : ''}。${fault === 'sentinel' ? '漏掉空前缀会漏算从下标 0 开始的答案。' : fault === 'modulo' ? '负余数未归一化，可能漏掉同余配对。' : '频次表此时不改变。'}`, lines: [12] });
      if (fault !== 'order') update();
    }
  }
  const last = steps.at(-1)!;
  const returnLine = lesson === 'range' ? method === 'brute' ? 7 : 12 : method === 'brute' ? 11 : 15;
  steps[steps.length - 1] = { ...last, lines: [...new Set([...last.lines, returnLine])] };
  return steps;
}
