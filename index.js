// index.js

const express = require('express');
// You can use express.json() instead of bodyParser
// const bodyParser = require('body-parser');

const auditRoutes   = require('./src/routes/auditRoutes');
const policyRoutes  = require('./src/routes/policyRoutes');
const reportRoutes  = require('./src/routes/reportRoutes');  // <— add this import
const aiRoutes = require('./src/routes/ai'); // <-- Add this


const app = express();
const PORT = process.env.PORT || 3000;

// Use built-in JSON parser
app.use(express.json());

// Mount audit endpoints under /api/audit …
app.use('/api', auditRoutes);

// Mount policy CRUD endpoints under /policies …
app.use('/policies', policyRoutes);

// Mount report endpoints under /report …
app.use('/report', reportRoutes);
app.use('/ai', aiRoutes); // <-- Add this after the others

app.listen(PORT, () => {
  console.log(`Audit & Policy service running on port ${PORT}`);
});
