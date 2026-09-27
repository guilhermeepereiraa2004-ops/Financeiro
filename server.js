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
  email: { type: String, unique: true, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  baseSalary: { type: Number, default: 0 },
  baseSalaryDay: { type: Number, default: 5 },
  role: { type: String, enum: ['user', 'super_admin'], default: 'user' },
  paymentStatus: { type: String, enum: ['paid', 'pending'], default: 'pending' },
  paymentDueDate: Date,
  lastPaymentDate: Date,
  lastLoginAt: Date,
  activeMonthId: String,
  months: { type: Map, of: { baseSalaryStatus: { type: String, default: 'pending' } } },
  createdAt: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: String,
  amount: Number,
  category: { type: String, default: 'Outros' },
  dueDate: Date,
  status: { type: String, default: 'pending' },
  isRecurring: { type: Boolean, default: false },
  installments: Number,
  currentInstallment: Number,
  type: String,
  monthId: String,
  createdAt: { type: Date, default: Date.now }
});

const AdminSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  pixKey: { type: String, default: '' },
  pixBeneficiary: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
const AdminSettings = mongoose.models.AdminSettings || mongoose.model('AdminSettings', AdminSettingsSchema);

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();
const configuredAdminEmails = () => String(process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || '')
  .split(',').map(normalizeEmail).filter(Boolean);
const isSuperAdmin = (user) => Boolean(user && (user.role === 'super_admin' || configuredAdminEmails().includes(normalizeEmail(user.email))));

const normalizeTransactionPayload = (payload, withDefaults = false) => {
  const normalized = { ...payload };
  if (normalized.dueDate) normalized.monthId = String(normalized.dueDate).slice(0, 7);
  if (withDefaults && !normalized.category) normalized.category = 'Outros';
  return normalized;
};

