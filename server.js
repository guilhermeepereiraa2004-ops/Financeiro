import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
// Coloque sua URI no arquivo .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/green_control';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado ao MongoDB'))
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));

// --- Schemas ---
const TransactionSchema = new mongoose.Schema({
  description: String,
  amount: Number,
  status: { type: String, default: 'pending' },
  isRecurring: { type: Boolean, default: false },
  installments: Number,
  currentInstallment: Number,
  type: String, // 'income' or 'expenses'
  monthId: String, // 'YYYY-MM'
  createdAt: { type: Date, default: Date.now }
});

const UserDataSchema = new mongoose.Schema({
  userId: { type: String, unique: true, default: 'default_user' },
  baseSalary: { type: Number, default: 0 },
  activeMonthId: String,
  months: {
    type: Map,
    of: {
      baseSalaryStatus: { type: String, default: 'pending' }
    }
  }
});

const Transaction = mongoose.model('Transaction', TransactionSchema);
const UserData = mongoose.model('UserData', UserDataSchema);

// --- Routes ---

// Obter dados do usuário e transações do mês
app.get('/api/data/:monthId', async (req, res) => {
  try {
    const { monthId } = req.params;
    const userData = await UserData.findOne({ userId: 'default_user' });
    const transactions = await Transaction.find({ monthId });
    
    res.json({
      userData: userData || { baseSalary: 0, activeMonthId: monthId },
      transactions: {
        income: transactions.filter(t => t.type === 'income'),
        expenses: transactions.filter(t => t.type === 'expenses')
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar Salário Base
app.post('/api/user/salary', async (req, res) => {
  try {
    const { baseSalary } = req.body;
    const userData = await UserData.findOneAndUpdate(
      { userId: 'default_user' },
      { baseSalary },
      { upsert: true, new: true }
    );
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salvar transação
app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = new Transaction(req.body);
    await transaction.save();
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar status/dados de transação
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletar transação
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deletado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
