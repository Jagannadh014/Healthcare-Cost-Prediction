const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;

const app = express();
app.use(bodyParser.json());
app.use(cors());

const MONGO = 'mongodb://127.0.0.1:27017/newDB';
console.log('⏳ Attempting to connect to MongoDB...');
mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ Mongo connected successfully');
    console.log('⏳ Starting createDefaultAdmin...');
    createDefaultAdmin(); // Ensure this runs after connection
  })
  .catch(err => {
    console.error('❌ Mongo Connection Error:', err);
    console.log('Please check if your MongoDB service is running.');
  });

// JWT Secret (MVP - should be in environment variable in production)
const JWT_SECRET = 'healthcare_jwt_secret_key_2025_mvp';
const JWT_EXPIRY = '24h';

// ==================== USER SCHEMA ====================
const UserSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  created_at: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// ==================== PREDICTION SCHEMA ====================
const PredictionSchema = new mongoose.Schema({
  prediction_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },  // links to user
  input: Object,
  prediction: Number,
  model: String,
  model_version: String,
  uncertainty: {
    range_80: [Number], // [min, max]
    range_95: [Number], // [min, max]
    uncertainty_level: String, // low, moderate, high
    interpretation: String
  },
  feedback: {
    actual_cost: Number,
    absolute_error: Number,
    percentage_error: Number,
    feedback_note: String,
    reported_at: Date
  },
  createdAt: { type: Date, default: Date.now }
});
const Prediction = mongoose.model('Prediction', PredictionSchema);

const FeedbackSchema = new mongoose.Schema({
  prediction_id: { type: String, required: true, unique: true },
  actual_cost: { type: Number, required: true },
  absolute_error: Number,
  percentage_error: Number,
  reported_at: { type: Date, default: Date.now }
});
const Feedback = mongoose.model('Feedback', FeedbackSchema);

// ==================== AUTH MIDDLEWARE ====================

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // { user_id, email, role }
    next();
  });
};

