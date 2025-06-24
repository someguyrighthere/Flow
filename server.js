// server.js

// --- 1. Imports and Setup ---
const express = require('express');
// Import the 'pg' library for PostgreSQL database interaction
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// --- 2. Initialize Express App ---
const app = express();
// Use PORT from environment variables (Render will provide this) or default to 3000
const PORT = process.env.PORT || 3000;
// Use JWT_SECRET from environment variables (set this on Render)
// Provide a strong default for local development, but NEVER use this default in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Get the PostgreSQL database connection string from environment variables.
// Render automatically provides this as DATABASE_URL for linked PostgreSQL services.
// If running locally, you might set this environment variable or use a local string for testing.
const DATABASE_URL = process.env.DATABASE_URL;

// --- 3. Database Connection and Initialization ---
// Create a new PostgreSQL connection pool.
// Connection pools manage multiple connections to the database, improving performance
// by reusing connections instead of opening a new one for every request.
const pool = new Pool({
    connectionString: DATABASE_URL,
    // SSL configuration is crucial for Render-hosted PostgreSQL databases.
    // Render's internal connections typically require `rejectUnauthorized: false`
    // because they use self-signed certificates that are trusted within the Render
    // environment but might not be recognized by default Node.js root CAs.
    // WARNING: For external connections not on Render's internal network,
    // disabling `rejectUnauthorized` can be a security risk.
    ssl: {
        rejectUnauthorized: false
    }
});

// Attempt to connect to the database to ensure it's reachable and
// then initialize the database schema (create tables if they don't exist).
pool.connect()
    .then(client => {
        console.log('Connected to the PostgreSQL database.');
        // Release the client back to the pool immediately after testing the connection
        client.release();

        // Define the initial database schema using PostgreSQL-specific syntax.
        // SERIAL PRIMARY KEY is used for auto-incrementing integer IDs in PostgreSQL.
        const initialSchema = `
            CREATE TABLE IF NOT EXISTS locations (
                location_id SERIAL PRIMARY KEY,
                location_name TEXT NOT NULL,
                location_address TEXT
            );

            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('super_admin', 'location_admin', 'employee')),
                position TEXT,
                location_id INTEGER,
                -- Define a foreign key constraint to link users to locations.
                -- ON DELETE SET NULL means if a location is deleted, users associated
                -- with it will have their location_id set to NULL instead of being deleted.
                FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE SET NULL
            );

            -- Add other CREATE TABLE statements here in the future as your app grows.
            -- Example: Checklists, Tasks, etc.
        `;

        // Execute the schema creation queries.
        // pool.query() returns a Promise, allowing for chained .then() and .catch()
        // for asynchronous operations.
        return pool.query(initialSchema);
    })
    .then(() => {
        console.log("Database schema is ready.");
    })
    .catch(err => {
        console.error('Error connecting to or initializing PostgreSQL database:', err.message);
        // If the database connection or schema initialization fails, it's critical
        // to exit the process as the application cannot function without a database.
        process.exit(1);
    });


// --- 4. Middleware ---
// Enable CORS (Cross-Origin Resource Sharing) to allow requests from different origins.
app.use(cors());
// Parse incoming JSON requests, making it available on req.body.
app.use(express.json());
// Serve static files (e.g., HTML, CSS, JavaScript for the frontend) from the current directory.
// Uncomment this if you are serving your frontend files directly from this Node.js server.
// app.use(express.static(__dirname));


// --- 5. Authentication Middleware ---
// Middleware to verify JWT token and authenticate user.
const isAuthenticated = (req, res, next) => {
    // Get the Authorization header (e.g., "Bearer YOUR_TOKEN")
    const authHeader = req.headers['authorization'];
    // Extract the token part
    const token = authHeader && authHeader.split(' ')[1];
    // If no token is provided, return 401 Unauthorized
    if (token == null) return res.sendStatus(401);

    // Verify the token using the JWT_SECRET
    jwt.verify(token, JWT_SECRET, (err, user) => {
        // If token verification fails (e.g., invalid, expired), return 403 Forbidden
        if (err) return res.sendStatus(403);
        // If valid, attach the decoded user payload to the request object
        req.user = user;
        // Proceed to the next middleware or route handler
        next();
    });
};

