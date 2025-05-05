const router = require('express').Router();
const conversationsController = require('../controllers/conversations.controller');
const { validateConversation } = require('../middleware/validateInput');

router.post('/', validateConversation, conversationsController.createConversation);
router.get('/:candidate_id', conversationsController.getConversationsByCandidate);

module.exports = router;