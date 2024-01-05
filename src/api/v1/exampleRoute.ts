import express from 'express';
const router = express.Router();

router.get('/', function (req, res) {
    return res.status(200).json({ message: 'Example API Endpoint'});
});

export default router;