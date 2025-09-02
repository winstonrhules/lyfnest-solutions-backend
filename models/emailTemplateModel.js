

// export default function EmailTemplateDesigner() {
//   // ... existing state
//   const [savedTemplates, setSavedTemplates] = useState([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [syncStatus, setSyncStatus] = useState('synced'); // 'syncing', 'synced', 'error'

//   // Load templates from backend on component mount
//   useEffect(() => {
//     loadTemplatesFromBackend();
//   }, []);

//   const loadTemplatesFromBackend = async () => {
//     setIsLoading(true);
//     setSyncStatus('syncing');
//     try {
//       const templates = await templateAPI.getTemplates();
//       setSavedTemplates(templates);
//       setSyncStatus('synced');
//     } catch (error) {
//       console.error('Failed to load templates:', error);
//       setSyncStatus('error');
//       // Fallback to localStorage
//       const localTemplates = localStorage.getItem('emailTemplates');
//       if (localTemplates) {
//         setSavedTemplates(JSON.parse(localTemplates));
//       }
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Enhanced save template function
//   const saveTemplate = async () => {
//     if (!emailData.templateName.trim()) {
//       setSnackbarMessage('Please enter a template name');
//       setSnackbarOpen(true);
//       return;
//     }

//     const newTemplate = {
//       name: emailData.templateName,
//       subject: emailData.subject,
//       body: emailData.body,
//       templateType: emailData.template,
//       design: emailData.design,
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString()
//     };

//     setSyncStatus('syncing');
//     try {
//       // Save to backend first
//       const savedTemplate = await templateAPI.saveTemplate(newTemplate);
      
//       // Update local state
//       const updatedTemplates = [...savedTemplates, savedTemplate];
//       setSavedTemplates(updatedTemplates);
      
//       // Also save to localStorage as backup
//       localStorage.setItem('emailTemplates', JSON.stringify(updatedTemplates));
      
//       setSyncStatus('synced');
//       setSnackbarMessage('Template saved successfully and synced!');
//       setSnackbarOpen(true);
//       setSaveTemplateDialogOpen(false);
//       setEmailData(prev => ({ ...prev, templateName: '' }));
//     } catch (error) {
//       setSyncStatus('error');
//       setSnackbarMessage('Failed to sync template. Saved locally only.');
//       setSnackbarOpen(true);
      
//       // Fallback to localStorage only
//       const newTemplateWithId = { ...newTemplate, id: Date.now() };
//       const updatedTemplates = [...savedTemplates, newTemplateWithId];
//       setSavedTemplates(updatedTemplates);
//       localStorage.setItem('emailTemplates', JSON.stringify(updatedTemplates));
//     }
//   };

//   // Enhanced delete template function
//   const deleteTemplate = async (templateId) => {
//     setSyncStatus('syncing');
//     try {
//       await templateAPI.deleteTemplate(templateId);
      
//       const updatedTemplates = savedTemplates.filter(t => t.id !== templateId);
//       setSavedTemplates(updatedTemplates);
//       localStorage.setItem('emailTemplates', JSON.stringify(updatedTemplates));
      
//       setSyncStatus('synced');
//       setSnackbarMessage('Template deleted and synced');
//       setSnackbarOpen(true);
//     } catch (error) {
//       setSyncStatus('error');
//       setSnackbarMessage('Failed to sync deletion. Deleted locally only.');
//       setSnackbarOpen(true);
      
//       // Delete locally anyway
//       const updatedTemplates = savedTemplates.filter(t => t.id !== templateId);
//       setSavedTemplates(updatedTemplates);
//       localStorage.setItem('emailTemplates', JSON.stringify(updatedTemplates));
//     }
//   };

