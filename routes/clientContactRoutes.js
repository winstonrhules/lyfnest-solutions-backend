const express = require("express");
const router = express.Router();
// const { protect } = require("../middleware/authMiddleware"); // ADD THIS
const {
  createClientContact,
  getAllClientContacts,
  calculateEngagementMetrics
} = require("../controllers/clientContactController");

// Add protect middleware to all routes
router.post("/register-contacts",  createClientContact);
router.get("/get-all-contacts",  getAllClientContacts);
router.get('/engagement',  calculateEngagementMetrics);

module.exports = router;