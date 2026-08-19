const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'learnit-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Login (works for both instructor and student)
app.post('/api/login', (req, res) => {
  const { student_id, password, role } = req.body;
  if (!student_id || !password || !role) {
    return res.status(400).json({ error: 'student_id, password, and role are required' });
  }

  const user = db.table('users').find(u => u.student_id === student_id && u.role === role);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.user = {
    id: user.id,
    role: user.role,
    fullname: user.fullname,
    student_id: user.student_id,
    block: user.block,
    year: user.year
  };
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// Instructor: create student
app.post('/api/students', requireRole('instructor'), (req, res) => {
  const { fullname, student_id, password, block, year } = req.body;
  if (!fullname || !student_id || !password || !block || !year) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const users = db.table('users');
  if (users.find(u => u.student_id === student_id)) {
    return res.status(400).json({ error: 'Student ID already exists' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const student = users.insert({
    role: 'student',
    fullname,
    student_id,
    password: hash,
    block,
    year,
    created_at: new Date().toISOString()
  });
  res.status(201).json({ id: student.id, fullname, student_id, block, year });
});

// Instructor: list students
app.get('/api/students', requireRole('instructor'), (req, res) => {
  const students = db.table('users')
    .filter(u => u.role === 'student')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ students });
});

// Instructor: create assessment / module assignment
app.post('/api/assessments', requireRole('instructor'), (req, res) => {
  const { title, description, module, block, year } = req.body;
  if (!title || !block || !year) {
    return res.status(400).json({ error: 'title, block, and year are required' });
  }

  const assessment = db.table('assessments').insert({
    title,
    description: description || null,
    module: module || null,
    block,
    year,
    created_by: req.session.user.id,
    created_at: new Date().toISOString()
  });

  res.status(201).json({ id: assessment.id, title, description, module, block, year });
});

// Instructor: list all assessments
app.get('/api/assessments', requireAuth, (req, res) => {
  const assessments = db.table('assessments').all().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const users = db.table('users');
  const enriched = assessments.map(a => {
    const instructor = users.find(u => u.id === a.created_by);
    return { ...a, instructor: instructor ? instructor.fullname : 'Unknown' };
  });
  res.json({ assessments: enriched });
});

// Student: view assigned assessments filtered by block and year
app.get('/api/students/assessments', requireRole('student'), (req, res) => {
  const { block, year } = req.session.user;
  const assessments = db.table('assessments')
    .filter(a => a.block === block && a.year === year)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ assessments });
});

// Student: submit assessment answers
app.post('/api/submissions', requireRole('student'), (req, res) => {
  const { assessment_id, answers } = req.body;
  if (!assessment_id) return res.status(400).json({ error: 'assessment_id is required' });

  const submissions = db.table('submissions');
  const existing = submissions.find(s => s.assessment_id === assessment_id && s.student_id === req.session.user.id);
  if (existing) {
    db.table('submissions').update(existing.id, { answers: JSON.stringify(answers || {}), submitted_at: new Date().toISOString() });
    res.json({ message: 'Submission updated' });
  } else {
    const submission = submissions.insert({
      assessment_id,
      student_id: req.session.user.id,
      answers: JSON.stringify(answers || {}),
      score: null,
      status: 'pending',
      submitted_at: new Date().toISOString()
    });
    res.status(201).json({ id: submission.id });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
