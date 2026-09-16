/**
 * Seed temporário para prints da landing.
 * Conta logada → console:
 *   await stepzSeedPrints()
 * Depois dos prints:
 *   await stepzWipePrints()
 */
(function stepzSeedPrintsModule() {
  const HABIT_DEFS = [
    { title: 'Yoga', category: 'health', color: '#366b52', weight: 3 },
    { title: 'Quotes', category: 'mind', color: '#735491', weight: 2 },
    { title: 'Leitura 20 min', category: 'learn', color: '#286892', weight: 2 },
    { title: 'Caminhada', category: 'health', color: '#366b52', weight: 2 },
    { title: 'Água 2L', category: 'health', color: '#286892', weight: 1 },
    { title: 'Meditar', category: 'mind', color: '#9f4176', weight: 2 },
    { title: 'Sem redes à noite', category: 'reflect', color: '#5f5e5b', weight: 1 },
    { title: 'Diário', category: 'reflect', color: '#a87626', weight: 1 },
  ];

  const TASK_TITLES = [
    ['Revisar PRs do Stepz', 'career', 'Stepz', ['dev', 'code'], 'high'],
    ['Atualizar landing page', 'career', 'Stepz', ['design'], 'high'],
    ['Casa Marina — orçamento', 'life', 'Casa Marina', ['casa'], 'medium'],
    ['Agendar dentista', 'health', 'Geral', ['saúde'], 'medium'],
    ['Enviar proposta cliente', 'career', 'Trabalho', ['cliente'], 'high'],
    ['Organizar fotos viagem', 'life', 'Pessoal', ['viagem'], 'low'],
    ['Ler capítulo 4', 'learn', 'Estudos', ['leitura'], 'medium'],
    ['Comprar presente aniversário', 'relations', 'Pessoal', ['família'], 'medium'],
    ['Backup do notebook', 'career', 'Trabalho', ['dev'], 'low'],
    ['Planejar sprint', 'career', 'Trabalho', ['planejamento'], 'high'],
    ['Limpar inbox', 'career', 'Trabalho', ['admin'], 'low'],
    ['Treino pernas', 'health', 'Geral', ['treino'], 'medium'],
    ['Atualizar currículo', 'career', 'Carreira', ['job'], 'medium'],
    ['Marcar jantar com Ana', 'relations', 'Pessoal', ['social'], 'low'],
    ['Pagar contas do mês', 'life', 'Casa Marina', ['finanças'], 'high'],
    ['Documentar API auth', 'career', 'Stepz', ['docs', 'dev'], 'medium'],
    ['Escolher livro do mês', 'learn', 'Estudos', ['leitura'], 'low'],
    ['Revisar metas Q3', 'reflect', 'Geral', ['planejamento'], 'medium'],
    ['Instalar atualização NAS', 'life', 'Casa Marina', ['tech'], 'low'],
    ['Preparar demo stakeholders', 'career', 'Trabalho', ['apresentação'], 'high'],
    ['Assinar relatório semanal', 'career', 'Trabalho', ['admin'], 'medium'],
    ['Comprar filtro de água', 'life', 'Casa Marina', ['casa'], 'medium'],
    ['Aula de espanhol — lição 8', 'learn', 'Estudos', ['idioma'], 'medium'],
    ['Responder e-mails atrasados', 'career', 'Trabalho', ['admin'], 'high'],
    ['Montar playlist foco', 'mind', 'Pessoal', ['música'], 'low'],
    ['Revisar seguro do carro', 'life', 'Geral', ['finanças'], 'medium'],
    ['Publicar post LinkedIn', 'career', 'Carreira', ['marca'], 'low'],
    ['Organizar armário', 'life', 'Casa Marina', ['casa'], 'low'],
    ['Testar fluxo de onboarding', 'career', 'Stepz', ['qa', 'dev'], 'high'],
    ['Agendar call com mentor', 'career', 'Carreira', ['network'], 'medium'],
  ];

  const GOAL_DEFS = [
    {
      title: 'Correr 5K sem parar',
      description: 'Construir base aeróbica e chegar nos 5 km contínuos.',
      category: 'health', color: '#366b52', durationDays: 90, doneRatio: 1,
      milestones: ['Semana 1 — 2 km', '3 km contínuos', '4 km contínuos', '5K completo'],
    },
    {
      title: 'Lançar v1 do Stepz',
      description: 'Landing, auth estável e onboarding sem fricção.',
      category: 'career', color: '#735491', durationDays: 120, doneRatio: 0.75,
      milestones: ['Auth Supabase', 'Escada ao vivo', 'Landing publicada', 'Beta com 10 usuários'],
    },
    {
      title: 'Ler 12 livros no ano',
      description: 'Um livro por mês — ficção e não ficção.',
      category: 'learn', color: '#286892', durationDays: 365, doneRatio: 0.4,
      milestones: ['Lista escolhida', 'Livro 1', 'Livro 2', 'Livro 3', 'Metade do ano'],
    },
    {
      title: 'Rotina de sono',
      description: 'Horário fixo e menos telas à noite.',
      category: 'health', color: '#286892', durationDays: 45, doneRatio: 0.5,
      milestones: ['Horário definido', '7 noites sem celular na cama', '14 dias consistentes'],
    },
    {
      title: 'Poupar viagem Europa',
      description: 'Reserva + passagens até o fim do ano.',
      category: 'life', color: '#a87626', durationDays: 200, doneRatio: 0.33,
      milestones: ['Abrir conta viagem', 'Meta mensal definida', '50% do valor', 'Passagens compradas'],
    },
    {
      title: 'Dominar TypeScript',
      description: 'Projetos reais com tipagem estrita.',
      category: 'learn', color: '#735491', durationDays: 60, doneRatio: 0.6,
      milestones: ['Curso bases', 'Migrar um módulo', 'Generics no dia a dia', 'Projeto tipado 100%'],
    },
    {
      title: 'Fortalecer círculo próximo',
      description: 'Contato semanal com amigos e família.',
      category: 'relations', color: '#9f4176', durationDays: 90, doneRatio: 0.25,
      milestones: ['Lista de pessoas', '4 jantares marcados', 'Viagem em família'],
    },
    {
      title: 'Casa organizada',
      description: 'Um cômodo por mês sem bagunça acumulada.',
      category: 'life', color: '#523628', durationDays: 180, doneRatio: 0.5,
      milestones: ['Inventário', 'Doação feita', 'Escritório ok', 'Quarto ok'],
    },
    {
      title: 'Meditar 100 dias',
      description: '10 minutos por dia — consistência acima de perfeição.',
      category: 'mind', color: '#735491', durationDays: 100, doneRatio: 1,
      milestones: ['App configurado', '10 dias', '30 dias', '100 dias'],
    },
    {
      title: 'Portfólio atualizado',
      description: 'Três cases com processo e resultado.',
      category: 'career', color: '#286892', durationDays: 75, doneRatio: 0.2,
      milestones: ['Selecionar cases', 'Escrever case 1', 'Fotos/prints', 'Publicar site'],
    },
  ];

  const POSTIT_DEFS = [
    { title: 'Contas da casa', color: 'amber', tag: 'lembrete', items: ['Luz até dia 10', 'Água — automática', 'Internet — cartão final 4421', 'Condomínio'] },
    { title: 'Ideias Stepz', color: 'violet', tag: 'ideia', items: ['Modo foco na escada', 'Export PDF da jornada', 'Widget de streak', 'Temas sazonais'] },
    { title: 'Compras', color: 'teal', tag: 'tarefa', items: ['Filtro de café', 'Caderno A5', 'Cabo USB-C', 'Protetor solar'] },
    { title: 'Contatos úteis', color: 'gray', tag: 'lembrete', items: ['Piscineiro — João 11 9xxxx', 'Síndica — Carla', 'Dentista — Dra. Lia'] },
    { title: 'Links rápidos', color: 'rose', tag: 'link', items: ['Figma landing', 'Supabase dashboard', 'Analytics', 'Repo GitHub'] },
    { title: 'Eventos', color: 'green', tag: 'evento', items: ['Meetup front — 22/09', 'Aniversário Marina', 'Demo stakeholders'] },
    { title: 'Hábitos a testar', color: 'violet', tag: 'habito', items: ['Journaling noturno', 'Alongamento 5 min', 'Sem café após 15h'] },
    { title: 'Priorizar esta semana', color: 'amber', tag: 'priorizar', items: ['Landing prints', 'Corrigir sync wipe', 'Seed demo'] },
    { title: 'Receitas', color: 'teal', tag: 'dica', items: ['Risoto de cogumelos', 'Bowl de grão-de-bico', 'Pão de fermentação'] },
    { title: 'Viagem Europa', color: 'rose', tag: 'evento', items: ['Vistos?', 'Seguro viagem', 'Roteiro Lisboa→Porto', 'Airbnb 4 noites'] },
    { title: 'Leitura', color: 'violet', tag: 'ideia', items: ['Atomic Habits', 'Creative Act', 'O Programador Pragmático'] },
    { title: 'Setup desk', color: 'gray', tag: 'tarefa', items: ['Braço monitor', 'Luminária quente', 'Organizar cabos'] },
    { title: 'Dicas foco', color: 'green', tag: 'dica', items: ['Pomodoro 45/10', 'Fone noise cancel', 'Uma aba só'] },
    { title: 'Presentes', color: 'amber', tag: 'lembrete', items: ['Ana — livro', 'Pai — ferramenta', 'Marina — planta'] },
    { title: 'Bugs anotados', color: 'rose', tag: 'tarefa', items: ['Modal metas overflow', 'Post-it drag mobile', 'Escada zoom reset'] },
    { title: 'Frases do mês', color: 'violet', tag: 'ideia', items: ['Silence says more…', 'Consistency > intensity'] },
  ];

  function id() {
    return (typeof cryptoId === 'function' ? cryptoId() : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4));
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function dateOffset(days) {
    if (typeof addCalendarDays === 'function' && typeof todayStr === 'function') {
      return addCalendarDays(todayStr(), days);
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function noonIso(dateStr) {
    return new Date(`${dateStr}T12:00:00`).toISOString();
  }

  function eveningIso(dateStr, hour) {
    const h = hour == null ? 18 : hour;
    return new Date(`${dateStr}T${pad2(h)}:30:00`).toISOString();
  }

  function pick(arr, i) {
    return arr[i % arr.length];
  }

  function buildPrintsState() {
    const base = typeof defaultState === 'function' ? defaultState() : {
      createdAt: dateOffset(-160),
      categories: (typeof BASE_CATEGORIES !== 'undefined' ? BASE_CATEGORIES : []).map((c) => ({ ...c })),
      tasks: [], habits: [], steps: [], goals: [], postits: [],
      taskTagColors: {}, projectOrder: [], projectColors: {},
    };

    base.createdAt = dateOffset(-160);
    base.categories = (typeof BASE_CATEGORIES !== 'undefined' ? BASE_CATEGORIES : base.categories).map((c) => ({ ...c }));

    const habits = HABIT_DEFS.map((h) => ({
      id: id(),
      title: h.title,
      category: h.category,
      color: h.color,
      history: [],
    }));

    const weightedHabits = [];
    HABIT_DEFS.forEach((h, i) => {
      for (let w = 0; w < h.weight; w++) weightedHabits.push(habits[i]);
    });

    const goals = GOAL_DEFS.map((g, gi) => {
      const milestones = g.milestones.map((title, mi) => ({
        id: id(),
        title,
        done: mi < Math.round(g.milestones.length * g.doneRatio),
      }));
      const completed = milestones.length > 0 && milestones.every((m) => m.done);
      return {
        id: id(),
        title: g.title,
        description: g.description,
        category: g.category,
        color: g.color,
        targetDate: dateOffset(30 + gi * 18),
        durationDays: g.durationDays,
        milestones,
        completed,
      };
    });

    const postits = POSTIT_DEFS.map((p, pi) => {
      const created = noonIso(dateOffset(-90 + pi * 4));
      return {
        id: id(),
        title: p.title,
        color: p.color,
        tag: p.tag,
        items: p.items.map((text) => ({ id: id(), text })),
        comments: pi % 4 === 0 ? [{ id: id(), body: 'Revisar no fim de semana', createdAt: created, updatedAt: created }] : [],
        createdAt: created,
        updatedAt: created,
      };
    });

    const projects = ['Geral', 'Stepz', 'Trabalho', 'Casa Marina', 'Pessoal', 'Estudos', 'Carreira'];
    const projectColors = {
      Stepz: '#735491',
      Trabalho: '#286892',
      'Casa Marina': '#a87626',
      Pessoal: '#9f4176',
      Estudos: '#366b52',
      Carreira: '#523628',
    };
    const taskTagColors = {
      dev: '#735491',
      design: '#9f4176',
      casa: '#a87626',
      leitura: '#286892',
      cliente: '#a73d3d',
      finanças: '#366b52',
      planejamento: '#5f5e5b',
    };

    const tasks = [];
    const steps = [];

    // ~80 habit check-ins over ~150 days (biased recent)
    let habitMarks = 0;
    const targetHabitSteps = 78;
    for (let day = -150; day <= 0 && habitMarks < targetHabitSteps; day++) {
      const dateStr = dateOffset(day);
      const density = day > -21 ? 0.85 : day > -60 ? 0.55 : 0.28;
      for (let hi = 0; hi < weightedHabits.length && habitMarks < targetHabitSteps; hi++) {
        const roll = ((day * 17 + hi * 31) % 100) / 100;
        if (roll > density) continue;
        const h = weightedHabits[hi];
        if (h.history.includes(dateStr)) continue;
        // skip some older days for Quotes to leave a visible gap today sometimes
        if (h.title === 'Quotes' && day === 0) continue;
        h.history.push(dateStr);
        steps.push({
          id: id(),
          habitId: h.id,
          title: h.title,
          color: h.color,
          completedAt: noonIso(dateStr),
        });
        habitMarks++;
      }
    }
    habits.forEach((h) => { h.history.sort(); });

    // Ensure Yoga marked today for a green streak on home
    const yoga = habits.find((h) => h.title === 'Yoga');
    if (yoga) {
      const today = dateOffset(0);
      if (!yoga.history.includes(today)) {
        yoga.history.push(today);
        yoga.history.sort();
        steps.push({
          id: id(),
          habitId: yoga.id,
          title: yoga.title,
          color: yoga.color,
          completedAt: new Date().toISOString(),
        });
      }
    }

    // Done tasks → steps (~48)
    const doneCount = 48;
    for (let i = 0; i < doneCount; i++) {
      const [title, category, project, tags, priority] = pick(TASK_TITLES, i);
      const day = -140 + Math.floor((i / doneCount) * 140);
      const dateStr = dateOffset(day);
      const taskId = id();
      const desc = i % 5 === 0 ? 'Concluído no fluxo do dia — seed de prints.' : '';
      tasks.push({
        id: taskId,
        title: `${title}`,
        category,
        done: true,
        dueDate: dateStr,
        status: 'done',
        priority,
        tags: [...tags],
        description: desc,
        project,
      });
      steps.push({
        id: id(),
        taskId,
        title,
        project,
        category,
        completedAt: eveningIso(dateStr, 10 + (i % 8)),
        ...(desc ? { description: desc } : {}),
        tags: [...tags],
        priority,
        dueDate: dateStr,
      });
    }

    // Open tasks for Tasks tab
    const openDefs = TASK_TITLES.slice(0, 12);
    openDefs.forEach((def, i) => {
      const [title, category, project, tags, priority] = def;
      const status = i < 4 ? 'doing' : 'todo';
      tasks.push({
        id: id(),
        title: i === 0 ? 'Casa Marina — visita elétrica' : title,
        category,
        done: false,
        dueDate: dateOffset(i < 3 ? i : 3 + i),
        status,
        priority,
        tags: [...tags],
        description: i === 0 ? 'Combinar horário com o eletricista.' : '',
        project,
      });
    });

    // One monthly recurring example
    tasks.push({
      id: id(),
      title: 'Pagar cartão',
      category: 'life',
      done: false,
      dueDate: dateOffset(12),
      status: 'todo',
      priority: 'high',
      tags: ['finanças'],
      description: 'Todo mês — seed.',
      project: 'Casa Marina',
      recurrence: 'monthly',
      recurrenceIntervalDays: 30,
      recurrenceLeadDays: 7,
    });

    // Goal completion steps for fully done goals
    goals.filter((g) => g.completed).forEach((g, i) => {
      steps.push({
        id: id(),
        completedGoalId: g.id,
        title: g.title,
        category: g.category,
        completedAt: eveningIso(dateOffset(-20 + i * 5), 16),
        ...(g.color ? { color: g.color } : {}),
      });
    });

    // Sort steps chronologically and trim/pad to ~130
    steps.sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));

    let finalSteps = steps;
    if (finalSteps.length > 130) {
      finalSteps = finalSteps.slice(finalSteps.length - 130);
    }
    while (finalSteps.length < 130) {
      const h = habits[finalSteps.length % habits.length];
      const dateStr = dateOffset(-2 - (130 - finalSteps.length));
      if (!h.history.includes(dateStr)) {
        h.history.push(dateStr);
        h.history.sort();
      }
      finalSteps.push({
        id: id(),
        habitId: h.id,
        title: h.title,
        color: h.color,
        completedAt: noonIso(dateStr),
      });
    }
    finalSteps.sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));

    // Guarantee exactly 130
    finalSteps = finalSteps.slice(0, 130);

    // Recompute habit histories from final steps (keeps Habits UI + stairs in sync)
    const habitById = new Map(habits.map((h) => [h.id, h]));
    habits.forEach((h) => { h.history = []; });
    finalSteps.forEach((st) => {
      if (!st.habitId) return;
      const h = habitById.get(st.habitId);
      if (!h) return;
      const key = String(st.completedAt || '').slice(0, 10);
      // Prefer calendar day from ISO via local noon dates we wrote; fall back to dateKeyFromIso
      const day = (typeof dateKeyFromIso === 'function' ? dateKeyFromIso(st.completedAt) : key);
      if (day && !h.history.includes(day)) h.history.push(day);
    });
    habits.forEach((h) => { h.history.sort(); });

    return {
      ...base,
      tasks,
      habits,
      steps: finalSteps,
      goals,
      postits,
      taskTagColors,
      projectOrder: projects,
      projectColors,
    };
  }

  async function resolveUserKey() {
    try {
      const raw = localStorage.getItem('stepz.auth.v1');
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.email) return String(s.email).trim().toLowerCase();
      }
    } catch (_) { /* ignore */ }
    try {
      const sb = typeof getStepzSupabase === 'function' ? getStepzSupabase() : null;
      if (sb) {
        const { data } = await sb.auth.getSession();
        const email = data && data.session && data.session.user && data.session.user.email;
        if (email) return String(email).trim().toLowerCase();
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  async function persistState(state, reason) {
    const userKey = await resolveUserKey();
    if (!userKey) {
      throw new Error('Nenhuma conta logada. Entre com a conta de prints e tente de novo.');
    }
    if (typeof saveState === 'function') saveState(userKey, state);
    if (typeof saveStateCache === 'function') {
      saveStateCache(userKey, state, { updatedAt: new Date().toISOString(), source: reason });
    }
    try {
      localStorage.setItem(`stepz.v1:${userKey}:lastGood`, JSON.stringify(state));
    } catch (_) { /* quota */ }

    const rs = window.stepzRemoteState;
    if (rs && typeof rs.save === 'function') {
      const res = await rs.save(state, { force: true, reason });
      if (res && res.ok === false && res.reason && res.reason !== 'not-configured') {
        console.warn('[stepz seed] remoto:', res);
      }
    }
    return userKey;
  }

  async function stepzSeedPrints() {
    const state = buildPrintsState();
    const userKey = await persistState(state, 'prints-seed');
    console.info(`[stepz] Seed aplicado em ${userKey}: ${state.steps.length} degraus, ${state.habits.length} hábitos, ${state.goals.length} metas, ${state.postits.length} post-its, ${state.tasks.length} tasks.`);
    location.reload();
    return state;
  }

  async function stepzWipePrints() {
    const empty = typeof defaultState === 'function' ? defaultState() : {
      createdAt: dateOffset(0), categories: [], tasks: [], habits: [], steps: [], goals: [], postits: [],
      taskTagColors: {}, projectOrder: [], projectColors: {},
    };
    const userKey = await persistState(empty, 'prints-wipe');
    console.info(`[stepz] Estado limpo em ${userKey}.`);
    location.reload();
    return empty;
  }

  window.stepzSeedPrints = stepzSeedPrints;
  window.stepzWipePrints = stepzWipePrints;
  window.stepzBuildPrintsState = buildPrintsState;
})();