//   // Sync status indicator component
//   const SyncStatusIndicator = () => (
//     <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
//       {syncStatus === 'syncing' && (
//         <>
//           <CircularProgress size={16} sx={{ mr: 1 }} />
//           <Typography variant="caption" color="text.secondary">
//             Syncing templates...
//           </Typography>
//         </>
//       )}
//       {syncStatus === 'synced' && (
//         <>
//           <CheckCircleIcon sx={{ color: 'success.main', fontSize: 16, mr: 1 }} />
//           <Typography variant="caption" color="success.main">
//             Templates synced
//           </Typography>
//         </>
//       )}
//       {syncStatus === 'error' && (
//         <>
//           <ErrorIcon sx={{ color: 'error.main', fontSize: 16, mr: 1 }} />
//           <Typography variant="caption" color="error.main">
//             Sync failed - using local storage
//           </Typography>
//           <Button size="small" onClick={loadTemplatesFromBackend} sx={{ ml: 1 }}>
//             Retry
//           </Button>
//         </>
//       )}
//     </Box>
//   );

//   // Export/Import functionality for manual backup
//   const exportTemplates = () => {
//     const dataStr = JSON.stringify(savedTemplates, null, 2);
//     const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
//     const exportFileDefaultName = `lyfnest-email-templates-${new Date().toISOString().split('T')[0]}.json`;
//     const linkElement = document.createElement('a');
//     linkElement.setAttribute('href', dataUri);
//     linkElement.setAttribute('download', exportFileDefaultName);
//     linkElement.click();
//   };

//   const importTemplates = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = async (e) => {
//         try {
//           const importedTemplates = JSON.parse(e.target.result);
          
//           // Validate the structure
//           if (Array.isArray(importedTemplates)) {
//             setSavedTemplates(prev => [...prev, ...importedTemplates]);
//             localStorage.setItem('emailTemplates', JSON.stringify([...savedTemplates, ...importedTemplates]));
//             setSnackbarMessage(`Imported ${importedTemplates.length} templates`);
//             setSnackbarOpen(true);
//           } else {
//             throw new Error('Invalid file format');
//           }
//         } catch (error) {
//           setSnackbarMessage('Failed to import templates. Please check file format.');
//           setSnackbarOpen(true);
//         }
//       };
//       reader.readAsText(file);
//     }
//   };

//   // Add these to your Settings tab
//   return (
//     <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
//       {/* ... existing JSX */}
      
//       {/* Add this to your Settings TabPanel */}
//       <TabPanel value={activeTab} index={5}>
//         <Typography variant="h6" gutterBottom>
//           Settings
//         </Typography>
        
//         {/* Sync Status */}
//         <Card sx={{ mb: 3 }}>
//           <CardContent>
//             <Typography variant="subtitle1" gutterBottom>
//               Template Sync Status
//             </Typography>
//             <SyncStatusIndicator />
            
//             {/* Export/Import Options */}
//             <Box sx={{ mt: 2 }}>
//               <Typography variant="subtitle2" gutterBottom>
//                 Backup & Restore
//               </Typography>
//               <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
//                 <Button
//                   variant="outlined"
//                   onClick={exportTemplates}
//                   startIcon={<DownloadIcon />}
//                 >
//                   Export Templates
//                 </Button>
//                 <input
//                   accept=".json"
//                   style={{ display: 'none' }}
//                   id="import-templates"
//                   type="file"
//                   onChange={importTemplates}
//                 />
//                 <label htmlFor="import-templates">
//                   <Button
//                     variant="outlined"
//                     component="span"
//                     startIcon={<UploadIcon />}
//                   >
//                     Import Templates
//                   </Button>
//                 </label>
//               </Box>
//               <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
//                 Export your templates as a backup file that you can import on any device or browser.
//               </Typography>
//             </Box>
//           </CardContent>
//         </Card>
        
//         {/* ... rest of existing settings */}
//       </TabPanel>
//     </Box>
//   );
// }

// // Solution 3: Backend API Routes (Node.js/Express example)
// // Add these routes to your backend

// // routes/emailTemplates.js

// // Solution 4: Database Schema (MongoDB/Mongoose example)
// // models/EmailTemplate.js
// const mongoose = require('mongoose');

// const emailTemplateSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   subject: { type: String, required: true },
//   body: { type: String, required: true },
//   templateType: { type: String, default: 'default' },
//   design: { type: String, default: 'default' },
//   userId: { type: String }, // Optional: if you want user-specific templates
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);