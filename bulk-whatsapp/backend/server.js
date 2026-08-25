const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./config/database');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

dotenv.config();

const app = express();

app.set('trust proxy', 1);
connectDB().then(() => {
  console.log('DB Connected');
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false
}));

app.use(mongoSanitize());
app.use(hpp());

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '2gb' }));
app.use(bodyParser.urlencoded({ limit: '2gb', extended: true }));


// VPS API — auth & licenses only (WhatsApp/campaign/template/botflow run in Electron)
app.use('/api/admin', require('./routes/admin.route'));
app.use('/api/user', require('./routes/user.route'));

app.get('/api/', (req, res) => {
  res.send('Server is running');
});



const port = process.env.PORT;

app.listen(port, () => {
  console.log('Server Running on Port: ' + port);
});
