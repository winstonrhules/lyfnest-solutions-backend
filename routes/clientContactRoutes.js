const express = require("express");
const router = express.Router();
const {createClientContact, getAllClientContacts, calculateEngagementMetrics } = require("../controllers/clientContactController");
// import { calculateEngagementMetrics } from '../controllers/engagementController';
// const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// Route to create a new client contact
router.post("/register-contacts",  createClientContact);
router.get("/get-all-contacts",  getAllClientContacts);
router.get('/engagement', calculateEngagementMetrics);

module.exports = router;