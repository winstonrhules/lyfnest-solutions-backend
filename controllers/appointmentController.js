


// const getAppointments = asyncHandler(async (req, res) => {
//   try {
//     const appointments = await Appointment.find().sort({ assignedSlot: 1 });
    
//     const formattedAppointments = await Promise.all(appointments.map(async (app) => {
//       // Default values for user data
//       let userData = {
//         firstName: 'N/A',
//         lastName: 'N/A',  
//         Email: 'N/A',
//         phoneNumber: 'N/A',
//         Dob: null,
//         primaryGoal: 'N/A',
//         coverageType: []
//       };

//       // Fetch form data based on form type
//       switch(app.formType) {
//         case 'mainForm':
//           const mainForm = await Form.findById(app.formId);
//           if (mainForm) {
//             userData = {
//               firstName: mainForm.firstName,
//               lastName: mainForm.lastName,
//               Email: mainForm.Email,
//               phoneNumber: mainForm.phoneNumber,
//               Dob: mainForm.Dob,
//               primaryGoal: mainForm.primaryGoal,
//               coverageType: mainForm.coverageType || []
//             };
//           }
//           break;
          
//         case 'termForm':
//           const termForm = await Tform.findById(app.formId);
//           if (termForm) {
//             userData = {
//               firstName: termForm.firstName,
//               lastName: termForm.lastName,
//               Email: termForm.Email,  // Note: might be different field name
//               phoneNumber: termForm.phoneNumber,
//               Dob: termForm.Dob,
//               primaryGoal: 'Term Life Insurance',
//               preferredTerm: termForm.preferredTerm || 'N/A',
//               coverageType: [termForm.coverageAmount ? `$${termForm.coverageAmount}` : '']
//             };
//           }
//           break;
          
//         case 'wholeForm':
//           const wholeForm = await Wform.findById(app.formId);
//           if (wholeForm) {
//             userData = {
//               firstName: wholeForm.firstName,
//               lastName: wholeForm.lastName,
//               Email: wholeForm.Email,
//               phoneNumber: wholeForm.phoneNumber,
//               Dob: wholeForm.Dob,
//               primaryGoal: 'Whole Life Insurance',
//               preferredTerm: wholeForm.preferredTerm || 'N/A',
//               coverageType: wholeForm.coverage || []
//             };
//           }
//           break;
          
//         case 'indexedForm':
//           const indexedForm = await Iform.findById(app.formId);
//           if (indexedForm) {
//             userData = {
//               firstName:6 indexedForm.firstName,
//               lastName: indexedForm.lastName,
//               Email: indexedForm.Email,
//               phoneNumber: indexedForm.phoneNumber,
//               Dob: indexedForm.Dob,
//               primaryGoal: 'Indexed Universal Life',
//               preferredTerm: indexedForm.preferredTerm || 'N/A',
//               coverageType: indexedForm.coverage || []
//             };
//           }
//           break;
          
//         case 'finalForm':
//           const finalForm = await Fform.findById(app.formId);
//           if (finalForm) {
//             userData = {
//               firstName: finalForm.firstName,
//               lastName: finalForm.lastName,
//               Email: finalForm.Email,
//               phoneNumber: finalForm.phoneNumber,
//               Dob: finalForm.Dob,
//               primaryGoal: 'Final Expense Insurance',
//               monthlyBudget: finalForm.monthlyBudget || 'N/A',
//               coverageType: [finalForm.coverageAmount ? `$${finalForm.coverageAmount}` : '']
//             };
//           }
//           break;
//       }

//       return {
//         id: app._id,
//         formId: app.formId,
//         formType: app.formType,
//         formData: app.formData,
//         contactWindowStart: app.contactWindowStart,
//         contactWindowEnd: app.contactWindowEnd,
//         assignedSlot: app.assignedSlot,
//         status: app.status || 'scheduled',
//         user: {
//           firstName: userData.firstName,
//           lastName: userData.lastName,
//           email: userData.Email,
//           phoneNumber: userData.phoneNumber,
//           dob: userData.Dob
//         },
//         goals: [
//           userData.primaryGoal,
//           ...(userData.coverageType || [])
//         ]
//       };
//     }));

//     res.status(200).json(formattedAppointments);
//   } catch (error) {
//     console.error("Get Appointments Error:", error);
//     res.status(500).json({ error: 'Failed to retrieve appointments' });
//   }
// });



