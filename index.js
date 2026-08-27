const express = require('express');
const Database = require('better-sqlite3'); 
const swaggerUi = require('swagger-ui-express');
const openapi = require('./openapi.json');
const app = express();
const PORT = 3000;

// Parse JSON request bodies
app.use(express.json());

const db = new Database('tasks.db');

// SQLite has no real boolean type, so done is stored as 0/1 (INTEGER)
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )
`);

// Original demo data - POST /reset restores a fresh copy of this list.
const SEED_TASKS = [
    { id: 1, title: 'Buy a book', done: true },
    { id: 2, title: 'Go on a morning walk', done: true },
    { id: 3, title: 'Go to market', done: false },
];

// Seed only when empty, so restarting the server won't duplicate rows.
const countTasks = db.prepare('SELECT COUNT(*) AS count FROM tasks');
if (countTasks.get().count === 0) {
  const insert = db.prepare('INSERT INTO tasks (id, title, done) VALUES (?, ?, ?)');
  
  const seed = db.transaction((tasks) => {
    for (const task of tasks) {
      insert.run(task.id, task.title, task.done ? 1 : 0);
    }
  });
  seed(SEED_TASKS);
}

const tasks = SEED_TASKS.map((task) => ({ ...task }));

function resetTasks() {
  tasks.length = 0;
  tasks.push(...SEED_TASKS.map((task) => ({ ...task })));
}

// OpenAPI spec - interactive docs at /docs.
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// API metadata
app.get('/', (req, res) => {
    res.json({
        name: 'Task API',
        version: '1.0',
        endpoints: ['/tasks', '/stats', '/reset'],
    });
});

// Liveness check for load balancers and monitoring
app.get('/health', (req, res) => {
  res.json({status: 'OK' });
});

// Convert a SQLite row (done is 0/1) into the JSON shape the API already returns.
function rowToTask(row) {
  return { id: row.id, title: row.title, done: Boolean(row.done) };
}

// Query params after ? filter the list - they are not part of the address.
app.get('/tasks', (req, res) => {
  let sql = 'SELECT id, title, done FROM tasks WHERE 1=1';
  const params = [];

  if (req.query.done !== undefined) {
    if (req.query.done !== 'true' && req.query.done !== 'false') {
      return res.status(400).json({ error: 'done must be true or false' });
    }

    sql += ' AND done = ?';
    params.push(req.query.done === 'true' ? 1 : 0);
  }

  if (req.query.search !== undefined) {
    const word = String(req.query.search).trim();
    
    if (word === '') {
      return res.status(400).json({ error: 'search must not be empty' });
    }

    sql += ' AND LOWER(title) LIKE ?';
    params.push(`%${word.toLowerCase()}%`);
  }

  sql += ' ORDER BY id';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(rowToTask));
});

// Derived counts - the server computes, not just stores.
app.get('/stats', (req, res) => {
  const done = tasks.filter((t) => t.done).length;
  res.json({
    total: tasks.length,
    done,
    open: tasks.length - done,
  });
});

// Restore the seed tasks
app.post('/reset', (req, res) => {
  resetTasks();
  res.json(tasks);
});

// Create a task
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  if (title === undefined || title === null || String(title).trim() === '') {
    return res.status(400).json({ error: 'title is required and cannot be empty' });
  }

  const id = tasks.length === 0 ? 1 : Math.max(...tasks.map((t) => t.id)) + 1;
  const task = { id, title: String(title).trim(), done: false };

  tasks.push(task);
  res.status(201).json(task);
});

app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id, title, done FROM tasks WHERE id = ?').get(id);

  if (!row) {
    return res.status(404).json({ error: `Task ${id} is not found` });
  }

  res.json(rowToTask(row));
});

// Update an existing task
app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body ?? {};
  const hasTitle = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'title');
  const hasDone = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'done');

  if (!hasTitle && !hasDone) {
    return res.status(400).json({ error: 'request body must include title and/or done' });
  }

  if (hasTitle) {
    if (title === null || String(title).trim() === '') {
      return res.status(400).json({ error: 'title cannot be empty' });
    }
    task.title = String(title).trim();
  }

  if (hasDone) {
    if (typeof done !== 'boolean') {
      return res.status(400).json({ error: 'done must be a boolean' });
    }
    task.done = done;
  }

  res.json(task);
});

// Remove a task
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  tasks.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
});
