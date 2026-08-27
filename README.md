# Task API

An Express CRUD API for managing tasks.

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
  { "id": 1, "title": "Buy a book", "done": true },
  { "id": 2, "title": "Go on a morning walk", "done": true },
  { "id": 3, "title": "Go to market", "done": false }
]
```

**Example**

```bash
curl http://localhost:3000/tasks
curl "http://localhost:3000/tasks?done=true"
curl "http://localhost:3000/tasks?search=milk"
```

### `GET /stats`

Returns computed counts for the current task list.

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

**Response (200)**

```json
[
  { "id": 1, "title": "Buy a book", "done": true },
  { "id": 2, "title": "Go on a morning walk", "done": true },
  { "id": 3, "title": "Go to market", "done": false }
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
{ "id": 1, "title": "Buy a book", "done": true }
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
{ "id": 4, "title": "Buy milk", "done": false }
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
{ "id": 1, "title": "Buy oat milk", "done": true }
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
