import { buildPrefixTrace, DEFAULTS, EXAMPLES, parseParameters, type Fault, type Lesson, type Method, type Parameters } from '../lib/prefix-sum';

const pauses: (() => void)[] = [];
const pauseAll = () => pauses.forEach(pause => pause());
function initialize(root: HTMLElement) {
  const lesson = root.dataset.prefixLesson as Lesson;
  const experiment = root.dataset.experiment === 'true';
  const find = <T extends HTMLElement = HTMLElement>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing prefix course element: ${selector}`);
    return element;
  };
  const out = (name: string, value: string | number) => { find(`[data-p="${name}"]`).textContent = String(value); };
  const button = (action: string) => find<HTMLButtonElement>(`[data-action="${action}"]`);
  let params: Parameters = { ...DEFAULTS[lesson], nums: [...DEFAULTS[lesson].nums] };
  if (experiment) params = lesson === 'range' ? { nums: [5], left: 0, right: 0, k: 1 }
    : lesson === 'count' ? { nums: [0], left: 0, right: 0, k: 0 } : { nums: [-1, 5], left: 0, right: 1, k: 5 };
  let method: Method = 'optimized';
  let fault: Fault = 'none';
  let trace = buildPrefixTrace(lesson, params, method);
  let position = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const pause = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    if (!experiment) { button('play').textContent = '播放'; button('play').setAttribute('aria-pressed', 'false'); }
  };
  pauses.push(pause);
  function fillDraft() {
    if (experiment) return;
    find<HTMLInputElement>('[name="nums"]').value = params.nums.join(', ');
    for (const name of lesson === 'range' ? ['left', 'right'] as const : ['k'] as const) find<HTMLInputElement>(`[name="${name}"]`).value = String(params[name]);
    out('error', ''); out('draft', '');
  }
  const cells = (values: (number | null)[], selected: number[], prefix = false) => values.map((value, index) => {
    const cell = document.createElement('div');
    const active = selected.includes(index);
    cell.className = `array-cell ${active ? 'current' : prefix && value !== null ? 'history' : 'future'}`;
    const label = document.createElement('small'); label.textContent = prefix ? `P[${index}]` : `下标 ${index}`;
    const number = document.createElement('strong'); number.textContent = value === null ? '?' : String(value);
    const note = document.createElement('span'); note.textContent = active ? '本步关注' : prefix ? value === null ? '未计算' : index === 0 ? '空前缀' : `前 ${index} 项` : '原数组';
    cell.append(label, number, note); return cell;
  });
  function render() {
    const s = trace[position]; const done = position === trace.length - 1;
    out('position', `${position} / ${trace.length - 1} 步`);
    out('input', `[${params.nums.join(', ')}]`);
    out('parameters', lesson === 'range' ? `已应用闭区间 [${params.left},${params.right}]（包含两端）` : `已应用 K = ${params.k}；只统计非空连续子数组`);
    out('mode', fault !== 'none' ? '故意错误的做法' : method === 'optimized' ? '前缀解法' : '暴力解法');
    root.classList.toggle('wrong-order', fault !== 'none');
    find('[data-p="array"]').replaceChildren(...cells(params.nums, s.selected));
    find('[data-prefix-row]').hidden = method === 'brute';
    find('[data-p="prefix"]').replaceChildren(...cells(s.prefix, s.prefixSelected, true));
    out('phase', position === 0 ? '初始状态' : `动作 ${position}`); out('title', s.title); out('explanation', s.explanation);
    out('answer', s.ans ?? '尚未计算'); out('cur', s.cur);
    out('cur-label', method === 'brute' ? '当前区间累加和 sum' : lesson === 'range' ? '右侧前缀 whole' : '当前前缀 cur');
    if (lesson === 'range' && method === 'optimized' && ['initial', 'build'].includes(s.phase)) out('cur', '未读取');
    if (lesson === 'range' && method === 'brute') out('cur', s.ans ?? 0);
    out('hit', lesson === 'range' ? method === 'brute' ? '不使用' : s.need ?? '未读取' : s.hit ?? '未查询');
    if (lesson === 'range') {
      out('history', method === 'brute' ? '逐项读取区间内元素，不构造前缀表。' : `前缀已计算到 P[${s.built}]；一次构造可供后续多个区间查询复用。`);
      out('need', `闭区间 [${params.left},${params.right}] 的正确公式：P[${params.right + 1}] − P[${params.left}]。`);
    } else {
      out('history', method === 'brute' ? '暴力逐个检查所有候选区间，不使用频次表。'
        : `${fault === 'sentinel' ? '遗漏 P[0]；' : '包含空前缀 P[0]；'}历史已记录至 ${s.historyEnd < 0 ? '尚无前缀' : `P[${s.historyEnd}]`}。${s.index === null ? '' : s.historyEnd === s.index + 1 ? '已包含当前前缀。' : '还不包含当前前缀。'}`);
      out('need', method === 'brute' ? '向右延伸一格就累加一个数，换左端点时重新从 0 累加。'
        : `${lesson === 'count' ? '待匹配的历史前缀 need' : '待匹配的余数 mod'}：${s.need ?? '尚未计算'}。`);
    }
    const map = find('[data-p="counts"]'); map.replaceChildren();
    if (lesson !== 'range' && method === 'optimized') {
      if (!Object.keys(s.counts).length) map.textContent = '频次表为空 {}';
      Object.entries(s.counts).sort(([a], [b]) => Number(a) - Number(b)).forEach(([key, count]) => {
        const item = document.createElement('span');
        const active = s.need !== null && Number(key) === s.need && ['key', 'query', 'add'].includes(s.phase);
        item.className = `map-entry${active ? ' active' : ''}`;
        item.textContent = `${key} → ${count}${active ? ' ← 查询键' : ''}`; map.append(item);
      });
      if (s.phase === 'query' && s.need !== null && !(s.need in s.counts)) {
        const item = document.createElement('span'); item.className = 'map-entry active'; item.textContent = `${s.need} 不存在 → 读取 0，未插入`; map.append(item);
      }
    }
    out('intervals', lesson === 'range' ? '高亮显示本动作涉及的原数组元素及前缀位置。'
      : `已计入区间（原数组闭区间）：${s.intervals.length ? s.intervals.map(([l, r]) => `[${l},${r}]${l > r ? '（非法空区间）' : ''}`).join('、') : '无'}`);
    out('ledger', lesson === 'range' ? method === 'optimized' ? `本轮构造 ${s.builds} 项 · 查询读取 ${s.reads} 次 · 区间相减 ${s.phase === 'subtract' ? 1 : 0} 次`
      : `读取并累加 ${s.reads} / ${params.right - params.left + 1} 个区间元素`
      : method === 'optimized' ? `累计前缀 ${s.index === null ? 0 : s.index + 1} / ${params.nums.length} 项 · 匹配查询 ${s.queries} 次 · 记录频次 ${s.updates} 次（不含初始空前缀）`
        : `候选区间检查 ${s.checks} / ${params.nums.length * (params.nums.length + 1) / 2} 次`);
    out('completion', `演示结束 · ${fault === 'none' ? '结果' : '错误做法的结果'} ${s.ans}${fault === 'none' ? '。可回退复盘；播放完不等于已掌握。' : `；正确结果为 ${buildPrefixTrace(lesson, params, 'optimized').at(-1)!.ans}。`}`);
    find('[data-p="completion"]').hidden = !done;
    button('prev').disabled = position === 0; button('next').disabled = done;
    if (!experiment) button('play').disabled = done;
    if (done) pause();
    root.querySelectorAll<HTMLElement>('[data-prefix-code]').forEach(block => {
      block.hidden = block.dataset.prefixCode !== method;
      block.querySelectorAll<HTMLElement>('[data-line]').forEach(line => {
        const active = !block.hidden && s.lines.includes(Number(line.dataset.line));
        line.classList.toggle('executed', active);
        if (active) line.setAttribute('aria-current', 'step'); else line.removeAttribute('aria-current');
      });
    });
  }
  function restart(reuse = false) { pause(); position = 0; trace = buildPrefixTrace(lesson, params, method, fault, reuse); render(); }
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(control => control.addEventListener('click', () => {
    method = control.dataset.mode === 'brute' ? 'brute' : 'optimized';
    fault = ['optimized', 'brute'].includes(control.dataset.mode!) ? 'none' : control.dataset.mode as Fault;
    root.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === control)));
    restart();
  }));
  button('prev').addEventListener('click', () => { pause(); position = Math.max(0, position - 1); render(); });
  button('next').addEventListener('click', () => { pause(); position = Math.min(trace.length - 1, position + 1); render(); });
  button('reset').addEventListener('click', () => { fillDraft(); restart(); });
  if (!experiment) {
    button('play').addEventListener('click', () => {
      if (timer !== undefined) return pause();
      if (position === trace.length - 1) return;
      timer = setInterval(() => { position = Math.min(trace.length - 1, position + 1); render(); }, 1000);
      button('play').textContent = '暂停'; button('play').setAttribute('aria-pressed', 'true');
    });
    const form = find<HTMLFormElement>('form');
    form.addEventListener('input', () => { pause(); out('draft', '编辑尚未应用；图形、解释与答案仍使用已应用数据。'); });
    form.addEventListener('submit', event => {
      event.preventDefault(); pause();
      const data = new FormData(form); const value = (name: string) => String(data.get(name) ?? '');
      try {
        const next = parseParameters(lesson, value('nums'), value('left'), value('right'), value('k'));
        const reuse = lesson === 'range' && method === 'optimized' && trace[position].built === params.nums.length && next.nums.join(',') === params.nums.join(',');
        params = next; fillDraft(); restart(reuse); out('draft', reuse ? '区间已应用；复用已建好的前缀数组。' : '输入已应用，推演从初始状态开始。');
      } catch (error) { out('error', error instanceof Error ? error.message : '输入无效。'); out('draft', '应用失败，原演示与步骤保持不变。'); }
    });
    root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(control => control.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(EXAMPLES[lesson][control.dataset.copy as Method]); out('copy', '已复制完整 Java 示例。'); }
      catch { out('copy', '自动复制不可用，请选中代码手动复制。'); }
    }));
  } else {
    root.addEventListener('focusin', pauseAll); root.addEventListener('pointerdown', pauseAll);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) pauseAll(); }, { threshold: .1 }).observe(root);
  }
  render(); find<HTMLFieldSetElement>('.player-controls').disabled = false; find('.player-failure').hidden = true; root.dataset.ready = 'true';
}
document.querySelectorAll<HTMLElement>('[data-prefix-lesson]').forEach(root => {
  try { initialize(root); } catch (error) { console.error('Prefix lesson initialization failed', error); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
window.addEventListener('blur', pauseAll); window.addEventListener('pagehide', pauseAll);
document.querySelectorAll('a[href="#experiment"]').forEach(link => link.addEventListener('click', pauseAll));
document.querySelectorAll('a[href="#prefix-java"]').forEach(link => link.addEventListener('click', () => { document.querySelector<HTMLDetailsElement>('#prefix-java')!.open = true; }));

const answers = {
  range: ['4', '2', 'P[3]=2−1+3=4。', 'P[3]−P[1]=4−2=2。', '闭区间包含 r，所以要用 pre[r+1]−pre[l]。'],
  count: ['0', '2', 'cur=1−1=0，need=cur−K=0。', '合法区间是 [0,1] 和 [1,2]，共 2 段。', '空前缀位于所有元素之前，能与当前前缀相减，计入从下标 0 开始的区间。'],
  divisible: ['4', '1', 'Java 的 -1%5 为 -1；(-1+5)%5=4。', '只有闭区间 [1,1]，其和为 5。', '统一到 0～K−1，数学上同余的前缀才会匹配。'],
};
document.querySelectorAll<HTMLFormElement>('[data-prefix-quiz]').forEach(form => {
  form.querySelector<HTMLFieldSetElement>('fieldset')!.disabled = false;
  form.querySelector<HTMLElement>('[data-quiz-loading]')!.hidden = true;
  form.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(form); const key = answers[form.dataset.prefixQuiz as Lesson];
    const numeric = (name: string, correct: string) => /^[+-]?\d+$/.test(String(data.get(name)).trim()) && Number(data.get(name)) === Number(correct);
    const result = [numeric('one', key[0]), numeric('two', key[1]), data.get('reason') === '1'];
    form.querySelectorAll<HTMLElement>('[data-feedback]').forEach((element, i) => {
      element.textContent = `${result[i] ? '答对了。' : '还需要想一想。'}${i < 2 ? `正确答案：${key[i]}。` : ''}${key[i + 2]}`;
      element.classList.toggle('correct', result[i]);
    });
    form.querySelector<HTMLElement>('[data-quiz-result]')!.textContent = `本轮答对 ${result.filter(Boolean).length} / 3 题。可修改后再答，不代表已掌握整个专题。`;
  });
  form.addEventListener('reset', () => form.querySelectorAll('[data-feedback], [data-quiz-result]').forEach(node => { node.textContent = ''; }));
});
