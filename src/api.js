import axios from 'axios';

// Na Vercel, o frontend e o backend rodam no mesmo domínio.
// Usar uma string vazia ou apenas '/api' faz com que ele use o domínio atual.
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api' 
  : '/api';

export const api = {
  async getMonthData(monthId) {
    try {
      const response = await axios.get(`${API_URL}/data/${monthId}`);
      return response.data;
    } catch (err) {
      console.warn('Backend não detectado ou erro na rede.');
      return null;
    }
  },

  async saveTransaction(data) {
    try {
      const response = await axios.post(`${API_URL}/transactions`, data);
      return response.data;
    } catch (err) {
      return null;
    }
  },

  async updateTransaction(id, data) {
    try {
      const response = await axios.put(`${API_URL}/transactions/${id}`, data);
      return response.data;
    } catch (err) {
      return null;
    }
  },

  async deleteTransaction(id) {
    try {
      await axios.delete(`${API_URL}/transactions/${id}`);
      return true;
    } catch (err) {
      return false;
    }
  },

  async updateBaseSalary(amount) {
    try {
      const response = await axios.post(`${API_URL}/user/salary`, { baseSalary: amount });
      return response.data;
    } catch (err) {
      return null;
    }
  }
};
