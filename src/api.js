import axios from 'axios';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
  ? 'http://localhost:3001/api' 
  : '/api';

// Configurar axios para enviar o token automaticamente
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // --- Auth ---
  async login(email, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user_info', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (err) {
      if (!err.response) throw 'Não foi possível conectar ao servidor. Reinicie o projeto com “npm run dev”.';
      throw err.response?.data?.error || 'Erro ao fazer login';
    }
  },

  async registerTrial(name, email, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, { name, email, password });
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user_info', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (err) {
      if (!err.response) throw 'Não foi possível conectar ao servidor. Reinicie o projeto com “npm run dev”.';
      throw err.response?.data?.error || 'Erro ao criar a conta de teste';
    }
  },

  clearSession() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user_info');
  },

  logout() {
    this.clearSession();
    window.location.reload();
  },

  isImpersonating() {
    return Boolean(localStorage.getItem('admin_token'));
  },

  returnToAdmin() {
    const adminToken = localStorage.getItem('admin_token');
    const adminUser = localStorage.getItem('admin_user_info');
    if (!adminToken) return false;
    localStorage.setItem('auth_token', adminToken);
    if (adminUser) localStorage.setItem('user_info', adminUser);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user_info');
    window.location.reload();
    return true;
  },

  // --- Data ---
  async getMonthData(monthId) {
    try {
      const response = await axios.get(`${API_URL}/data/${monthId}?t=${Date.now()}`);
      return response.data;
    } catch (err) {
      if (err.response?.status === 401) {
        if (localStorage.getItem('admin_token')) {
          this.returnToAdmin();
          return null;
        }
        localStorage.removeItem('auth_token');
        return null;
      }
      if (err.response?.status === 403 && err.response?.data?.code === 'TRIAL_EXPIRED') {
        this.clearSession();
        const error = new Error(err.response.data.error);
        error.code = 'TRIAL_EXPIRED';
        throw error;
      }
      throw err.response?.data?.error || 'Não foi possível carregar os dados da conta';
    }
  },

  async getFinancialAnalytics(monthId) {
    try {
      const now = new Date();
      const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const cutoffDay = monthId === currentMonthId ? now.getDate() : 31;
      const response = await axios.get(`${API_URL}/analytics/${monthId}?cutoffDay=${cutoffDay}&t=${Date.now()}`);
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Não foi possível carregar o histórico financeiro');
    }
  },

  async saveTransaction(data) {
    try {
      const response = await axios.post(`${API_URL}/transactions`, data);
      return response.data;
    } catch (err) { return null; }
  },

  async updateTransaction(id, data) {
    try {
      const response = await axios.put(`${API_URL}/transactions/${id}`, data);
      return response.data;
    } catch (err) { return null; }
  },

  async deleteTransaction(id) {
    try {
      await axios.delete(`${API_URL}/transactions/${id}`);
      return true;
    } catch (err) { return false; }
  },

  async updateBaseSalary(amount, day) {
    try {
      const response = await axios.post(`${API_URL}/user/salary`, { baseSalary: amount, baseSalaryDay: day });
      return response.data;
    } catch (err) { return null; }
  },
  
  async updateBaseSalaryStatus(monthId, status) {
    try {
      const response = await axios.post(`${API_URL}/user/salary-status`, { monthId, status });
      return response.data;
    } catch (err) { return null; }
  },

  // --- Super Admin ---
  async getAdminOverview() {
    try {
      const response = await axios.get(`${API_URL}/admin/overview?t=${Date.now()}`);
      return response.data;
    } catch (err) {
      throw err.response?.data?.error || 'Erro ao carregar o painel administrativo';
    }
  },

  async createUser(data) {
    try {
      const response = await axios.post(`${API_URL}/admin/users`, data);
      return response.data;
    } catch (err) {
      throw err.response?.data?.error || 'Erro ao criar a conta';
    }
  },

  async deleteUser(id) {
    try {
      const response = await axios.delete(`${API_URL}/admin/users/${id}`);
      return response.data;
    } catch (err) {
      throw err.response?.data?.error || 'Erro ao excluir a conta';
    }
  },

  async updateUserPayment(id, data) {
    try {
      const response = await axios.put(`${API_URL}/admin/users/${id}/payment`, data);
      return response.data;
    } catch (err) {
      throw err.response?.data?.error || 'Erro ao atualizar o pagamento';
    }
  },

  async reactivateUser(id, paymentDueDate) {
    try {
      const response = await axios.put(`${API_URL}/admin/users/${id}/reactivate`, { paymentDueDate });
      return response.data;
    } catch (err) {
      throw err.response?.data?.error || 'Erro ao reativar a conta';
    }
  },

  async updateAdminSettings(data) {
    try {
      const response = await axios.put(`${API_URL}/admin/settings`, data);
      return response.data;
    } catch (err) {
      throw err.response?.data?.error || 'Erro ao salvar as configurações';
    }
  },

  async impersonateUser(id) {
    try {
      const response = await axios.post(`${API_URL}/admin/users/${id}/impersonate`);
      if (response.data.token) {
        localStorage.setItem('admin_token', localStorage.getItem('auth_token') || '');
        localStorage.setItem('admin_user_info', localStorage.getItem('user_info') || '');
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user_info', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (err) {
      throw err.response?.data?.error || 'Erro ao acessar a conta';
    }
  }
};
