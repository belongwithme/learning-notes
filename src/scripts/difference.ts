import { buildTrace, DEFAULTS, EXPERIMENTS, JAVA, formatOps, parseInput, type Fault, type Input, type Lesson, type Method } from '../lib/difference';
const pauses: (() => void)[] = [];
const pauseAll = () => pauses.forEach(pause => pause());
function initialize(root: HTMLElement) {
  const lesson = root.dataset.difference as Lesson, experiment = root.dataset.experiment === 'true';
  const find = <T extends HTMLElement = HTMLElement>(selector: string) => {
    const el = root.querySelector<T>(selector); if (!el) throw new Error(`Missing difference element ${selector}`); return el;
  };
  const out = (name: string, value: string | number) => { find(`[data-d="${name}"]`).textContent = String(value); };
  const button = (name: string) => find<HTMLButtonElement>(`[data-action="${name}"]`);
  let p: Input = structuredClone((experiment ? EXPERIMENTS : DEFAULTS)[lesson]);
  let method: Method = 'diff', fault: Fault = 'none', position = 0;
  let trace = buildTrace(lesson, p, method);
  let timer: ReturnType<typeof setInterval> | undefined;
  const pause = () => { if (timer !== undefined) clearInterval(timer); timer = undefined; if (!experiment) { button('play').textContent = '播放'; button('play').setAttribute('aria-pressed', 'false'); } };
  pauses.push(pause);
  const fill = () => {
    if (experiment) return;
    if (lesson !== 'capacity') find<HTMLInputElement>('[name="base"]').value = lesson === 'range' ? p.base.join(', ') : p.word;
    else find<HTMLInputElement>('[name="capacity"]').value = String(p.capacity);
    find<HTMLTextAreaElement>('[name="ops"]').value = formatOps(p); out('draft', ''); out('error', '');
  };
  const cells = (values: (string | number | null)[], points: number[], active: number | null, diff = false) => values.map((value, i) => {
    const cell = document.createElement('div'), label = document.createElement('small'), number = document.createElement('strong'), note = document.createElement('span');
    const sentinel = diff && lesson !== 'capacity' && i === p.base.length;
    cell.className = `array-cell${active === points[i] ? ' current' : value === null ? '' : ' history'}${sentinel ? ' sentinel' : ''}`;
    label.textContent = `${lesson === 'capacity' ? '坐标' : '下标'} ${points[i]}`; number.textContent = value === null ? '?' : String(value);
    note.textContent = sentinel ? '哨兵 · 不输出' : diff ? '净变化量' : value === null ? '尚未还原' : lesson === 'capacity' ? '从此站出发' : '当前位置结果';
    cell.append(label, number, note); return cell;
  });
  const result = (s: typeof trace[number]) => lesson === 'capacity' ? `峰值 ${s.peak} · ${s.violation === null ? '可承载' : '超载'}` : lesson === 'shift' ? s.values.join('') : `[${s.values.join(', ')}]`;
  function render() {
    const s = trace[position], done = position === trace.length - 1;
    out('position', `${position} / ${trace.length - 1} 步`);
    out('applied', lesson === 'capacity' ? `已应用容量 ${p.capacity}` : `已应用初始值 ${lesson === 'shift' ? p.word : `[${p.base.join(', ')}]`}`);
    out('mode', fault !== 'none' ? '故意错误的做法' : method === 'diff' ? '端点法：批量打标后扫描' : '朴素对照');
    root.classList.toggle('wrong-order', fault !== 'none');
    const ops = p.ops.map(([l, r, v], i) => { const el = document.createElement('span'); el.className = s.op === i ? 'current' : ''; el.textContent = `#${i + 1} [${l},${r}${lesson === 'capacity' ? ')' : ']'} ${v >= 0 ? '+' : ''}${v}${lesson === 'capacity' ? ' 人' : ''}`; return el; });
    find('[data-d="ops"]').replaceChildren(...ops); if (!ops.length) out('ops', '无操作');
    const points = Object.keys(s.diff).map(Number).sort((a, b) => a - b);
    find('[data-diff-row]').hidden = method === 'brute';
    find('[data-d="diff"]').replaceChildren(...cells(points.map(x => s.diff[x]), points, method === 'diff' ? s.index : null, true));
    const valuePoints = lesson === 'capacity' ? points : p.base.map((_, i) => i);
    find('[data-d="values"]').replaceChildren(...cells(s.values, valuePoints, s.index));
    out('title', s.title); out('explanation', s.explanation);
    out('active', method === 'brute' && lesson !== 'capacity' ? '不使用' : s.active);
    out('metric', lesson === 'capacity' ? s.peak : s.op === null ? '—' : s.op + 1);
    out('result', done ? result(s) : '尚未完成');
    out('status', lesson === 'capacity' ? s.violation === null ? '已检查部分未发现超载；结束后才判定全程。' : `首次超载坐标 ${s.violation}，后续下车不改变这个结论。` : '端点打标只改变变化量；还原后才能读取最终数组。');
    if (done && lesson === 'capacity' && s.violation === null) out('status', '全部事件已扫描，全程未超载。');
    out('ledger', lesson === 'capacity' ? method === 'diff' ? `事件合并 ${s.writes} 次 · 扫描 ${s.scans} 个坐标（有序表另有 O(log m) 维护成本）` : `区间包含检查 ${s.scans} 次 · 候选坐标 ${points.length} 个`
      : method === 'diff' ? `差分写入 ${s.writes} 次（${lesson === 'range' ? '含初始构造' : '从零变化量开始'}） · 还原 ${s.scans} / ${p.base.length} 项` : `逐项修改 ${s.writes} 次（不含初始复制）`);
    find('[data-d="comparison"]').hidden = !done || !experiment;
    if (done && experiment) out('comparison', `本次结果：${result(s)}；正确结果：${result(buildTrace(lesson, p, 'diff').at(-1)!)}。`);
    button('prev').disabled = position === 0; button('next').disabled = done;
    if (!experiment) button('play').disabled = done;
    if (done) pause();
    root.querySelectorAll<HTMLElement>('[data-difference-code]').forEach(block => {
      block.hidden = block.dataset.differenceCode !== method;
      block.querySelectorAll<HTMLElement>('[data-line]').forEach(line => {
        const active = !block.hidden && s.lines.includes(Number(line.dataset.line)); line.classList.toggle('executed', active);
        if (active) line.setAttribute('aria-current', 'step'); else line.removeAttribute('aria-current');
      });
    });
  }
  const restart = () => { pause(); position = 0; trace = buildTrace(lesson, p, method, fault); render(); };
  root.querySelectorAll<HTMLButtonElement>('[data-method]').forEach(control => control.addEventListener('click', () => {
    method = control.dataset.method === 'brute' ? 'brute' : 'diff'; fault = ['diff', 'brute'].includes(control.dataset.method!) ? 'none' : control.dataset.method as Fault;
    root.querySelectorAll('[data-method]').forEach(el => el.setAttribute('aria-pressed', String(el === control))); restart();
  }));
  button('prev').addEventListener('click', () => { pause(); position = Math.max(0, position - 1); render(); });
  button('next').addEventListener('click', () => { pause(); position = Math.min(trace.length - 1, position + 1); render(); });
  button('reset').addEventListener('click', () => { fill(); restart(); });
  if (!experiment) {
    button('play').addEventListener('click', () => {
      if (timer !== undefined) return pause();
      if (position === trace.length - 1) return;
      timer = setInterval(() => { position++; render(); }, 1000);
      button('play').textContent = '暂停'; button('play').setAttribute('aria-pressed', 'true');
    });
    find('form').addEventListener('input', () => { pause(); out('draft', '编辑尚未应用；图形和步骤仍使用已应用数据。'); });
    find<HTMLFormElement>('form').addEventListener('submit', event => {
      event.preventDefault(); pause(); const data = new FormData(event.currentTarget as HTMLFormElement);
      try { const next = parseInput(lesson, String(data.get('base') ?? ''), String(data.get('ops') ?? ''), String(data.get('capacity') ?? '')); p = next; fill(); restart(); out('draft', '已应用，推演从初始状态开始。'); }
      catch (error) { out('error', error instanceof Error ? error.message : '输入无效'); out('draft', '应用失败，原数据和步骤保持不变。'); }
    });
    root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(control => control.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(JAVA[lesson][control.dataset.copy as Method]); out('copy', '已复制完整 Java 示例。'); }
      catch { out('copy', '自动复制不可用，请选中代码手动复制。'); }
    }));
  } else {
    root.addEventListener('focusin', pauseAll); root.addEventListener('pointerdown', pauseAll);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) pauseAll(); }, { threshold: .1 }).observe(root);
  }
  render(); find<HTMLFieldSetElement>('.player-controls').disabled = false; find('.player-failure').hidden = true; root.dataset.ready = 'true';
}
document.querySelectorAll<HTMLElement>('[data-difference]').forEach(root => { try { initialize(root); } catch (e) { console.error('Difference course initialization failed', e); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
window.addEventListener('blur', pauseAll); window.addEventListener('pagehide', pauseAll);
document.querySelectorAll('a[href="#experiment"]').forEach(link => link.addEventListener('click', pauseAll));
document.querySelectorAll('a[href="#difference-java"]').forEach(link => link.addEventListener('click', () => { const details = document.querySelector<HTMLDetailsElement>('#difference-java'); if (details) details.open = true; }));
const answers: Record<Lesson, string[]> = {
  range: ['2', '2', '退出点 r+1=2；下标 1 仍在区间里。', '还原后是 [2,2,0]。', 'diff 记录变化，前缀累计恢复真实值。'],
  capacity: ['0', '2', '同站 -2+2=0，人换了一批，总数不变。', '峰值 2，容量 2，未超载。', '同站合并后检查，可避免错误的临时峰值 4。'],
  shift: ['25', '1', '(-1%26+26)%26=25，对应 z。', 'diff[1]-=(-1)，所以退出点为 +1。', 'Java 负数取余可能为负，需要规范化。'],
};
document.querySelectorAll<HTMLFormElement>('[data-difference-quiz]').forEach(form => {
  const key = answers[form.dataset.differenceQuiz as Lesson];
  form.querySelector<HTMLFieldSetElement>('fieldset')!.disabled = false; form.querySelector<HTMLElement>('[data-quiz-loading]')!.hidden = true;
  form.addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(form);
    const numeric = (name: string, answer: string) => { const value = String(data.get(name) ?? '').trim().replaceAll('−', '-'); return /^[+-]?\d+$/.test(value) && Number(value) === Number(answer); };
    const result = [numeric('one', key[0]), numeric('two', key[1]), data.get('reason') === '1'];
    form.querySelectorAll<HTMLElement>('[data-feedback]').forEach((el, i) => { el.textContent = `${result[i] ? '答对了。' : '还需要想一想。'}${i < 2 ? `正确答案：${key[i]}。` : ''}${key[i + 2]}`; el.classList.toggle('correct', result[i]); });
    form.querySelector<HTMLElement>('[data-quiz-result]')!.textContent = `本轮答对 ${result.filter(Boolean).length} / 3 题。可修改后再答，不代表已掌握整个专题。`;
  });
  form.addEventListener('reset', () => form.querySelectorAll<HTMLElement>('[data-feedback], [data-quiz-result]').forEach(el => { el.textContent = ''; el.classList.remove('correct'); }));
});
