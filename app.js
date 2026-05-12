/* SPIN Sales Coach — client-side question generator. */

(() => {
  'use strict';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    goal: $('goal'),
    prospectName: $('prospectName'),
    prospectRole: $('prospectRole'),
    situation: $('situation'),
    problems: $('problems'),
    outcome: $('outcome'),
    stakes: $('stakes'),
    generateBtn: $('generateBtn'),
    saveBtn: $('saveBtn'),
    clearBtn: $('clearBtn'),
    newSessionBtn: $('newSessionBtn'),
    sessionPicker: $('sessionPicker'),
    presetPicker: $('presetPicker'),
    loadPresetBtn: $('loadPresetBtn'),
    output: $('output'),
    emptyState: $('emptyState'),
    copyAllBtn: $('copyAllBtn'),
    printBtn: $('printBtn'),
  };

  // ---------- Presets ----------
  const PRESETS = {
    hireDrivers: {
      goal: 'Hire this driver',
      prospectName: '',
      prospectRole: 'CDL-A Truck Driver',
      situation: 'Currently driving for another carrier. Has CDL-A with clean record. Looking at job options.',
      problems: 'Inconsistent miles and unpredictable paychecks\nDispatcher is hard to reach\nHome time keeps getting pushed back\nOlder truck breaking down on the road\nNo bonuses for safety or fuel efficiency',
      outcome: 'Guaranteed weekly minimum pay\nDedicated dispatcher available 24/7\nHome every weekend\nNewer truck with APU\nSafety + performance bonuses paid out monthly',
      stakes: 'Another year of burnout, missing family time, and falling behind on bills.',
    },
    sellProduct: {
      goal: 'Close the deal / Book a follow-up demo',
      prospectName: '',
      prospectRole: 'Decision maker',
      situation: 'Currently using a manual / legacy process. Team of X people involved.',
      problems: 'Process is slow and error-prone\nHard to get reporting / visibility\nTeam wastes hours on busywork\nCustomers complain about delays',
      outcome: 'Hours saved per week\nReal-time visibility into the numbers\nHappier customers and repeat business\nTeam focused on high-value work',
      stakes: 'Lost revenue and team turnover from the same bottlenecks compounding.',
    },
    recruitTalent: {
      goal: 'Get them to accept the offer',
      prospectName: '',
      prospectRole: 'Candidate',
      situation: 'Currently employed elsewhere. Open to a conversation. Has X years of experience.',
      problems: 'Stuck on projects they don\'t care about\nNo clear growth path\nUnderpaid for their skill level\nBurned out from culture / hours',
      outcome: 'Work on meaningful projects they\'re proud of\nClear growth and ownership\nCompensation that matches their value\nA team that respects boundaries',
      stakes: 'Another year stuck in the same role, watching peers move ahead.',
    },
    closeRenewal: {
      goal: 'Renew the contract (and upsell)',
      prospectName: '',
      prospectRole: 'Existing customer / champion',
      situation: 'On current contract for X months. Using core features. Team size has grown.',
      problems: 'Some features underutilized\nNew use cases not yet covered\nNeed better reporting for leadership\nIntegrations causing manual workarounds',
      outcome: 'Full ROI realized across all teams\nLeadership sees the numbers they need\nNo more manual workarounds\nTeam ready to scale without adding headcount',
      stakes: 'Losing the productivity gains, team going back to old tools, slower decisions.',
    },
  };

  // ---------- Question Templates ----------
  // Tokens: {name}, {role}, {goal}, {problem}, {outcomeItem}, {stakes}
  const TEMPLATES = {
    situation: [
      'Can you walk me through how things are set up right now with {context}?',
      'How long have you been dealing with {context} the way it is today?',
      'Who else is involved or affected by this on your side?',
      'What\'s working well in your current setup — what would you keep?',
      'When you think about your day-to-day, where does most of your time go?',
    ],
    problem: [
      'How often does "{problem}" actually come up for you?',
      'What\'s the hardest part about "{problem}"?',
      'On a scale of 1–10, how frustrating is "{problem}" on a bad week?',
      'When "{problem}" happens, what do you usually have to do to work around it?',
      'Has "{problem}" gotten better, worse, or stayed the same over the last 6 months?',
    ],
    implication: [
      'When "{problem}" happens, what does it cost you — in time, money, or stress?',
      'How does "{problem}" affect the people around you — your family, your team, your customers?',
      'If "{problem}" keeps happening for another 6 or 12 months, where does that leave you?',
      'What\'s the ripple effect when "{problem}" hits — does it slow down anything else?',
      'Have you ever lost out on something important because of "{problem}"?',
    ],
    needPayoff: [
      'If you had "{outcomeItem}" starting next month, what would that change for you?',
      'How much easier would your week be if "{outcomeItem}" was just a given?',
      'What would "{outcomeItem}" mean for you personally — not just for the business?',
      'If we could lock in "{outcomeItem}", how would you feel walking into work on Monday?',
      'Who in your life would notice the difference if "{outcomeItem}" became reality?',
    ],
    stakesGeneric: [
      'If nothing changes between now and this time next year, what does that look like?',
      'What\'s the cost of waiting another 6 months to fix this?',
      'You said "{stakes}" — how much longer can you keep doing that?',
    ],
  };

  // ---------- Helpers ----------
  function getInputs() {
    return {
      goal: els.goal.value.trim(),
      prospectName: els.prospectName.value.trim(),
      prospectRole: els.prospectRole.value.trim(),
      situation: els.situation.value.trim(),
      problems: splitLines(els.problems.value),
      outcome: splitLines(els.outcome.value),
      stakes: els.stakes.value.trim(),
    };
  }

  function setInputs(data) {
    els.goal.value = data.goal || '';
    els.prospectName.value = data.prospectName || '';
    els.prospectRole.value = data.prospectRole || '';
    els.situation.value = data.situation || '';
    els.problems.value = Array.isArray(data.problems) ? data.problems.join('\n') : (data.problems || '');
    els.outcome.value = Array.isArray(data.outcome) ? data.outcome.join('\n') : (data.outcome || '');
    els.stakes.value = data.stakes || '';
  }

  function splitLines(text) {
    return (text || '')
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function pick(arr, n) {
    // Deterministic-ish: pick first n without repeat
    return arr.slice(0, Math.min(n, arr.length));
  }

  function fill(tmpl, vars) {
    return tmpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  }

  function nameOrYou(name) {
    return name ? name : 'you';
  }

  // ---------- Question Generator ----------
  function generate(inputs) {
    const haveProblems = inputs.problems.length > 0;
    const haveOutcome = inputs.outcome.length > 0;

    // SITUATION — 4-5 broad fact-finders
    const situationContext = inputs.situation || 'your current setup';
    const situationQs = TEMPLATES.situation
      .slice(0, 5)
      .map((t) => fill(t, { context: situationContext.split('.')[0].toLowerCase() }));

    // PROBLEM — 2 per pain point (capped), plus a catch-all if none
    const problemQs = [];
    if (haveProblems) {
      inputs.problems.forEach((p, idx) => {
        const picks = pick(TEMPLATES.problem, 2);
        picks.forEach((t) => problemQs.push(fill(t, { problem: p })));
      });
    } else {
      problemQs.push('What\'s the biggest frustration you\'re dealing with right now?');
      problemQs.push('If you could wave a magic wand and fix one thing about your situation, what would it be?');
    }

    // IMPLICATION — 2 per pain point + stakes question if provided
    const implicationQs = [];
    if (haveProblems) {
      inputs.problems.forEach((p) => {
        const picks = pick(TEMPLATES.implication, 2);
        picks.forEach((t) => implicationQs.push(fill(t, { problem: p })));
      });
    }
    if (inputs.stakes) {
      implicationQs.push(fill(TEMPLATES.stakesGeneric[2], { stakes: inputs.stakes }));
    }
    implicationQs.push(TEMPLATES.stakesGeneric[0]);
    implicationQs.push(TEMPLATES.stakesGeneric[1]);

    // NEED-PAYOFF — 2 per outcome item
    const needPayoffQs = [];
    if (haveOutcome) {
      inputs.outcome.forEach((o) => {
        const picks = pick(TEMPLATES.needPayoff, 2);
        picks.forEach((t) => needPayoffQs.push(fill(t, { outcomeItem: o })));
      });
    } else {
      needPayoffQs.push('If we could fix all of this, what would the ideal outcome look like for you?');
      needPayoffQs.push('What would it mean for you personally to have this solved?');
    }

    // VISION SCRIPT — narrative version of the outcome
    const visionScript = buildVisionScript(inputs);

    return {
      situationQs,
      problemQs,
      implicationQs,
      needPayoffQs,
      visionScript,
    };
  }

  function buildVisionScript(inputs) {
    const name = nameOrYou(inputs.prospectName);
    const goal = inputs.goal || 'making this work';

    let intro = `Picture this, ${name} — `;
    if (inputs.outcome.length === 0) {
      return intro + 'imagine waking up Monday knowing the problems you just described are simply… not problems anymore. What does that morning look like?';
    }

    const outcomeBits = inputs.outcome.map((o) => o.toLowerCase().replace(/\.$/, ''));
    const joined =
      outcomeBits.length === 1
        ? outcomeBits[0]
        : outcomeBits.slice(0, -1).join('; ') + '; and ' + outcomeBits[outcomeBits.length - 1];

    let body = `imagine three months from now: ${joined}. `;

    if (inputs.stakes) {
      body += `No more ${inputs.stakes.toLowerCase().replace(/\.$/, '')}. `;
    }

    let close = '';
    if (/hire|recruit|driver|candidate/i.test(goal)) {
      close = `That's the life this role is built for. The question isn't whether it's possible — it's whether you're ready to start next week. What's stopping you?`;
    } else if (/close|sell|deal|demo|renew/i.test(goal)) {
      close = `That's the outcome we build for the people who say yes. The only real question is: how soon do you want to be in that picture?`;
    } else {
      close = `That's the version of this story that's available to you. What would it take for us to start writing it together?`;
    }

    return intro + body + close;
  }

  // ---------- Rendering ----------
  function render(result, inputs) {
    els.emptyState.classList.add('hidden');
    els.output.classList.remove('hidden');
    els.copyAllBtn.disabled = false;
    els.printBtn.disabled = false;

    const summary = [];
    if (inputs.goal) summary.push(`<strong>Goal:</strong> ${escapeHtml(inputs.goal)}`);
    if (inputs.prospectName || inputs.prospectRole) {
      summary.push(
        `<strong>Talking to:</strong> ${escapeHtml(inputs.prospectName || '—')}${
          inputs.prospectRole ? ` (${escapeHtml(inputs.prospectRole)})` : ''
        }`
      );
    }

    const summaryHtml = summary.length
      ? `<div class="context-summary">${summary.join(' &nbsp;·&nbsp; ')}</div>`
      : '';

    els.output.innerHTML = `
      ${summaryHtml}
      ${stageHtml('s', 'S — Situation Questions', 'Open the conversation. Confirm the facts, build rapport, set context.', result.situationQs)}
      ${stageHtml('p', 'P — Problem Questions', 'Get them to verbalize their pain points in their own words.', result.problemQs)}
      ${stageHtml('i', 'I — Implication Questions', 'Expand the pain. Make them feel the cost of doing nothing.', result.implicationQs)}
      ${stageHtml('n', 'N — Need-Payoff Questions', 'Lead them to picture the value of the solution — let them sell themselves.', result.needPayoffQs)}
      ${visionHtml(result.visionScript)}
    `;

    // Wire copy-stage buttons
    els.output.querySelectorAll('.copy-stage-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        const list = els.output.querySelector(`[data-stage="${target}"] .stage-content`);
        if (list) {
          copyText(list.innerText);
          btn.classList.add('copied');
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.textContent = 'Copy';
          }, 1400);
        }
      });
    });
  }

  function stageHtml(key, title, desc, items) {
    const lis = items.map((q) => `<li>${escapeHtml(q)}</li>`).join('');
    return `
      <div class="stage ${key}" data-stage="${key}">
        <div class="stage-header">
          <div class="stage-title">${title}</div>
          <button class="copy-stage-btn" data-target="${key}">Copy</button>
        </div>
        <p class="stage-desc">${desc}</p>
        <ul class="stage-content">${lis}</ul>
      </div>
    `;
  }

  function visionHtml(script) {
    return `
      <div class="stage v" data-stage="v">
        <div class="stage-header">
          <div class="stage-title">★ Vision-Casting Script</div>
          <button class="copy-stage-btn" data-target="v">Copy</button>
        </div>
        <p class="stage-desc">Read this slowly. Pause after the picture is painted. Let them sit in it.</p>
        <div class="vision-script stage-content">${escapeHtml(script)}</div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }
  }

  // ---------- Toast ----------
  let toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  // ---------- Storage ----------
  const STORAGE_KEY = 'spin_sessions_v1';

  function loadSessions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (_) { return {}; }
  }

  function saveSessions(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function refreshSessionPicker(selected) {
    const sessions = loadSessions();
    const names = Object.keys(sessions).sort();
    els.sessionPicker.innerHTML = '<option value="">— Saved sessions —</option>' +
      names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    if (selected) els.sessionPicker.value = selected;
  }

  function saveCurrentSession() {
    const inputs = getInputs();
    const defaultName = inputs.prospectName || inputs.goal || `Session ${new Date().toLocaleString()}`;
    const name = prompt('Save session as:', defaultName);
    if (!name) return;
    const sessions = loadSessions();
    sessions[name] = { ...inputs, savedAt: Date.now() };
    saveSessions(sessions);
    refreshSessionPicker(name);
    toast(`Saved "${name}"`);
  }

  function loadSession(name) {
    if (!name) return;
    const sessions = loadSessions();
    const s = sessions[name];
    if (!s) return;
    setInputs(s);
    toast(`Loaded "${name}"`);
  }

  // ---------- Events ----------
  els.generateBtn.addEventListener('click', () => {
    const inputs = getInputs();
    if (!inputs.goal && !inputs.problems.length && !inputs.situation) {
      toast('Add at least a goal or some problems to generate questions.');
      return;
    }
    const result = generate(inputs);
    render(result, inputs);
    els.output.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  els.saveBtn.addEventListener('click', saveCurrentSession);

  els.clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all fields?')) return;
    setInputs({});
    els.output.classList.add('hidden');
    els.emptyState.classList.remove('hidden');
    els.copyAllBtn.disabled = true;
    els.printBtn.disabled = true;
  });

  els.newSessionBtn.addEventListener('click', () => {
    setInputs({});
    els.sessionPicker.value = '';
    els.output.classList.add('hidden');
    els.emptyState.classList.remove('hidden');
    els.copyAllBtn.disabled = true;
    els.printBtn.disabled = true;
    els.goal.focus();
  });

  els.sessionPicker.addEventListener('change', (e) => loadSession(e.target.value));

  els.loadPresetBtn.addEventListener('click', () => {
    const key = els.presetPicker.value;
    if (!key) { toast('Pick a preset first.'); return; }
    const preset = PRESETS[key];
    if (preset) {
      setInputs(preset);
      toast(`Loaded preset: ${els.presetPicker.options[els.presetPicker.selectedIndex].text}`);
    }
  });

  els.copyAllBtn.addEventListener('click', () => {
    copyText(els.output.innerText);
    toast('Copied full playbook to clipboard.');
  });

  els.printBtn.addEventListener('click', () => window.print());

  // Init
  refreshSessionPicker();
})();
