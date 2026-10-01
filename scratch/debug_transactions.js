import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const TransactionSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  description: String,
  isRecurring: Boolean,
  installments: Number,
  currentInstallment: Number,
  type: String,
  monthId: String
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const items = await Transaction.find().sort({ createdAt: -1 }).limit(20);
  console.log(JSON.stringify(items, null, 2));
  process.exit();
}

check();
