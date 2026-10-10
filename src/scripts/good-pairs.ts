import { buildTrace, DEFAULT_INPUT, gradeQuiz, JAVA, parseInput, type Method } from '../lib/good-pairs';

const pausePlayers: (() => void)[] = [];

function initialize(root: HTMLElement) {
  const experiment = root.dataset.player === 'experiment';
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`Missing course element: ${selector}`);
    return found;
  };
  const role = (name: string) => el(`[data-role="${name}"]`);
  const button = (name: string) => el<HTMLButtonElement>(`[data-action="${name}"]`);
  let nums = experiment ? [1] : [...DEFAULT_INPUT];
  let method: Method = 'optimized';
  let wrong = false;
  let trace = buildTrace(nums, method);
  let position = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const pause = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    if (!experiment) {
      button('play').textContent = '播放';
      button('play').setAttribute('aria-pressed', 'false');
    }
  };
  pausePlayers.push(pause);
  const text = (name: string, value: string | number) => { role(name).textContent = String(value); };
  const pairsText = (pairs: [number, number][]) => pairs.length ? pairs.map(([i, j]) => `(${i},${j})`).join('、') : '无';
  function render() {
    const state = trace[position];
    const end = position === trace.length - 1;
    text('position', `${position} / ${trace.length - 1} 步`);
    text('input', `[${nums.join(', ')}]`);
    text('method', wrong ? '故意错误的解法' : method === 'optimized' ? '优化扫描' : '暴力枚举');
    root.classList.toggle('wrong-order', wrong);
    text('phase', state.phase === 'initial' ? '初始状态' : `动作 ${position}`);
    text('title', state.title);
    text('explanation', state.explanation);
    text('answer', state.ans);
    text('left', method === 'brute' ? '不使用' : state.left ?? '未查询');
    text('contribution', state.phase === 'add' || state.phase === 'compare' ? state.contribution ?? '—' : '—');
    text('completion', `演示结束 · ${wrong ? '错误结果' : '最终数量'} ${state.ans}${wrong ? '，包含非法数对 (0,0)' : '。可以回退复盘，或换一个输入验证。'}`);
    role('completion').hidden = !end;
    button('prev').disabled = position === 0;
    button('next').disabled = end;
    if (!experiment) button('play').disabled = end;
    if (end) pause();
    text('range', method === 'brute'
      ? `候选范围：i < j。${state.j === null ? '尚未检查。' : `本次右端点 j = ${state.j}，检查左侧 i = ${state.i}。`}`
      : state.historyEnd < 0 ? '频次表覆盖范围：空；尚未加入任何元素。'
        : `频次表覆盖下标 0～${state.historyEnd}${state.historyEnd === state.j ? '，已包含当前元素。' : '，不含当前元素及右侧未来元素。'}`);
    const cells = nums.map((value, index) => {
      const cell = document.createElement('div');
      const current = state.j === index;
      const historical = index <= state.historyEnd;
      const label = current ? (historical && method === 'optimized' ? '当前·已入表' : '当前点') : historical ? '历史区' : '未处理';
      cell.className = `array-cell ${current ? 'current' : historical ? 'history' : 'future'}`;
      if (state.added.some(([i]) => i === index) || state.i === index) cell.classList.add('paired');
      const valueNode = document.createElement('strong'); valueNode.textContent = String(value);
      const indexNode = document.createElement('small'); indexNode.textContent = `下标 ${index}`;
      const labelNode = document.createElement('span'); labelNode.textContent = label;
      cell.append(indexNode, valueNode, labelNode);
      return cell;
    });
    role('array').replaceChildren(...cells);
    const entries = Object.entries(state.counts).sort(([a], [b]) => Number(a) - Number(b));
    role('counts').replaceChildren();
    text('map-note', method === 'brute' ? '暴力解法不使用频次表' : '值 → 出现次数');
    if (!entries.length) role('counts').textContent = method === 'brute' ? '—' : '空表 {}';
    for (const [key, value] of entries) {
      const entry = document.createElement('span');
      entry.className = 'map-entry';
      const active = state.j !== null && Number(key) === nums[state.j] && ['query', 'update', 'add'].includes(state.phase);
      entry.classList.toggle('active', active);
      entry.textContent = `${key} → ${value}${active ? ' ← 当前键' : ''}`;
      role('counts').append(entry);
    }
    if (state.phase === 'query' && state.j !== null && !(nums[state.j] in state.counts)) {
      const absent = document.createElement('span'); absent.className = 'map-entry active';
      absent.textContent = `${nums[state.j]} → 不存在，读取 0（未插入）`; role('counts').append(absent);
    }
    text('candidate', state.i === null ? (state.j === null ? '尚未选中当前元素' : `当前右端点 j = ${state.j}，值 x = ${nums[state.j]}`) : `本次候选：(${state.i},${state.j})`);
    text('added', `本轮已计入：${pairsText(state.added)}`);
    text('pairs', `全部已计入：${pairsText(state.pairs)}`);
    text('ledger', method === 'brute'
      ? `候选数对检查 ${state.checks} / ${nums.length * (nums.length - 1) / 2} 次`
      : `频次查询 ${state.queries} / ${nums.length} 次 · 频次更新 ${state.updates} / ${nums.length} 次`);
    root.querySelectorAll<HTMLElement>('[data-code]').forEach(code => {
      code.hidden = code.dataset.code !== method;
      code.querySelectorAll<HTMLElement>('[data-line]').forEach(line => {
        const active = code.dataset.code === method && state.lines.includes(Number(line.dataset.line));
        line.classList.toggle('executed', active);
        if (active) line.setAttribute('aria-current', 'step'); else line.removeAttribute('aria-current');
      });
    });
  }
  const restart = () => { pause(); position = 0; trace = buildTrace(nums, method, wrong); render(); };
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(control => {
    control.addEventListener('click', () => {
      method = control.dataset.mode === 'brute' ? 'brute' : 'optimized';
      wrong = control.dataset.mode === 'wrong';
      root.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === control)));
      restart();
    });
  });
  button('prev').addEventListener('click', () => { pause(); position = Math.max(0, position - 1); render(); });
  button('next').addEventListener('click', () => { pause(); position = Math.min(trace.length - 1, position + 1); render(); });
  button('reset').addEventListener('click', () => {
    if (!experiment) {
      el<HTMLInputElement>('input[name="nums"]').value = nums.join(', ');
      el('input[name="nums"]').removeAttribute('aria-invalid');
      el('#pairs-input-error').textContent = ''; text('draft', '');
    }
    restart();
  });
  if (!experiment) {
    button('play').addEventListener('click', () => {
      if (timer !== undefined) return pause();
      if (position >= trace.length - 1) return;
      timer = setInterval(() => { position = Math.min(trace.length - 1, position + 1); render(); }, 1000);
      button('play').textContent = '暂停'; button('play').setAttribute('aria-pressed', 'true');
    });
    const input = el<HTMLInputElement>('input[name="nums"]');
    input.addEventListener('input', () => { pause(); text('draft', '编辑内容尚未应用；演示仍使用上方“当前演示数据”。'); });
    el<HTMLFormElement>('form').addEventListener('submit', event => {
      event.preventDefault(); pause();
      try {
        const next = parseInput(input.value);
        nums = next; input.value = nums.join(', '); input.removeAttribute('aria-invalid');
        el('#pairs-input-error').textContent = ''; text('draft', '输入已应用。'); restart();
      } catch (error) {
        input.setAttribute('aria-invalid', 'true');
        el('#pairs-input-error').textContent = error instanceof Error ? error.message : '输入无法识别。';
      }
    });
    root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(control => control.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(JAVA[control.dataset.copy as Method]); text('copy-status', '已复制完整 Java 示例。'); }
      catch { text('copy-status', '自动复制不可用，请在代码区域选中文本复制。'); }
    }));
  } else {
    root.addEventListener('focusin', () => pausePlayers.forEach(stop => stop()));
    root.addEventListener('pointerdown', () => pausePlayers.forEach(stop => stop()));
  }
  render();
  el<HTMLFieldSetElement>('fieldset').disabled = false;
  el('.player-failure').hidden = true;
  root.dataset.ready = 'true';
}

