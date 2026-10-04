import './style.css';
import { api } from './api';

const EXPENSE_CATEGORIES = ['Assinaturas', 'Cartão', 'Casa', 'Compras', 'Contas', 'Delivery', 'Educação', 'Empréstimo', 'Lanches', 'Lazer', 'Mercado', 'Padaria', 'Roupas', 'Saúde', 'Transporte', 'Viagem', 'Outros'];
const INCOME_CATEGORIES = ['Freelance', 'Investimentos', 'Presente', 'Reembolso', 'Salário', 'Vendas', 'Outros'];

const CATEGORY_META = {
  Casa: { icon: '⌂', color: '#557966', soft: '#e5eee8' },
  Contas: { icon: '▤', color: '#527a9a', soft: '#e8f0f5' },
  Mercado: { icon: '🛒', color: '#6d8c78', soft: '#e8f0ea' },
  Delivery: { icon: '🍔', color: '#bd7b45', soft: '#f7ecdf' },
  Lanches: { icon: '☕', color: '#b66e52', soft: '#f7e9e2' },
  Padaria: { icon: '🥖', color: '#ad7a3f', soft: '#f8eddd' },
  Roupas: { icon: '👕', color: '#9a647d', soft: '#f5e9ef' },
  Empréstimo: { icon: '▤', color: '#a75d56', soft: '#f7e7e5' },
  Viagem: { icon: '✈', color: '#4f7893', soft: '#e7f0f5' },
  Cartão: { icon: '💳', color: '#4a6572', soft: '#eaf0f4' },
  Transporte: { icon: '◆', color: '#667d8b', soft: '#e8eef1' },
  Saúde: { icon: '✚', color: '#b05e67', soft: '#f7e8ea' },
  Educação: { icon: '◆', color: '#5d7797', soft: '#e8eef5' },
  Lazer: { icon: '🎟️', color: '#766a94', soft: '#eeeaf5' },
  Assinaturas: { icon: '◉', color: '#936c82', soft: '#f1e9ed' },
  Compras: { icon: '▰', color: '#a06f55', soft: '#f5ebe5' },
  Salário: { icon: '↗', color: '#2d846d', soft: '#e2f1eb' },
  Freelance: { icon: '✦', color: '#527a9a', soft: '#e8f0f5' },
  Vendas: { icon: '◇', color: '#6f8753', soft: '#ebf0e5' },
  Investimentos: { icon: '↗', color: '#4f7b6d', soft: '#e4efeb' },
  Reembolso: { icon: '↺', color: '#667d8b', soft: '#e8eef1' },
  Presente: { icon: '◇', color: '#936c82', soft: '#f1e9ed' },
  Outros: { icon: '•••', color: '#7d8984', soft: '#edf0ee' }
};

const getCurrentMonthId = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

let selectedMonthId = getCurrentMonthId();
let activeView = 'dashboard';
let showCompletedIncome = false;
let showCompletedExpense = false;
let isRegisterMode = false;
let confirmCallback = null;
let toastTimer = null;

const appData = {
  baseSalary: 0,
  baseSalaryDay: 5,
  months: {},
  userName: 'Usuário',
  userEmail: '',
  role: 'user',
  accountStatus: 'active',
  trialExpiresAt: null,
  trialDaysRemaining: 0,
  paymentStatus: 'pending',
  paymentDueDate: null,
  lastPaymentDate: null,
  paymentSettings: { pixKey: '', pixBeneficiary: '' },
  adminOverview: null
};

const $ = (id) => document.getElementById(id);
const dom = {
  app: $('app'), authModal: $('auth-modal'), authForm: $('auth-form'), authTitle: $('auth-title'),
  authSubtitle: $('auth-subtitle'), authSubmit: $('auth-submit-btn'), authSwitch: $('auth-switch-btn'),
  authSwitchText: $('auth-switch-text'), authError: $('auth-error'), registerName: $('register-name-group'),
  pageTitle: $('page-title'), userGreeting: $('user-greeting'), userName: $('user-name'), userAvatar: $('user-avatar'),
  monthDisplay: $('current-month-display'), incomeList: $('income-list'), expenseList: $('expense-list'),
  recentList: $('recent-list'), modal: $('modal'), typeModal: $('type-modal'), salaryModal: $('salary-modal'),
  confirmModal: $('confirm-modal'), profileModal: $('profile-modal'), paymentModal: $('payment-modal'),
  createUserModal: $('create-user-modal'), reactivateUserModal: $('reactivate-user-modal'),
  transactionForm: $('transaction-form'), bulkContainer: $('bulk-items-container'),
  editId: $('edit-id'), addRow: $('add-row-btn'), baseSalaryInput: $('base-salary-input'),
  transactionSubmit: $('transaction-form').querySelector('button[type="submit"]'), toast: $('toast')
};

