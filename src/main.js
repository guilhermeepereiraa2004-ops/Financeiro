import './style.css'
import { api } from './api';

// --- Auth State ---
const checkAuth = () => {
  const token = localStorage.getItem('auth_token');
  const appEl = document.getElementById('app');
  const authModal = document.getElementById('auth-modal');

  if (token) {
    appEl.style.display = 'block';
    authModal.style.display = 'none';
    render();
  } else {
    appEl.style.display = 'none';
    authModal.style.display = 'flex';
  }
};

// --- State Management ---
const getCurrentMonthId = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

let defaultState = {
  activeMonthId: getCurrentMonthId(),
  baseSalary: 0,
  months: {}
};
defaultState.months[defaultState.activeMonthId] = { income: [], expenses: [], baseSalaryStatus: 'pending' };

let appData = defaultState; // Será preenchido pelo backend
let selectedMonthId = getCurrentMonthId();

// --- DOM Elements ---
const balanceRealEl = document.getElementById('total-balance-real');
const balancePlannedEl = document.getElementById('total-balance-planned');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const incomeListEl = document.getElementById('income-list');
const expenseListEl = document.getElementById('expense-list');

const baseSalaryDisplay = document.getElementById('base-salary-display');
const editBaseSalaryBtn = document.getElementById('edit-base-salary');
const monthDisplay = document.getElementById('current-month-display');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const resetMonthBtn = document.getElementById('reset-month-btn');
const logoutBtn = document.getElementById('logout-btn');
const userGreetingEl = document.getElementById('user-greeting');

// Auth DOM
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const regNameGroup = document.getElementById('register-name-group');
const authErrorEl = document.getElementById('auth-error');
let isRegisterMode = false;

// Modals
const entryModal = document.getElementById('modal');
const salaryModal = document.getElementById('salary-modal');
const confirmModal = document.getElementById('confirm-modal');

// Forms & Containers
const transactionForm = document.getElementById('transaction-form');
const bulkContainer = document.getElementById('bulk-items-container');
const addRowBtn = document.getElementById('add-row-btn');
const editIdInput = document.getElementById('edit-id');
const submitBtn = transactionForm.querySelector('button[type="submit"]');

const salaryForm = document.getElementById('salary-form');
const baseSalaryInput = document.getElementById('base-salary-input');

const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');

const addIncomeBtn = document.getElementById('add-income-btn');
const addExpenseBtn = document.getElementById('add-expense-btn');