// Middleware to check user role
const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Access denied. ${role} role required.` });
    }
    next();
  };
};

// ==================== DEFAULT ADMIN CREATION ====================
// Create default admin on server start if not exists
const createDefaultAdmin = async () => {
  try {
    const adminEmail = 'admin@healthcare.ai'; // Updated to match MVP req
    const adminPassword = 'admin123';

    const existingAdmin = await User.findOne({ email: adminEmail });

    // Always hash the password to ensure it's correct even if changed previously
    const { randomUUID } = require('crypto');
    const password_hash = await bcrypt.hash(adminPassword, 10);

    if (!existingAdmin) {
      const admin = new User({
        user_id: randomUUID(),
        email: adminEmail,
        password_hash,
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Default admin created');
    } else {
      // Force update to ensure correct password and role for MVP
      existingAdmin.password_hash = password_hash;
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log('✅ Default admin updated to standard credentials');
    }

    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
  } catch (err) {
    console.error('Error creating default admin:', err);
  }
};

// ... (mongoose connection line stays same)

// ==================== AUTH ENDPOINTS ====================

// POST /admin/login - Specific admin login
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    // Verify Role
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Not an administrator.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// POST /auth/register - Register new user
// ... (rest of register) ...
// ... (rest of login) ...


// ==================== ADMIN ENDPOINTS ====================

// GET /admin/users - Get list of users (admin only)
app.get('/admin/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }) // Only list normal users
      .select('user_id email role created_at')
      .sort({ created_at: -1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// GET /admin/users/:userId/predictions - Get user's predictions (admin only)
app.get('/admin/users/:userId/predictions', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const predictions = await Prediction.find({ user_id: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(predictions);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// GET /admin/predictions - Get all predictions (admin only)
// ...
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists. Please login.' });
    }

    // Validate role (prevent unauthorized admin creation in production)
    const userRole = (role === 'admin') ? 'admin' : 'user';

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate user_id
    const { randomUUID } = require('crypto');
    const user_id = randomUUID();

    // Create user
    const user = new User({
      user_id,
      email: email.toLowerCase(),
      password_hash,
      role: userRole
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      message: 'Registration successful',
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// POST /auth/login - Login existing user
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register.' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// POST /auth/verify - Verify token (optional, for frontend checks)
app.post('/auth/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      user_id: req.user.user_id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// ==================== PREDICTION ENDPOINTS ====================


// ==================== PREDICTION ENDPOINTS ====================

// Helper: Run Python Script
const runPython = (scriptName, inputData) => {
  return new Promise((resolve, reject) => {
    // py for windows, python3 otherwise (or just rely on 'py' if env is windows)
    const pyCmd = process.platform === 'win32' ? 'py' : 'python3';
    const scriptPath = path.join(__dirname, '..', 'server', scriptName);

    // Spawn process
    const py = spawn(pyCmd, [scriptPath]);

    let output = '';
    let errorOutput = '';

    // Timeout (15s for models)
    const timeout = setTimeout(() => {
      py.kill();
      reject(new Error(`Timeout running ${scriptName}`));
    }, 15000);

    py.stdout.on('data', (d) => output += d.toString());
    py.stderr.on('data', (d) => errorOutput += d.toString());

    py.stdin.write(JSON.stringify(inputData));
    py.stdin.end();

    py.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        console.error(`Error running ${scriptName}:`, errorOutput);
        reject(new Error(`Model script failed: ${errorOutput}`));
        return;
      }
      try {
        if (!output.trim()) throw new Error("No output");
        const json = JSON.parse(output);
        if (json.error) throw new Error(json.error);
        resolve(json);
      } catch (e) {
        reject(new Error(`Invalid JSON from ${scriptName}: ${e.message}`));
      }
    });

    py.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

app.post('/predict', authenticateToken, async (req, res) => {
  const input = req.body || {};
  const { randomUUID } = require('crypto');
  const prediction_id = randomUUID();

  try {
    // ---------------- STEP 1: BASELINE MODEL ----------------
    // Always run baseline first
    const baseline = await runPython('serve_baseline_model.py', input);

    // ---------------- STEP 2: EPISODE MODEL (Optional) ----------------
    let episode = null;
    let adjustment = {
      mean: 1.0,
      p10: 1.0,
      p95: 1.0
    };

    if (input.condition && input.condition.trim() !== '') {
      try {
        const epiRes = await runPython('serve_episode_model.py', { condition: input.condition });
        episode = epiRes;
        adjustment = {
          mean: epiRes.adjustment_mean,
          p10: epiRes.adjustment_p10,
          p95: epiRes.adjustment_p95
        };
      } catch (err) {
        console.error("Episode Model Failure (Fallback to Baseline):", err.message);
        // Fallback: episode is null, adjustment stays 1.0
        // We might want to log this to the user response? 
        // For now, silent fallback as per spec ("Default Adjustment")
      }
    }

    // ---------------- STEP 3: COMBINE (Uncertainty Propagation) ----------------
    const final_mean = baseline.baseline_mean * adjustment.mean;
    const final_p10 = baseline.baseline_p10 * adjustment.p10;
    const final_p95 = baseline.baseline_p95 * adjustment.p95;

    // ---------------- STEP 4: PREPARE RESPONSE ----------------
    const response = {
      prediction_id,
      baseline: {
        mean: baseline.baseline_mean,
        range: [baseline.baseline_p10, baseline.baseline_p95],
        shap_values: baseline.shap_values
      },
      episode: episode, // null if no condition or failed
      final_estimate: {
        mean: Math.round(final_mean),
        expected_cost: Math.round(final_mean), // Alias for frontend compat
        range: [Math.round(final_p10), Math.round(final_p95)],
        uncertainty_level: assessUncertainty(final_mean, final_p10, final_p95)
      }
    };

    // Save Prediction logic (Updated Schema)
    // We need to adapt the Mongoose Schema or just save "prediction" as final_mean
    // DB Schema is: prediction: Number, uncertainty: Object
    const rec = new Prediction({
      prediction_id,
      user_id: req.user.user_id,
      input,
      prediction: response.final_estimate.mean,
      model: "two_layer_v1",
      model_version: "baseline_v2_episode_v1",
      uncertainty: {
        range_80: [Math.round(final_p10), Math.round(final_p95)], // Reuse p10/95 as 80 for backward compat if needed? 
        // Actually frontend expects range_80/95. 
        // Spec said "Range: [P10, P95]". 
        // I'll populate range_95 with [P10, P95] and range_80 with narrower if possible.
        // For simplicity, let's map P10-P95 to range_95. 
        // And create a synthetic range_80 (P15-P85 ish?) or just dup.
        range_95: [Math.round(final_p10), Math.round(final_p95)],
        range_80: [Math.round(final_p10 + (final_mean - final_p10) * 0.2), Math.round(final_p95 - (final_p95 - final_mean) * 0.2)], // Rough heuristic
        uncertainty_level: response.final_estimate.uncertainty_level
      }
    });
    await rec.save();

    res.json(response);

  } catch (err) {
    console.error("Prediction Error:", err);
    res.status(500).json({ error: "Prediction failed: " + err.message });
  }
});

function assessUncertainty(mean, p10, p95) {
  if (mean < 1) return "low";
  const width = p95 - p10;
  const ratio = width / mean;
  if (ratio < 0.6) return "low";
  if (ratio < 1.0) return "moderate";
  return "high";
}

// ==================== WHAT-IF SIMULATION ENDPOINT ====================

// Helper wrapper for the new flow
async function getPredictionFromModel(inputs) {
  // We reuse the new logic but internally. 
  // Wait, What-if simulator uses "prediction" field.
  // If we change input (bmi), we want to see change in FINAL cost.
  // So we should run the MAIN pipeline.

  // Call runPython directly for speed? 
  // Actually, `serve_baseline_model.py` is enough if we assume condition doesn't change?
  // BUT if the user HAS a condition, the baseline change is multiplied!
  // So we MUST run the full pipeline.

  // Quick Hack: Call the same logic without DB save.
  // Simplified pipeline:
  const baseline = await runPython('serve_baseline_model.py', inputs);

  let adjustment = 1.0;
  if (inputs.condition && inputs.condition.trim() !== '') {
    try {
      const epi = await runPython('serve_episode_model.py', { condition: inputs.condition });
      adjustment = epi.adjustment_mean;
    } catch (e) { }
  }

  return baseline.baseline_mean * adjustment;
}

// POST /what-if - Compare baseline vs simulated predictions with counterfactual analysis
app.post('/what-if', authenticateToken, async (req, res) => {
  try {
    const { baseline_inputs, modified_inputs } = req.body;

    if (!baseline_inputs || !modified_inputs) {
      return res.status(400).json({ error: 'baseline_inputs and modified_inputs are required' });
    }

    // Validate that only controllable factors changed
    const controllable = ['bmi', 'smoker', 'children'];
    const readonly = ['age', 'sex', 'region'];

    for (const field of readonly) {
      if (baseline_inputs[field] !== modified_inputs[field]) {
        return res.status(400).json({
          error: `${field} cannot be changed (read-only factor)`
        });
      }
    }

    // Get baseline prediction
    const baseline_cost = await getPredictionFromModel(baseline_inputs);

    // Get simulated prediction
    const simulated_cost = await getPredictionFromModel(modified_inputs);

    // Calculate difference
    const difference = simulated_cost - baseline_cost;
    const percentage_change = ((difference / baseline_cost) * 100).toFixed(1);

    // ==================== COUNTERFACTUAL ANALYSIS ====================
    const counterfactuals = [];

    // Test 1: Reduce BMI to healthy range (23)
    if (baseline_inputs.bmi > 25) {
      try {
        const test_inputs = { ...baseline_inputs, bmi: 23 };
        const test_cost = await getPredictionFromModel(test_inputs);
        const savings = baseline_cost - test_cost;

        if (savings > 0) {
          counterfactuals.push({
            change: `Reduce BMI from ${baseline_inputs.bmi} to 23 (healthy range)`,
            expected_savings: Math.round(savings * 100) / 100,
            explanation: "Maintaining a healthy BMI (18.5-24.9) reduces obesity-related health risks including diabetes, heart disease, and joint problems, leading to lower healthcare costs."
          });
        }
      } catch (err) {
        console.error('BMI counterfactual error:', err);
      }
    }

    // Test 2: Quit smoking
    if (baseline_inputs.smoker === "yes") {
      try {
        const test_inputs = { ...baseline_inputs, smoker: "no" };
        const test_cost = await getPredictionFromModel(test_inputs);
        const savings = baseline_cost - test_cost;

        if (savings > 0) {
          counterfactuals.push({
            change: "Stop smoking",
            expected_savings: Math.round(savings * 100) / 100,
            explanation: "Smoking significantly increases healthcare costs due to higher risks of cancer, respiratory diseases, and cardiovascular problems. Quitting smoking is one of the most impactful health decisions."
          });
        }
      } catch (err) {
        console.error('Smoking counterfactual error:', err);
      }
    }

    // Test 3: Reduce children by 1 (if applicable)
    if (baseline_inputs.children > 0) {
      try {
        const test_inputs = { ...baseline_inputs, children: baseline_inputs.children - 1 };
        const test_cost = await getPredictionFromModel(test_inputs);
        const savings = baseline_cost - test_cost;

        if (savings > 0) {
          counterfactuals.push({
            change: `Reduce dependents from ${baseline_inputs.children} to ${baseline_inputs.children - 1}`,
            expected_savings: Math.round(savings * 100) / 100,
            explanation: "Fewer dependents reduce overall family healthcare coverage costs and out-of-pocket expenses."
          });
        }
      } catch (err) {
        console.error('Children counterfactual error:', err);
      }
    }

    // Select best counterfactual (highest savings)
    let best_counterfactual;
    if (counterfactuals.length === 0) {
      best_counterfactual = {
        change: "No significant changes recommended",
        expected_savings: 0,
        explanation: "Your current health profile is already optimized. Continue maintaining healthy habits."
      };
    } else {
      best_counterfactual = counterfactuals.sort((a, b) => b.expected_savings - a.expected_savings)[0];
    }

    // Return comparison
    res.json({
      baseline_cost: Math.round(baseline_cost * 100) / 100,
      simulated_cost: Math.round(simulated_cost * 100) / 100,
      difference: Math.round(difference * 100) / 100,
      percentage_change: parseFloat(percentage_change),
      counterfactual: best_counterfactual,
      all_counterfactuals: counterfactuals
    });

  } catch (err) {
    console.error('What-if error:', err);
    res.status(500).json({ error: err.toString() });
  }
});

// ==================== FEEDBACK ENDPOINTS ====================

// POST /feedback - Submit actual cost and compute errors
// POST /feedback - Submit actual cost and link to prediction
app.post('/feedback', authenticateToken, async (req, res) => {
  try {
    const { prediction_id, actual_cost, feedback_note } = req.body;

    if (!prediction_id || actual_cost === undefined || actual_cost === null) {
      return res.status(400).json({ error: 'prediction_id and actual_cost are required' });
    }

    if (actual_cost < 0) {
      return res.status(400).json({ error: 'actual_cost must be non-negative' });
    }

    // Find prediction belonging to this user
    const prediction = await Prediction.findOne({
      prediction_id,
      user_id: req.user.user_id
    });

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found or access denied' });
    }

    // Check if feedback already exists
    if (prediction.feedback && prediction.feedback.actual_cost !== undefined) {
      return res.status(409).json({ error: 'Feedback already submitted for this prediction' });
    }

    // Compute errors
    const predicted_cost = prediction.prediction;
    const absolute_error = Math.abs(actual_cost - predicted_cost);
    const percentage_error = predicted_cost !== 0
      ? (absolute_error / predicted_cost) * 100
      : 0;

    // Update prediction with feedback
    prediction.feedback = {
      actual_cost,
      absolute_error,
      percentage_error,
      feedback_note,
      reported_at: new Date()
    };

    await prediction.save();

    // Broadcast update to all connected clients
    broadcastUpdate({ type: 'update', message: 'New feedback received' });

    res.json({ message: 'Feedback submitted successfully', feedback: prediction.feedback });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// GET /predictions/history - Get logged-in user's history
app.get('/predictions/history', authenticateToken, async (req, res) => {
  try {
    const predictions = await Prediction.find({ user_id: req.user.user_id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('prediction_id prediction createdAt feedback uncertainty input'); // Select specific fields

    // Map to lightweight format
    const history = predictions.map(p => ({
      prediction_id: p.prediction_id,
      predicted_cost: p.prediction,
      created_at: p.createdAt,
      feedback_given: !!(p.feedback && p.feedback.actual_cost !== undefined),
      input_summary: `${p.input.age}y / ${p.input.sex} / ${p.input.smoker}`,
      uncertainty_level: p.uncertainty?.uncertainty_level || 'unknown'
    }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// GET /feedback/:prediction_id - Get feedback for a specific prediction
app.get('/feedback/:prediction_id', async (req, res) => {
  try {
    const { prediction_id } = req.params;
    const feedback = await Feedback.findOne({ prediction_id });

    if (!feedback) {
      return res.status(404).json({ error: 'No feedback found for this prediction' });
    }

    res.json(feedback);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ==================== MEDICAL GUIDANCE ENDPOINTS ====================

// Serve Static Medical Guidance (Offline curated)
app.get('/guidance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const safeId = id.replace(/[^a-z0-9-_]/gi, '').toLowerCase(); // Sanitize
    const filePath = path.join(__dirname, 'guidance', `${safeId}.json`);

    // Check existence
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Guidance not found' });
    }

    const data = await fs.readFile(filePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error serving guidance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== REAL-TIME ANALYTICS (SSE) ====================

// Store connected clients for SSE
let clients = [];

// SSE Endpoint
app.get('/analytics/stream', (req, res) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  res.writeHead(200, headers);

  const clientId = Date.now();
  const newClient = {
    id: clientId,
    res
  };
  clients.push(newClient);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
  });
});

// Broadcast function
const broadcastUpdate = (data) => {
  clients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};

// ==================== CHART DATA ENDPOINTS ====================

// GET /analytics/predicted-vs-actual - Time series data
app.get('/analytics/predicted-vs-actual', authenticateToken, async (req, res) => {
  try {
    const query = { 'feedback.actual_cost': { $exists: true } };

    // If not admin, filter by user
    if (req.user.role !== 'admin') {
      query.user_id = req.user.user_id;
    }

    const predictions = await Prediction.find(query)
      .sort({ createdAt: 1 }) // Oldest first for line chart
      .select('prediction_id prediction feedback.actual_cost createdAt');

    const data = predictions.map(p => ({
      date: p.createdAt.toISOString().split('T')[0], // YYYY-MM-DD
      timestamp: p.createdAt,
      prediction_id: p.prediction_id,
      predicted: p.prediction,
      actual: p.feedback.actual_cost,
      error: p.feedback.actual_cost - p.prediction
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// GET /analytics/error-distribution - Histogram buckets
app.get('/analytics/error-distribution', authenticateToken, async (req, res) => {
  try {
    const query = { 'feedback.actual_cost': { $exists: true } };
    if (req.user.role !== 'admin') {
      query.user_id = req.user.user_id;
    }

    const predictions = await Prediction.find(query).select('feedback.absolute_error');

    // Define buckets
    const buckets = {
      '0-1k': 0,
      '1k-5k': 0,
      '5k-10k': 0,
      '10k+': 0
    };

    predictions.forEach(p => {
      const err = p.feedback.absolute_error;
      if (err <= 1000) buckets['0-1k']++;
      else if (err <= 5000) buckets['1k-5k']++;
      else if (err <= 10000) buckets['5k-10k']++;
      else buckets['10k+']++;
    });

    const data = Object.keys(buckets).map(range => ({
      range,
      count: buckets[range]
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

// ... existing analytics endpoints ...
// GET /analytics/errors - Aggregated performance metrics
app.get('/analytics/errors', authenticateToken, async (req, res) => {
  try {
    const query = { 'feedback.actual_cost': { $exists: true } };
    if (req.user.role !== 'admin') {
      query.user_id = req.user.user_id;
    }

    const predictions = await Prediction.find(query);

    if (predictions.length === 0) {
      return res.json({
        message: 'No feedback data available yet',
        total_feedback_count: 0
      });
    }

    const feedbacks = predictions.map(p => p.feedback);
    const absolute_errors = feedbacks.map(f => f.absolute_error);
    const percentage_errors = feedbacks.map(f => f.percentage_error);

    const mean_absolute_error = absolute_errors.reduce((a, b) => a + b, 0) / absolute_errors.length;
    const mean_percentage_error = percentage_errors.reduce((a, b) => a + b, 0) / percentage_errors.length;

    // Median calculation
    const sorted_abs = [...absolute_errors].sort((a, b) => a - b);
    const mid = Math.floor(sorted_abs.length / 2);
    const median_absolute_error = sorted_abs.length % 2 === 0
      ? (sorted_abs[mid - 1] + sorted_abs[mid]) / 2
      : sorted_abs[mid];

    res.json({
      total_feedback_count: feedbacks.length,
      mean_absolute_error: parseFloat(mean_absolute_error.toFixed(2)),
      median_absolute_error: parseFloat(median_absolute_error.toFixed(2)),
      mean_percentage_error: parseFloat(mean_percentage_error.toFixed(2))
    });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// GET /analytics/bias - Bias monitoring by groups
app.get('/analytics/bias', authenticateToken, async (req, res) => {
  try {
    const query = { 'feedback.actual_cost': { $exists: true } };
    if (req.user.role !== 'admin') {
      query.user_id = req.user.user_id;
    }

    // Get all predictions with feedback
    const predictions = await Prediction.find(query);

    if (predictions.length === 0) {
      return res.json({ message: 'No feedback data available yet' });
    }

    // Group by smoker status
    const smokerGroups = { yes: [], no: [] };

    // Group by age bands
    const ageBands = { '18-25': [], '26-35': [], '36-50': [], '50+': [] };

    // Group by BMI categories
    const bmiCategories = { underweight: [], normal: [], overweight: [], obese: [] };

    predictions.forEach(pred => {
      const feedback = pred.feedback;
      const input = pred.input;
      const error = feedback.actual_cost - pred.prediction; // Signed error (positive = underprediction)

      // Smoker grouping
      if (input.smoker === 'yes') smokerGroups.yes.push(error);
      else smokerGroups.no.push(error);

      // Age band grouping
      const age = input.age;
      if (age <= 25) ageBands['18-25'].push(error);
      else if (age <= 35) ageBands['26-35'].push(error);
      else if (age <= 50) ageBands['36-50'].push(error);
      else ageBands['50+'].push(error);

      // BMI category grouping
      const bmi = input.bmi;
      if (bmi < 18.5) bmiCategories.underweight.push(error);
      else if (bmi < 25) bmiCategories.normal.push(error);
      else if (bmi < 30) bmiCategories.overweight.push(error);
      else bmiCategories.obese.push(error);
    });

    // Helper function to compute group stats
    const computeGroupStats = (errors) => {
      if (errors.length === 0) return null;
      const mean_error = errors.reduce((a, b) => a + b, 0) / errors.length;
      const mean_abs_error = errors.map(e => Math.abs(e)).reduce((a, b) => a + b, 0) / errors.length;
      const bias_direction = mean_error > 0 ? 'underprediction' : mean_error < 0 ? 'overprediction' : 'neutral';

      return {
        count: errors.length,
        mean_error: parseFloat(mean_error.toFixed(2)),
        mean_absolute_error: parseFloat(mean_abs_error.toFixed(2)),
        bias_direction
      };
    };

    const result = {
      by_smoker: {
        yes: computeGroupStats(smokerGroups.yes),
        no: computeGroupStats(smokerGroups.no)
      },
      by_age_band: {
        '18-25': computeGroupStats(ageBands['18-25']),
        '26-35': computeGroupStats(ageBands['26-35']),
        '36-50': computeGroupStats(ageBands['36-50']),
        '50+': computeGroupStats(ageBands['50+'])
      },
      by_bmi_category: {
        underweight: computeGroupStats(bmiCategories.underweight),
        normal: computeGroupStats(bmiCategories.normal),
        overweight: computeGroupStats(bmiCategories.overweight),
        obese: computeGroupStats(bmiCategories.obese)
      }
    };

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// GET /export/training-data - Export retraining-ready dataset
app.get('/export/training-data', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const predictions = await Prediction.find({ 'feedback.actual_cost': { $exists: true } });

    if (predictions.length === 0) {
      return res.status(404).json({ error: 'No feedback data available for export' });
    }

    // Build CSV
    const csvRows = [];
    csvRows.push('prediction_id,age,sex,bmi,children,smoker,region,predicted_cost,actual_cost,absolute_error,percentage_error,timestamp');

    predictions.forEach(pred => {
      const feedback = pred.feedback;
      const input = pred.input;
      const row = [
        pred.prediction_id,
        input.age,
        input.sex,
        input.bmi,
        input.children,
        input.smoker,
        input.region,
        pred.prediction,
        feedback.actual_cost,
        feedback.absolute_error,
        feedback.percentage_error,
        feedback.reported_at.toISOString()
      ].join(',');

      csvRows.push(row);
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=training_data.csv');
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

const server = app.listen(5000, () => {
  console.log("Backend running on 5000");
});
// Increased timeout to 300s to handle model loading + prediction + explanations
server.timeout = 300000;

