import './style.css';
import { api } from './api';

const EXPENSE_CATEGORIES = ['Assinaturas', 'Cartão', 'Casa', 'Compras', 'Contas', 'Delivery', 'Educação', 'Lazer', 'Mercado', 'Saúde', 'Transporte', 'Outros'];
const INCOME_CATEGORIES = ['Freelance', 'Investimentos', 'Presente', 'Reembolso', 'Salário', 'Vendas', 'Outros'];

const CATEGORY_META = {
  Casa: { icon: '⌂', color: '#557966', soft: '#e5eee8' },
  Contas: { icon: '▤', color: '#527a9a', soft: '#e8f0f5' },
  Mercado: { icon: '🛒', color: '#6d8c78', soft: '#e8f0ea' },
  Delivery: { icon: '🍔', color: '#bd7b45', soft: '#f7ecdf' },
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

const updateDashboard = (currentData, totals) => {
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
  renderInsights(currentData, totals);
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
  const delivery = totals.Delivery || 0;
  const leisure = totals.Lazer || 0;
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];

  $('delivery-value').textContent = formatCurrency(delivery);
  $('delivery-share').textContent = `${total ? Math.round((delivery / total) * 100) : 0}% dos gastos previstos`;
  $('leisure-value').textContent = formatCurrency(leisure);
  $('leisure-share').textContent = `${total ? Math.round((leisure / total) * 100) : 0}% dos gastos previstos`;
  $('top-category').textContent = top ? top[0] : 'Nenhuma ainda';
  $('top-category-value').textContent = top ? `${formatCurrency(top[1])} · ${Math.round((top[1] / total) * 100)}% do total` : 'Comece adicionando seus gastos';
};

const renderInsights = (currentData, totals) => {
  const categoryTotals = currentData.expenses.reduce((acc, item) => {
    const category = item.category || 'Outros';
    acc[category] = (acc[category] || 0) + (Number(item.amount) || 0);
    return acc;
  }, {});
  const top = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const pendingItems = currentData.expenses.filter((item) => item.status !== 'completed');
  const discretionary = ['Delivery', 'Lazer', 'Compras', 'Assinaturas'];
  const adjustable = Object.entries(categoryTotals).filter(([category]) => discretionary.includes(category)).sort((a, b) => b[1] - a[1])[0];
  const insightCards = [];

  if (top) {
    const share = totals.plannedExpense ? Math.round((top[1] / totals.plannedExpense) * 100) : 0;
    insightCards.push({ icon: '↗', title: 'Maior concentração', copy: `<strong>${escapeHtml(top[0])}</strong> representa ${share}% das despesas do mês, com ${formatCurrency(top[1])}.` });
  } else {
    insightCards.push({ icon: '◎', title: 'Comece por aqui', copy: 'Registre seus gastos para descobrir quais categorias mais pesam no seu orçamento.' });
  }

  if (pendingItems.length) {
    insightCards.push({ icon: '!', title: 'Pontos de atenção', copy: `Você ainda tem <strong>${pendingItems.length} ${pendingItems.length === 1 ? 'conta pendente' : 'contas pendentes'}</strong>, somando ${formatCurrency(totals.pendingExpense)}.` });
  } else if (currentData.expenses.length) {
    insightCards.push({ icon: '✓', title: 'Tudo em dia', copy: 'Todas as despesas cadastradas neste mês já foram marcadas como pagas.' });
  } else {
    insightCards.push({ icon: '!', title: 'Pontos de atenção', copy: 'Cadastre também as contas futuras para evitar surpresas ao longo do mês.' });
  }

  if (adjustable) {
    const saving = adjustable[1] * 0.15;
    insightCards.push({ icon: '→', title: 'Próximo mês', copy: `Reduzir <strong>${escapeHtml(adjustable[0])} em 15%</strong> pode liberar cerca de ${formatCurrency(saving)} para seus objetivos.` });
  } else if (totals.plannedIncome > 0) {
    const target = totals.plannedIncome * 0.1;
    insightCards.push({ icon: '→', title: 'Próximo mês', copy: `Separe primeiro <strong>${formatCurrency(target)}</strong> (10% da renda) para formar sua reserva.` });
  } else {
    insightCards.push({ icon: '→', title: 'Próximo mês', copy: 'Defina seu salário base para receber uma meta de economia proporcional à sua renda.' });
  }

  $('insights-list').innerHTML = insightCards.map((insight) => `<article class="insight-card"><div class="insight-card-head"><span class="insight-card-icon">${insight.icon}</span><h3>${insight.title}</h3></div><p>${insight.copy}</p></article>`).join('');
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
      <td>${formatDateTime(user.lastLoginAt)}</td>
      <td>${formatStoredDate(trial || expiredTrial ? user.trialExpiresAt : user.paymentDueDate, 'Não definido')}</td>
      <td>${statusBadge}</td>
      <td><div class="admin-row-actions">${billingAction}<button class="admin-row-button access impersonate-btn" data-user-id="${user._id}" type="button" ${admin ? 'disabled' : ''}>Acessar conta</button></div></td>
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
    baseSalaryStatus: backendData.userData.months?.[selectedMonthId]?.baseSalaryStatus || 'pending'
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
  updateDashboard(currentData, totals);
  renderTransactionList(dom.incomeList, currentData.income, 'income', showCompletedIncome);
  renderTransactionList(dom.expenseList, currentData.expenses, 'expenses', showCompletedExpense);
  $('toggle-completed-income').classList.toggle('active', showCompletedIncome);
  $('toggle-completed-expense').classList.toggle('active', showCompletedExpense);
};

