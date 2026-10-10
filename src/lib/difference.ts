export type Lesson = 'range' | 'capacity' | 'shift';
export type Method = 'diff' | 'brute';
export type Fault = 'none' | 'boundary' | 'exit' | 'modulo';
export type Operation = [number, number, number]; // start, end, delta; capacity end is exclusive
export interface Input { base: number[]; word: string; ops: Operation[]; capacity: number }
export interface Step {
  title: string; explanation: string; phase: string; op: number | null; index: number | null;
  diff: Record<number, number>; values: (number | string | null)[]; active: number;
  peak: number; violation: number | null; writes: number; scans: number; lines: number[];
}
export const NAMES: Record<Lesson, string> = { range: '区间加减', capacity: '拼车容量扫描', shift: '字母移位' };
export const DEFAULTS: Record<Lesson, Input> = {
  range: { base: [0, 0, 0, 0, 0, 0], word: '', ops: [[1, 3, 2], [2, 5, 1]], capacity: 0 },
  capacity: { base: [], word: '', ops: [[1, 5, 2], [3, 7, 3]], capacity: 4 },
  shift: { base: [0, 1, 2], word: 'abc', ops: [[0, 1, -1], [1, 2, 1]], capacity: 0 },
};
export const EXPERIMENTS: Record<Lesson, Input> = {
  range: { base: [0, 0, 0], word: '', ops: [[0, 1, 2]], capacity: 0 },
  capacity: { base: [], word: '', ops: [[1, 3, 2], [3, 5, 2]], capacity: 2 },
  shift: { base: [0], word: 'a', ops: [[0, 0, -1]], capacity: 0 },
};
export const JAVA: Record<Lesson, Record<Method, string>> = {
  range: {
    diff: `class Solution {
    public long[] rangeAdd(int[] base, int[][] ops) {
        int n = base.length;
        long[] diff = new long[n + 1];
        for (int i = 0; i < n; i++) {
            diff[i] = (long) base[i] - (i == 0 ? 0L : base[i - 1]);
        }
        for (int[] op : ops) {
            diff[op[0]] += op[2];
            diff[op[1] + 1] -= op[2];
        }
        long[] result = new long[n];
        long active = 0L;
        for (int i = 0; i < n; i++) {
            active += diff[i];
            result[i] = active;
        }
        return result;
    }
}`,
    brute: `class Solution {
    public long[] rangeAdd(int[] base, int[][] ops) {
        long[] result = new long[base.length];
        for (int i = 0; i < base.length; i++) result[i] = base[i];
        for (int[] op : ops) {
            for (int i = op[0]; i <= op[1]; i++) {
                result[i] += op[2];
            }
        }
        return result;
    }
}`,
  },
  capacity: {
    diff: `import java.util.Map;
import java.util.TreeMap;
class Solution {
    public long peakPassengers(int[][] trips) {
        TreeMap<Long, Long> events = new TreeMap<>();
        for (int[] t : trips) { // [start, end, passengers]
            events.merge((long) t[0], (long) t[2], Long::sum);
            events.merge((long) t[1], -(long) t[2], Long::sum);
        }
        long active = 0L, peak = 0L;
        for (Map.Entry<Long, Long> e : events.entrySet()) {
            active += e.getValue();
            peak = Math.max(peak, active);
        }
        return peak; // feasible iff peak <= capacity
    }
}`,
    brute: `import java.util.TreeSet;
class Solution {
    public long peakPassengers(int[][] trips) {
        TreeSet<Integer> points = new TreeSet<>();
        for (int[] t : trips) { points.add(t[0]); points.add(t[1]); }
        long peak = 0L;
        for (int x : points) {
            long active = 0L;
            for (int[] t : trips) {
                if (t[0] <= x && x < t[1]) active += t[2];
            }
            peak = Math.max(peak, active);
        }
        return peak;
    }
}`,
  },
  shift: {
    diff: `class Solution {
    public String shift(String text, int[][] ops) {
        int n = text.length();
        long[] diff = new long[n + 1];
        for (int[] op : ops) {
            diff[op[0]] += op[2];
            diff[op[1] + 1] -= op[2];
        }
        char[] result = text.toCharArray();
        long active = 0L;
        for (int i = 0; i < n; i++) {
            active += diff[i];
            int code = (int) (((text.charAt(i) - 'a' + active) % 26 + 26) % 26);
            result[i] = (char) ('a' + code);
        }
        return new String(result);
    }
}`,
    brute: `class Solution {
    public String shift(String text, int[][] ops) {
        char[] result = text.toCharArray();
        for (int[] op : ops) {
            for (int i = op[0]; i <= op[1]; i++) {
                long raw = result[i] - 'a' + (long) op[2];
                int code = (int) ((raw % 26 + 26) % 26);
                result[i] = (char) ('a' + code);
            }
        }
        return new String(result);
    }
}`,
  },
};
function integer(text: string, label: string, min: number, max: number) {
  const normalized = text.trim().replaceAll('−', '-');
  const value = Number(normalized);
  if (!/^[+-]?\d+$/.test(normalized) || !Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label}需为 ${min}～${max} 的整数。`);
  return value;
}
export function parseInput(lesson: Lesson, rawBase: string, rawOps: string, rawCapacity: string): Input {
  const p: Input = { base: [], word: '', ops: [], capacity: 0 };
  if (lesson === 'shift') {
    p.word = rawBase.trim();
    if (!/^[a-z]{1,12}$/.test(p.word)) throw new Error('字符串需为 1～12 个小写英文字母。');
    p.base = [...p.word].map(c => c.charCodeAt(0) - 97);
  } else if (lesson === 'range') {
    p.base = rawBase.trim().replace(/^\[(.*)\]$/, '$1').replaceAll('，', ',').split(',').map(s => integer(s, '数组元素', -99, 99));
    if (p.base.length > 12) throw new Error('数组最多 12 个元素。');
  } else p.capacity = integer(rawCapacity, '容量', 0, 999);
  const rows = rawOps.trim() ? rawOps.trim().split(/[;；\n]/).filter(row => row.trim()) : [];
  if (rows.length > 8) throw new Error('最多支持 8 条操作。');
  p.ops = rows.map((row, i) => {
    const pieces = row.trim().replace(/^\[(.*)\]$/, '$1').replaceAll('，', ',').split(',');
    if (pieces.length !== 3) throw new Error(`第 ${i + 1} 条需三个整数：起点,终点,${lesson === 'capacity' ? '人数' : '增量'}。`);
    const upper = lesson === 'capacity' ? 1_000_000_000 : p.base.length - 1;
    const l = integer(pieces[0], '起点', 0, upper), r = integer(pieces[1], '终点', 0, upper);
    if (l > r || (lesson === 'capacity' && l === r)) throw new Error(lesson === 'capacity' ? '行程必须 start < end。' : '闭区间必须 l ≤ r。');
    return [l, r, integer(pieces[2], lesson === 'capacity' ? '人数' : '增量', lesson === 'capacity' ? 1 : -99, 99)];
  });
  return p;
}
export const formatOps = (p: Input) => p.ops.map(op => op.join(', ')).join('; ');
export const coordinates = (lesson: Lesson, p: Input) => lesson === 'capacity'
  ? [...new Set(p.ops.flatMap(([l, r]) => [l, r]))].sort((a, b) => a - b)
  : Array.from({ length: p.base.length + 1 }, (_, i) => i);
const letter = (raw: number, broken = false) => String.fromCharCode(97 + (broken ? raw % 26 : (raw % 26 + 26) % 26));

/** Each step owns its arrays and map so backwards navigation restores every field. */
export function buildTrace(lesson: Lesson, p: Input, method: Method, fault: Fault = 'none'): Step[] {
  const points = coordinates(lesson, p);
  let s: Step = { title: '初始状态 · 尚未开始', explanation: lesson === 'capacity' ? '先整理事件坐标；尚未统计峰值。' : '打标阶段不显示最终结果，? 表示尚未还原。', phase: 'initial', op: null, index: null,
    diff: Object.fromEntries(points.map(x => [x, 0])), values: method === 'brute' && lesson !== 'capacity' ? lesson === 'shift' ? [...p.word] : [...p.base] : Array(lesson === 'capacity' ? points.length : p.base.length).fill(null),
    active: 0, peak: 0, violation: null, writes: 0, scans: 0, lines: [] };
  const trace: Step[] = [];
  const push = (patch: Partial<Step>) => { s = { ...s, ...patch }; s = { ...s, diff: { ...s.diff }, values: [...s.values], lines: [...s.lines] }; trace.push(s); };
  push({});
  if (method === 'diff') {
    if (lesson === 'range') p.base.forEach((v, i) => push({ phase: 'build', index: i, diff: { ...s.diff, [i]: v - (p.base[i - 1] ?? 0) }, writes: s.writes + 1, title: `构造 diff[${i}] = ${v} − (${p.base[i - 1] ?? 0})`, explanation: '相邻原值作差；扫描到这里时，原数组的值应改变这么多。', lines: [5, 6] }));
    p.ops.forEach(([l, r, v], op) => {
      push({ phase: 'enter', op, index: l, diff: { ...s.diff, [l]: (s.diff[l] ?? 0) + v }, writes: s.writes + 1,
        title: `进入：${lesson === 'capacity' ? 'events' : 'diff'}[${l}] += ${v}`, explanation: `第 ${op + 1} 条操作从 ${l} 开始生效；此时只完成了一个端点。`, lines: [lesson === 'range' ? 9 : lesson === 'capacity' ? 7 : 6] });
      const end = lesson === 'capacity' ? fault === 'exit' ? r + 1 : r : fault === 'boundary' ? r : r + 1;
      push({ phase: 'exit', index: end, diff: { ...s.diff, [end]: (s.diff[end] ?? 0) - v }, writes: s.writes + 1,
        title: `退出：${lesson === 'capacity' ? 'events' : 'diff'}[${end}] -= ${v}`, explanation: lesson === 'capacity'
          ? fault === 'exit' ? '故意晚一个坐标下车：把半开行程错误当成闭区间。' : '到 end 已经下车，半开区间 [start,end) 在 end 立即失效。相同坐标的增减合并。'
          : fault === 'boundary' ? '故意在 r 提前抵消，右端点被漏掉。' : `闭区间包含 r=${r}，必须到 r+1=${r + 1} 才抵消。${r + 1 === p.base.length ? '这里是哨兵，不是输出元素。' : ''}`, lines: [lesson === 'range' ? 10 : lesson === 'capacity' ? 8 : 7] });
    });
    const scanPoints = lesson === 'capacity' ? Object.keys(s.diff).map(Number).sort((a, b) => a - b) : points.slice(0, -1);
    // Fault experiments can introduce one extra event coordinate.
    if (lesson === 'capacity') s = { ...s, values: Array(scanPoints.length).fill(null) };
    scanPoints.forEach((x, i) => {
      const active = s.active + s.diff[x];
      push({ phase: 'accumulate', op: null, index: x, active, scans: s.scans + 1,
        title: `累计到 ${x}：active = ${s.active} + (${s.diff[x]}) = ${active}`, explanation: lesson === 'capacity' ? '先合并本站全部上下车，再判断本站出发后的载客数；不检查同站事件的虚假中间峰值。' : '累计变化量。先更新 active，下一步再写入当前输出。', lines: [lesson === 'range' ? 15 : 12] });
      const values = [...s.values];
      values[i] = lesson === 'shift' ? letter(p.base[i] + active, fault === 'modulo') : active;
      push({ phase: 'store', values, peak: lesson === 'capacity' ? Math.max(s.peak, active) : 0,
        violation: lesson === 'capacity' && active > p.capacity && s.violation === null ? x : s.violation,
        title: lesson === 'shift' ? `映射字母：${p.word[i]} + (${active}) → ${values[i]}` : lesson === 'capacity' ? `检查容量：${active} ${active > p.capacity ? '>' : '≤'} ${p.capacity}` : `写入 result[${i}] = ${active}`,
        explanation: lesson === 'shift' ? fault === 'modulo' ? `原始余数 ${(p.base[i] + active) % 26} 可能为负，字符越出 a～z。` : '先取模，再 +26 再取模，将编码放回 0～25。'
          : lesson === 'capacity' ? `该状态持续到下一个事件坐标；峰值更新为 ${Math.max(s.peak, active)}。${active > p.capacity ? '已超载，即使之后下车也不能撤销这一事实。' : ''}` : '输出的是累计后的真实值，不能直接拿 diff[i] 当答案。', lines: lesson === 'shift' ? [13, 14] : [lesson === 'range' ? 16 : 13] });
    });
  } else if (lesson === 'capacity') {
    points.forEach((x, i) => {
      push({ phase: 'zero', index: x, active: 0, title: `到候选坐标 ${x}，人数清零重数`, explanation: '只有端点处状态会变化，所以不枚举十亿个坐标；每个端点重新检查全部行程。', lines: [7, 8] });
      p.ops.forEach(([l, r, v], op) => {
        const hit = l <= x && x < r;
        push({ phase: 'check', op, active: s.active + (hit ? v : 0), scans: s.scans + 1,
          title: `检查行程 ${op + 1}：${l} ≤ ${x} < ${r} ${hit ? '成立' : '不成立'}`, explanation: `本次贡献 ${hit ? v : 0} 人。`, lines: [9, 10] });
      });
      const values = [...s.values]; values[i] = s.active;
      push({ phase: 'store', op: null, values, peak: Math.max(s.peak, s.active), violation: s.active > p.capacity && s.violation === null ? x : s.violation,
        title: `坐标 ${x} 共 ${s.active} 人`, explanation: `峰值 ${Math.max(s.peak, s.active)}，容量 ${p.capacity}。`, lines: [12] });
    });
  } else {
    p.ops.forEach(([l, r, v], op) => {
      for (let i = l; i <= r; i++) {
        const values = [...s.values]; const previous = values[i]!;
        values[i] = lesson === 'range' ? Number(previous) + v : letter(String(previous).charCodeAt(0) - 97 + v);
        push({ phase: 'point', op, index: i, values, writes: s.writes + 1, title: `逐项修改位置 ${i}：${previous} → ${values[i]}`, explanation: `第 ${op + 1} 条操作要逐个访问闭区间 [${l},${r}]；重叠位置还会再次修改。`, lines: lesson === 'range' ? [6, 7] : [5, 6, 7, 8] });
      }
    });
  }
  push({ phase: 'done', index: null, op: null, title: '推演完成', explanation: lesson === 'capacity' ? `峰值 ${s.peak}，${s.violation === null ? '全程未超载' : `首次超载坐标 ${s.violation}`}。` : `结果：${lesson === 'shift' ? s.values.join('') : `[${s.values.join(', ')}]`}。`, lines: [lesson === 'range' ? method === 'diff' ? 18 : 10 : lesson === 'capacity' ? method === 'diff' ? 15 : 14 : method === 'diff' ? 16 : 11] });
  return trace;
}