const formatCurrency = (value, compact = false) => {
  const number = Number(value) || 0;
  if (compact && Math.abs(number) >= 1000) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(number);
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getDateKey = (item) => {
  if (item.dueDate) return String(item.dueDate).slice(0, 10);
  if (item.createdAt) return String(item.createdAt).slice(0, 10);
  return `${item.monthId || selectedMonthId}-01`;
};

const dateFromKey = (dateKey) => new Date(`${dateKey}T12:00:00`);

const formatDate = (dateKey, options = { day: '2-digit', month: 'short' }) => {
  if (!dateKey) return 'Sem data';
  return dateFromKey(dateKey).toLocaleDateString('pt-BR', options).replace('.', '');
};

const formatStoredDate = (value, fallback = 'Não definida') => {
  if (!value) return fallback;
  return formatDate(String(value).slice(0, 10), { day: '2-digit', month: 'long', year: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return 'Nunca acessou';
  const date = new Date(value);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const getMonthLabel = (monthId) => {
  const [year, month] = monthId.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const getDefaultDate = () => {
  const today = new Date();
  if (selectedMonthId === getCurrentMonthId()) {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }
  return `${selectedMonthId}-01`;
};

const getDayInMonth = (monthId, requestedDay) => {
  const [year, month] = monthId.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthId}-${String(Math.min(Math.max(Number(requestedDay) || 1, 1), lastDay)).padStart(2, '0')}`;
};

const sortByDateDesc = (items) => [...items].sort((a, b) => {
  const byDate = getDateKey(b).localeCompare(getDateKey(a));
  if (byDate !== 0) return byDate;
  return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
});

const getMeta = (category) => CATEGORY_META[category] || CATEGORY_META.Outros;

const showToast = (message, type = 'success') => {
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.className = `toast show ${type === 'error' ? 'error' : ''}`;
  toastTimer = setTimeout(() => { dom.toast.className = 'toast'; }, 3200);
};

const openModal = (element) => element.classList.add('active');
const closeModal = (element) => element.classList.remove('active');

const copyPixKey = async () => {
  const key = appData.paymentSettings.pixKey;
  if (!key) return showToast('A chave PIX ainda não foi configurada.', 'error');
  try {
    await navigator.clipboard.writeText(key);
    showToast('Chave PIX copiada.');
  } catch {
    showToast(`Chave PIX: ${key}`);
  }
};

const updatePaymentUI = () => {
  const isTrial = appData.accountStatus === 'trial';
  const isExpiredTrial = appData.accountStatus === 'trial_expired';
  const pending = appData.accountStatus === 'active' && appData.paymentStatus !== 'paid';
  const isAdmin = appData.role === 'super_admin' && !api.isImpersonating();
  const dueDate = formatStoredDate(appData.paymentDueDate);
  const trialEndDate = formatStoredDate(appData.trialExpiresAt);
  const pixConfigured = Boolean(appData.paymentSettings.pixKey);
  const alert = $('payment-alert');

  alert.hidden = (!pending && !isTrial && !isExpiredTrial) || isAdmin;
  alert.className = `payment-alert${isTrial ? ' trial' : ''}${isExpiredTrial ? ' expired' : ''}`;
  $('payment-alert-icon').textContent = isTrial ? String(Math.max(1, appData.trialDaysRemaining)) : '!';
  $('payment-alert-title').textContent = isTrial ? 'Teste gratuito ativo' : (isExpiredTrial ? 'Teste gratuito encerrado' : 'Pagamento pendente');
  $('payment-alert-message').textContent = isTrial
    ? `Você ainda tem ${Math.max(1, appData.trialDaysRemaining)} ${appData.trialDaysRemaining === 1 ? 'dia' : 'dias'} de acesso. Seu teste termina em ${trialEndDate}.`
    : isExpiredTrial
      ? 'O período gratuito terminou. O admin master pode reativar esta conta como cliente.'
      : appData.paymentDueDate
        ? `Sua mensalidade está pendente. Vencimento em ${dueDate}.`
        : 'Sua mensalidade está pendente. Consulte abaixo os dados para pagamento.';
  $('payment-alert-pix').hidden = !pending || !pixConfigured;
  $('payment-alert-copy-btn').hidden = !pending || !pixConfigured;
  $('payment-alert-key').textContent = appData.paymentSettings.pixKey || '—';
  $('payment-alert-amount').textContent = formatCurrency(appData.paymentSettings.pixAmount || 0);

  $('profile-avatar').textContent = appData.userName.charAt(0).toUpperCase() || 'U';
  $('profile-name').textContent = appData.userName;
  $('profile-email').textContent = appData.userEmail || 'E-mail não informado';
  $('profile-payment-card').className = `profile-payment-card ${isTrial ? 'trial' : isExpiredTrial ? 'expired' : pending ? 'pending' : 'paid'}`;
  $('profile-payment-status').previousElementSibling.textContent = isTrial || isExpiredTrial ? 'Status da conta' : 'Status da mensalidade';
  $('profile-payment-status').textContent = isTrial ? 'Teste gratuito' : isExpiredTrial ? 'Teste encerrado' : pending ? 'Pendente' : 'Em dia';
  $('profile-due-label').textContent = isTrial || isExpiredTrial ? 'Fim do período de teste' : 'Data de vencimento';
  $('profile-due-date').textContent = isTrial || isExpiredTrial ? trialEndDate : dueDate;
  $('profile-last-payment-label').textContent = isTrial || isExpiredTrial ? 'Próxima etapa' : 'Último pagamento';
  $('profile-last-payment').textContent = isTrial || isExpiredTrial ? 'Reativação pelo admin' : formatStoredDate(appData.lastPaymentDate, 'Nenhum registrado');
  $('profile-pix-card').hidden = !pending || !pixConfigured;
  $('profile-pix-name').textContent = appData.paymentSettings.pixBeneficiary || 'Beneficiário não informado';
  $('profile-pix-key').textContent = appData.paymentSettings.pixKey || '—';
  $('profile-pix-amount').textContent = formatCurrency(appData.paymentSettings.pixAmount || 0);
  $('profile-admin-btn').hidden = appData.role !== 'super_admin' || api.isImpersonating();
  $('profile-logout-btn').querySelector('span').textContent = api.isImpersonating() ? 'Voltar ao Admin Master' : 'Sair da conta';
};

const checkAuth = () => {
  const authenticated = Boolean(localStorage.getItem('auth_token'));
  dom.app.style.display = authenticated ? 'block' : 'none';
  dom.authModal.style.display = authenticated ? 'none' : 'flex';
  if (authenticated) render();
};

const calculateTotals = (currentData) => {
  const baseSalaryCompleted = currentData.baseSalaryStatus === 'completed';
  const incomeTotal = currentData.income.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const expenseTotal = currentData.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const realIncome = currentData.income.filter((item) => item.status === 'completed').reduce((sum, item) => sum + (Number(item.amount) || 0), 0) + (baseSalaryCompleted ? appData.baseSalary : 0);
  const realExpense = currentData.expenses.filter((item) => item.status === 'completed').reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const plannedIncome = appData.baseSalary + incomeTotal;
  return {
    plannedIncome,
    plannedExpense: expenseTotal,
    realIncome,
    realExpense,
    pendingIncome: Math.max(0, plannedIncome - realIncome),
    pendingExpense: Math.max(0, expenseTotal - realExpense),
    realBalance: realIncome - realExpense,
    plannedBalance: plannedIncome - expenseTotal
  };
};

const setAll = (className, text) => document.querySelectorAll(`.${className}`).forEach(el => el.textContent = text);

const updateDashboard = (currentData, totals, analytics) => {
  setAll('val-total-balance-real', formatCurrency(totals.realBalance));
  setAll('val-total-balance-planned', `Saldo previsto: ${formatCurrency(totals.plannedBalance)}`);
  setAll('val-stat-income-real', formatCurrency(totals.realIncome));
  setAll('val-stat-income-pending', `${formatCurrency(totals.pendingIncome)} a receber`);
  setAll('val-stat-expense-real', formatCurrency(totals.realExpense));
  setAll('val-stat-expense-pending', `${formatCurrency(totals.pendingExpense)} a pagar`);
  setAll('val-base-salary-display', formatCurrency(appData.baseSalary));

  const commitment = totals.plannedIncome > 0 ? Math.round((totals.plannedExpense / totals.plannedIncome) * 100) : 0;
  setAll('val-income-commitment', `${commitment}%`);
  document.querySelectorAll('.val-income-commitment-bar').forEach(el => {
    el.style.width = `${Math.min(commitment, 100)}%`;
    el.style.background = commitment > 90 ? '#e19a8f' : commitment > 70 ? '#e0bd7d' : '#bfd3b8';
  });
  setAll('val-commitment-copy', commitment > 100
    ? 'As despesas previstas ultrapassam sua renda. Vale revisar prioridades.'
    : commitment > 70
      ? 'Uma parte alta da renda já está comprometida neste mês.'
      : totals.plannedIncome > 0
        ? `${100 - commitment}% da renda prevista permanece livre.`
        : 'Cadastre receitas e despesas para acompanhar.');

  const savingsRate = totals.realIncome > 0 ? Math.round(((totals.realIncome - totals.realExpense) / totals.realIncome) * 100) : 0;
  setAll('val-savings-rate', `${savingsRate}%`);
  setAll('val-savings-copy', savingsRate >= 0 ? 'do que você recebeu' : 'saldo acima da renda');

  renderCategories(currentData.expenses);
  renderHighlights(currentData.expenses);
  renderInsights(currentData, totals, analytics);
  renderRecent(currentData);
};

const renderCategories = (expenses) => {
  const categoryTotals = expenses.reduce((acc, item) => {
    const category = item.category || 'Outros';
    acc[category] = (acc[category] || 0) + (Number(item.amount) || 0);
    return acc;
  }, {});
  const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, value]) => sum + value, 0);
  $('category-total').textContent = formatCurrency(total, true);

  if (!total) {
    $('category-donut').style.background = 'conic-gradient(#dce7df 0 100%)';
    $('category-breakdown').innerHTML = '<div class="category-empty">Adicione despesas para ver como seus gastos estão distribuídos.</div>';
    return;
  }

  let cursor = 0;
  const segments = sorted.map(([category, value]) => {
    const start = cursor;
    cursor += (value / total) * 100;
    return `${getMeta(category).color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  $('category-donut').style.background = `conic-gradient(${segments.join(', ')})`;
  $('category-breakdown').innerHTML = sorted.slice(0, 6).map(([category, value]) => {
    const meta = getMeta(category);
    const percentage = Math.round((value / total) * 100);
    return `<div class="category-row">
      <span class="category-dot" style="background:${meta.color}"></span>
      <span class="category-row-label">${escapeHtml(category)}</span>
      <span class="category-row-value">${formatCurrency(value)} · ${percentage}%</span>
      <div class="category-bar"><span style="width:${percentage}%;background:${meta.color}"></span></div>
    </div>`;
  }).join('');
};

const renderHighlights = (expenses) => {
  const totals = expenses.reduce((acc, item) => {
    const category = item.category || 'Outros';
    acc[category] = (acc[category] || 0) + (Number(item.amount) || 0);
    return acc;
  }, {});
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const topCategories = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3);

  $('top-expenses-list').innerHTML = topCategories.length
    ? topCategories.map(([category, value], index) => {
      const meta = getMeta(category);
      const percentage = total ? Math.round((value / total) * 100) : 0;
      return `<div class="spotlight-item ${index === 0 ? 'emphasis' : ''}">
        <div class="category-icon" style="background:${meta.soft};color:${meta.color}">${meta.icon}</div>
        <div><span>${index + 1}º maior gasto · ${escapeHtml(category)}</span><strong>${formatCurrency(value)}</strong><small>${percentage}% das despesas previstas</small></div>
      </div>`;
    }).join('')
    : '<div class="category-empty">Adicione despesas para ver as três categorias que mais pesam no mês.</div>';

  const lifestyleCategories = [
    { name: 'Delivery', icon: getMeta('Delivery').icon },
    { name: 'Lanches', icon: getMeta('Lanches').icon },
    { name: 'Lazer', icon: getMeta('Lazer').icon }
  ];
  const lifestyleTotal = lifestyleCategories.reduce((sum, item) => sum + (Number(totals[item.name]) || 0), 0);
  $('lifestyle-total').textContent = formatCurrency(lifestyleTotal);
  $('lifestyle-share').textContent = `${total ? Math.round((lifestyleTotal / total) * 100) : 0}% das despesas do mês`;
  $('lifestyle-spending-list').innerHTML = lifestyleCategories.map((item) => {
    const value = Number(totals[item.name]) || 0;
    const meta = getMeta(item.name);
    return `<div class="lifestyle-item">
      <div class="category-icon" style="background:${meta.soft};color:${meta.color}">${item.icon}</div>
      <div><span>${item.name}</span><strong>${formatCurrency(value)}</strong><small>${total ? Math.round((value / total) * 100) : 0}% do total</small></div>
    </div>`;
  }).join('');
};

const renderInsights = (currentData, totals, analytics = { months: [] }) => {
  const categoryTotals = currentData.expenses.reduce((acc, item) => {
    const category = item.category || 'Outros';
    acc[category] = (acc[category] || 0) + (Number(item.amount) || 0);
    return acc;
  }, {});

  const analyticsUnavailable = Boolean(analytics.unavailable);
  const currentAnalytics = (analytics.months || [])[0];
  const historicalMonths = (analytics.months || []).slice(1).filter((month) => month.expenseTotal > 0 && month.hasReliableCategories);
  const comparableHistoricalMonths = (analytics.months || []).slice(1).filter((month) => month.expenseTotal > 0 && month.hasReliablePeriodCategories);
  const previousMonth = (analytics.months || [])[1];
  const comparisonCategoryTotals = currentAnalytics?.periodCategoryTotals || categoryTotals;
  const discretionary = ['Delivery', 'Lanches', 'Lazer', 'Compras', 'Roupas', 'Viagem', 'Padaria', 'Assinaturas'];
  const essentials = ['Casa', 'Contas', 'Mercado', 'Saúde', 'Educação', 'Transporte'];
  const adjustable = Object.entries(categoryTotals).filter(([category]) => discretionary.includes(category)).sort((a, b) => b[1] - a[1])[0];
  const insightCards = [];

  $('insight-status').classList.toggle('error', analyticsUnavailable);
  $('insight-status').innerHTML = `<span></span> ${analyticsUnavailable ? 'Histórico indisponível' : `Comparando até o dia ${analytics.cutoffDay || 31}`}`;

  const anomalies = Object.entries(comparisonCategoryTotals).map(([category, value]) => {
    if (comparableHistoricalMonths.length < 2 || !currentAnalytics?.hasReliablePeriodCategories) return null;
    const average = comparableHistoricalMonths.reduce((sum, month) => sum + (Number(month.periodCategoryTotals?.[category]) || 0), 0) / comparableHistoricalMonths.length;
    if (average <= 0) return null;
    const difference = value - average;
    const percentage = Math.round((difference / average) * 100);
    return difference >= 50 && percentage >= 25 ? { category, value, average, difference, percentage } : null;
  }).filter(Boolean).sort((a, b) => b.percentage - a.percentage);

  if (analyticsUnavailable) {
    insightCards.push({ icon: '!', tone: 'warning', label: 'Variação anormal', title: 'Histórico indisponível', copy: 'Os dados do mês continuam válidos, mas não foi possível consultar os meses anteriores. Tente novamente após atualizar a página.' });
  } else if (anomalies.length) {
    const anomaly = anomalies[0];
    insightCards.push({ icon: '↗', tone: 'warning', label: 'Variação anormal', title: `${anomaly.category} aumentou`, copy: `O valor está <strong>${anomaly.percentage}% acima</strong> da média dos últimos meses, uma diferença de ${formatCurrency(anomaly.difference)}.` });
  } else if (comparableHistoricalMonths.length >= 2 && currentAnalytics?.hasReliablePeriodCategories && currentData.expenses.length) {
    insightCards.push({ icon: '✓', tone: 'positive', label: 'Variação anormal', title: 'Gastos dentro do padrão', copy: 'Nenhuma categoria está 25% e R$ 50 acima da sua média recente.' });
  } else {
    insightCards.push({ icon: '↗', label: 'Variação anormal', title: 'Histórico ainda não comparável', copy: 'São necessários dois meses anteriores com datas e pelo menos 70% das despesas categorizadas para detectar aumentos com segurança.' });
  }

  const balanceBeforePendingIncome = totals.realBalance - totals.pendingExpense;
  if (totals.plannedBalance < 0) {
    insightCards.push({ icon: '!', tone: 'danger', label: 'Previsão do mês', title: 'Risco de saldo negativo', copy: `As despesas previstas superam a renda em <strong>${formatCurrency(Math.abs(totals.plannedBalance))}</strong>. Revise gastos antes dos próximos vencimentos.` });
  } else if (balanceBeforePendingIncome < 0 && totals.pendingExpense > 0) {
    const requiredIncome = Math.abs(balanceBeforePendingIncome);
    insightCards.push({ icon: '!', tone: 'warning', label: 'Previsão do mês', title: 'Saldo depende de entradas futuras', copy: `Você tem ${formatCurrency(totals.realBalance)} de saldo realizado e ${formatCurrency(totals.pendingExpense)} em contas futuras. Precisa receber <strong>ao menos ${formatCurrency(requiredIncome)}</strong> dos ${formatCurrency(totals.pendingIncome)} previstos.` });
  } else {
    insightCards.push({ icon: '✓', tone: 'positive', label: 'Previsão do mês', title: 'Saldo protegido', copy: totals.plannedIncome > 0 ? `Após as despesas previstas, sua margem estimada é de <strong>${formatCurrency(totals.plannedBalance)}</strong>.` : 'Cadastre sua renda para calcular o risco de saldo negativo.' });
  }

  if (adjustable) {
    const saving = adjustable[1] * 0.15;
    insightCards.push({ icon: '↓', label: 'Onde revisar', title: `Confira seus gastos em ${adjustable[0]}`, copy: `É sua maior categoria ajustável, com ${formatCurrency(adjustable[1])}. Se 15% puder ser evitado, você liberaria cerca de <strong>${formatCurrency(saving)}</strong>. Revise a classificação antes de decidir.` });
  } else if (currentData.expenses.length) {
    insightCards.push({ icon: '↓', label: 'Onde economizar', title: 'Despesas essenciais predominam', copy: 'Não identificamos gastos relevantes em Delivery, Lanches, Lazer, Compras ou Assinaturas neste mês.' });
  } else {
    insightCards.push({ icon: '↓', label: 'Onde economizar', title: 'Ainda sem análise', copy: 'Adicione suas despesas para descobrir quais gastos oferecem uma redução mais segura.' });
  }

  const realisticSaving = totals.plannedBalance > 0 && totals.plannedIncome > 0
    ? Math.max(0, Math.floor(Math.min(totals.plannedIncome * 0.2, totals.plannedBalance * 0.7) / 10) * 10)
    : 0;
  if (realisticSaving > 0) {
    const rate = Math.round((realisticSaving / totals.plannedIncome) * 100);
    const dependsOnFutureIncome = balanceBeforePendingIncome < 0 && totals.pendingIncome > 0;
    insightCards.push(dependsOnFutureIncome
      ? { icon: '◆', tone: 'warning', label: 'Potencial de economia', title: `Até ${formatCurrency(realisticSaving)} ao fim do mês`, copy: `Esse valor representa ${rate}% da renda prevista, mas <strong>não deve ser separado agora</strong>. Ele só estará disponível se as receitas pendentes forem recebidas e as despesas não aumentarem.` }
      : { icon: '◆', tone: 'positive', label: 'Meta de economia', title: `Separe até ${formatCurrency(realisticSaving)}`, copy: `A previsão comporta essa meta, equivalente a <strong>${rate}% da renda prevista</strong>, mantendo uma margem para imprevistos.` });
  } else if (totals.plannedIncome > 0) {
    insightCards.push({ icon: '◆', tone: 'warning', label: 'Meta de economia', title: 'Primeiro, recupere sua margem', copy: 'Sua previsão ainda não comporta uma poupança segura. Reduza despesas antes de separar um valor fixo.' });
  } else {
    insightCards.push({ icon: '◆', label: 'Meta de economia', title: 'Informe sua renda', copy: 'Com uma renda prevista, o Meu Saldo calcula quanto poupar sem apertar demais o orçamento.' });
  }

  const challengeHistory = adjustable
    ? historicalMonths.map(month => Number(month.categoryTotals?.[adjustable[0]]) || 0).filter(value => value > 0)
    : [];
  if (adjustable && challengeHistory.length >= 2) {
    const baseline = challengeHistory.reduce((sum, value) => sum + value, 0) / challengeHistory.length;
    const challengeReduction = Math.max(20, Math.round(Math.min(baseline * 0.1, 100) / 10) * 10);
    const challengeLimit = Math.max(0, baseline - challengeReduction);
    const remaining = Math.max(0, challengeLimit - adjustable[1]);
    const onTrack = adjustable[1] <= challengeLimit;
    const reductionNeeded = Math.max(0, adjustable[1] - challengeLimit);
    insightCards.push({ icon: '★', tone: 'challenge', label: 'Desafio do mês', title: onTrack ? `${adjustable[0]} está dentro da meta` : `Reduza ${adjustable[0]} em ${formatCurrency(reductionNeeded)}`, copy: `Sua média recente é ${formatCurrency(baseline)} e o limite do desafio é <strong>${formatCurrency(challengeLimit)}</strong>. ${onTrack ? `Você ainda tem ${formatCurrency(remaining)} até o limite.` : 'Acompanhe essa categoria até o fechamento do mês.'}` });
  } else {
    insightCards.push({ icon: '★', tone: 'challenge', label: 'Desafio do mês', title: 'Desafio em preparação', copy: adjustable ? 'Categorize essa despesa por mais dois meses para criar uma meta baseada no seu comportamento real, e não em um valor arbitrário.' : 'Cadastre gastos ajustáveis para receber um desafio personalizado quando houver histórico suficiente.' });
  }

  const now = new Date();
  const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedYear, selectedMonth] = selectedMonthId.split('-').map(Number);
  const weekEnd = selectedMonthId === currentMonthId ? now : new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const isInWeek = (value) => {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date >= weekStart && date <= weekEnd;
  };
  const completedExpenses = currentData.expenses.filter((item) => item.status === 'completed' && isInWeek(item.completedAt));
  const completedIncome = currentData.income.filter((item) => item.status === 'completed' && isInWeek(item.completedAt));
  const salaryCompletedThisWeek = currentData.baseSalaryStatus === 'completed' && isInWeek(currentData.baseSalaryCompletedAt);
  const monthPaid = currentData.expenses.filter((item) => item.status === 'completed').reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const monthReceived = currentData.income.filter((item) => item.status === 'completed').reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    + (currentData.baseSalaryStatus === 'completed' ? appData.baseSalary : 0);
  const weeklyPaid = completedExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const weeklyReceived = completedIncome.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) + (salaryCompletedThisWeek ? appData.baseSalary : 0);
  const pendingDueInPeriod = currentData.expenses.filter((item) => {
    if (item.status === 'completed') return false;
    const date = dateFromKey(getDateKey(item));
    return date >= weekStart && date <= weekEnd;
  }).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const hasWeeklyCompletions = completedExpenses.length || completedIncome.length || salaryCompletedThisWeek;
  const weeklyDetail = hasWeeklyCompletions
    ? ` Nos últimos sete dias, ${formatCurrency(weeklyPaid)} foram marcados como pagos e ${formatCurrency(weeklyReceived)} como recebidos.`
    : pendingDueInPeriod > 0
      ? ` No período semanal, ainda há <strong>${formatCurrency(pendingDueInPeriod)} pendentes</strong>.`
      : ' Não há contas pendentes com vencimento no período semanal.';
  insightCards.push({ icon: '7d', label: 'Resumo financeiro', title: `${formatCurrency(monthReceived)} recebidos no mês`, copy: `Você marcou <strong>${formatCurrency(monthPaid)} como pagos</strong>, independentemente da data de vencimento.${weeklyDetail}` });

  const monthsForReserve = [
    { categoryTotals },
    ...historicalMonths
  ];
  const essentialAverage = monthsForReserve.length
    ? monthsForReserve.reduce((monthSum, month) => monthSum + essentials.reduce((sum, category) => sum + (Number(month.categoryTotals?.[category]) || 0), 0), 0) / monthsForReserve.length
    : 0;
  if (essentialAverage > 0) {
    const reserveTarget = essentialAverage * 6;
    const contribution = realisticSaving || Math.min(totals.plannedIncome * 0.1, totals.plannedBalance > 0 ? totals.plannedBalance : 0);
    const hasReserveHistory = historicalMonths.length >= 2;
    const contributionCopy = contribution > 0
      ? balanceBeforePendingIncome < 0
        ? ` Após receber as entradas pendentes e pagar as contas, avalie aportes de até <strong>${formatCurrency(contribution)} por mês</strong>.`
        : ` Um aporte de até <strong>${formatCurrency(contribution)} por mês</strong> cabe na previsão atual.`
      : '';
    insightCards.push({ icon: '▣', label: 'Reserva de emergência', title: `${hasReserveHistory ? 'Meta estimada' : 'Estimativa inicial'}: ${formatCurrency(reserveTarget)}`, copy: `${hasReserveHistory ? 'Equivale a seis meses do custo essencial médio' : 'Usa apenas as despesas essenciais categorizadas neste mês'}, hoje em ${formatCurrency(essentialAverage)}.${contributionCopy}` });
  } else {
    insightCards.push({ icon: '▣', label: 'Reserva de emergência', title: 'Proteja de 3 a 6 meses', copy: 'Cadastre gastos essenciais como casa, mercado, saúde e transporte para calcular sua reserva recomendada.' });
  }

  if (analyticsUnavailable) {
    insightCards.push({ icon: '↔', tone: 'warning', label: 'Comparativo mensal', title: 'Comparativo indisponível', copy: 'Não foi possível consultar o mês anterior. Os valores do mês atual continuam disponíveis.' });
  } else if (previousMonth?.expenseTotal > 0 && previousMonth.hasReliablePeriodCategories && currentAnalytics?.hasReliablePeriodCategories) {
    const previousCategories = previousMonth.periodCategoryTotals || {};
    const categories = new Set([...Object.keys(comparisonCategoryTotals), ...Object.keys(previousCategories)]);
    const changes = [...categories].map((category) => {
      const current = Number(comparisonCategoryTotals[category]) || 0;
      const previous = Number(previousCategories[category]) || 0;
      return previous > 0 ? { category, current, previous, difference: current - previous } : null;
    }).filter(Boolean).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    const change = changes[0];
    if (change && change.difference !== 0) {
      const percentage = Math.round((Math.abs(change.difference) / change.previous) * 100);
      const direction = change.difference > 0 ? 'mais' : 'menos';
      insightCards.push({ icon: '↔', tone: change.difference > 0 ? 'warning' : 'positive', label: 'Comparativo mensal', title: `${change.category}: ${percentage}% ${direction}`, copy: `Você registrou <strong>${formatCurrency(Math.abs(change.difference))} ${direction}</strong> em ${escapeHtml(change.category)} do que no mês anterior.` });
    } else {
      insightCards.push({ icon: '↔', label: 'Comparativo mensal', title: 'Gastos estáveis', copy: 'As categorias registradas mantiveram os mesmos valores do mês anterior.' });
    }
  } else {
    const coverage = Math.round((Number(previousMonth?.categoryCoverage) || 0) * 100);
    const missingPeriodDates = previousMonth?.hasReliableCategories && !previousMonth?.hasReliablePeriodCategories;
    insightCards.push({ icon: '↔', label: 'Comparativo mensal', title: previousMonth?.expenseTotal > 0 ? 'Histórico ainda não comparável' : 'Falta um mês para comparar', copy: previousMonth?.expenseTotal > 0 ? (missingPeriodDates ? 'O mês anterior possui categorias, mas os lançamentos antigos não têm datas suficientes para comparar o mesmo período do mês com segurança.' : `O mês anterior existe, mas apenas ${coverage}% das despesas têm categoria. Classifique pelo menos 70% para gerar um comparativo confiável.`) : 'Quando houver despesas categorizadas no mês anterior, você verá quanto cada categoria aumentou ou diminuiu.' });
  }

  $('insights-list').innerHTML = insightCards.map((insight) => `<article class="insight-card ${insight.tone || ''}"><span class="insight-card-label">${insight.label}</span><div class="insight-card-head"><span class="insight-card-icon">${insight.icon}</span><h3>${escapeHtml(insight.title)}</h3></div><p>${insight.copy}</p></article>`).join('');
};

const renderRecent = (currentData) => {
  const transactions = [
    ...currentData.income.map((item) => ({ ...item, transactionType: 'income' })),
    ...currentData.expenses.map((item) => ({ ...item, transactionType: 'expenses' }))
  ];
  const recent = sortByDateDesc(transactions).slice(0, 5);
  if (!recent.length) {
    dom.recentList.innerHTML = '<div class="category-empty">Seus lançamentos mais recentes aparecerão aqui.</div>';
    return;
  }
  dom.recentList.innerHTML = recent.map((item) => {
    const category = item.category || 'Outros';
    const meta = getMeta(category);
    const income = item.transactionType === 'income';
    return `<div class="recent-row ${item.importance === 'important' ? 'important-transaction' : ''}">
      <div class="recent-row-icon" style="background:${meta.soft};color:${meta.color}">${meta.icon}</div>
      <div class="recent-row-info"><strong>${item.importance === 'important' ? '<span class="important-star">★</span>' : ''}${escapeHtml(item.description)}</strong><span>${escapeHtml(category)} · ${formatDate(getDateKey(item), { day: '2-digit', month: 'long' })}</span></div>
      <div class="recent-row-amount ${income ? 'income' : 'expense'}"><strong>${income ? '+' : '−'} ${formatCurrency(item.amount)}</strong><span>${item.status === 'completed' ? (income ? 'Recebido' : 'Pago') : (income ? 'A receber' : 'A pagar')}</span></div>
    </div>`;
  }).join('');
};

const renderAdminUsers = (query = '') => {
  const users = appData.adminOverview?.users || [];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = users.filter((user) => !normalizedQuery || `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(normalizedQuery));
  const list = $('admin-users-list');
  if (!filtered.length) {
    list.innerHTML = `<tr><td colspan="5" class="admin-loading">${users.length ? 'Nenhuma conta encontrada para esta busca.' : 'Nenhuma conta criada ainda.'}</td></tr>`;
    return;
  }

  list.innerHTML = filtered.map((user) => {
    const admin = user.role === 'super_admin';
    const paid = user.paymentStatus === 'paid';
    const trial = user.accountStatus === 'trial';
    const expiredTrial = user.accountStatus === 'trial_expired';
    const trialLabel = trial ? `Teste · ${user.trialDaysRemaining || 1}d` : 'Teste expirado';
    const statusBadge = admin
      ? '<span class="admin-role-badge">Administrativo</span>'
      : trial || expiredTrial
        ? `<span class="billing-badge ${trial ? 'trial' : 'expired'}">${trialLabel}</span>`
        : `<span class="billing-badge ${paid ? 'paid' : 'pending'}">${paid ? 'Em dia' : 'Pendente'}</span>`;
    const billingAction = trial || expiredTrial
      ? `<button class="admin-row-button reactivate-user-btn" data-user-id="${user._id}" type="button">${expiredTrial ? 'Reativar' : 'Converter'}</button>`
      : `<button class="admin-row-button payment-admin-btn" data-user-id="${user._id}" type="button" ${admin ? 'disabled' : ''}>Pagamento</button>`;
    return `<tr>
      <td><div class="admin-user-cell"><div class="admin-user-avatar">${escapeHtml((user.name || user.email || 'U').charAt(0).toUpperCase())}</div><div><strong>${escapeHtml(user.name || 'Sem nome')}</strong><span>${escapeHtml(user.email || '')}</span>${admin ? '<em class="admin-role-badge">Super admin</em>' : trial || expiredTrial ? '<em class="admin-role-badge">Conta de teste</em>' : ''}</div></div></td>
      <td>${user.lastAccessAt ? formatDateTime(user.lastAccessAt) : '<span class="admin-never-accessed">Ainda não registrado</span>'}</td>
      <td>${formatStoredDate(trial || expiredTrial ? user.trialExpiresAt : user.paymentDueDate, 'Não definido')}</td>
      <td>${statusBadge}</td>
      <td><div class="admin-row-actions">${billingAction}<button class="admin-row-button access impersonate-btn" data-user-id="${user._id}" type="button" ${admin ? 'disabled' : ''}>Acessar conta</button><button class="admin-row-button danger delete-user-btn" data-user-id="${user._id}" type="button" ${admin ? 'disabled' : ''}>Excluir</button></div></td>
    </tr>`;
  }).join('');

  list.querySelectorAll('.payment-admin-btn:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
    const user = users.find((item) => item._id === button.dataset.userId);
    if (user) openPaymentModal(user);
  }));
  list.querySelectorAll('.reactivate-user-btn').forEach((button) => button.addEventListener('click', () => {
    const user = users.find((item) => item._id === button.dataset.userId);
    if (user) openReactivationModal(user);
  }));
  list.querySelectorAll('.impersonate-btn:not(:disabled)').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Acessando...';
    try {
      await api.impersonateUser(button.dataset.userId);
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Acessar conta';
      showToast(error, 'error');
    }
  }));
  list.querySelectorAll('.delete-user-btn:not(:disabled)').forEach((button) => button.addEventListener('click', () => {
    const user = users.find((item) => item._id === button.dataset.userId);
    if (!user) return;
    showConfirm(
      'Excluir conta permanentemente',
      `Tem certeza que deseja excluir a conta de ${user.name || user.email}? Todos os lançamentos dessa conta também serão apagados. Esta ação não pode ser desfeita.`,
      async () => {
        const confirmButton = $('confirm-ok-btn');
        confirmButton.disabled = true;
        confirmButton.textContent = 'Excluindo...';
        try {
          const result = await api.deleteUser(user._id);
          closeModal(dom.confirmModal);
          confirmCallback = null;
          showToast(`${result.message}. ${result.deletedTransactions || 0} lançamentos removidos.`);
          await loadAdminDashboard();
        } catch (error) {
          showToast(error, 'error');
        } finally {
          confirmButton.disabled = false;
          confirmButton.textContent = 'Excluir';
        }
      }
    );
  }));
};

const loadAdminDashboard = async () => {
  if (appData.role !== 'super_admin' || api.isImpersonating()) return;
  $('admin-users-list').innerHTML = '<tr><td colspan="5" class="admin-loading">Carregando contas...</td></tr>';
  try {
    const overview = await api.getAdminOverview();
    appData.adminOverview = overview;
    $('admin-total-users').textContent = overview.metrics.total;
    $('admin-paid-users').textContent = overview.metrics.paid;
    $('admin-pending-users').textContent = overview.metrics.pending;
    $('admin-trial-users').textContent = overview.metrics.trials;
    $('admin-trial-caption').textContent = overview.metrics.expiredTrials
      ? `${overview.metrics.expiredTrials} aguardando reativação`
      : 'acessos gratuitos ativos';
    $('admin-pix-key').value = overview.settings.pixKey || '';
    $('admin-pix-beneficiary').value = overview.settings.pixBeneficiary || '';
    $('admin-pix-amount').value = overview.settings.pixAmount || '';
    $('pix-preview-key').textContent = overview.settings.pixKey || 'Chave PIX não definida';
    $('pix-preview-name').textContent = overview.settings.pixBeneficiary || 'Beneficiário não definido';
    $('pix-preview-amount').textContent = formatCurrency(overview.settings.pixAmount || 0);
    renderAdminUsers($('admin-user-search').value);
  } catch (error) {
    $('admin-users-list').innerHTML = `<tr><td colspan="5" class="admin-loading">${escapeHtml(error)}</td></tr>`;
    showToast(error, 'error');
  }
};

const openPaymentModal = (user) => {
  $('payment-user-id').value = user._id;
  $('payment-user-avatar').textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
  $('payment-user-name').textContent = user.name || 'Sem nome';
  $('payment-user-email').textContent = user.email || '';
  $('payment-status-input').value = user.paymentStatus || 'pending';
  $('payment-due-date-input').value = user.paymentDueDate ? String(user.paymentDueDate).slice(0, 10) : '';
  $('payment-paid-date-input').value = user.lastPaymentDate ? String(user.lastPaymentDate).slice(0, 10) : '';
  $('payment-pix-amount-input').value = user.pixAmount || '';
  openModal(dom.paymentModal);
};

const openReactivationModal = (user) => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  const localDueDate = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
  $('reactivate-user-id').value = user._id;
  $('reactivate-user-avatar').textContent = (user.name || user.email || 'U').charAt(0).toUpperCase();
  $('reactivate-user-name').textContent = user.name || 'Sem nome';
  $('reactivate-user-email').textContent = user.email || '';
  $('reactivate-due-date').value = localDueDate;
  openModal(dom.reactivateUserModal);
};

const createTransactionCard = (item, type, isFixed = false) => {
  const card = document.createElement('article');
  const completed = item.status === 'completed';
  const income = type === 'income';
  const category = item.category || (isFixed ? 'Salário' : 'Outros');
  const meta = getMeta(category);
  const dateKey = getDateKey(item);
  const installment = item.installments ? `Parcela ${item.currentInstallment || 1}/${item.installments}` : '';
  const isImportant = item.importance === 'important';
  card.className = `transaction-card ${completed ? 'completed' : 'pending'} ${isImportant ? 'important-transaction' : ''}`;
  card.innerHTML = `
    <div class="transaction-category-icon" style="background:${meta.soft};color:${meta.color}">${meta.icon}</div>
    <div class="transaction-info">
      <div class="transaction-name-row"><span class="transaction-name">${isImportant ? '<span class="important-star">★</span>' : ''}${escapeHtml(item.description)}</span>${item.isRecurring ? '<span class="recurring-badge">RECORRENTE</span>' : ''}</div>
      <div class="transaction-meta"><span>${escapeHtml(category)}</span><i></i><span>${income ? 'Receber' : 'Vencimento'} em ${formatDate(dateKey, { day: '2-digit', month: 'long' })}</span>${installment ? `<i></i><span>${installment}</span>` : ''}</div>
    </div>
    <span class="status-pill ${completed ? 'completed' : ''}">${completed ? (income ? 'Recebido' : 'Pago') : (income ? 'A receber' : 'A pagar')}</span>
    <div class="transaction-value ${income ? 'income' : 'expense'}"><strong>${income ? '+' : '−'} ${formatCurrency(item.amount)}</strong><small>${income ? 'entrada' : 'saída'} prevista</small></div>
    <div class="card-actions">
      <button class="card-action status-action" type="button" title="${completed ? 'Marcar como pendente' : (income ? 'Marcar como recebido' : 'Marcar como pago')}" aria-label="Alterar status">
        <svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6"/></svg>
      </button>
      ${isFixed ? '' : `<button class="card-action edit-action" type="button" title="Editar" aria-label="Editar"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="card-action delete delete-action" type="button" title="Excluir" aria-label="Excluir"><svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/></svg></button>`}
    </div>`;

  card.querySelector('.status-action').addEventListener('click', async () => {
    const newStatus = completed ? 'pending' : 'completed';
    if (isFixed) {
      const result = await api.updateBaseSalaryStatus(selectedMonthId, newStatus);
      if (!result) return showToast('Não foi possível atualizar o salário.', 'error');
    } else {
      const result = await api.updateTransaction(item._id, { status: newStatus });
      if (!result) return showToast('Não foi possível atualizar o lançamento.', 'error');
    }
    showToast(income ? 'Status da receita atualizado.' : 'Status da despesa atualizado.');
    render();
  });

  if (!isFixed) {
    card.querySelector('.edit-action').addEventListener('click', () => openEditModal(type, item));
    card.querySelector('.delete-action').addEventListener('click', () => showConfirm(
      'Excluir lançamento',
      `Tem certeza que deseja excluir “${item.description}”?`,
      async () => {
        const success = await api.deleteTransaction(item._id);
        if (!success) return showToast('Não foi possível excluir o lançamento.', 'error');
        closeModal(dom.confirmModal);
        showToast('Lançamento excluído.');
        render();
      }
    ));
  }
  return card;
};

const renderTransactionList = (container, items, type, showCompleted) => {
  container.innerHTML = '';
  const visible = sortByDateDesc(items.filter((item) => showCompleted || item.status !== 'completed'));
  if (type === 'income' && appData.baseSalary > 0) {
    const currentData = appData.months[selectedMonthId];
    const salary = {
      id: 'base-salary', description: 'Salário base', amount: appData.baseSalary,
      status: currentData.baseSalaryStatus || 'pending', category: 'Salário', isRecurring: true,
      dueDate: getDayInMonth(selectedMonthId, appData.baseSalaryDay), monthId: selectedMonthId
    };
    if (showCompleted || salary.status !== 'completed') visible.push(salary);
  }

  const sortedVisible = sortByDateDesc(visible);
  if (!sortedVisible.length) {
    const noun = type === 'income' ? 'receita' : 'despesa';
    container.innerHTML = `<div class="empty-state"><div><div class="empty-state-icon">${type === 'income' ? '↑' : '↓'}</div><strong>Nenhuma ${noun} por aqui</strong><p>${showCompleted ? `Você ainda não registrou nenhuma ${noun} neste mês.` : `Não há ${noun}s pendentes. Use o botão acima para adicionar.`}</p></div></div>`;
    return;
  }

  const groups = sortedVisible.reduce((acc, item) => {
    const key = getDateKey(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  Object.entries(groups).forEach(([dateKey, groupItems]) => {
    const group = document.createElement('section');
    group.className = 'date-group';
    group.innerHTML = `<h3 class="date-group-title">${formatDate(dateKey, { weekday: 'long', day: '2-digit', month: 'long' })}</h3>`;
    groupItems.forEach((item) => group.appendChild(createTransactionCard(item, type, item.id === 'base-salary')));
    container.appendChild(group);
  });
};

const render = async () => {
  const requestMonth = selectedMonthId;
  let backendData;
  try {
    backendData = await api.getMonthData(requestMonth);
  } catch (error) {
    if (error?.code === 'TRIAL_EXPIRED') {
      dom.app.style.display = 'none';
      dom.authModal.style.display = 'flex';
      dom.authError.textContent = error.message;
      dom.authError.style.display = 'block';
      return;
    }
    showToast(`Erro ao carregar os dados: ${error?.message || error}`, 'error');
    return;
  }
  if (requestMonth !== selectedMonthId) return;
  if (!backendData) {
    showToast('Não foi possível carregar seus dados. Verifique a conexão.', 'error');
    return;
  }

  let analytics;
  try {
    analytics = await api.getFinancialAnalytics(requestMonth);
  } catch (error) {
    analytics = { months: [], unavailable: true, error: error.message };
  }
  if (requestMonth !== selectedMonthId) return;

  appData.baseSalary = Number(backendData.userData.baseSalary) || 0;
  appData.baseSalaryDay = Number(backendData.userData.baseSalaryDay) || 5;
  appData.userName = backendData.userData.name || 'Usuário';
  appData.userEmail = backendData.userData.email || '';
  appData.role = backendData.userData.role || 'user';
  appData.accountStatus = backendData.userData.accountStatus || 'active';
  appData.trialExpiresAt = backendData.userData.trialExpiresAt || null;
  appData.trialDaysRemaining = Number(backendData.userData.trialDaysRemaining) || 0;
  appData.paymentStatus = backendData.userData.paymentStatus || 'pending';
  appData.paymentDueDate = backendData.userData.paymentDueDate || null;
  appData.lastPaymentDate = backendData.userData.lastPaymentDate || null;
  appData.paymentSettings = backendData.userData.paymentSettings || { pixKey: '', pixBeneficiary: '', pixAmount: 0 };
  appData.months[selectedMonthId] = {
    income: backendData.transactions.income || [],
    expenses: backendData.transactions.expenses || [],
    baseSalaryStatus: backendData.userData.months?.[selectedMonthId]?.baseSalaryStatus || 'pending',
    baseSalaryCompletedAt: backendData.userData.months?.[selectedMonthId]?.baseSalaryCompletedAt || null
  };

  const firstName = appData.userName.trim().split(' ')[0] || 'Usuário';
  dom.userName.textContent = appData.userName;
  dom.userAvatar.textContent = firstName.charAt(0).toUpperCase();
  dom.userGreeting.textContent = `Olá, ${firstName}! Aqui está o resumo do seu mês.`;
  dom.monthDisplay.textContent = getMonthLabel(selectedMonthId);
  const impersonating = api.isImpersonating() || backendData.userData.isImpersonating;
  $('impersonation-banner').hidden = !impersonating;
  $('impersonation-copy').textContent = `Você está visualizando a conta de ${appData.userName}.`;
  $('admin-nav-item').hidden = appData.role !== 'super_admin' || impersonating;
  $('mobile-profile-btn').querySelector('span').textContent = appData.role === 'super_admin' && !impersonating ? 'Admin' : 'Conta';
  updatePaymentUI();
  const currentData = appData.months[selectedMonthId];
  const totals = calculateTotals(currentData);
  updateDashboard(currentData, totals, analytics);
  renderTransactionList(dom.incomeList, currentData.income, 'income', showCompletedIncome);
  renderTransactionList(dom.expenseList, currentData.expenses, 'expenses', showCompletedExpense);
  $('toggle-completed-income').classList.toggle('active', showCompletedIncome);
  $('toggle-completed-expense').classList.toggle('active', showCompletedExpense);
};

const categoryOptions = (type, selected) => {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return categories.map((category) => `<option value="${escapeHtml(category)}" ${category === selected ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('');
};

const closeCustomSelects = (except = null) => {
  document.querySelectorAll('.custom-select.open').forEach((element) => {
    if (element === except) return;
    element.classList.remove('open');
    element.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
  });
};

const enhanceSelect = (select, variant = 'default') => {
  const wrapper = document.createElement('div');
  wrapper.className = `custom-select custom-select-${variant}`;
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add('native-select-hidden');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';
  menu.setAttribute('role', 'listbox');

  const getVisual = (value) => {
    if (variant === 'category') {
      const meta = getMeta(value);
      return { icon: meta.icon, color: meta.color, soft: meta.soft };
    }
    return { icon: '•', color: '#557966', soft: '#e5eee8' };
  };

  const updateSelection = () => {
    const selected = select.options[select.selectedIndex];
    const visual = getVisual(selected.value);
    trigger.innerHTML = `<span class="custom-select-value"><i style="background:${visual.soft};color:${visual.color}">${visual.icon}</i><b>${escapeHtml(selected.textContent)}</b></span><svg viewBox="0 0 24 24" fill="none"><path d="m7 10 5 5 5-5"/></svg>`;
    menu.querySelectorAll('.custom-select-option').forEach((option) => {
      const active = option.dataset.value === select.value;
      option.classList.toggle('selected', active);
      option.setAttribute('aria-selected', String(active));
    });
  };

  [...select.options].forEach((option) => {
    const visual = getVisual(option.value);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'custom-select-option';
    button.dataset.value = option.value;
    button.setAttribute('role', 'option');
    button.innerHTML = `<i style="background:${visual.soft};color:${visual.color}">${visual.icon}</i><span>${escapeHtml(option.textContent)}</span><b>✓</b>`;
    button.addEventListener('click', () => {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      wrapper.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    });
    menu.appendChild(button);
  });

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = !wrapper.classList.contains('open');
    closeCustomSelects(wrapper);
    wrapper.classList.toggle('open', willOpen);
    trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) menu.querySelector('.custom-select-option.selected')?.focus();
  });
  trigger.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (!wrapper.classList.contains('open')) trigger.click();
  });
  menu.addEventListener('keydown', (event) => {
    const options = [...menu.querySelectorAll('.custom-select-option')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') options[Math.min(index + 1, options.length - 1)]?.focus();
    if (event.key === 'ArrowUp') options[Math.max(index - 1, 0)]?.focus();
    if (event.key === 'Escape') {
      wrapper.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }
  });
  select.addEventListener('change', updateSelection);
  wrapper.append(trigger, menu);
  updateSelection();
};