const categoryOptions = (type, selected) => {
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  return categories.map((category) => `<option value="${escapeHtml(category)}" ${category === selected ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('');
};

const createBulkRow = (data = {}, type = 'expenses') => {
  const row = document.createElement('div');
  const defaultCategory = type === 'income' ? 'Salário' : 'Contas';
  const dateValue = data.dueDate ? String(data.dueDate).slice(0, 10) : getDefaultDate();
  row.className = 'bulk-row';
  row.innerHTML = `
    <div class="bulk-row-header"><span class="bulk-row-title">Detalhes do lançamento</span><button type="button" class="remove-row-btn" aria-label="Remover item"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="row-fields">
      <div class="field-wrap"><label class="field-label">Descrição</label><input type="text" class="form-input row-desc" placeholder="Ex.: Aluguel, salário, mercado" value="${escapeHtml(data.description || '')}" maxlength="80" required /></div>
      <div class="field-wrap"><label class="field-label">Valor</label><div class="currency-field"><span>R$</span><input type="number" class="form-input row-amount" placeholder="0,00" min="0.01" step="0.01" value="${data.amount || ''}" required /></div></div>
    </div>
    <div class="row-secondary-fields">
      <div class="field-wrap"><label class="field-label">Categoria</label><select class="form-select row-category" required>${categoryOptions(type, data.category || defaultCategory)}</select></div>
      <div class="field-wrap"><label class="field-label">Data para ${type === 'income' ? 'receber' : 'pagar'}</label><input type="date" class="form-input row-date" value="${dateValue}" required /></div>
    </div>
    <div class="row-secondary-fields">
      <div class="field-wrap"><label class="field-label">Importância</label><select class="form-select row-importance"><option value="neutral" ${data.importance !== 'important' ? 'selected' : ''}>Neutra</option><option value="important" ${data.importance === 'important' ? 'selected' : ''}>Importante</option></select></div>
    </div>
    <div class="recurring-options">
      <label class="check-label"><input type="checkbox" class="row-recurring" ${data.isRecurring ? 'checked' : ''} /> Repetir mensalmente</label>
      <div class="installment-wrap" style="display:${data.isRecurring ? 'block' : 'none'}"><input type="number" class="form-input row-installments" placeholder="Nº de parcelas" min="1" max="120" value="${data.installments || ''}" title="Deixe vazio para repetir sem prazo" /></div>
    </div>`;

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
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(closeModal); });

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
      const importance = row.querySelector('.row-importance').value;
      const installmentsValue = row.querySelector('.row-installments').value;
      const installments = isRecurring && installmentsValue ? Number(installmentsValue) : undefined;
      const payload = { description, amount, category, dueDate, type, monthId: dueDate.slice(0, 7), isRecurring, installments, importance };
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
