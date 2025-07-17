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

 const calculateEngagementMetrics = asyncHandler (async (req, res) => {
  try{

    const now = new Date();
  
  // Calculate date ranges
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // Months are 0-indexed in JS, so add 1
  
  // Start of current month (first day)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  // End of current month (last day)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  
  // Start of current week (Sunday)
  const startOfWeek = new Date();
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  // End of current week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  // 30 days ago for new clients
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  // Run all queries in parallel
  const [
    activeClients,
    inactiveClients,
    birthdaysThisWeek,
    birthdaysThisMonth,
    annualReviews,
    overdueFollowUps,
    reviewedThisMonth,
    newClients
  ] = await Promise.all([
    // Active clients
    ClientContact.find({ policyStatus: 'active' }),
    
    // Inactive clients
   ClientContact.find({ 
      policyStatus: { $in: ['inactive', 'lapsed', 'cancelled'] } 
    }),
    
    // Birthdays this week
    ClientContact.aggregate([
      {
        $addFields: {
          bdayThisYear: {
            $dateFromParts: {
              year: currentYear,
              month: { $month: "$Dob" },
              day: { $dayOfMonth: "$Dob" }
            }
          }
        }
      },
      {
        $match: {
          bdayThisYear: {
            $gte: startOfWeek,
            $lte: endOfWeek
          }
        }
      }
    ]),
    
    // Birthdays this month
    ClientContact.find({ 
      $expr: { $eq: [{ $month: "$Dob" }, currentMonth] } 
    }),
    
    // Annual reviews this month
    ClientContact.find({
      annualReviewDate: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    }),
    
    // Overdue follow-ups
    ClientContact.find({
      nextFollowUpAt: { $lt: now },
      policyStatus: 'active'
    }),
    
    // Reviewed this month
   ClientContact.find({
      lastContactedAt: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    }),
    
    // New clients (last 30 days)
   ClientContact.find({
      clientSince: { $gte: thirtyDaysAgo }
    })
  ]);

  res.status(200).json({
    activeClients,
    inactiveClients,
    birthdaysThisWeek,
    birthdaysThisMonth,
    annualReviews,
    overdueFollowUps,
    reviewedThisMonth,
    newClients
  });
  }catch(error){
    res.status(500).json({
      status:"error",
      message:"server error:" + error.message
    })
  }
  
});



module.exports = {
  createClientContact,
  getAllClientContacts,
  calculateEngagementMetrics
};

