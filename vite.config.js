import { defineConfig } from 'vite';
import os from 'node:os';

function getLanIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.')) return net.address;
        if (net.address.startsWith('10.')) candidates.unshift(net.address);
        else candidates.push(net.address);
      }
    }
  }
  return candidates[0] || '';
}

export default defineConfig({
  server: { port: 5173, host: true },
  define: {
    __LAN_IP__: JSON.stringify(getLanIp()),
  },
  plugins: [
    {
      name: 'lan-ip-service',
      configureServer(server) {
        server.middlewares.use('/api/lan-ip', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ip: getLanIp() }));
        });
      },
    },
  ],
  build: { rollupOptions: { input: { main: 'index.html', markers: 'markers.html' } }, chunkSizeWarningLimit: 2500 },
});
