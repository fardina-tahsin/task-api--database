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
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const taskColumns = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);

if (!taskColumns.includes('created_at')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`);
  db.exec(`UPDATE tasks SET created_at = datetime('now') WHERE created_at = ''`);
}
if (!taskColumns.includes('updated_at')) {
  db.exec(`ALTER TABLE tasks ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
  db.exec(`UPDATE tasks SET updated_at = datetime('now') WHERE updated_at = ''`);
}

// Original demo data - POST /reset restores a fresh copy of this list.
const SEED_TASKS = [
    { id: 1, title: 'Buy a book', done: true },
    { id: 2, title: 'Go on a morning walk', done: true },
    { id: 3, title: 'Go to market', done: false },
];

const insertSeedTask = db.prepare('INSERT INTO tasks (id, title, done) VALUES (?, ?, ?)');

function seedTasks(tasks) {
  for (const task of tasks) {
    insertSeedTask.run(task.id, task.title, task.done ? 1 : 0);
  }
}

// Seed only when empty, so restarting the server won't duplicate rows.
const countTasks = db.prepare('SELECT COUNT(*) AS count FROM tasks');
if (countTasks.get().count === 0) {
  db.transaction(seedTasks)(SEED_TASKS);
}

function resetTasks() {
  const clear = db.prepare('DELETE FROM tasks');
  const reset = db.transaction((tasks) => {
    clear.run();
    seedTasks(tasks);
  });
  reset(SEED_TASKS);
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
  return {
    id: row.id,
    title: row.title,
    done: Boolean(row.done),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const TASK_COLUMNS = 'id, title, done, created_at, updated_at';

// Query params after ? filter the list - they are not part of the address.
app.get('/tasks', (req, res) => {
  let sql = `SELECT ${TASK_COLUMNS} FROM tasks WHERE 1=1`;
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
  const stats = db.prepare(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN done = 1 THEN 1 END) AS done,
        COUNT(CASE WHEN done = 0 THEN 1 END) AS open
      FROM tasks
    `
    )
    .get();

  res.json(stats);
});

// Restore the seed tasks
app.post('/reset', (req, res) => {
  resetTasks();
  const rows = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY id`).all();
  res.json(rows.map(rowToTask));
});

// Create a task
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  if (title === undefined || title === null || String(title).trim() === '') {
    return res.status(400).json({ error: 'title is required and cannot be empty' });
  }

  // Insert a new row
  const result = db.prepare('INSERT INTO tasks (title, done) VALUES (?, 0)').run(String(title).trim());

  const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(result.lastInsertRowid);

  res.status(201).json(rowToTask(row));
});

app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);

  if (!row) {
    return res.status(404).json({ error: `Task ${id} is not found` });
  }

  res.json(rowToTask(row));
});

// Update an existing task
app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);

  if (!row) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  const { title, done } = req.body ?? {};
  const hasTitle = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'title');
  const hasDone = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'done');

  if (!hasTitle && !hasDone) {
    return res.status(400).json({ error: 'request body must include title and/or done' });
  }

  // Start from existing values
  let nextTitle = row.title;
  let nextDone = row.done;

  if (hasTitle) {
    if (title === null || String(title).trim() === '') {
      return res.status(400).json({ error: 'title cannot be empty' });
    }
    nextTitle = String(title).trim();
  }

  if (hasDone) {
    if (typeof done !== 'boolean') {
      return res.status(400).json({ error: 'done must be a boolean' });
    }
    nextDone = done ? 1 : 0;
  }

  db.prepare(
    `UPDATE tasks SET title = ?, done = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(nextTitle, nextDone, id);

  const updated = db.prepare(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = ?`).get(id);
  res.json(rowToTask(updated));
});

// Remove a task
app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);

  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }

  res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
});
