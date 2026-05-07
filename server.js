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
app.get('/', (req, res) => {
  res.send('🚀 Backend do Controle Financeiro está rodando. Use a interface do frontend (normalmente na porta 5173).');
});

// (Movido para o final do arquivo)

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-financeiro';

// Conexão com MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado ao MongoDB (Local)'))
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));

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

    // Lógica robusta para herdar recorrentes e parcelas
    const getMonthDiff = (id1, id2) => {
      const [y1, m1] = id1.split('-').map(Number);
      const [y2, m2] = id2.split('-').map(Number);
      return (y2 - y1) * 12 + (m2 - m1);
    };

    // Buscar transações recorrentes/parceladas de meses anteriores
    const prevRecurringItems = await Transaction.find({
      userId: req.userId,
      isRecurring: true,
      monthId: { $lt: monthId }
    }).sort({ monthId: -1 });

    // Filtrar para pegar apenas a ocorrência mais recente de cada item único
    const templates = new Map();
    for (const item of prevRecurringItems) {
      // Normalizar chave para evitar problemas com espaços ou maiúsculas
      const normalizedDesc = item.description.trim().toLowerCase();
      const key = `${normalizedDesc}-${item.type}`;
      if (!templates.has(key)) {
        templates.set(key, item);
      }
    }

    const newTransactions = [];
    for (const t of templates.values()) {
      // Verificar se já existe neste mês (insensível a maiúsculas/espaços)
      const tDescNormal = t.description.trim().toLowerCase();
      const exists = transactions.some(curr => 
        curr.description.trim().toLowerCase() === tDescNormal && 
        curr.type === t.type
      );
      if (exists) continue;

      const diff = getMonthDiff(t.monthId, monthId);
      
      if (t.installments) {
        const nextInstallment = t.currentInstallment + diff;
        if (nextInstallment <= t.installments) {
          newTransactions.push(new Transaction({
            userId: t.userId,
            description: t.description,
            amount: t.amount,
            type: t.type,
            monthId: monthId,
            isRecurring: true,
            installments: t.installments,
            currentInstallment: nextInstallment,
            status: 'pending'
          }));
        }
      } else {
        // Recorrente fixo (sem parcelas)
        newTransactions.push(new Transaction({
          userId: t.userId,
          description: t.description,
          amount: t.amount,
          type: t.type,
          monthId: monthId,
          isRecurring: true,
          status: 'pending'
        }));
      }
    }

    if (newTransactions.length > 0) {
      await Transaction.insertMany(newTransactions);
      transactions = await Transaction.find({ userId: req.userId, monthId });
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

app.post('/api/user/salary-status', auth, async (req, res) => {
  try {
    const { monthId, status } = req.body;
    const user = await User.findById(req.userId);
    if (!user.months) user.months = new Map();
    
    const monthData = user.months.get(monthId) || {};
    monthData.baseSalaryStatus = status;
    user.months.set(monthId, monthData);
    
    await user.save();
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

// Middleware para rotas de API inexistentes (GET) - DEVE FICAR POR ÚLTIMO
app.get(/\/api\/.*/, (req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado ou método inválido.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
