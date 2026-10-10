export type Method = 'optimized' | 'brute';
export type Phase = 'initial' | 'select' | 'query' | 'add' | 'update' | 'compare' | 'empty';
export interface Step {
  phase: Phase;
  j: number | null;
  i: number | null;
  left: number | null;
  contribution: number | null;
  ans: number;
  counts: Record<number, number>;
  historyEnd: number;
  pairs: [number, number][];
  added: [number, number][];
  checks: number;
  queries: number;
  updates: number;
  title: string;
  explanation: string;
  lines: number[];
}

export const DEFAULT_INPUT = [1, 2, 1, 1];
export const JAVA = {
  optimized: `import java.util.HashMap;
import java.util.Map;

class Solution {
    public long countGoodPairs(int[] nums) {
        Map<Integer, Integer> cnt = new HashMap<>();
        long ans = 0L;
        for (int x : nums) {
            int left = cnt.getOrDefault(x, 0);
            ans += left;
            cnt.put(x, left + 1);
        }
        return ans;
    }
}`,
  brute: `class Solution {
    public long countGoodPairs(int[] nums) {
        long ans = 0L;
        for (int j = 0; j < nums.length; j++) {
            for (int i = 0; i < j; i++) {
                if (nums[i] == nums[j]) {
                    ans++;
                }
            }
        }
        return ans;
    }
}`,
} as const;

export function parseInput(raw: string): number[] {
  let text = raw.trim();
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1).trim();
  if (!text) throw new Error('请输入 1～12 个整数，不能留空。');
  const parts = text.replaceAll('，', ',').split(',').map(part => part.trim());
  if (parts.some(part => part === '')) throw new Error('存在空元素，请检查连续逗号或末尾逗号。');
  if (parts.some(part => !/^[+-]?\d+$/.test(part))) throw new Error('每项必须是整数；可用一对方括号包住数组。');
  if (parts.length > 12) throw new Error('最多支持 12 个整数，请减少数量后重新应用。');
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isSafeInteger(n) || n < 0 || n > 99)) {
    throw new Error('每个整数必须在 0～99 之间。');
  }
  return nums;
}

// Every action owns a complete snapshot. Seeking never reverses mutations or replays timers.
export function buildTrace(nums: number[], method: Method, wrongOrder = false): Step[] {
  let state: Step = {
    phase: 'initial', j: null, i: null, left: null, contribution: null,
    ans: 0, counts: {}, historyEnd: -1, pairs: [], added: [],
    checks: 0, queries: 0, updates: 0,
    title: '准备好了，从第一个动作开始',
    explanation: '尚未处理任何元素。答案为 0，频次表为空。',
    lines: method === 'optimized' ? [6, 7] : [3],
  };
  const steps: Step[] = [state];
  const push = (change: Partial<Step>) => {
    state = { ...state, ...change };
    steps.push(state);
  };
  if (method === 'brute') {
    for (let j = 1; j < nums.length; j++) {
      for (let i = 0; i < j; i++) {
        const match = nums[i] === nums[j];
        const added: [number, number][] = match ? [[i, j]] : [];
        push({ phase: 'compare', j, i, historyEnd: j - 1, contribution: Number(match), added,
          ans: state.ans + Number(match), pairs: [...state.pairs, ...added], checks: state.checks + 1,
          title: `检查候选 (${i},${j})：${match ? '相等，新增 1 对' : '不相等，新增 0 对'}`,
          explanation: `nums[${i}] = ${nums[i]}，nums[${j}] = ${nums[j]}。ans：${state.ans} → ${state.ans + Number(match)}。固定右端点 j，再逐个检查 i < j。`,
          lines: match ? [4, 5, 6, 7] : [4, 5, 6],
        });
      }
    }
    if (steps.length === 1) push({ phase: 'empty', title: '没有候选数对', explanation: '只有一个元素，找不到 i < j 的两个下标，返回 0。', lines: [4, 5, 11] });
  } else {
    for (let j = 0; j < nums.length; j++) {
      const x = nums[j];
      push({ phase: 'select', j, left: null, contribution: null, added: [],
        title: `选中当前元素：j = ${j}，x = ${x}`,
        explanation: `本轮尚未查询。历史${j === 0 ? '为空' : `仅含下标 0～${j - 1}`}，先想一想：左边有几个 ${x}？`, lines: [8] });
      const update = () => {
        const before = state.counts[x] ?? 0;
        push({ phase: 'update', counts: { ...state.counts, [x]: before + 1 }, historyEnd: j,
          updates: state.updates + 1, title: `加入历史：cnt[${x}]：${before} → ${before + 1}`,
          explanation: `${wrongOrder ? '故意先更新：' : ''}频次表现在已包含当前下标 ${j}。${wrongOrder ? '此时再查询就会读到自己。' : '答案不变，为下一个元素准备历史。'}`, lines: [11] });
      };
      if (wrongOrder) update();
      const left = state.counts[x] ?? 0;
      push({ phase: 'query', left, queries: state.queries + 1,
        title: `查询${wrongOrder ? '已含当前点的' : '左侧'}频次：读到 ${left} 次`,
        explanation: `读取 cnt[${x}]${x in state.counts ? '' : '（键不存在，默认返回 0）'}。频次表和 ans 不改变。${wrongOrder ? '这个次数包含当前元素自己。' : '这个次数就是本轮可新增的数对数量。'}`, lines: [9] });
      const added: [number, number][] = [];
      for (let i = 0; i < j + Number(wrongOrder); i++) if (nums[i] === x) added.push([i, j]);
      push({ phase: 'add', contribution: left, added, pairs: [...state.pairs, ...added], ans: state.ans + left,
        title: `累加贡献：ans：${state.ans} → ${state.ans + left}`,
        explanation: wrongOrder
          ? '错误计入 (0,0)：把自己和自己配对，违反 i < j。这是故意错误的解法，不能提交。'
          : `新增 ${left} 对${added.length ? `：${added.map(([i, r]) => `(${i},${r})`).join('、')}` : '：左边还没有相同值'}。频次表不改变。`, lines: [10] });
      if (!wrongOrder) update();
    }
  }
  const last = steps[steps.length - 1];
  // Return is folded into the final teaching action, not counted as an extra comparison/query.
  steps[steps.length - 1] = { ...last, lines: [...last.lines, method === 'optimized' ? 13 : 11] };
  return steps;
}

export function gradeQuiz(first: string, answer: string, count: string, reason: string): boolean[] {
  const is = (value: string, expected: number) => /^\d+$/.test(value.trim()) && Number(value) === expected;
  return [is(first, 1), is(answer, 1) && is(count, 2), reason === 'self'];
}
