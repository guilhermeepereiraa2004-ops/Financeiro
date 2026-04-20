import axios from 'axios';

const API_URL = window.location.hostname === 'localhost' 
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
      throw err.response?.data?.error || 'Erro ao fazer login';
    }
  },

  async register(name, email, password) {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, { name, email, password });
      if (response.data.token) {
        localStorage.setItem('auth_token', response.data.token);
        localStorage.setItem('user_info', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (err) {
      throw err.response?.data?.error || 'Erro ao cadastrar';
    }
  },

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
    window.location.reload();
  },

  // --- Data ---
  async getMonthData(monthId) {
    try {
      const response = await axios.get(`${API_URL}/data/${monthId}`);
      return response.data;
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('auth_token');
        return null;
      }
      return null;
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

  async updateBaseSalary(amount) {
    try {
      const response = await axios.post(`${API_URL}/user/salary`, { baseSalary: amount });
      return response.data;
    } catch (err) { return null; }
  }
};
