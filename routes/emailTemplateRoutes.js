
// const express = require('express');
// const router = express.Router();

// // GET /api/email-templates - Get all templates for user
// router.get('/', async (req, res) => {
//   try {
//     // If you have user authentication, filter by user ID
//     // const userId = req.user.id;
//     // const templates = await EmailTemplate.find({ userId });
    
//     // For now, get all templates or implement your logic
//     const templates = await EmailTemplate.find();
//     res.json(templates);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch templates' });
//   }
// });

// // POST /api/email-templates - Create new template
// router.post('/', async (req, res) => {
//   try {
//     const template = new EmailTemplate({
//       ...req.body,
//       // userId: req.user.id, // if you have authentication
//       createdAt: new Date(),
//       updatedAt: new Date()
//     });
    
//     const savedTemplate = await template.save();
//     res.status(201).json(savedTemplate);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to save template' });
//   }
// });

// // PUT /api/email-templates/:id - Update template
// router.put('/:id', async (req, res) => {
//   try {
//     const template = await EmailTemplate.findByIdAndUpdate(
//       req.params.id,
//       { ...req.body, updatedAt: new Date() },
//       { new: true }
//     );
//     res.json(template);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to update template' });
//   }
// });

// // DELETE /api/email-templates/:id - Delete template
// router.delete('/:id', async (req, res) => {
//   try {
//     await EmailTemplate.findByIdAndDelete(req.params.id);
//     res.status(204).send();
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to delete template' });
//   }
// });

// module.exports = router;  


// routes/emailTemplates.js
// const express = require('express');
// const router = express.Router();
// const EmailTemplate = require('../models/emailTemplateModel');
// // const auth = require('../middleware/auth'); // Your authentication middleware

// // GET all templates for user
// router.get('/',  async (req, res) => {
//   try {
//     const templates = await EmailTemplate.find({ userId: req.user.id })
//       .sort({ updatedAt: -1 });
//     res.json(templates);
//   } catch (error) {
//     console.error('Error fetching templates:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // POST create new template
// router.post('/',  async (req, res) => {
//   try {
//     const { name, subject, body, templateType, design, tags } = req.body;
    
//     const template = new EmailTemplate({
//       userId: req.user.id,
//       name,
//       subject,
//       body,
//       templateType,
//       design,
//       tags
//     });
    
//     await template.save();
//     res.status(201).json(template);
//   } catch (error) {
//     console.error('Error creating template:', error);
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({ message: error.message });
//     }
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // PUT update template
// router.put('/:id',  async (req, res) => {
//   try {
//     const template = await EmailTemplate.findOneAndUpdate(
//       { _id: req.params.id, userId: req.user.id },
//       req.body,
//       { new: true, runValidators: true }
//     );
    
//     if (!template) {
//       return res.status(404).json({ message: 'Template not found' });
//     }
    
//     res.json(template);
//   } catch (error) {
//     console.error('Error updating template:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // DELETE template
// router.delete('/:id',  async (req, res) => {
//   try {
//     const template = await EmailTemplate.findOneAndDelete({
//       _id: req.params.id,
//       userId: req.user.id
//     });
    
//     if (!template) {
//       return res.status(404).json({ message: 'Template not found' });
//     }
    
//     res.json({ message: 'Template deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting template:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();
const EmailTemplate = require('../models/emailTemplateModel');

// GET all templates with proper sorting
router.get('/', async (req, res) => {
  try {
    // ISSUE 2 FIX: Sort by createdAt to maintain chronological order
    const templates = await EmailTemplate.find().sort({ createdAt: 1 });
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST create new template
router.post('/', async (req, res) => {
  try {
    const { name, subject, body, templateType, design, tags } = req.body;
    
    const template = new EmailTemplate({
      name,
      subject,
      body,
      templateType,
      design,
      tags
    });
    
    await template.save();
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT update template
router.put('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ISSUE 3 FIX: Better delete response
// In your emailRoutes2.txt - ensure the delete route looks like this:
router.delete('/:id', async (req, res) => {
  try {
    const template = await EmailTemplate.findByIdAndDelete(req.params.id);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    // Return success message with the deleted template ID
    res.json({ 
      message: 'Template deleted successfully',
      deletedId: req.params.id
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
