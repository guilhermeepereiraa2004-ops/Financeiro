import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

// Conexão com MongoDB (Singleton para evitar múltiplas conexões na Vercel)
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  
  const db = await mongoose.connect(MONGODB_URI);
  cachedDb = db;
  return db;
}

// Schemas
const TransactionSchema = new mongoose.Schema({
  description: String,
  amount: Number,
  status: { type: String, default: 'pending' },
  isRecurring: { type: Boolean, default: false },
  installments: Number,
  currentInstallment: Number,
  type: String,
  monthId: String,
  createdAt: { type: Date, default: Date.now }
});

const UserDataSchema = new mongoose.Schema({
  userId: { type: String, unique: true, default: 'default_user' },
  baseSalary: { type: Number, default: 0 },
  activeMonthId: String,
  months: { type: Map, of: { baseSalaryStatus: { type: String, default: 'pending' } } }
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
const UserData = mongoose.models.UserData || mongoose.model('UserData', UserDataSchema);

// Middleware para conectar ao banco antes de cada requisição
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Erro de conexão com o banco de dados' });
  }
});

// Routes
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/user/salary', async (req, res) => {
  try {
    const { baseSalary } = req.body;
    const userData = await UserData.findOneAndUpdate({ userId: 'default_user' }, { baseSalary }, { upsert: true, new: true });
    res.json(userData);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = new Transaction(req.body);
    await transaction.save();
    res.json(transaction);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(transaction);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deletado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default app;