// Update appointment status
// const updateAppointmentStatus = asyncHandler(async (req, res) => {
//   try {
//     const { status } = req.body;
//     const appointment = await Appointment.findById(req.params.id);
    
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }
    
//     appointment.status = status;
//     await appointment.save();
    
//     res.status(200).json({
//       _id: appointment._id,
//       status: appointment.status,
//       formId: appointment.formId
//     });
//   } catch (error) {
//     console.error("Update Appointment Error:", error);
//     res.status(500).json({ error: 'Failed to update appointment' });
//   }

// if (status === 'contacted') {
//   appointment.lastContactDate = new Date();
//   appointment.contactedBy = req.user?.name || 'System'; // use auth session
//   appointment.contactMethod = 'email'; // or 'phone', etc.
// }

// if (status === 'contacted') {
//   appointment.lastContactDate = new Date();
//   appointment.contactedBy = req.user?.name || 'System'; // use auth session
//   appointment.contactMethod = 'email'; // or 'phone', etc.
// }

// if (status === 'contacted') {
//   appointment.lastContactDate = new Date();
//   appointment.contactedBy = req.user?.name || 'System'; // use auth session
//   appointment.contactMethod = 'email'; // or 'phone', etc.
// }

// if (status === 'booked') {
//   appointment.lastContactDate = new Date();
// }
 
 
// });



// const getAppointments = asyncHandler(async (req, res) => {
//   try {
//     const appointments = await Appointment.find().sort({ assignedSlot: 1 }).lean();
    
//     const formattedAppointments = appointments.map(app => {
//       // Extract user data directly from formData
//       const formData = app.formData || {};
//       return {
//         ...app,
//         user: {
//           firstName: formData.firstName || 'N/A',
//           lastName: formData.lastName || 'N/A',
//           email: formData.Email || formData.email || 'N/A',
//           phoneNumber: formData.phoneNumber || 'N/A'
//         },
//         goals: [
//           formData.primaryGoal || 'Insurance Consultation',
//           ...(formData.coverageType || [])
//         ]
//       };
//     });

//     res.status(200).json(formattedAppointments);
//   } catch (error) {
//     console.error("Get Appointments Error:", error);
//     res.status(500).json({ error: 'Failed to retrieve appointments' });
//   }
// });



// const updateAppointmentStatus = asyncHandler(async (req, res) => {
//   try {
//     const { status, zoomMeetingId } = req.body;
//     const appointment = await Appointment.findById(req.params.id);
    
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }

//     // Update status based on workflow
//     if (status === 'contacted') {
//       appointment.status = 'contacted';
//     } 
//     else if (zoomMeetingId) {
//       appointment.status = 'booked';
//       appointment.zoomMeetingId = zoomMeetingId;
//     } 
//     else if (status === 'completed') {
//       appointment.status = 'completed';
//     }

//     await appointment.save();
    
//     res.status(200).json(appointment);
//   } catch (error) {
//     console.error("Update Appointment Error:", error);
//     res.status(500).json({ error: 'Failed to update appointment' });
//   }
// });



// // Reschedule appointment
// const rescheduleAppointment = asyncHandler(async (req, res) => {
//   try {
//     const { newSlot } = req.body;
//     const appointment = await Appointment.findById(req.params.id);
    
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }

//     const  now =new Date();
//     if(new Date(newSlot)< now){
//        return res.status(400).json({ error: 'Can not schedule in the past' });
//     }
    
//     // Validate new slot is within original window
//     if (
//       new Date(newSlot) < appointment.contactWindowStart ||
//       new Date(newSlot) > appointment.contactWindowEnd
//     ) {
//       return res.status(400).json({ error: 'New slot outside contact window' });
//     }
    
//     appointment.assignedSlot = newSlot;
//     await appointment.save();
    
//     // Send notification to admin
//     const form = await Form.findById(appointment.formId);
//     await Notification.create({
//       message: `Appointment rescheduled for ${form.firstName} ${form.lastName} to ${newSlot.toLocaleString()}`,
//       formType: 'appointment',
//       read: false
//     });
    
//     res.status(200).json(appointment);
//   } catch (error) {
//     console.error("Reschedule Error:", error);
//     res.status(500).json({ error: 'Failed to reschedule appointment' });
//   }
// });

