const express = require('express');
const c = require('../controllers/breeds.controller');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Reads are public: anonymous visitors see the base breed list; authenticated
// users see their own copy. Writes always require a valid token.
router.get('/', optionalAuth, c.listBreeds);
router.post('/', requireAuth, c.createBreed);

router.get('/:name', optionalAuth, c.getBreed);
router.put('/:name', requireAuth, c.updateBreed);
router.delete('/:name', requireAuth, c.deleteBreed);

router.post('/:name/sub-breeds', requireAuth, c.addSubBreed);
router.put('/:name/sub-breeds/:sub', requireAuth, c.renameSubBreed);
router.delete('/:name/sub-breeds/:sub', requireAuth, c.deleteSubBreed);

module.exports = router;
