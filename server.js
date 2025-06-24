// server.js

// --- 1. Imports and Setup ---
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
// ... other imports

// --- 2. Initialize Express App & Middleware ---
const app = express();
// ... other initializations

// --- 3. Database Initialization ---
const initializeDatabase = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('Connected to the PostgreSQL database.');
        
        // All existing CREATE TABLE statements...
        await client.query(`CREATE TABLE IF NOT EXISTS locations (...)`);
        await client.query(`CREATE TABLE IF NOT EXISTS users (...)`);
        // ... etc.

        // --- MODIFIED: Applicants Table ---
        await client.query(`
            CREATE TABLE IF NOT EXISTS applicants (
                id SERIAL PRIMARY KEY,
                job_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                address TEXT,
                phone TEXT,
                date_of_birth DATE,
                ssn TEXT,
                desired_salary TEXT,
                availability TEXT,
                can_relocate BOOLEAN,
                is_authorized BOOLEAN,
                status VARCHAR(50) DEFAULT 'Applied',
                applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE
            );
        `);
        console.log("Applicants table updated and ready.");
        
        // ... rest of the function
    } catch (err) {
        // ... error handling
    } finally {
        if (client) client.release();
    }
};

// --- 4. API Routes ---

// --- MODIFIED: /apply/:jobId Route ---
app.post('/apply/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const { 
        name, email, address, phone, date_of_birth, ssn, 
        desired_salary, availability, can_relocate, is_authorized 
    } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required.' });
    }

    const sql = `
        INSERT INTO applicants (
            job_id, name, email, address, phone, date_of_birth, ssn, 
            desired_salary, availability, can_relocate, is_authorized
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    const values = [
        jobId, name, email, address, phone, date_of_birth || null, ssn,
        desired_salary, availability, can_relocate, is_authorized
    ];

    try {
        await pool.query(sql, values);
        res.status(201).json({ message: 'Application submitted successfully!' });
    } catch (err) {
        console.error("Error submitting application:", err);
        res.status(500).json({ error: 'Failed to submit application.' });
    }
});


// ... (All other routes and server startup logic)
// ...
