const express = require("express");
const router = express.Router();
const {createClientContact, getAllClientContacts } = require("../controllers/clientContactController");
// const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");

// Route to create a new client contact
router.post("/register-contacts",  createClientContact);
router.get("/get-all-contacts",  getAllClientContacts);

module.exports = router;