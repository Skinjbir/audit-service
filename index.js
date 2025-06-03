// index.js
const express = require('express');
const cors = require('cors'); // Consider adding CORS support
const helmet = require('helmet'); // Security middleware

const auditRoutes = require('./src/routes/auditRoutes');
const policyRoutes = require('./src/routes/policyRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const aiRoutes = require('./src/routes/ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middlewares
app.use(helmet());
app.use(cors()); // Configure properly for production

// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For form data

// Routes
app.use('/api', auditRoutes);
app.use('/policies', policyRoutes);
app.use('/report', reportRoutes);
app.use('/ai', aiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Audit & Policy service running on port ${PORT}`);
});