document.querySelectorAll<HTMLElement>('[data-player]').forEach(root => {
  try { initialize(root); } catch (error) { console.error('Good pairs initialization failed', error); }
});
const pauseAll = () => pausePlayers.forEach(pause => pause());
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); });
window.addEventListener('blur', pauseAll);
window.addEventListener('pagehide', pauseAll);
document.querySelectorAll<HTMLAnchorElement>('a[href="#experiment"]').forEach(link => link.addEventListener('click', pauseAll));
document.querySelectorAll<HTMLAnchorElement>('a[href="#java-code"]').forEach(link => link.addEventListener('click', () => {
  const details = document.querySelector<HTMLDetailsElement>('#java-code');
  if (details) details.open = true;
}));
const experiment = document.querySelector('[data-player="experiment"]');
if (experiment && 'IntersectionObserver' in window) {
  new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) pauseAll(); }, { threshold: 0.15 }).observe(experiment);
}

const quiz = document.querySelector<HTMLFormElement>('#pairs-quiz');
if (quiz) {
  const submit = quiz.querySelector<HTMLFieldSetElement>('fieldset')!;
  submit.disabled = false;
  quiz.querySelector<HTMLElement>('[data-quiz-loading]')!.hidden = true;
  quiz.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(quiz);
    const values = ['first', 'answer', 'count', 'reason'].map(key => String(form.get(key) ?? ''));
    const results = gradeQuiz(values[0], values[1], values[2], values[3]);
    const explanations = [
      '正确答案：1 次。处理 j=2 前，左侧是下标 0、1，只有下标 0 的值为 2。',
      '正确答案：ans=1，cnt[2]=2。先新增 (0,2) 这一对，再把当前的 2 加入历史。',
      '正确答案：会把自己与自己配对，违反 i < j。这个顺序要求针对本课的在线扫描解法。',
    ];
    quiz.querySelectorAll<HTMLElement>('[data-feedback]').forEach((feedback, index) => {
      feedback.textContent = `${results[index] ? '答对了。' : '还需要想一想。'}${explanations[index]}`;
      feedback.classList.toggle('correct', results[index]);
    });
    quiz.querySelector<HTMLElement>('[data-quiz-result]')!.textContent = `本轮答对 ${results.filter(Boolean).length} / 3 题。可以修改后再答，或重做。`;
  });
  quiz.addEventListener('reset', () => {
    quiz.querySelectorAll<HTMLElement>('[data-feedback], [data-quiz-result]').forEach(node => { node.textContent = ''; });
  });
}