const enhanceImportance = (select) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'importance-toggle';
  wrapper.setAttribute('role', 'radiogroup');
  wrapper.setAttribute('aria-label', 'Importância do lançamento');
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add('native-select-hidden');

  const choices = [
    { value: 'neutral', icon: '○', label: 'Normal' },
    { value: 'important', icon: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v6M12 16.5h.01"/></svg>', label: 'Importante' }
  ];

  const updateSelection = () => {
    wrapper.querySelectorAll('.importance-choice').forEach((button) => {
      const selected = button.dataset.value === select.value;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  };

  choices.forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `importance-choice ${choice.value}`;
    button.dataset.value = choice.value;
    button.setAttribute('role', 'radio');
    button.innerHTML = `<span>${choice.icon}</span><strong>${choice.label}</strong>`;
    button.addEventListener('click', () => {
      select.value = choice.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const nextValue = choice.value === 'neutral' ? 'important' : 'neutral';
      select.value = nextValue;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      wrapper.querySelector(`[data-value="${nextValue}"]`)?.focus();
    });
    wrapper.appendChild(button);
  });

  select.addEventListener('change', updateSelection);
  updateSelection();
};

const createBulkRow = (data = {}, type = 'expenses') => {
  const row = document.createElement('div');
  const defaultCategory = type === 'income' ? 'Salário' : 'Contas';
  const dateValue = data.dueDate ? String(data.dueDate).slice(0, 10) : getDefaultDate();
  const isIncome = type === 'income';
  const descriptionPlaceholder = isIncome ? 'Ex.: Salário, freelance, venda' : 'Ex.: Aluguel, mercado, energia';
  const completedLabel = isIncome ? 'Já recebido' : 'Já pago';
  row.className = 'bulk-row';
  row.innerHTML = `
    <div class="bulk-row-header"><span class="bulk-row-title">Detalhes do lançamento</span><button type="button" class="remove-row-btn" aria-label="Remover item"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="row-fields">
      <div class="field-wrap"><label class="field-label">Descrição</label><input type="text" class="form-input row-desc" placeholder="${descriptionPlaceholder}" value="${escapeHtml(data.description || '')}" maxlength="80" required /></div>
      <div class="field-wrap"><label class="field-label">Valor</label><div class="currency-field"><span>R$</span><input type="number" class="form-input row-amount" placeholder="0,00" min="0.01" step="0.01" value="${data.amount || ''}" required /></div></div>
    </div>
    <div class="row-secondary-fields">
      <div class="field-wrap"><label class="field-label">Categoria</label><select class="form-select row-category" required>${categoryOptions(type, data.category || defaultCategory)}</select></div>
      <div class="field-wrap"><label class="field-label">Data para ${type === 'income' ? 'receber' : 'pagar'}</label><input type="date" class="form-input row-date" value="${dateValue}" required /></div>
    </div>
    <div class="row-secondary-fields">
      <div class="field-wrap"><label class="field-label">Importância</label><select class="form-select row-importance"><option value="neutral" ${data.importance !== 'important' ? 'selected' : ''}>Normal</option><option value="important" ${data.importance === 'important' ? 'selected' : ''}>Importante</option></select></div>
      <div class="field-wrap"><label class="field-label">Status atual</label><label class="completed-check"><input type="checkbox" class="row-completed" ${data.status === 'completed' ? 'checked' : ''} /><span class="completed-check-box">✓</span><span><strong>${completedLabel}</strong><small>Vale somente para este mês</small></span></label></div>
    </div>
    <div class="recurring-options">
      <label class="check-label"><input type="checkbox" class="row-recurring" ${data.isRecurring ? 'checked' : ''} /> Repetir mensalmente</label>
      <div class="installment-wrap" style="display:${data.isRecurring ? 'block' : 'none'}"><input type="number" class="form-input row-installments" placeholder="Nº de parcelas" min="1" max="120" value="${data.installments || ''}" title="Deixe vazio para repetir sem prazo" /></div>
    </div>`;

  enhanceSelect(row.querySelector('.row-category'), 'category');
  enhanceImportance(row.querySelector('.row-importance'));

  row.querySelector('.row-recurring').addEventListener('change', (event) => {
    row.querySelector('.installment-wrap').style.display = event.target.checked ? 'block' : 'none';
  });
  row.querySelector('.remove-row-btn').addEventListener('click', () => {
    if (dom.bulkContainer.children.length > 1) row.remove();
    else showToast('Mantenha ao menos um lançamento.', 'error');
  });
  return row;
};

