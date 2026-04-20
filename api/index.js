import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Rota raiz para evitar erros de navegação direta
app.get('/api', (req, res) => {
  res.send('🚀 Backend do Controle Financeiro está rodando.');
});

// Middleware para rotas de API inexistentes (GET)
app.get('/api/invalid', (req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-financeiro';

// Conexão com MongoDB
let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const db = await mongoose.connect(MONGODB_URI);
  cachedDb = db;
  return db;
}

// --- Schemas ---

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  baseSalary: { type: Number, default: 0 },
  activeMonthId: String,
  months: { type: Map, of: { baseSalaryStatus: { type: String, default: 'pending' } } },
  createdAt: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email já cadastrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Middleware de Autenticação
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) { res.status(401).json({ error: 'Sessão expirada' }); }
};

// --- Protected Data Routes ---

app.get('/api/data/:monthId', auth, async (req, res) => {
  try {
    const { monthId } = req.params;
    const userData = await User.findById(req.userId);
    
    // Buscar transações do mês atual
    let transactions = await Transaction.find({ userId: req.userId, monthId });

    // Se não houver transações, verificar se precisamos herdar do mês anterior
    if (transactions.length === 0) {
      const getPrevMonthId = (id) => {
        const [y, m] = id.split('-').map(Number);
        let prevM = m - 1, prevY = y;
        if (prevM < 1) { prevM = 12; prevY--; }
        return `${prevY}-${String(prevM).padStart(2, '0')}`;
      };

      const prevMonthId = getPrevMonthId(monthId);
      const prevTransactions = await Transaction.find({ userId: req.userId, monthId: prevMonthId });

      const newTransactions = [];
      for (const t of prevTransactions) {
        // Lógica para Parcelas
        if (t.installments && t.currentInstallment < t.installments) {
          const nextInstallment = new Transaction({
            userId: t.userId,
            description: t.description,
            amount: t.amount,
            type: t.type,
            monthId: monthId,
            isRecurring: t.isRecurring,
            installments: t.installments,
            currentInstallment: t.currentInstallment + 1,
            status: 'pending'
          });
          newTransactions.push(nextInstallment);
        } 
        // Lógica para Recorrentes (sem parcelas)
        else if (t.isRecurring && !t.installments) {
          const nextRecurring = new Transaction({
            userId: t.userId,
            description: t.description,
            amount: t.amount,
            type: t.type,
            monthId: monthId,
            isRecurring: true,
            status: 'pending'
          });
          newTransactions.push(nextRecurring);
        }
      }

      if (newTransactions.length > 0) {
        await Transaction.insertMany(newTransactions);
        transactions = await Transaction.find({ userId: req.userId, monthId });
      }
    }

    res.json({
      userData: { 
        baseSalary: userData.baseSalary, 
        activeMonthId: userData.activeMonthId || monthId,
        months: userData.months,
        name: userData.name
      },
      transactions: {
        income: transactions.filter(t => t.type === 'income'),
        expenses: transactions.filter(t => t.type === 'expenses')
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/user/salary', auth, async (req, res) => {
  try {
    const { baseSalary } = req.body;
    const user = await User.findByIdAndUpdate(req.userId, { baseSalary }, { new: true });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', auth, async (req, res) => {
  try {
    const transaction = new Transaction({ ...req.body, userId: req.userId });
    await transaction.save();
    res.json(transaction);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/transactions/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, req.body, { new: true });
    res.json(transaction);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/transactions/:id', auth, async (req, res) => {
  try {
    await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Deletado' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Conectar ao banco antes de processar
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

export default app;
