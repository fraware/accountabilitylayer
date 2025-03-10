const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const logRoutes = require('./routes/logRoutes');
const authRoutes = require('./routes/authRoutes');
const { verifyToken } = require('./middleware/auth');
const usageLogger = require('./middleware/usageLogger');
const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(morgan('dev'));

// Log API usage.
app.use(usageLogger);

// Unprotected auth endpoint.
app.use('/api/v1/auth', authRoutes);

// All endpoints below require a valid JWT.
app.use('/api/v1', verifyToken);
app.use('/api/v1', logRoutes);

// Enhanced error handling middleware.
app.use(errorHandler);

// Connect to MongoDB.
const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/accountability';
mongoose
  .connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
