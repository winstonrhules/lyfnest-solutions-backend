// server/utils/templateUtils.js
// Function to replace template variables with actual data
const replaceTemplateVariables = (text, contactData = {}, companySettings = {}) => {
  if (!text) return '';
  
  // Calculate age from birth date
  const calculateAge = (birthDate) => {
    if (!birthDate) return '';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age.toString();
  };

  const variables = {
    // Contact Information
    '{{firstName}}': contactData.firstName || contactData.first_name || '',
    '{{lastName}}': contactData.lastName || contactData.last_name || '',
    '{{fullName}}': `${contactData.firstName || contactData.first_name || ''} ${contactData.lastName || contactData.last_name || ''}`.trim(),
    '{{email}}': contactData.Email || contactData.email || '',
    '{{phone}}': contactData.Phone || contactData.phone || '',
    
    // Policy Information
    '{{policyType}}': contactData.policyType || contactData.policy_type || 'Policy',
    '{{policyNumber}}': contactData.policyNumber || contactData.policy_number || '',
    '{{renewalDate}}': contactData.renewalDate || contactData.renewal_date || '',
    '{{premiumAmount}}': contactData.premiumAmount || contactData.premium_amount || '',
    
    // Dates
    '{{currentDate}}': new Date().toLocaleDateString(),
    '{{currentYear}}': new Date().getFullYear().toString(),
    '{{birthDate}}': contactData.Dob ? new Date(contactData.Dob).toLocaleDateString() : '',
    '{{age}}': contactData.Dob ? calculateAge(contactData.Dob) : '',
    
    // Company Information
    '{{companyName}}': companySettings.companyName || 'Lyfnest Solutions',
    '{{agentName}}': companySettings.agentName || 'Your Insurance Agent',
    '{{agentEmail}}': companySettings.agentEmail || '',
    '{{agentPhone}}': companySettings.agentPhone || '',
    '{{officeAddress}}': companySettings.officeAddress || '',
    
    // Scheduling and Appointments
    '{{appointmentDate}}': contactData.appointmentDate || '',
    '{{appointmentTime}}': contactData.appointmentTime || '',
    '{{schedulingLink}}': companySettings.schedulingLink || 'https://scheduler.zoom.us/nattye-a/discovery-and-guidance-call',
    '{{reviewDueDate}}': contactData.reviewDueDate || ''
  };

  let replacedText = text;
  Object.entries(variables).forEach(([variable, value]) => {
    const regex = new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g');
    replacedText = replacedText.replace(regex, value || '');
  });

  return replacedText;
};

module.exports = { replaceTemplateVariables };