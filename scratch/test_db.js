import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
console.log('Tentando conectar a:', uri.replace(/:([^@]+)@/, ':****@'));

mongoose.connect(uri)
  .then(() => {
    console.log('✅ Conectado com sucesso!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro de conexão:', err);
    process.exit(1);
  });