// const deleteAppointment = asyncHandler(async (req, res) => {
//   try {
//     const appointment = await Appointment.findByIdAndDelete(req.params.id);
    
//     if (!appointment) {
//       return res.status(404).json({ error: 'Appointment not found' });
//     }
    
//     // Delete the appointment
//     // await appointment.deleteOne({_id:req.params.id});
    
    
//     res.status(200).json({ success: true, message: 'Appointment deleted successfully' });
//   } catch (error) {
//     console.error("Delete Appointment Error:", error);
//     res.status(500).json({ error: 'Failed to delete appointment' });
//   }
// });


// module.exports = {
//   getAppointments,
//   updateAppointmentStatus,
//   rescheduleAppointment,
//   deleteAppointment
// };

const asyncHandler = require('express-async-handler');
const Appointment = require('../models/appointmentModels');
const Form = require('../models/formModels');
const Fform = require('../models/fformModels');
const Iform = require('../models/iformModel');
const Tform = require('../models/tformModels');
const Wform = require('../models/wformModels');


const createAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.create(req.body);

  // Emit new appointment to all connected clients
  req.io.to('appointments').emit('newAppointment', appointment);

  res.status(201).json(appointment);
});

// 🟢 GET ALL    
const getAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find().sort({ assignedSlot: 1 }).lean();

  const formattedAppointments = appointments.map(app => {
    const formData = app.formData || {};
    return {
      ...app,
      user: {
        firstName: formData.firstName || 'N/A',
        lastName: formData.lastName || 'N/A',
        email: formData.Email || formData.email || 'N/A',
        phoneNumber: formData.phoneNumber || 'N/A'
      },
      goals: [
        formData.primaryGoal || 'Insurance Consultation',
        ...(formData.coverageType || [])
      ]
    };
  });

  res.status(200).json(formattedAppointments);
});

// 🟡 UPDATE STATUS
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { status, zoomMeetingId } = req.body;
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  if (status === 'contacted') {
    appointment.status = 'contacted';
    appointment.lastContactDate = new Date();
  } else if (zoomMeetingId) {
    appointment.status = 'booked';
    appointment.zoomMeetingId = zoomMeetingId;
  } else if (status === 'completed') {
    appointment.status = 'completed';
  }

  await appointment.save();

  // Emit update
  // req.app.locals.io.emit('updateAppointment', appointment);
req.io.to('appointments').emit('updateAppointment', appointment);
  res.status(200).json(appointment);
});

// 🟠 RESCHEDULE
const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { newSlot } = req.body;
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  const now = new Date();
  if (new Date(newSlot) < now) {
    return res.status(400).json({ error: 'Cannot schedule in the past' });
  }

  if (
    new Date(newSlot) < appointment.contactWindowStart ||
    new Date(newSlot) > appointment.contactWindowEnd
  ) {
    return res.status(400).json({ error: 'New slot outside contact window' });
  }

  appointment.assignedSlot = newSlot;
  await appointment.save();

  let form;
  try{
    switch(appointment.formType) {
        case 'mainForm':
          const form = await Form.findById(appointment.formId);
          break;
        case 'termForm':
          form = await Tform.findById(appointment.formId);
          break;
        case 'wholeForm':
          form = await Wform.findById(appointment.formId);
          break;
        case 'indexedForm':
          form = await Iform.findById(appointment.formId);
           break;
        case 'finalForm':
          form = await Fform.findById(appointment.formId);
          break;
        default:
          form = null;
    }
  } catch (error) {
    console.error("Error fetching form data:", error);
    return res.status(500).json({ error: 'Failed to fetch form data' });
  }

  await Notification.create({
    message: `Appointment rescheduled for ${form ? `${form.firstName} ${form.lastName}` : 'a user'} to ${newSlot.toLocaleString()}`,
    formType: 'appointment',
    read: false
  });

  // Emit reschedule
  req.io.to('appointments').emit('rescheduleAppointment', appointment);

  res.status(200).json(appointment);
});

// 🔴 DELETE
const deleteAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findByIdAndDelete(req.params.id);

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Emit delete
  req.io.to('appointments').emit('deleteAppointment', req.params.id);
  res.status(200).json({ success: true, message: 'Appointment deleted successfully' });
});

module.exports = {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
  createAppointment
};
