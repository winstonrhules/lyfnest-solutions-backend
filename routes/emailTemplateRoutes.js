
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