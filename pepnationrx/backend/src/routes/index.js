'use strict';

// ============================================================================
// Route table aggregator.
// Mounts every feature router under /api. Phase 2 ships authentication only;
// later phases add intake, subscription, prescription, checkout, patient,
// affiliate, and admin routers here.
// ============================================================================

const express = require('express');
const authRoutes = require('./auth.routes');

const router = express.Router();

// Lightweight liveness probe for the load balancer. No database call so it
// stays green even during a brief database blip.
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'pepnationrx-api' });
});

router.use('/auth', authRoutes);

module.exports = router;
