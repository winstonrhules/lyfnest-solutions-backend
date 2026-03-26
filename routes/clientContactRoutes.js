const express = require("express");
const router = express.Router();
// const { protect } = require("../middleware/authMiddleware"); // ADD THIS
const {
  createClientContact,
  getAllClientContacts,
  calculateEngagementMetrics,
  updateClientContact,
  getArchivedContacts,
  deactivateClientContact,
  reactivateClientContact,
  permanentlyDeleteContact
} = require("../controllers/clientContactController");

// Add protect middleware to all routes
router.post("/register-contacts",  createClientContact);
router.get("/get-all-contacts",  getAllClientContacts);
router.get('/engagement',  calculateEngagementMetrics);
router.put("/update-contact/:contactId",  updateClientContact);
router.put("/deactivate-contact/:contactId", deactivateClientContact);
router.get("/archived-contacts",  getArchivedContacts);
router.put("/reactivate-contact/:contactId", reactivateClientContact);
router.delete("/permanent-delete/:contactId", permanentlyDeleteContact);


module.exports = router;