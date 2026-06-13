const express = require('express');
const router = express.Router();
const { getUserHistory, createUser, updateUser, updateUserProfile, getUserProfile, getUserStats, addFamilyMember, getFamilyMembers, removeFamilyMember } = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.post('/family', requireAuth, addFamilyMember);
router.get('/family', requireAuth, getFamilyMembers);
router.delete('/family/:memberId', requireAuth, removeFamilyMember);

router.get('/profile', requireAuth, getUserProfile);

router.get('/:id', getUserHistory);

router.post('/', createUser);

router.put('/profile', requireAuth, updateUserProfile);

router.put('/:id', requireAuth, updateUser);

router.get('/:id/stats', getUserStats);

module.exports = router;
