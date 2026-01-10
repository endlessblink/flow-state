const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 6010;

// Enable CORS
app.use(cors());

// Serve static files from current directory
app.use(express.static(__dirname));

// API Endpoint to get MASTER_PLAN.md content
app.get('/api/master-plan', (req, res) => {
    // Default to ../docs/MASTER_PLAN.md relative to this script
    const defaultPath = path.join(__dirname, '../docs/MASTER_PLAN.md');
    // Allow override via env var, resolving relative to CWD or using absolute path
    const masterPlanPath = process.env.MASTER_PLAN_PATH
        ? path.resolve(process.env.MASTER_PLAN_PATH)
        : defaultPath;

    console.log(`[API] Fetching MASTER_PLAN.md from: ${masterPlanPath}`);

    fs.readFile(masterPlanPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`[API] Error reading MASTER_PLAN.md: ${err.message}`);
            return res.status(500).json({
                error: 'Failed to read MASTER_PLAN.md',
                details: err.message,
                path: masterPlanPath
            });
        }
        res.json({ content: data });
    });
});

app.listen(PORT, () => {
    console.log(`Dev Manager running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${__dirname}`);
});
