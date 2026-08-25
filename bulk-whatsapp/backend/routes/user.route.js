const express = require('express');
const router = express.Router();
const { getStatistics, loginWithLicense, createLicense, renewLicense, getProfile } = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/login-license', loginWithLicense);
router.post('/create-license', createLicense); // Should be protected in prod, but open for now
router.post('/renew-license', protect, renewLicense);
router.get('/statistics', protect ,getStatistics);
router.get('/profile', protect, getProfile);


module.exports = router;
