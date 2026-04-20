import './style.css'
import { api } from './api';

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

// --- Global App State (Local Copy) ---
let appData = JSON.parse(localStorage.getItem('green_control_v2')) || defaultState;
let selectedMonthId = appData.activeMonthId;

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

// Modals
const entryModal = document.getElementById('modal');
const salaryModal = document.getElementById('salary-modal');
const confirmModal = document.getElementById('confirm-modal');

// Forms & Inputs
const transactionForm = document.getElementById('transaction-form');
const editIdInput = document.getElementById('edit-id');
const descInput = document.getElementById('desc');
const amountInput = document.getElementById('amount');
const isRecurringInput = document.getElementById('is-recurring');
const installmentsGroup = document.getElementById('installments-group');
const installmentsInput = document.getElementById('installments');

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

const saveLocally = () => {
  localStorage.setItem('green_control_v2', JSON.stringify(appData));
};

const getMonthLabel = (id) => {
  const [year, month] = id.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// --- Sync Logic ---
const syncWithBackend = async () => {
  const backendData = await api.getMonthData(selectedMonthId);
  if (backendData) {
    // Mesclar dados do backend com estado local se necessário
    // Por enquanto, priorizamos o backend se disponível
    appData.baseSalary = backendData.userData.baseSalary;
    appData.months[selectedMonthId] = {
      ...appData.months[selectedMonthId],
      income: backendData.transactions.income,
      expenses: backendData.transactions.expenses,
      baseSalaryStatus: backendData.userData.months?.[selectedMonthId]?.baseSalaryStatus || 'pending'
    };
    saveLocally();
  }
};

// --- Custom Confirmation Logic ---
let confirmCallback = null;
const showConfirm = (title, message, callback) => {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmCallback = callback;
  confirmModal.classList.add('active');
};

const hideConfirm = () => {
  confirmModal.classList.remove('active');
  confirmCallback = null;
};

// --- Core Logic ---
const render = async () => {
  // Tentar sincronizar antes de renderizar
  await syncWithBackend();

  baseSalaryDisplay.textContent = formatCurrency(appData.baseSalary);
  monthDisplay.textContent = getMonthLabel(selectedMonthId);
  
  const sortedMonths = Object.keys(appData.months).sort();
  const currentIndex = sortedMonths.indexOf(selectedMonthId);
  prevMonthBtn.disabled = currentIndex <= 0;
  nextMonthBtn.disabled = currentIndex >= sortedMonths.length - 1;

  const currentData = appData.months[selectedMonthId] || { income: [], expenses: [], baseSalaryStatus: 'pending' };
  
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
  
  resetMonthBtn.parentElement.style.display = selectedMonthId === appData.activeMonthId ? 'flex' : 'none';
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
      <span class="transaction-date">${isFixed ? 'Mensal Fixo' : new Date(item.id || Date.now()).toLocaleDateString('pt-BR')}</span>
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
      const currentData = appData.months[selectedMonthId];
      const newStatus = currentData.baseSalaryStatus === 'completed' ? 'pending' : 'completed';
      currentData.baseSalaryStatus = newStatus;
      // Note: O backend precisaria de uma rota para salvar status do salário base.
      // Por simplicidade, salvamos localmente e o backend cuidaria do perfil do usuário.
    } else {
      const newStatus = item.status === 'completed' ? 'pending' : 'completed';
      item.status = newStatus;
      if (item._id) await api.updateTransaction(item._id, { status: newStatus });
    }
    saveLocally();
    render();
  });

  if (!isFixed) {
    card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(type, item));
    card.querySelector('.delete-btn').addEventListener('click', () => {
      showConfirm('Excluir Lançamento', `Deseja realmente excluir "${item.description}"?`, async () => {
        if (item._id) await api.deleteTransaction(item._id);
        appData.months[selectedMonthId][type] = appData.months[selectedMonthId][type].filter(i => i.id !== item.id && i._id !== item._id);
        saveLocally();
        render();
        hideConfirm();
      });
    });
  }

  return card;
};

// --- Actions ---
const openEditModal = (type, item) => {
  entryModal.dataset.currentType = type;
  editIdInput.value = item._id || item.id;
  descInput.value = item.description;
  amountInput.value = item.amount;
  isRecurringInput.checked = item.isRecurring || false;
  installmentsInput.value = item.installments || '';
  installmentsGroup.style.display = isRecurringInput.checked ? 'block' : 'none';
  document.getElementById('modal-title').textContent = `Editar ${type === 'income' ? 'Ganho' : 'Despesa'}`;
  entryModal.classList.add('active');
};

