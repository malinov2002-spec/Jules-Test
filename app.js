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
    enhanceBtn: $('enhanceBtn'),
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
    aiStatusBar: $('aiStatusBar'),
    // AI Settings modal
    aiSettingsBtn: $('aiSettingsBtn'),
    settingsModal: $('settingsModal'),
    modalCloseBtn: $('modalCloseBtn'),
    aiCancelBtn: $('aiCancelBtn'),
    aiSaveBtn: $('aiSaveBtn'),
    aiTestBtn: $('aiTestBtn'),
    aiProvider: $('aiProvider'),
    aiKey: $('aiKey'),
    aiModel: $('aiModel'),
    aiInstructions: $('aiInstructions'),
    aiTestResult: $('aiTestResult'),
    keyHelp: $('keyHelp'),
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
  function render(result, inputs, meta = {}) {
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
    if (meta.ai) {
      const providerLabel = meta.provider === 'openai' ? 'OpenAI' : 'Claude';
      summary.push(`<span class="ai-badge">✨ AI: ${escapeHtml(providerLabel)} ${escapeHtml(meta.model || '')}</span>`);
    }

    const summaryHtml = summary.length
      ? `<div class="context-summary">${summary.join(' &nbsp;·&nbsp; ')}</div>`
      : '';

    els.output.innerHTML = `
      ${summaryHtml}
      ${stageHtml('s', 'S', 'Situation', 'Open the conversation. Confirm facts, build rapport.', result.situationQs)}
      ${stageHtml('p', 'P', 'Problem', 'Get them to verbalize their pain in their own words.', result.problemQs)}
      ${stageHtml('i', 'I', 'Implication', 'Expand the pain. Make them feel the cost of doing nothing.', result.implicationQs)}
      ${stageHtml('n', 'N', 'Need-Payoff', 'Lead them to picture the value — let them sell themselves.', result.needPayoffQs)}
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

  function stageHtml(key, letter, title, subtitle, items) {
    const lis = items.map((q) => `<li>${escapeHtml(q)}</li>`).join('');
    return `
      <div class="stage ${key}" data-stage="${key}">
        <div class="stage-header">
          <div class="stage-titleblock">
            <div class="stage-letter">${escapeHtml(letter)}</div>
            <div>
              <div class="stage-title">${escapeHtml(title)} Questions</div>
              <div class="stage-subtitle">${escapeHtml(subtitle)}</div>
            </div>
          </div>
          <button class="copy-stage-btn" data-target="${key}">Copy</button>
        </div>
        <ul class="stage-content">${lis}</ul>
      </div>
    `;
  }

  function visionHtml(script) {
    return `
      <div class="stage v" data-stage="v">
        <div class="stage-header">
          <div class="stage-titleblock">
            <div class="stage-letter">★</div>
            <div>
              <div class="stage-title">Vision-Casting Script</div>
              <div class="stage-subtitle">Read slowly. Pause after the picture is painted. Let them sit in it.</div>
            </div>
          </div>
          <button class="copy-stage-btn" data-target="v">Copy</button>
        </div>
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

  // ============================================================
  // AI Integration (OpenAI / Anthropic)
  // ============================================================

  const AI_STORAGE_KEY = 'spin_ai_settings_v1';

  const MODELS = {
    openai: [
      { id: 'gpt-4o', label: 'GPT-4o (recommended)' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini (cheaper, faster)' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (cheapest)' },
    ],
    anthropic: [
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7 (most capable)' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest, cheapest)' },
    ],
  };

  const DEFAULT_AI_INSTRUCTIONS = `You are an expert sales coach trained in Neil Rackham's SPIN selling model. You help the user prepare for one-on-one conversations with prospects or candidates.

Your job: take the user's inputs (goal, prospect, current situation, pain points, ideal outcome, stakes) and produce SPIN-framework questions that:
- Sound natural and conversational, not scripted
- Reference the prospect's specific situation, not generic placeholders
- Build emotional weight as they move from Situation → Problem → Implication → Need-Payoff
- End with a vision-casting script that paints the ideal outcome vividly enough that the prospect can picture themselves living it`;

  function loadAiSettings() {
    try { return JSON.parse(localStorage.getItem(AI_STORAGE_KEY)) || {}; }
    catch (_) { return {}; }
  }

  function saveAiSettings(s) {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(s));
  }

  function populateModels(provider) {
    const models = MODELS[provider] || [];
    els.aiModel.innerHTML = models
      .map((m) => `<option value="${m.id}">${escapeHtml(m.label)}</option>`)
      .join('');
  }

  function updateKeyHelp(provider) {
    els.keyHelp.querySelectorAll('span[data-provider]').forEach((span) => {
      span.classList.toggle('hidden', span.dataset.provider !== provider);
    });
  }

  function openSettings() {
    const s = loadAiSettings();
    const provider = s.provider || 'openai';
    els.aiProvider.value = provider;
    populateModels(provider);
    updateKeyHelp(provider);
    els.aiKey.value = s.key || '';
    els.aiModel.value = s.model || MODELS[provider][0].id;
    els.aiInstructions.value = s.instructions || '';
    els.aiTestResult.classList.add('hidden');
    els.settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    els.settingsModal.classList.add('hidden');
  }

  function showAiStatus(msg, kind = 'info') {
    els.aiStatusBar.textContent = msg;
    els.aiStatusBar.className = 'ai-status-bar ' + (kind === 'info' ? '' : kind);
    els.aiStatusBar.classList.remove('hidden');
  }

  function hideAiStatus() {
    els.aiStatusBar.classList.add('hidden');
  }

  function buildAiUserPrompt(inputs) {
    const lines = [];
    if (inputs.goal) lines.push(`GOAL: ${inputs.goal}`);
    if (inputs.prospectName || inputs.prospectRole) {
      lines.push(`PROSPECT: ${inputs.prospectName || '(unnamed)'}${inputs.prospectRole ? ` — ${inputs.prospectRole}` : ''}`);
    }
    if (inputs.situation) lines.push(`SITUATION (current state, facts known):\n${inputs.situation}`);
    if (inputs.problems.length) lines.push(`PAIN POINTS / PROBLEMS:\n${inputs.problems.map(p => '- ' + p).join('\n')}`);
    if (inputs.outcome.length) lines.push(`IDEAL OUTCOME:\n${inputs.outcome.map(o => '- ' + o).join('\n')}`);
    if (inputs.stakes) lines.push(`WHAT'S AT STAKE IF NOTHING CHANGES:\n${inputs.stakes}`);

    return lines.join('\n\n') + `

Generate 5–7 questions per SPIN stage, plus a vision-casting script.

Return ONLY a valid JSON object — no markdown fences, no commentary — with this exact shape:

{
  "situationQs": ["...", "..."],
  "problemQs": ["...", "..."],
  "implicationQs": ["...", "..."],
  "needPayoffQs": ["...", "..."],
  "visionScript": "A single flowing paragraph that paints the ideal outcome vividly, ending with a question that invites them to picture themselves there."
}`;
  }

  function buildAiSystemPrompt(customInstructions) {
    const base = customInstructions && customInstructions.trim()
      ? customInstructions.trim()
      : DEFAULT_AI_INSTRUCTIONS;

    return base + `

When responding, always return strict JSON with this shape and no other text:
{
  "situationQs": string[],
  "problemQs": string[],
  "implicationQs": string[],
  "needPayoffQs": string[],
  "visionScript": string
}`;
  }

  async function callOpenAI({ key, model, system, user }) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 400)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned no content.');
    return JSON.parse(content);
  }

  async function callAnthropic({ key, model, system, user }) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 400)}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) throw new Error('Anthropic returned no content.');
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    return JSON.parse(cleaned);
  }

  async function aiGenerate(inputs) {
    const s = loadAiSettings();
    if (!s.key || !s.provider) {
      throw new Error('No API key configured. Open AI Settings to add one.');
    }
    const system = buildAiSystemPrompt(s.instructions);
    const user = buildAiUserPrompt(inputs);
    const args = { key: s.key, model: s.model || MODELS[s.provider][0].id, system, user };
    if (s.provider === 'openai') return callOpenAI(args);
    if (s.provider === 'anthropic') return callAnthropic(args);
    throw new Error(`Unknown provider: ${s.provider}`);
  }

  async function testAiConnection() {
    const provider = els.aiProvider.value;
    const key = els.aiKey.value.trim();
    const model = els.aiModel.value;

    if (!key) {
      showTestResult('Enter an API key first.', 'error');
      return;
    }

    showTestResult('Testing connection...', 'info');
    els.aiTestBtn.disabled = true;

    try {
      const args = {
        key,
        model,
        system: 'You respond with valid JSON only.',
        user: 'Respond with exactly this JSON and nothing else: {"ok": true}',
      };
      const result = provider === 'openai' ? await callOpenAI(args) : await callAnthropic(args);
      if (result && result.ok) {
        showTestResult(`✓ Connected to ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} using ${model}.`, 'success');
      } else {
        showTestResult(`Connected, but unexpected response: ${JSON.stringify(result).slice(0, 200)}`, 'success');
      }
    } catch (err) {
      showTestResult(`✗ ${err.message}`, 'error');
    } finally {
      els.aiTestBtn.disabled = false;
    }
  }

  function showTestResult(msg, kind) {
    els.aiTestResult.textContent = msg;
    els.aiTestResult.className = 'ai-test-result ' + kind;
    els.aiTestResult.classList.remove('hidden');
  }

  function validateAiResponse(r) {
    const required = ['situationQs', 'problemQs', 'implicationQs', 'needPayoffQs', 'visionScript'];
    for (const k of required) {
      if (!(k in r)) throw new Error(`AI response missing field: ${k}`);
    }
    for (const k of ['situationQs', 'problemQs', 'implicationQs', 'needPayoffQs']) {
      if (!Array.isArray(r[k])) throw new Error(`AI response field ${k} must be an array`);
    }
    return r;
  }

  // ---------- AI Event Wiring ----------
  els.aiSettingsBtn.addEventListener('click', openSettings);
  els.modalCloseBtn.addEventListener('click', closeSettings);
  els.aiCancelBtn.addEventListener('click', closeSettings);
  els.settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettings);

  els.aiProvider.addEventListener('change', (e) => {
    populateModels(e.target.value);
    updateKeyHelp(e.target.value);
    els.aiTestResult.classList.add('hidden');
  });

  els.aiSaveBtn.addEventListener('click', () => {
    const settings = {
      provider: els.aiProvider.value,
      key: els.aiKey.value.trim(),
      model: els.aiModel.value,
      instructions: els.aiInstructions.value,
    };
    saveAiSettings(settings);
    closeSettings();
    if (settings.key) {
      toast('AI settings saved — Enhance with AI is ready.');
    } else {
      toast('Settings saved (no API key — AI disabled).');
    }
  });

  els.aiTestBtn.addEventListener('click', testAiConnection);

  els.enhanceBtn.addEventListener('click', async () => {
    const inputs = getInputs();
    if (!inputs.goal && !inputs.problems.length && !inputs.situation) {
      toast('Add at least a goal or some problems first.');
      return;
    }

    const s = loadAiSettings();
    if (!s.key) {
      showAiStatus('No API key configured. Click ⚙ AI Settings (top right) to add one.', 'error');
      openSettings();
      return;
    }

    els.enhanceBtn.classList.add('loading');
    els.enhanceBtn.disabled = true;
    els.generateBtn.disabled = true;
    showAiStatus(`Generating with ${s.provider === 'openai' ? 'OpenAI' : 'Claude'} (${s.model})...`, 'info');

    try {
      const result = await aiGenerate(inputs);
      validateAiResponse(result);
      render(result, inputs, { ai: true, provider: s.provider, model: s.model });
      showAiStatus(`✓ Generated with ${s.provider === 'openai' ? 'OpenAI' : 'Claude'} (${s.model}).`, 'success');
      setTimeout(hideAiStatus, 4000);
      els.output.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      showAiStatus(`✗ ${err.message}`, 'error');
    } finally {
      els.enhanceBtn.classList.remove('loading');
      els.enhanceBtn.disabled = false;
      els.generateBtn.disabled = false;
    }
  });

  // Init
  refreshSessionPicker();
})();