const openAddModal = (type) => {
  closeModal(dom.typeModal);
  dom.modal.dataset.currentType = type;
  dom.editId.value = '';
  dom.bulkContainer.innerHTML = '';
  dom.bulkContainer.appendChild(createBulkRow({}, type));
  dom.addRow.style.display = 'block';
  $('modal-title').textContent = type === 'income' ? 'Nova receita' : 'Nova despesa';
  dom.transactionSubmit.textContent = 'Salvar lançamentos';
  openModal(dom.modal);
};

const openEditModal = (type, item) => {
  dom.modal.dataset.currentType = type;
  dom.editId.value = item._id;
  dom.bulkContainer.innerHTML = '';
  dom.bulkContainer.appendChild(createBulkRow(item, type));
  dom.addRow.style.display = 'none';
  $('modal-title').textContent = type === 'income' ? 'Editar receita' : 'Editar despesa';
  dom.transactionSubmit.textContent = 'Salvar alterações';
  openModal(dom.modal);
};

const showConfirm = (title, message, callback) => {
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = message;
  confirmCallback = callback;
  openModal(dom.confirmModal);
};

const changeMonth = (offset) => {
  const [year, month] = selectedMonthId.split('-').map(Number);
  const target = new Date(year, month - 1 + offset, 1);
  selectedMonthId = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
  dom.monthDisplay.textContent = getMonthLabel(selectedMonthId);
  render();
};

