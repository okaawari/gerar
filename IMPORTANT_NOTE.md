# ⚠️ IMPORTANT — API Request Methods

## DO NOT USE PATCH, PUT, DELETE, OR ANY OTHER HTTP METHOD

**This project uses ONLY:**

- **GET** — for reading data
- **POST** — for creating, updating, and deleting data

**Do NOT use:** `PATCH`, `PUT`, `DELETE`, or any other HTTP method in:
- API routes in this backend
- Frontend or client calls to this API
- Postman/API tests
- Any integration with this API

All mutations (create, update, delete) must be implemented as **POST** requests, with the action indicated by the URL path or request body if needed.

This constraint may be required by the hosting environment (e.g. proxy, cPanel, or firewall) that only allows GET and POST.