// --- Utilities ---
const formatCurrency = (value) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getMonthLabel = (id) => {
  const [year, month] = id.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// --- Core Logic ---
const render = async () => {
  const backendData = await api.getMonthData(selectedMonthId);
  if (!backendData) return;

  appData.baseSalary = backendData.userData.baseSalary;
  userGreetingEl.textContent = `Olá, ${backendData.userData.name || 'Usuário'}!`;
  
  appData.months[selectedMonthId] = {
    income: backendData.transactions.income,
    expenses: backendData.transactions.expenses,
    baseSalaryStatus: backendData.userData.months?.[selectedMonthId]?.baseSalaryStatus || 'pending'
  };

  baseSalaryDisplay.textContent = formatCurrency(appData.baseSalary);
  monthDisplay.textContent = getMonthLabel(selectedMonthId);
  
  // Navegação básica (simplificada para o mês atual e históricos detectados)
  monthDisplay.textContent = getMonthLabel(selectedMonthId);

  const currentData = appData.months[selectedMonthId];
  
  incomeListEl.innerHTML = '';
  expenseListEl.innerHTML = '';

  let totals = { plannedIncome: appData.baseSalary, plannedExpense: 0, realIncome: 0, realExpense: 0 };
  if (currentData.baseSalaryStatus === 'completed') totals.realIncome += appData.baseSalary;

  if (appData.baseSalary > 0) {
    const baseSalaryItem = {
      id: 'base-salary',
      description: 'Salário Base (Fixo)',
      amount: appData.baseSalary,
      status: currentData.baseSalaryStatus,
      isRecurring: true
    };
    incomeListEl.appendChild(createCard(baseSalaryItem, 'income', true));
  }

  currentData.income.forEach(item => {
    totals.plannedIncome += item.amount;
    if (item.status === 'completed') totals.realIncome += item.amount;
    incomeListEl.appendChild(createCard(item, 'income'));
  });

  if (incomeListEl.children.length === 0) {
    incomeListEl.innerHTML = '<div class="empty-state">Nenhum ganho registrado</div>';
  }

  currentData.expenses.forEach(item => {
    totals.plannedExpense += item.amount;
    if (item.status === 'completed') totals.realExpense += item.amount;
    expenseListEl.appendChild(createCard(item, 'expenses'));
  });

  if (expenseListEl.children.length === 0) {
    expenseListEl.innerHTML = '<div class="empty-state">Nenhuma despesa registrada</div>';
  }

  const realBalance = totals.realIncome - totals.realExpense;
  const plannedBalance = totals.plannedIncome - totals.plannedExpense;

  balanceRealEl.textContent = formatCurrency(realBalance);
  balancePlannedEl.textContent = `Previsto: ${formatCurrency(plannedBalance)}`;
  totalIncomeEl.textContent = formatCurrency(totals.plannedIncome);
  totalExpenseEl.textContent = formatCurrency(totals.plannedExpense);
  
  resetMonthBtn.parentElement.style.display = 'flex'; // Sempre visível no sistema de banco de dados
};

const createCard = (item, type, isFixed = false) => {
  const card = document.createElement('div');
  const isCompleted = item.status === 'completed';
  card.className = `transaction-card ${isCompleted ? 'completed' : 'pending'}`;
  if (isFixed) card.style.background = 'rgba(201, 228, 202, 0.1)';
  
  const displayClass = type === 'income' ? 'income' : 'expense';
  const symbol = type === 'income' ? '+' : '-';
  const installmentText = item.installments ? ` <span style="font-size: 0.75rem; color: var(--primary-medium); font-weight: 700;">(${item.currentInstallment}/${item.installments})</span>` : '';

  card.innerHTML = `
    <div class="transaction-info">
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="transaction-name">${item.description}${installmentText}</span>
        ${item.isRecurring ? `
          <svg title="Recorrente" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6; color: var(--primary-medium);"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        ` : ''}
      </div>
      <span class="transaction-date">${isFixed ? 'Mensal Fixo' : new Date(item.createdAt || Date.now()).toLocaleDateString('pt-BR')}</span>
    </div>
    <div class="card-actions">
      <span class="transaction-amount ${displayClass}">
        ${symbol} ${formatCurrency(item.amount)}
      </span>
      <button class="status-btn ${isCompleted ? 'completed' : ''}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </button>
      ${!isFixed ? `
      <button class="edit-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      </button>
      <button class="delete-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
      ` : ''}
    </div>
  `;

  card.querySelector('.status-btn').addEventListener('click', async () => {
    if (isFixed) {
      appData.months[selectedMonthId].baseSalaryStatus = appData.months[selectedMonthId].baseSalaryStatus === 'completed' ? 'pending' : 'completed';
    } else {
      const newStatus = item.status === 'completed' ? 'pending' : 'completed';
      item.status = newStatus;
      if (item._id) await api.updateTransaction(item._id, { status: newStatus });
    }
    render();
  });

  if (!isFixed) {
    card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(type, item));
    card.querySelector('.delete-btn').addEventListener('click', () => {
      showConfirm('Excluir Lançamento', `Deseja realmente excluir "${item.description}"?`, async () => {
        if (item._id) await api.deleteTransaction(item._id);
        render();
        hideConfirm();
      });
    });
  }

  return card;
};

// --- Bulk Add Logic ---
const createBulkRow = (data = {}) => {
  const row = document.createElement('div');
  row.className = 'bulk-row';
  row.innerHTML = `
    <div class="bulk-row-header">
      <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;"># Item</span>
      <button type="button" class="remove-row-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="bulk-row-inputs">
      <input type="text" class="form-input row-desc" placeholder="Descrição" value="${data.description || ''}" required />
      <input type="number" class="form-input row-amount" placeholder="0,00" step="0.01" value="${data.amount || ''}" required />
    </div>
    <div class="bulk-row-options">
      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
        <input type="checkbox" class="row-recurring" ${data.isRecurring ? 'checked' : ''} /> Recorrente
      </label>
      <div class="row-installments-group" style="display: ${data.isRecurring ? 'block' : 'none'};">
        <input type="number" class="form-input row-installments" placeholder="Parcelas" min="1" value="${data.installments || ''}" style="width: 100px;" />
      </div>
    </div>
  `;

  row.querySelector('.row-recurring').addEventListener('change', (e) => {
    row.querySelector('.row-installments-group').style.display = e.target.checked ? 'block' : 'none';
  });

  row.querySelector('.remove-row-btn').addEventListener('click', () => {
    if (bulkContainer.children.length > 1) row.remove();
  });

  return row;
};

// --- Auth Events ---
authSwitchBtn.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? 'Criar Conta' : 'Entrar';
  authSubmitBtn.textContent = isRegisterMode ? 'Cadastrar' : 'Entrar';
  authSwitchText.textContent = isRegisterMode ? 'Já tem uma conta?' : 'Não tem uma conta?';
  authSwitchBtn.textContent = isRegisterMode ? 'Faça Login' : 'Cadastre-se';
  regNameGroup.style.display = isRegisterMode ? 'block' : 'none';
  authErrorEl.style.display = 'none';
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('reg-name').value;

  authErrorEl.style.display = 'none';
  authSubmitBtn.classList.add('loading');

  try {
    if (isRegisterMode) {
      await api.register(name, email, password);
    } else {
      await api.login(email, password);
    }
    checkAuth();
  } catch (err) {
    authErrorEl.textContent = err;
    authErrorEl.style.display = 'block';
  } finally {
    authSubmitBtn.classList.remove('loading');
  }
});

logoutBtn.addEventListener('click', () => api.logout());

// --- App Actions ---
const openEditModal = (type, item) => {
  entryModal.dataset.currentType = type;
  editIdInput.value = item._id;
  bulkContainer.innerHTML = '';
  bulkContainer.appendChild(createBulkRow(item));
  addRowBtn.style.display = 'none';
  entryModal.classList.add('active');
};

const openAddModal = (type) => {
  entryModal.dataset.currentType = type;
  editIdInput.value = '';
  bulkContainer.innerHTML = '';
  bulkContainer.appendChild(createBulkRow());
  addRowBtn.style.display = 'block';
  entryModal.classList.add('active');
};

const finalizeMonth = () => {
  showConfirm('Finalizar Mês', 'Deseja encerrar este mês e iniciar o próximo?', async () => {
    // A lógica de recorrência no backend pode ser feita aqui ou no server
    // Por simplicidade, faremos no próximo render() detectando novos meses
    const [year, month] = selectedMonthId.split('-').map(Number);
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }
    selectedMonthId = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    render();
    hideConfirm();
  });
};

addRowBtn.addEventListener('click', () => bulkContainer.appendChild(createBulkRow()));

transactionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = entryModal.dataset.currentType;
  const editId = editIdInput.value;
  const rows = bulkContainer.querySelectorAll('.bulk-row');

  submitBtn.classList.add('loading');
  try {
    for (const row of rows) {
      const description = row.querySelector('.row-desc').value.trim();
      const amount = parseFloat(row.querySelector('.row-amount').value);
      const isRecurring = row.querySelector('.row-recurring').checked;
      const installments = isRecurring && row.querySelector('.row-installments').value ? parseInt(row.querySelector('.row-installments').value) : undefined;

      if (description && !isNaN(amount)) {
        const data = { description, amount, type, monthId: selectedMonthId, isRecurring, installments };
        if (editId) {
          await api.updateTransaction(editId, data);
        } else {
          if (installments) data.currentInstallment = 1;
          await api.saveTransaction(data);
        }
      }
    }
    render();
    entryModal.classList.remove('active');
  } finally {
    submitBtn.classList.remove('loading');
  }
});

editBaseSalaryBtn.addEventListener('click', () => {
  baseSalaryInput.value = appData.baseSalary;
  salaryModal.classList.add('active');
});

salaryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = parseFloat(baseSalaryInput.value);
  await api.updateBaseSalary(val);
  render();
  salaryModal.classList.remove('active');
});

// Outros eventos
addIncomeBtn.addEventListener('click', () => openAddModal('income'));
addExpenseBtn.addEventListener('click', () => openAddModal('expenses'));
document.getElementById('cancel-btn').addEventListener('click', () => entryModal.classList.remove('active'));
document.getElementById('salary-cancel-btn').addEventListener('click', () => salaryModal.classList.remove('active'));
document.getElementById('confirm-cancel-btn').addEventListener('click', () => confirmModal.classList.remove('active'));
confirmOkBtn.addEventListener('click', () => { if (confirmCallback) confirmCallback(); });
resetMonthBtn.addEventListener('click', finalizeMonth);

prevMonthBtn.addEventListener('click', () => {
  const [year, month] = selectedMonthId.split('-').map(Number);
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) { prevMonth = 12; prevYear--; }
  selectedMonthId = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  render();
});

nextMonthBtn.addEventListener('click', () => {
  const [year, month] = selectedMonthId.split('-').map(Number);
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) { nextMonth = 1; nextYear++; }
  selectedMonthId = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  render();
});

// Inicialização
checkAuth();