const moveDueDateToMonth = (sourceDate, targetMonthId) => {
  const originalDay = sourceDate instanceof Date
    ? sourceDate.getUTCDate()
    : sourceDate ? Number(String(sourceDate).slice(8, 10)) || 1 : 1;
  const [year, month] = targetMonthId.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${targetMonthId}-${String(Math.min(originalDay, lastDay)).padStart(2, '0')}`;
};

// --- Auth Routes ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await User.findOne({ email: normalizedEmail }).collation({ locale: 'en', strength: 2 });
    if (existingUser) return res.status(400).json({ error: 'Email já cadastrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = configuredAdminEmails().includes(normalizedEmail) ? 'super_admin' : 'user';
    const user = new User({ name, email: normalizedEmail, password: hashedPassword, role, lastLoginAt: new Date() });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: normalizeEmail(email) }).collation({ locale: 'en', strength: 2 });
    if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Senha incorreta' });

    if (configuredAdminEmails().includes(normalizeEmail(user.email))) user.role = 'super_admin';
    user.lastLoginAt = new Date();
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Middleware de Autenticação
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.adminId = decoded.adminId || null;
    req.impersonated = Boolean(decoded.impersonated);
    next();
  } catch (err) { res.status(401).json({ error: 'Sessão expirada' }); }
};

const requireSuperAdmin = async (req, res, next) => {
  try {
    if (req.impersonated) return res.status(403).json({ error: 'Volte ao painel master para executar esta ação' });
    const user = await User.findById(req.userId);
    if (!isSuperAdmin(user)) return res.status(403).json({ error: 'Acesso exclusivo do super admin' });
    if (user.role !== 'super_admin') {
      user.role = 'super_admin';
      await user.save();
    }
    req.adminUser = user;
    next();
  } catch (err) { res.status(403).json({ error: 'Acesso administrativo inválido' }); }
};

// --- Protected Data Routes ---

app.get('/api/data/:monthId', auth, async (req, res) => {
  try {
    const { monthId } = req.params;
    const userData = await User.findById(req.userId);
    if (!userData) return res.status(404).json({ error: 'Usuário não encontrado' });
    const adminSettings = await AdminSettings.findOne({ key: 'global' });
    
    // Buscar transações do mês atual
    let transactions = await Transaction.find({ userId: req.userId, monthId }).sort({ dueDate: -1, createdAt: -1 });

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
      // Se a última ocorrência foi deletada, significa que a recorrência foi cancelada/parada
      if (t.status === 'deleted') continue;

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
            category: t.category || 'Outros',
            dueDate: moveDueDateToMonth(t.dueDate, monthId),
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
          category: t.category || 'Outros',
          dueDate: moveDueDateToMonth(t.dueDate, monthId),
          type: t.type,
          monthId: monthId,
          isRecurring: true,
          status: 'pending'
        }));
      }
    }

    if (newTransactions.length > 0) {
      await Transaction.insertMany(newTransactions);
      transactions = await Transaction.find({ userId: req.userId, monthId }).sort({ dueDate: -1, createdAt: -1 });
    }

    res.json({
      userData: { 
        baseSalary: userData.baseSalary, 
        baseSalaryDay: userData.baseSalaryDay || 5,
        activeMonthId: userData.activeMonthId || monthId,
        months: userData.months,
        name: userData.name,
        email: userData.email,
        role: userData.role || 'user',
        paymentStatus: userData.paymentStatus || 'pending',
        paymentDueDate: userData.paymentDueDate,
        lastPaymentDate: userData.lastPaymentDate,
        isImpersonating: req.impersonated,
        paymentSettings: {
          pixKey: adminSettings?.pixKey || '',
          pixBeneficiary: adminSettings?.pixBeneficiary || ''
        }
      },
      transactions: {
        income: transactions.filter(t => t.type === 'income' && t.status !== 'deleted'),
        expenses: transactions.filter(t => t.type === 'expenses' && t.status !== 'deleted')
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/user/salary', auth, async (req, res) => {
  try {
    const { baseSalary, baseSalaryDay } = req.body;
    const day = Math.min(Math.max(Number(baseSalaryDay) || 5, 1), 31);
    const user = await User.findByIdAndUpdate(req.userId, { baseSalary, baseSalaryDay: day }, { new: true });
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
    const transaction = new Transaction({ ...normalizeTransactionPayload(req.body, true), userId: req.userId });
    await transaction.save();
    res.json(transaction);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/transactions/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, normalizeTransactionPayload(req.body), { new: true });
    res.json(transaction);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/transactions/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!transaction) return res.status(404).json({ error: 'Transação não encontrada' });

    if (transaction.isRecurring) {
      transaction.status = 'deleted';
      await transaction.save();
    } else {
      await Transaction.deleteOne({ _id: req.params.id, userId: req.userId });
    }
    res.json({ message: 'Deletado com sucesso' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Super Admin Routes ---

app.get('/api/admin/overview', auth, requireSuperAdmin, async (req, res) => {
  try {
    const [users, settings] = await Promise.all([
      User.find().select('name email role paymentStatus paymentDueDate lastPaymentDate lastLoginAt createdAt').sort({ lastLoginAt: -1, createdAt: -1 }).lean(),
      AdminSettings.findOne({ key: 'global' }).lean()
    ]);
    const normalizedUsers = users.map(user => ({
      ...user,
      role: isSuperAdmin(user) ? 'super_admin' : 'user',
      paymentStatus: user.paymentStatus || 'pending'
    }));
    const billingUsers = normalizedUsers.filter(user => user.role !== 'super_admin');
    res.json({
      users: normalizedUsers,
      settings: settings || { pixKey: '', pixBeneficiary: '' },
      metrics: {
        total: normalizedUsers.length,
        paid: billingUsers.filter(user => user.paymentStatus === 'paid').length,
        pending: billingUsers.filter(user => user.paymentStatus !== 'paid').length,
        loggedIn: normalizedUsers.filter(user => user.lastLoginAt).length
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/users/:id/payment', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { status, paymentDueDate, lastPaymentDate } = req.body;
    if (!['paid', 'pending'].includes(status)) return res.status(400).json({ error: 'Status de pagamento inválido' });
    const update = {
      paymentStatus: status,
      paymentDueDate: paymentDueDate || null,
      lastPaymentDate: status === 'paid' ? (lastPaymentDate || new Date()) : (lastPaymentDate || null)
    };
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('name email role paymentStatus paymentDueDate lastPaymentDate lastLoginAt createdAt');
    if (!user) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/settings', auth, requireSuperAdmin, async (req, res) => {
  try {
    const pixKey = String(req.body.pixKey || '').trim();
    const pixBeneficiary = String(req.body.pixBeneficiary || '').trim();
    const settings = await AdminSettings.findOneAndUpdate(
      { key: 'global' },
      { pixKey, pixBeneficiary, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users/:id/impersonate', auth, requireSuperAdmin, async (req, res) => {
  try {
    const target = await User.findById(req.params.id).select('name email role');
    if (!target) return res.status(404).json({ error: 'Conta não encontrada' });
    if (isSuperAdmin(target)) return res.status(400).json({ error: 'Não é possível acessar outra conta administrativa' });
    const token = jwt.sign(
      { userId: target._id, adminId: req.userId, impersonated: true },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token, user: { id: target._id, name: target.name, email: target.email } });
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