const switchView = (view) => {
  if (view === 'admin' && (appData.role !== 'super_admin' || api.isImpersonating())) return;
  activeView = view;
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  document.querySelectorAll('.view-section').forEach((section) => section.classList.remove('active-view'));
  $(`section-${view}`).classList.add('active-view');
  const titles = { dashboard: 'Visão geral', income: 'Receitas', expenses: 'Despesas' };
  titles.admin = 'Admin master';
  dom.pageTitle.textContent = titles[view];
  $('month-navigator').hidden = view === 'admin';
  $('quick-add-btn').hidden = view === 'admin';
  if (view === 'admin') loadAdminDashboard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal($(button.dataset.close))));
document.querySelectorAll('.modal-overlay').forEach((overlay) => overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(overlay); }));
document.addEventListener('click', (event) => { if (!event.target.closest('.custom-select')) closeCustomSelects(); });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (document.querySelector('.custom-select.open')) return closeCustomSelects();
  document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
});

$('prev-month').addEventListener('click', () => changeMonth(-1));
$('next-month').addEventListener('click', () => changeMonth(1));
$('quick-add-btn').addEventListener('click', () => openModal(dom.typeModal));
$('mobile-add-btn').addEventListener('click', () => openModal(dom.typeModal));
$('type-income-btn').addEventListener('click', () => openAddModal('income'));
$('type-expense-btn').addEventListener('click', () => openAddModal('expenses'));
$('add-income-btn').addEventListener('click', () => openAddModal('income'));
$('add-expense-btn').addEventListener('click', () => openAddModal('expenses'));
$('cancel-btn').addEventListener('click', () => closeModal(dom.modal));
$('salary-cancel-btn').addEventListener('click', () => closeModal(dom.salaryModal));
$('confirm-cancel-btn').addEventListener('click', () => { confirmCallback = null; closeModal(dom.confirmModal); });
$('confirm-ok-btn').addEventListener('click', () => { if (confirmCallback) confirmCallback(); });
$('logout-btn').addEventListener('click', () => api.isImpersonating() ? api.returnToAdmin() : api.logout());
$('profile-logout-btn').addEventListener('click', () => api.isImpersonating() ? api.returnToAdmin() : api.logout());
$('profile-btn').addEventListener('click', () => openModal(dom.profileModal));
$('mobile-profile-btn').addEventListener('click', () => openModal(dom.profileModal));
$('profile-admin-btn').addEventListener('click', () => {
  closeModal(dom.profileModal);
  switchView('admin');
});
$('payment-profile-btn').addEventListener('click', () => openModal(dom.profileModal));
$('payment-alert-copy-btn').addEventListener('click', copyPixKey);
$('profile-copy-pix').addEventListener('click', copyPixKey);
$('return-admin-btn').addEventListener('click', () => api.returnToAdmin());
$('see-all-btn').addEventListener('click', () => switchView('expenses'));
$('refresh-admin-btn').addEventListener('click', loadAdminDashboard);
$('admin-user-search').addEventListener('input', (event) => renderAdminUsers(event.target.value));
$('payment-cancel-btn').addEventListener('click', () => closeModal(dom.paymentModal));
$('create-user-btn').addEventListener('click', () => {
  $('create-user-form').reset();
  openModal(dom.createUserModal);
});
$('create-user-cancel-btn').addEventListener('click', () => closeModal(dom.createUserModal));
$('reactivate-user-cancel-btn').addEventListener('click', () => closeModal(dom.reactivateUserModal));

