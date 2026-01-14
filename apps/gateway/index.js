const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
// app.use(express.json()); // Disabled global body parsing to avoid conflict with proxy

const path = require('path');
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
const SECRET_KEY = process.env.SECRET_KEY || 'mysecretkey';

const ensureProtocol = (url) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
};

const FLIGHT_SERVICE_URL = ensureProtocol(process.env.FLIGHT_SERVICE_URL) || 'http://localhost:3001';
const SEARCH_SERVICE_URL = ensureProtocol(process.env.SEARCH_SERVICE_URL) || 'http://localhost:3002';
const NOTIFICATION_SERVICE_URL = ensureProtocol(process.env.NOTIFICATION_SERVICE_URL) || 'http://localhost:3003';
const ML_SERVICE_URL = ensureProtocol(process.env.ML_SERVICE_URL) || 'http://localhost:5000';

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Gateway' });
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Authentication Middleware
const verifyToken = (req, res, next) => {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(' ')[1];
        req.token = bearerToken;
        jwt.verify(req.token, SECRET_KEY, (err, authData) => {
            if (err) {
                res.sendStatus(403);
            } else {
                next();
            }
        });
    } else {
        res.sendStatus(403);
    }
};

// Auth Route
app.post('/auth/login', express.json(), (req, res) => {
    // Mock user
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        const user = { id: 1, username: 'admin', role: 'admin' };
        jwt.sign({ user }, SECRET_KEY, { expiresIn: '1h' }, (err, token) => {
            res.json({ token });
        });
    } else {
        res.sendStatus(401);
    }
});

// PROTECTED Routes (v1)
app.use('/v1/flights/add', verifyToken, createProxyMiddleware({
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true
}));

app.use('/v1/miles/add', verifyToken, createProxyMiddleware({
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true
}));

app.use('/v1/miles', createProxyMiddleware({
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true
}));

app.use('/v1/auth', createProxyMiddleware({
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true
})); // Standard Auth Proxy

app.use('/v1/flights/admin', createProxyMiddleware({
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true
}));

app.use('/v1/flights/delete', createProxyMiddleware({
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true
}));

// PUBLIC Routes (v1)
app.use('/v1/flights', createProxyMiddleware({
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true
}));

app.use('/v1/miles-smiles', createProxyMiddleware({
    target: FLIGHT_SERVICE_URL,
    changeOrigin: true
}));

app.use('/v1/search', createProxyMiddleware({
    target: SEARCH_SERVICE_URL,
    changeOrigin: true
}));

app.use('/api/notifications', createProxyMiddleware({
    target: NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/notifications': '/notifications' }
}));

app.use('/api/predict', createProxyMiddleware({
    target: ML_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/predict': '/predict' }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});
