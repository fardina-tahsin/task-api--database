# Task API

An Express CRUD API for managing tasks, SQLite for backend database.

## Why SQLite?

SQLite was chosen because it is a real SQL database that still fits a small local project:

- No separate database server to install or run — just a library (`better-sqlite3`) and a file
- Data survives server restarts 
- Synchronous API, which keeps the Express handlers simple (no `async`/`await` for queries)
- Enough SQL to practice `SELECT`, `INSERT`, `UPDATE`, and `DELETE` without the overhead of Postgres or MySQL

## Database file

Tasks are stored in **`tasks.db`** in the project root (the same folder as `index.js`).

The file is created automatically the first time the app starts. It is listed in `.gitignore`, so each machine keeps its own copy.

<img width="1156" height="290" alt="database" src="https://github.com/user-attachments/assets/d0812492-aa20-427e-8fc7-32c77c6f36fe" />

## Getting started

Install dependencies:

```bash
npm install
```

Start the server:

```bash
  npm run dev
```
or

```bash
npm start
```

The API runs at `http://localhost:3000`.

OpenAPI docs (Swagger UI) are at [http://localhost:3000/docs](http://localhost:3000/docs). The spec lives in `openapi.json`.

### Example SQL query

On startup, the app runs queries like this to read every row:

```sql
SELECT id, title, done, created_at, updated_at FROM tasks ORDER BY id;
```

That is the same data you get from `GET /tasks`. Each task also stores `created_at` and `updated_at` (set on insert; `updated_at` is refreshed on every successful `PUT`).

## Endpoints

### `GET /`

Returns metadata about the API.

**Response**

```json
{
  "name": "Task API",
  "version": "1.0",
  "endpoints": [
    "/tasks"
  ]
}
```

**Example**

```bash
curl http://localhost:3000/
```

### `GET /health`

Health check endpoint.

**Response**

```json
{
  "status": "OK"
}
```

**Example**

```bash
curl http://localhost:3000/health

### `GET /tasks`

Returns all tasks. Optional query parameters filter the list (the part after `?` - filters, not addresses).

| Query | Example | Effect |
|-------|---------|--------|
| `done` | `?done=true` | Only finished tasks |
| `done` | `?done=false` | Only open tasks |
| `search` | `?search=milk` | Title contains the word (case-insensitive) |

Filters can be combined: `?done=false&search=book`

**Response**

```json
[
  {
    "id": 1,
    "title": "Buy a book",
    "done": true,
    "created_at": "2026-08-27 13:38:30",
    "updated_at": "2026-08-27 13:38:30"
  },
  {
    "id": 2,
    "title": "Go on a morning walk",
    "done": true,
    "created_at": "2026-08-27 13:38:30",
    "updated_at": "2026-08-27 13:38:30"
  },
  {
    "id": 3,
    "title": "Go to market",
    "done": false,
    "created_at": "2026-08-27 13:40:00",
    "updated_at": "2026-08-27 13:40:00"
  }
]
```

**Example**

```bash
curl http://localhost:3000/tasks
curl "http://localhost:3000/tasks?done=true"
curl "http://localhost:3000/tasks?search=milk"
```

### `GET /stats`

Returns counts computed in SQL with `COUNT()` (not by looping in JavaScript).

**Response**

```json
{ "total": 7, "done": 3, "open": 4 }
```

**Example**

```bash
curl http://localhost:3000/stats
```

### `POST /reset`

Restores the three seed example tasks. Useful for demos and testing.
Clears the database and restores the three seed example tasks.

**Response (200)**

```json
[
  {
    "id": 1,
    "title": "Buy a book",
    "done": true,
    "created_at": "2026-08-27 13:38:30",
    "updated_at": "2026-08-27 13:38:30"
  },
  {
    "id": 2,
    "title": "Go on a morning walk",
    "done": true,
    "created_at": "2026-08-27 13:38:30",
    "updated_at": "2026-08-27 13:38:30"
  },
  {
    "id": 3,
    "title": "Go to market",
    "done": false,
    "created_at": "2026-08-27 13:40:00",
    "updated_at": "2026-08-27 13:40:00"
  }
]
```

**Example**

```bash
curl -X POST http://localhost:3000/reset
```

### `GET /tasks/:id`

Returns a single task by id.

**Response (200)**

```json
{ "id": 1, "title": "Buy a book", "done": true, "created_at": "2026-08-27 13:38:30", "updated_at": "2026-08-27 13:38:30" }
```

**Response (404)**

```json
{ "error": "Task 50 is not found" }
```

**Example**

```bash
curl http://localhost:3000/tasks/1
curl http://localhost:3000/tasks/50

### `POST /tasks`

Creates a new task.

**Request body**

```json
{ "title": "Buy milk" }
```

**Response (201)**

```json
{ "id": 4, "title": "Buy milk", "done": false, "created_at": "2026-08-27 13:45:00", "updated_at": "2026-08-27 13:45:00" }
```

**Response (400)**

```json
{ "error": "title is required and cannot be empty" }
```

**Example**

```bash
curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d "{\"title\":\"Buy milk\"}"

### `PUT /tasks/:id`

Updates a task's `title` and/or `done`. Send one or both fields; omitted fields stay unchanged.

**Request body**

```json
{ "title": "Buy oat milk", "done": true }
```

**Response (200)**

```json
{ "id": 1, "title": "Buy oat milk", "done": true, "created_at": "2026-08-27 13:46:30", "updated_at": "2026-08-27 13:46:30" }
```

**Response (400)**

```json
{ "error": "request body must include title and/or done" }
```

**Response (404)**

```json
{ "error": "Task 50 not found" }
```

**Example**

```bash
curl -i -X PUT http://localhost:3000/tasks/1 -H "Content-Type: application/json" -d "{\"done\": false}"
```

### `DELETE /tasks/:id`

Deletes a task.

**Response (204)**

Empty body - success, nothing to return.

**Response (404)**

```json
{ "error": "Task 50 not found" }
```

**Example**

```bash
curl -X DELETE http://localhost:3000/tasks/1
