import http from 'http';

http.get('http://localhost:3001/api/data/2026-05', (res) => {
  console.log('Status Code:', res.statusCode);
  res.on('data', (chunk) => {
    console.log('Body:', chunk.toString());
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
