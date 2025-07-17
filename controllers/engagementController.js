// import ClientContact from '../models/clientContactModels'

// export const calculateEngagementMetrics = async () => {
//   const now = new Date();
  
//   // Calculate date ranges
//   const thirtyDaysAgo = new Date();
//   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
//   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//   const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
//   const startOfWeek = new Date();
//   startOfWeek.setDate(now.getDate() - now.getDay());
//   const endOfWeek = new Date();
//   endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
  
//   // Helper to format dates for MongoDB queries
//   const formatDateForQuery = (date) => date.toISOString().split('T')[0];
  
//   return {
//     activeClients: await ClientContact.find({ policyStatus: 'active' }),
//     inactiveClients: await ClientContact.find({ 
//       policyStatus: { $in: ['inactive', 'lapsed', 'cancelled'] } 
//     }),
//     birthdaysThisWeek: await ClientContact.find({
//       Dob: {
//         $gte: formatDateForQuery(startOfWeek),
//         $lte: formatDateForQuery(endOfWeek)
//       }
//     }),
//     birthdaysThisMonth: await ClientContact.find({
//       Dob: {
//         $gte: formatDateForQuery(startOfMonth),
//         $lte: formatDateForQuery(endOfMonth)
//       }
//     }),
//     annualReviews: await ClientContact.find({
//       annualReviewDate: {
//         $gte: formatDateForQuery(startOfMonth),
//         $lte: formatDateForQuery(endOfMonth)
//       }
//     }),
//     overdueFollowUps: await ClientContact.find({
//       nextFollowUpAt: { $lt: now },
//       policyStatus: 'active'
//     }),
//     reviewedThisMonth: await ClientContact.find({
//       lastContactedAt: {
//         $gte: formatDateForQuery(startOfMonth),
//         $lte: formatDateForQuery(endOfMonth)
//       }
//     }),
//     newClients: await ClientContact.find({
//       clientSince: { $gte: thirtyDaysAgo }
//     })
//   };
//  };

import ClientContact from '../models/clientContactModels';

// export const calculateEngagementMetrics = async () => {
//   const now = new Date();
  
//   // Calculate date ranges
//   const currentYear = now.getFullYear();
//   const currentMonth = now.getMonth() + 1; // Months are 0-indexed in JS, so add 1
  
//   // Start of current month (first day)
//   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//   startOfMonth.setHours(0, 0, 0, 0);
  
//   // End of current month (last day)
//   const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
//   endOfMonth.setHours(23, 59, 59, 999);
  
//   // Start of current week (Sunday)
//   const startOfWeek = new Date();
//   startOfWeek.setDate(now.getDate() - now.getDay());
//   startOfWeek.setHours(0, 0, 0, 0);
  
//   // End of current week (Saturday)
//   const endOfWeek = new Date(startOfWeek);
//   endOfWeek.setDate(startOfWeek.getDate() + 6);
//   endOfWeek.setHours(23, 59, 59, 999);
  
//   // 30 days ago for new clients
//   const thirtyDaysAgo = new Date();
//   thirtyDaysAgo.setDate(now.getDate() - 30);
//   thirtyDaysAgo.setHours(0, 0, 0, 0);

//   // Run all queries in parallel
//   const [
//     activeClients,
//     inactiveClients,
//     birthdaysThisWeek,
//     birthdaysThisMonth,
//     annualReviews,
//     overdueFollowUps,
//     reviewedThisMonth,
//     newClients
//   ] = await Promise.all([
//     // Active clients
//     ClientContact.find({ policyStatus: 'active' }),
    
//     // Inactive clients
//     ClientContact.find({ 
//       policyStatus: { $in: ['inactive', 'lapsed', 'cancelled'] } 
//     }),
    
//     // Birthdays this week
//     ClientContact.aggregate([
//       {
//         $addFields: {
//           bdayThisYear: {
//             $dateFromParts: {
//               year: currentYear,
//               month: { $month: "$Dob" },
//               day: { $dayOfMonth: "$Dob" }
//             }
//           }
//         }
//       },
//       {
//         $match: {
//           bdayThisYear: {
//             $gte: startOfWeek,
//             $lte: endOfWeek
//           }
//         }
//       }
//     ]),
    
//     // Birthdays this month
//     ClientContact.find({ 
//       $expr: { $eq: [{ $month: "$Dob" }, currentMonth] } 
//     }),
    
//     // Annual reviews this month
//     ClientContact.find({
//       annualReviewDate: {
//         $gte: startOfMonth,
//         $lte: endOfMonth
//       }
//     }),
    
//     // Overdue follow-ups
//     ClientContact.find({
//       nextFollowUpAt: { $lt: now },
//       policyStatus: 'active'
//     }),
    
//     // Reviewed this month
//     ClientContact.find({
//       lastContactedAt: {
//         $gte: startOfMonth,
//         $lte: endOfMonth
//       }
//     }),
    
//     // New clients (last 30 days)
//     ClientContact.find({
//       clientSince: { $gte: thirtyDaysAgo }
//     })
//   ]);

//   return {
//     activeClients,
//     inactiveClients,
//     birthdaysThisWeek,
//     birthdaysThisMonth,
//     annualReviews,
//     overdueFollowUps,
//     reviewedThisMonth,
//     newClients
//   };
// };

