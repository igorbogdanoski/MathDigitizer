import http from 'http';
http.get('http://127.0.0.1:3000/api/config', (res) => {
  res.on('data', d => process.stdout.write(d));
});