$('create-user-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.classList.add('loading');
  try {
    await api.createUser({
      name: $('create-user-name').value.trim(),
      email: $('create-user-email').value.trim(),
      password: $('create-user-password').value,
      paymentDueDate: $('create-user-due-date').value || null
    });
    closeModal(dom.createUserModal);
    showToast('Conta criada. Envie os dados de acesso ao cliente.');
    await loadAdminDashboard();
  } catch (error) {
    showToast(error, 'error');
  } finally {
    submit.classList.remove('loading');
  }
});

$('reactivate-user-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.classList.add('loading');
  try {
    await api.reactivateUser($('reactivate-user-id').value, $('reactivate-due-date').value);
    closeModal(dom.reactivateUserModal);
    showToast('Conta reativada. O pagamento inicial está pendente.');
    await loadAdminDashboard();
  } catch (error) {
    showToast(error, 'error');
  } finally {
    submit.classList.remove('loading');
  }
});

$('payment-status-input').addEventListener('change', (event) => {
  if (event.target.value === 'paid' && !$('payment-paid-date-input').value) $('payment-paid-date-input').value = getDefaultDate();
});

$('payment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.classList.add('loading');
  try {
    await api.updateUserPayment($('payment-user-id').value, {
      status: $('payment-status-input').value,
      paymentDueDate: $('payment-due-date-input').value || null,
      lastPaymentDate: $('payment-paid-date-input').value || null,
      pixAmount: $('payment-pix-amount-input').value || undefined
    });
    closeModal(dom.paymentModal);
    showToast('Situação do pagamento atualizada.');
    loadAdminDashboard();
  } catch (error) {
    showToast(error, 'error');
  } finally {
    submit.classList.remove('loading');
  }
});

