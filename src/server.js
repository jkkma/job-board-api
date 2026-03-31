const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Basic test route
app.get('/', (req, res) => {
  res.json({ message: '🚀 Job Board API is running! (v1)' });
});

// TODO: We will add auth and jobs routes here later

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});