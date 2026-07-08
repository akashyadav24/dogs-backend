const express = require('express');
const c = require('../controllers/breeds.controller');

const router = express.Router();

router.get('/', c.listBreeds);
router.post('/', c.createBreed);

router.get('/:name', c.getBreed);
router.put('/:name', c.updateBreed);
router.delete('/:name', c.deleteBreed);

router.post('/:name/sub-breeds', c.addSubBreed);
router.put('/:name/sub-breeds/:sub', c.renameSubBreed);
router.delete('/:name/sub-breeds/:sub', c.deleteSubBreed);

module.exports = router;