$('admin-settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  submit.classList.add('loading');
  try {
    const settings = await api.updateAdminSettings({
      pixKey: $('admin-pix-key').value.trim(),
      pixBeneficiary: $('admin-pix-beneficiary').value.trim(),
      pixAmount: $('admin-pix-amount').value
    });
    $('pix-preview-key').textContent = settings.pixKey || 'Chave PIX não definida';
    $('pix-preview-name').textContent = settings.pixBeneficiary || 'Beneficiário não definido';
    $('pix-preview-amount').textContent = formatCurrency(settings.pixAmount || 0);
    showToast('Configurações PIX atualizadas.');
  } catch (error) {
    showToast(error, 'error');
  } finally {
    submit.classList.remove('loading');
  }
});

['admin-pix-key', 'admin-pix-beneficiary', 'admin-pix-amount'].forEach((id) => $(id).addEventListener('input', () => {
  $('pix-preview-key').textContent = $('admin-pix-key').value || 'Chave PIX não definida';
  $('pix-preview-name').textContent = $('admin-pix-beneficiary').value || 'Beneficiário não definido';
  $('pix-preview-amount').textContent = formatCurrency($('admin-pix-amount').value || 0);
}));

document.querySelectorAll('.btn-edit-base-salary').forEach(btn => btn.addEventListener('click', () => {
  dom.baseSalaryInput.value = appData.baseSalary || '';
  $('base-salary-day-input').value = appData.baseSalaryDay || 5;
  openModal(dom.salaryModal);
}));