const openAddModal = (type) => {
  entryModal.dataset.currentType = type;
  editIdInput.value = '';
  transactionForm.reset();
  isRecurringInput.checked = false;
  installmentsGroup.style.display = 'none';
  document.getElementById('modal-title').textContent = `Novo ${type === 'income' ? 'Ganho' : 'Despesa'}`;
  entryModal.classList.add('active');
  setTimeout(() => descInput.focus(), 100);
};

const finalizeMonth = () => {
  showConfirm('Finalizar Mês', 'Deseja encerrar este mês e iniciar o próximo?', async () => {
    const currentMonth = appData.months[appData.activeMonthId];
    const [year, month] = appData.activeMonthId.split('-').map(Number);
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }
    const nextId = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    
    if (!appData.months[nextId]) {
      // Processar recorrentes no frontend para resposta imediata
      const processRecurring = (list, type) => {
        return (list || [])
          .filter(item => {
            if (!item.isRecurring) return false;
            if (item.installments) return item.currentInstallment < item.installments;
            return true;
          })
          .map(item => {
            const newItem = {
              description: item.description,
              amount: item.amount,
              type: type,
              monthId: nextId,
              status: 'pending',
              isRecurring: true,
              installments: item.installments,
              currentInstallment: item.installments ? item.currentInstallment + 1 : undefined
            };
            // Salvar no backend também
            api.saveTransaction(newItem);
            return { ...newItem, id: Date.now() + Math.random() };
          });
      };

      appData.months[nextId] = {
        income: processRecurring(currentMonth.income, 'income'),
        expenses: processRecurring(currentMonth.expenses, 'expenses'),
        baseSalaryStatus: 'pending'
      };
    }
    
    appData.activeMonthId = nextId;
    selectedMonthId = nextId;
    saveLocally();
    render();
    hideConfirm();
  });
};

const navigateMonth = (direction) => {
  const sortedMonths = Object.keys(appData.months).sort();
  const currentIndex = sortedMonths.indexOf(selectedMonthId);
  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < sortedMonths.length) {
    selectedMonthId = sortedMonths[nextIndex];
    render();
  }
};

// --- Events ---
isRecurringInput.addEventListener('change', () => {
  installmentsGroup.style.display = isRecurringInput.checked ? 'block' : 'none';
});

editBaseSalaryBtn.addEventListener('click', () => {
  baseSalaryInput.value = appData.baseSalary;
  salaryModal.classList.add('active');
  setTimeout(() => baseSalaryInput.focus(), 100);
});

salaryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = parseFloat(baseSalaryInput.value.replace(',', '.'));
  if (!isNaN(val) && val >= 0) {
    appData.baseSalary = val;
    await api.updateBaseSalary(val);
    saveLocally();
    render();
    salaryModal.classList.remove('active');
  }
});

document.getElementById('salary-cancel-btn').addEventListener('click', () => salaryModal.classList.remove('active'));
document.getElementById('confirm-cancel-btn').addEventListener('click', hideConfirm);
confirmOkBtn.addEventListener('click', () => { if (confirmCallback) confirmCallback(); });

addIncomeBtn.addEventListener('click', () => openAddModal('income'));
addExpenseBtn.addEventListener('click', () => openAddModal('expenses'));
document.getElementById('cancel-btn').addEventListener('click', () => entryModal.classList.remove('active'));

prevMonthBtn.addEventListener('click', () => navigateMonth(-1));
nextMonthBtn.addEventListener('click', () => navigateMonth(1));
resetMonthBtn.addEventListener('click', finalizeMonth);

transactionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = entryModal.dataset.currentType;
  const id = editIdInput.value;
  const description = descInput.value.trim();
  const amount = parseFloat(amountInput.value.replace(',', '.'));
  const isRecurring = isRecurringInput.checked;
  const installments = isRecurring && installmentsInput.value ? parseInt(installmentsInput.value) : undefined;

  if (description && !isNaN(amount)) {
    const list = appData.months[selectedMonthId][type];
    const data = {
      description,
      amount,
      type,
      monthId: selectedMonthId,
      isRecurring,
      installments,
      status: 'pending'
    };

    if (id && isNaN(id)) { // ID do MongoDB (string)
      await api.updateTransaction(id, data);
    } else {
      if (installments) data.currentInstallment = 1;
      await api.saveTransaction(data);
    }
    
    // Atualizar estado local e renderizar
    saveLocally();
    render();
    entryModal.classList.remove('active');
  }
});

[entryModal, salaryModal, confirmModal].forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
});

render();
