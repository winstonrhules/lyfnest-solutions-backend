 
// const asyncHandler = require('express-async-handler');
// const ClientContact = require('../models/clientContactModels');


// const createClientContact = asyncHandler(async (req, res) => {
//   try {
//     // Calculate annual review date if not provided
//     if (!req.body.annualReviewDate && req.body.policyEffectiveDate) {
//       const effectiveDate = new Date(req.body.policyEffectiveDate);
//       req.body.annualReviewDate = new Date(
//         effectiveDate.getFullYear() + 1,
//         effectiveDate.getMonth(),
//         effectiveDate.getDate()
//       );
//     }

//     const newContact = await ClientContact.create(req.body);
//     res.status(201).json({
//       status: 'success',
//       data: {
//         contact: newContact
//       }
//     });
//   } catch (err) {
//     res.status(400).json({
//       status: 'fail',
//       message: err.message
//     });
//   }
// });

// // Get all client contacts
// const getAllClientContacts =asyncHandler(async (req, res) => {
//   try {
//     const contacts = await ClientContact.find();
//     res.status(200).json({
//       status: 'success',
//       results: contacts.length,
//       data: {
//         contacts
//               }
//     });
//   } catch (err) {
//     res.status(404).json({
//       status: 'fail',
//       message: err.message
//     });
//   }
// });

// module.exports = {
//   createClientContact,
//   getAllClientContacts,
// }


const asyncHandler = require('express-async-handler');
const ClientContact = require('../models/clientContactModels');

// Create new client contact
const createClientContact = asyncHandler(async (req, res) => {
  try {
    // Calculate annual review date if not provided
    if (!req.body.annualReviewDate && req.body.policyEffectiveDate) {
      const effectiveDate = new Date(req.body.policyEffectiveDate);
      req.body.annualReviewDate = new Date(
        effectiveDate.getFullYear() + 1,
        effectiveDate.getMonth(),
        effectiveDate.getDate()
      );
    }

    const newContact = await ClientContact.create(req.body);
    res.status(201).json(newContact);
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
      errors: error.errors
    });
  }
});

// Get all client contacts
const getAllClientContacts = asyncHandler(async (req, res) => {
  try {
    const contacts = await ClientContact.find().sort('-createdAt');
    res.status(200).json(contacts);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error'
    });
  }
});

module.exports = {
  createClientContact,
  getAllClientContacts
};

