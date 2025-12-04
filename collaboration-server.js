/**
 * Simple Collaboration WebSocket Server (Node.js)
 *
 * ใช้สำหรับทดสอบ Real-time Collaboration บน Dashboard
 *
 * วิธีใช้:
 * 1. npm install ws
 * 2. node collaboration-server.js
 * 3. เปิด Dashboard และเปิด Collaboration mode
 *
 * Features:
 * - Broadcast cursor movement
 * - Broadcast block selection
 * - Broadcast block changes
 * - User presence management
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 8080;

// สร้าง HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Collaboration WebSocket Server is running\n');
});

// สร้าง WebSocket server
const wss = new WebSocket.Server({ server });

// เก็บ clients แยกตาม dashboard
// Map<dashboardId, Map<userId, { ws, userData }>>
const dashboards = new Map();

// Broadcast message ไปยังทุก client ใน dashboard (ยกเว้น sender)
function broadcastToDashboard(dashboardId, message, senderWs = null) {
  const dashboard = dashboards.get(dashboardId);
  if (!dashboard) return;

  const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

  dashboard.forEach((client) => {
    if (client.ws !== senderWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

// Handle new connection
wss.on('connection', (ws, req) => {
  // Parse dashboard ID จาก query string
  const queryParams = url.parse(req.url, true).query;
  const dashboardId = queryParams.dashboard || 'default';

  console.log(`New connection to dashboard: ${dashboardId}`);

  let userId = null;
  let userData = null;

  // Initialize dashboard map ถ้ายังไม่มี
  if (!dashboards.has(dashboardId)) {
    dashboards.set(dashboardId, new Map());
  }

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle ping/pong (heartbeat)
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // เก็บ user info
      if (message.userId && !userId) {
        userId = message.userId;
        userData = {
          ws,
          userId: message.userId,
          userName: message.userName,
          userColor: message.userColor,
        };

        // Add to dashboard
        dashboards.get(dashboardId).set(userId, userData);

        console.log(`User joined: ${message.userName} (${userId}) in ${dashboardId}`);

        // ส่งรายการ users ปัจจุบันให้ user ใหม่
        const existingUsers = [];
        dashboards.get(dashboardId).forEach((client, id) => {
          if (id !== userId) {
            existingUsers.push({
              type: 'join',
              userId: client.userId,
              userName: client.userName,
              userColor: client.userColor,
              timestamp: Date.now(),
            });
          }
        });

        existingUsers.forEach((userMsg) => {
          ws.send(JSON.stringify(userMsg));
        });
      }

      // Broadcast message to other users in the same dashboard
      broadcastToDashboard(dashboardId, message, ws);

    } catch (err) {
      console.error('Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    if (userId && dashboards.has(dashboardId)) {
      const dashboard = dashboards.get(dashboardId);
      const user = dashboard.get(userId);

      if (user) {
        console.log(`User left: ${user.userName} (${userId}) from ${dashboardId}`);

        // Broadcast leave message
        broadcastToDashboard(dashboardId, {
          type: 'leave',
          userId: user.userId,
          userName: user.userName,
          userColor: user.userColor,
          timestamp: Date.now(),
        });

        // Remove from dashboard
        dashboard.delete(userId);

        // Clean up empty dashboard
        if (dashboard.size === 0) {
          dashboards.delete(dashboardId);
        }
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start server - bind to 0.0.0.0 to allow network access
const HOST = '0.0.0.0';
const localIP = getLocalIP();

server.listen(PORT, HOST, () => {
  console.log(`Collaboration WebSocket Server running on port ${PORT}`);
  console.log(`Local URL: ws://localhost:${PORT}?dashboard=YOUR_DASHBOARD_ID`);
  console.log(`Network URL: ws://${localIP}:${PORT}?dashboard=YOUR_DASHBOARD_ID`);
  console.log(`\nShare the Network URL with other users on the same network!`);
});

// Get local IP address for network access
function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
