import mongoose from 'mongoose';

async function test() {
  try {
    console.log('Testing local MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/green_control', { serverSelectionTimeoutMS: 2000 });
    console.log('Connected to local MongoDB!');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    process.exit(0);
  } catch (err) {
    console.log('Local MongoDB not found or error:', err.message);
    process.exit(1);
  }
}

test();
