/**
 * Validates if a status transition is allowed
 * @param {string} currentStatus - Current appointment status
 * @param {string} newStatus - Proposed new status
 * @returns {boolean} - Whether the transition is valid
 */
const isValidStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    'scheduled': ['contacted', 'completed', 'missed'],
    'contacted': ['booked', 'completed', 'missed'],
    'booked': ['completed', 'missed'],
    'completed': [], // Terminal state
    'missed': ['booked'] // Can be rebooked if customer shows up late
  };
  
  return validTransitions[currentStatus]?.includes(newStatus) || currentStatus === newStatus;
};

/**
 * Checks if an appointment should be updated based on matching criteria
 * @param {Object} appointment - Database appointment
 * @param {Object} meetingData - Zoom meeting data
 * @returns {Object} - Match result with confidence score
 */
const validateAppointmentMatch = (appointment, meetingData) => {
  let confidence = 0;
  const reasons = [];
  
  // Get appointment user data
  const userData = appointment.formId || appointment.formData || appointment.user || {};
  const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  const email = userData.Email || userData.email || '';
  
  // Extract name from meeting topic
  const topicName = meetingData.topic 
    ? meetingData.topic.replace('Financial Consultation - ', '').trim()
    : '';
  
  // Name matching (highest confidence)
  if (topicName && fullName) {
    if (topicName.toLowerCase() === fullName.toLowerCase()) {
      confidence += 90;
      reasons.push('Exact name match');
    } else if (topicName.toLowerCase().includes(fullName.toLowerCase()) || 
               fullName.toLowerCase().includes(topicName.toLowerCase())) {
      confidence += 70;
      reasons.push('Partial name match');
    }
  }
  
  // Email matching (high confidence)
  if (email && topicName.toLowerCase().includes(email.toLowerCase())) {
    confidence += 80;
    reasons.push('Email match');
  }
  
  // Time proximity matching (medium confidence)
  const appointmentTime = new Date(appointment.assignedSlot);
  const meetingTime = new Date(meetingData.start_time);
  const timeDiff = Math.abs(appointmentTime.getTime() - meetingTime.getTime());
  const oneHour = 60 * 60 * 1000;
  const twoHours = 2 * 60 * 60 * 1000;
  
  if (timeDiff <= oneHour) {
    confidence += 50;
    reasons.push('Within 1 hour of original time');
  } else if (timeDiff <= twoHours) {
    confidence += 30;
    reasons.push('Within 2 hours of original time');
  }
  
  // Status validation (required)
  if (appointment.status !== 'contacted') {
    confidence = 0;
    reasons.push(`Invalid status: ${appointment.status} (must be 'contacted')`);
  }
  
  // Must not have existing zoom meeting (required)
  if (appointment.zoomMeeting) {
    confidence = 0;
    reasons.push('Already has zoom meeting');
  }
  
  return {
    confidence,
    reasons,
    isValid: confidence >= 60, // Require at least 60% confidence
    appointment,
    meetingData
  };
};

/**
 * Finds the best matching appointment for a zoom meeting
 * @param {Array} appointments - Array of contacted appointments
 * @param {Object} meetingData - Zoom meeting data
 * @returns {Object|null} - Best match or null
 */
const findBestAppointmentMatch = (appointments, meetingData) => {
  if (!appointments || appointments.length === 0) {
    return null;
  }
  
  const matches = appointments
    .map(apt => validateAppointmentMatch(apt, meetingData))
    .filter(match => match.isValid)
    .sort((a, b) => b.confidence - a.confidence);
  
  if (matches.length === 0) {
    console.log('❌ No valid matches found for meeting:', meetingData.id);
    return null;
  }
  
  const bestMatch = matches[0];
  console.log(`✅ Best match found with ${bestMatch.confidence}% confidence:`, bestMatch.reasons);
  
  return bestMatch.appointment;
};

/**
 * Validates appointment update data to prevent contamination
 * @param {Object} currentAppointment - Current appointment data
 * @param {Object} updateData - Proposed update data
 * @returns {Object} - Sanitized update data
 */
const sanitizeAppointmentUpdate = (currentAppointment, updateData) => {
  const sanitized = { ...updateData };
  
  // Preserve original assigned slot unless status is changing to booked
  if (updateData.status !== 'booked' && updateData.assignedSlot !== currentAppointment.assignedSlot) {
    console.warn('⚠️ Preserving original assignedSlot, status not booked');
    sanitized.assignedSlot = currentAppointment.assignedSlot;
  }
  
  // Validate status transition
  if (!isValidStatusTransition(currentAppointment.status, updateData.status)) {
    console.warn(`⚠️ Invalid status transition: ${currentAppointment.status} → ${updateData.status}`);
    sanitized.status = currentAppointment.status;
  }
  
  // Always preserve critical fields
  sanitized._id = currentAppointment._id;
  sanitized.formType = currentAppointment.formType;
  sanitized.formId = currentAppointment.formId;
  sanitized.formData = currentAppointment.formData;
  sanitized.createdAt = currentAppointment.createdAt;
  sanitized.initialSlot = currentAppointment.initialSlot;
  
  return sanitized;
};

/**
 * Creates a unique identifier for appointment tracking
 * @param {Object} appointment - Appointment data
 * @returns {string} - Unique identifier
 */
const createAppointmentFingerprint = (appointment) => {
  const userData = appointment.formId || appointment.formData || appointment.user || {};
  const email = userData.Email || userData.email || '';
  const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  const createdAt = new Date(appointment.createdAt).getTime();
  
  return `${email}-${name}-${createdAt}`.toLowerCase().replace(/\s+/g, '-');
};

module.exports = {
  isValidStatusTransition,
  validateAppointmentMatch,
  findBestAppointmentMatch,
  sanitizeAppointmentUpdate,
  createAppointmentFingerprint
};
