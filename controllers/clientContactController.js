const asyncHandler = require('express-async-handler');
const ClientContact = require('../models/clientContactModels');
const Appointment = require('../models/appointmentModels');
const mongoose = require('mongoose'); 
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

    // const assignedSlot = new Date(req.body.policyEffectiveDate)
    // const assignedSlot = new Date();

    // const contactWindowStart = new Date(assignedSlot);
    // contactWindowStart.setHours(contactWindowStart.getHours()-1)

    // const contactWindowEnd = new Date(assignedSlot);
    // contactWindowEnd.setHours(contactWindowEnd.getHours()+ 1)

    //  const formData= {
    //     firstName: req.body.firstName,
    //     lastName: req.body.lastName,
    //     email: req.body.Email,
    //     phoneNumber: req.body.phoneNumber,
    //     Dob:req.body.Dob
    //   };

    //   const newAppointment = await Appointment.create({
    //   user: {
    //     firstName: req.body.firstName,
    //     lastName: req.body.lastName,
    //     email: req.body.Email,
    //     phoneNumber: req.body.phoneNumber,
    //     Dob:req.body.Dob
    //   },
    //   formId:new mongoose.Types.ObjectId(),
    //   formData:formData,
    //   assignedSlot: req.body.policyEffectiveDate,     
    //   contactWindowStart:contactWindowStart,
    //   contactWindowEnd:contactWindowEnd,
    //   assignedSlot:assignedSlot,
    //   initialSlot:assignedSlot,
    //   formType: 'contact_list',
    //   policyType: req.body.policyType,
    //   policyEffectiveDate: req.body.policyEffectiveDate,
    //   annualReviewDate: req.body.annualReviewDate,
    //   nextFollowUpAt: req.body.nextFollowUpAt,
    //   lastContactedAt:req.body.lastContactedAt,
    //   isContactList: true,
    //   appointmentType:'policy_review',
    //   clientContactId: newContact._id
    // });


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

// Update a client contact (full update)
const updateClientContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const updateData = req.body;

    // Optionally prevent updates to sensitive fields like _id, createdAt, etc.
    const updatedContact = await ClientContact.findByIdAndUpdate(
      contactId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json(updatedContact);
  } catch (error) {
    console.error("Update contact error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Soft delete – set isActive false and store deactivatedAt
const deactivateClientContact = async (req, res) => {
  try {
    const { contactId } = req.params;

    const deactivatedContact = await ClientContact.findByIdAndUpdate(
      contactId,
      {
        isActive: false,
        deactivatedAt: new Date(),
        // Optional: change policyStatus to "inactive" or leave as is
      },
      { new: true }
    );

    if (!deactivatedContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json({
      message: "Contact deactivated and moved to archive",
      contact: deactivatedContact,
    });
  } catch (error) {
    console.error("Deactivate contact error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all archived contacts (isActive = false)
const getArchivedContacts = async (req, res) => {
  try {
    const archivedContacts = await ClientContact.find({ isActive: false }).sort({ deactivatedAt: -1 });
    res.status(200).json(archivedContacts);
  } catch (error) {
    console.error("Get archived contacts error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Reactivate a contact – set isActive true, clear deactivatedAt, and set policyStatus to 'active'
const reactivateClientContact = async (req, res) => {
  try {
    const { contactId } = req.params;

    const reactivatedContact = await ClientContact.findByIdAndUpdate(
      contactId,
      {
        isActive: true,
        deactivatedAt: null,
        policyStatus: "active", // as per frontend expectation
      },
      { new: true }
    );

    if (!reactivatedContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json({
      message: "Contact reactivated and moved back to contact list",
      contact: reactivatedContact,
    });
  } catch (error) {
    console.error("Reactivate contact error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Permanently delete a contact (hard delete)
const permanentlyDeleteContact = async (req, res) => {
  try {
    const { contactId } = req.params;

    const deletedContact = await ClientContact.findByIdAndDelete(contactId);

    if (!deletedContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.status(200).json({ message: "Contact permanently deleted" });
  } catch (error) {
    console.error("Permanent delete error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

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
  updateClientContact,
  deactivateClientContact,
  getArchivedContacts,
  permanentlyDeleteContact,
  reactivateClientContact,
  calculateEngagementMetrics
};

