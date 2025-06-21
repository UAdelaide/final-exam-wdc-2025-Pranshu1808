const express = require('express');
const session = require('express-session');
const path = require('path');

// --- SETUP DB CONNECTION ---
// If you have db.js, require it here:
const db = require('./models/db'); // <--- update this to your actual path if needed

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: true
}));

// --- Serve static files (for frontend HTML etc) ---
app.use(express.static(path.join(__dirname, 'public')));

// === LOGIN API ===
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  // NOTE: For demo, match against unhashed password
  const [rows] = await db.query(
    'SELECT * FROM Users WHERE username = ? AND password_hash = ?',
    [username, password]
  );
  if (rows.length === 1) {
    req.session.user = {
      id: rows[0].user_id,
      username: rows[0].username,
      role: rows[0].role
    };
    res.json({ success: true, role: rows[0].role });
  } else {
    res.json({ success: false, message: 'Invalid credentials' });
  }
});

// === LOGOUT API ===
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// === GET DOGS FOR LOGGED-IN OWNER ===
app.get('/api/my-dogs', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'owner') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const ownerId = req.session.user.id;
    const [dogs] = await db.query(
      'SELECT dog_id, name FROM Dogs WHERE owner_id = ?', [ownerId]
    );
    res.json(dogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dogs' });
  }
});

// === WALKS API (EXAMPLE FOR DISPLAY/SUBMIT WALKS) ===
app.get('/api/walks', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'owner') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const [walks] = await db.query(
    `SELECT w.request_id, d.name AS dog_name, d.size, w.requested_time, w.duration_minutes, w.location, w.status
     FROM WalkRequests w JOIN Dogs d ON w.dog_id = d.dog_id
     WHERE d.owner_id = ?
     ORDER BY w.requested_time DESC`,
    [req.session.user.id]
  );
  res.json(walks);
});

app.post('/api/walks', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'owner') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { dog_id, requested_time, duration_minutes, location } = req.body;
  await db.query(
    'INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES (?, ?, ?, ?, ?)',
    [dog_id, requested_time, duration_minutes, location, 'Pending']
  );
  res.json({ message: 'Walk request created!' });
});

// === HOME ROUTE FALLBACK (for testing) ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === EXPORT APP (for bin/www) ===
module.exports = app;
