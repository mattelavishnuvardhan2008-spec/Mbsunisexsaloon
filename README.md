# Mysecondrepository2026
# BarberX Booking Website

A simple barber shop website with service imagery, appointment booking, and an owner-only admin panel.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```

## Available files

- `index.html` — public booking landing page
- `admin.html` — owner admin panel for appointment details
- `server.js` — Express backend serving the website and appointment API
- `private/db.json` — lightweight JSON database for appointments

## Admin access

The admin endpoint requires the owner bearer token. By default the key is:

`owner-secret-key`

To change it, set the `ADMIN_KEY` environment variable before starting the server:

```bash
ADMIN_KEY=my-secret-key npm start
```

Then open:

- `http://localhost:3000/admin`

and enter the owner key.