$('toggle-completed-income').addEventListener('click', () => {
  showCompletedIncome = !showCompletedIncome;
  const data = appData.months[selectedMonthId];
  if (data) renderTransactionList(dom.incomeList, data.income, 'income', showCompletedIncome);
  $('toggle-completed-income').classList.toggle('active', showCompletedIncome);
});

$('toggle-completed-expense').addEventListener('click', () => {
  showCompletedExpense = !showCompletedExpense;
  const data = appData.months[selectedMonthId];
  if (data) renderTransactionList(dom.expenseList, data.expenses, 'expenses', showCompletedExpense);
  $('toggle-completed-expense').classList.toggle('active', showCompletedExpense);
});

dom.addRow.addEventListener('click', () => dom.bulkContainer.appendChild(createBulkRow({}, dom.modal.dataset.currentType)));

dom.transactionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const type = dom.modal.dataset.currentType;
  const editId = dom.editId.value;
  const rows = [...dom.bulkContainer.querySelectorAll('.bulk-row')];
  dom.transactionSubmit.classList.add('loading');
  let saved = 0;
  try {
    for (const row of rows) {
      const description = row.querySelector('.row-desc').value.trim();
      const amount = Number(row.querySelector('.row-amount').value);
      const category = row.querySelector('.row-category').value;
      const dueDate = row.querySelector('.row-date').value;
      const isRecurring = row.querySelector('.row-recurring').checked;
      const isCompleted = row.querySelector('.row-completed').checked;
      const importance = row.querySelector('.row-importance').value;
      const installmentsValue = row.querySelector('.row-installments').value;
      const installments = isRecurring && installmentsValue ? Number(installmentsValue) : undefined;
      const payload = { description, amount, category, dueDate, type, monthId: dueDate.slice(0, 7), isRecurring, installments, importance, status: isCompleted ? 'completed' : 'pending' };
      if (!description || !amount || !dueDate) continue;
      if (!installments) delete payload.installments;
      if (!isRecurring) payload.installments = null;
      const result = editId
        ? await api.updateTransaction(editId, payload)
        : await api.saveTransaction({ ...payload, currentInstallment: installments ? 1 : undefined });
      if (!result) throw new Error('save-failed');
      saved += 1;
    }
    closeModal(dom.modal);
    showToast(`${saved} ${saved === 1 ? 'lançamento salvo' : 'lançamentos salvos'} com sucesso.`);
    await render();
  } catch {
    showToast('Não foi possível salvar. Tente novamente.', 'error');
  } finally {
    dom.transactionSubmit.classList.remove('loading');
  }
});

$('salary-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = Number(dom.baseSalaryInput.value);
  const day = Number($('base-salary-day-input').value);
  const result = await api.updateBaseSalary(value, day);
  if (!result) return showToast('Não foi possível salvar o salário.', 'error');
  closeModal(dom.salaryModal);
  showToast('Salário base atualizado.');
  render();
});

dom.authSwitch.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  dom.authTitle.textContent = isRegisterMode ? 'Comece seu teste gratuito' : 'Entre na sua conta';
  dom.authSubtitle.textContent = isRegisterMode
    ? 'Use todos os recursos por 7 dias, sem cobrança durante o teste.'
    : 'Acesse com seus dados para continuar.';
  dom.authSubmit.textContent = isRegisterMode ? 'Criar teste de 7 dias' : 'Entrar';
  dom.authSwitchText.textContent = isRegisterMode ? 'Já possui uma conta?' : 'Ainda não tem uma conta?';
  dom.authSwitch.textContent = isRegisterMode ? 'Entrar' : 'Testar grátis';
  dom.registerName.hidden = !isRegisterMode;
  $('reg-name').required = isRegisterMode;
  $('auth-password').autocomplete = isRegisterMode ? 'new-password' : 'current-password';
  $('auth-trial-note').textContent = isRegisterMode
    ? 'Ao final dos 7 dias, somente o admin master poderá reativar sua conta.'
    : 'Ainda não conhece o sistema? Crie um teste gratuito por 7 dias.';
  dom.authError.style.display = 'none';
});

dom.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  dom.authError.style.display = 'none';
  dom.authSubmit.classList.add('loading');
  try {
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    if (isRegisterMode) await api.registerTrial($('reg-name').value.trim(), email, password);
    else await api.login(email, password);
    checkAuth();
  } catch (error) {
    dom.authError.textContent = typeof error === 'string' ? error : (error?.message || 'Não foi possível continuar. Tente novamente.');
    dom.authError.style.display = 'block';
  } finally {
    dom.authSubmit.classList.remove('loading');
  }
});

const today = new Date();
$('today-label').textContent = today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
dom.monthDisplay.textContent = getMonthLabel(selectedMonthId);
checkAuth();