// Middleware to check if the authenticated user has 'super_admin' or 'location_admin' role.
const isAdmin = (req, res, next) => {
    // Check if the user's role is not super_admin or location_admin
    if (req.user.role !== 'super_admin' && req.user.role !== 'location_admin') {
        // If not, return 403 Forbidden with an access denied message
        return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    // If the user is an admin, proceed
    next();
};


// --- 6. API Routes ---

// Root route to serve the main HTML file (if applicable).
// Uncomment this and ensure you have an `index.html` in the same directory
// if you want your Node.js server to also serve your frontend.
// app.get('/', (req, res) => {
//     res.sendFile(__dirname + '/index.html');
// });

// Login Route: Authenticates user and issues a JWT.
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    // Validate request body
    if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

    // SQL query to fetch user by email.
    // PostgreSQL uses $1, $2, etc., for parameterized queries to prevent SQL injection.
    const sql = `SELECT * FROM users WHERE email = $1`;
    // Execute the query using the connection pool.
    pool.query(sql, [email])
        .then(result => {
            // In pg, query results for SELECT are in the 'rows' array.
            const user = result.rows[0];
            // If no user found with that email, return 401 Unauthorized
            if (!user) return res.status(401).json({ error: "Invalid credentials." });

            // Compare the provided password with the hashed password from the database.
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) return res.status(500).json({ error: "An internal server error occurred." });
                // If passwords don't match, return 401 Unauthorized
                if (!isMatch) return res.status(401).json({ error: "Invalid credentials." });

                // If authentication is successful, create a JWT payload.
                const payload = { id: user.user_id, role: user.role };
                // Sign the token with the JWT_SECRET and set an expiration (e.g., 1 day).
                const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
                // Send success response with the token and user role.
                res.json({ message: "Logged in successfully!", token: token, role: user.role });
            });
        })
        .catch(err => {
            // Log any database query errors
            console.error("Login error:", err.message);
            res.status(500).json({ error: "An internal server error occurred." });
        });
});

// Location Management Routes (Protected by isAuthenticated and isAdmin middleware)
// Get all locations
app.get('/locations', isAuthenticated, isAdmin, (req, res) => {
    pool.query("SELECT * FROM locations")
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).json({ error: err.message }));
});

// Add a new location
app.post('/locations', isAuthenticated, isAdmin, (req, res) => {
    const { location_name, location_address } = req.body;
    // INSERT query with RETURNING to get the newly created location_id
    pool.query(`INSERT INTO locations (location_name, location_address) VALUES ($1, $2) RETURNING location_id`, [location_name, location_address])
        .then(result => {
            res.status(201).json({ id: result.rows[0].location_id, location_name, location_address });
        })
        .catch(err => res.status(400).json({ error: err.message }));
});

// Delete a location
app.delete('/locations/:id', isAuthenticated, isAdmin, (req, res) => {
    pool.query(`DELETE FROM locations WHERE location_id = $1`, [req.params.id])
        .then(result => {
            // Check rowCount to see if any rows were actually deleted.
            if (result.rowCount === 0) return res.status(404).json({ error: 'Location not found.' });
            res.status(204).send(); // 204 No Content for successful deletion
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// User Management Routes (Protected by isAuthenticated and isAdmin middleware)
// Get all users with their associated location names
app.get('/users', isAuthenticated, isAdmin, (req, res) => {
    const sql = `
        SELECT u.user_id, u.full_name, u.email, u.role, u.position, l.location_name
        FROM users u
        LEFT JOIN locations l ON u.location_id = l.location_id
    `;
    pool.query(sql)
        .then(result => res.json(result.rows))
        .catch(err => res.status(500).json({ error: err.message }));
});

// Delete a user
app.delete('/users/:id', isAuthenticated, isAdmin, (req, res) => {
    // Prevent a user from deleting their own account
    if (req.user.id == req.params.id) {
        return res.status(403).json({ error: "You cannot delete your own account." });
    }
    pool.query(`DELETE FROM users WHERE user_id = $1`, [req.params.id])
        .then(result => {
            if (result.rowCount === 0) return res.status(404).json({ error: 'User not found.' });
            res.status(204).send();
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// Helper function to invite new users (admins or employees)
const inviteUser = (req, res, role) => {
    const { full_name, email, password, location_id, position } = req.body;
    // Basic input validation
    if (!full_name || !email || !password) {
        return res.status(400).json({ error: "Full name, email, and password are required to invite a user." });
    }

    // Hash the password before storing it in the database
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: "Error hashing password." });

        // SQL to insert a new user, returning the new user's ID
        const sql = `INSERT INTO users (full_name, email, password, role, position, location_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`;
        pool.query(sql, [full_name, email, hash, role, position || null, location_id])
            .then(result => {
                res.status(201).json({ id: result.rows[0].user_id });
            })
            .catch(err => {
                console.error("Error inviting user:", err.message);
                // PostgreSQL error code '23505' indicates a unique constraint violation (e.g., duplicate email)
                if (err.code === '23505') {
                    return res.status(400).json({ error: "Email may already be in use." });
                }
                res.status(500).json({ error: "An internal server error occurred." });
            });
    });
};

// Route to invite a location admin
app.post('/invite-admin', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'location_admin'));
// Route to invite an employee
app.post('/invite-employee', isAuthenticated, isAdmin, (req, res) => inviteUser(req, res, 'employee'));


// Existing Routes to be filled in later (Placeholders)
app.delete('/checklists/:id', isAuthenticated, (req, res) => {
    res.status(501).send("Not yet implemented");
});


// --- 7. Start Server ---
// Start the Express server and listen for incoming requests on the specified port.
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
