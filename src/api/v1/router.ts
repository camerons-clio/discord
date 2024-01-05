import express from 'express';
const router = express.Router();

// Import all of our routes
import discordRoute from './discord';

router.get('/', function (req, res) {
    return res.status(200).json({ message: 'Hello World! API V1' });
});

// Add All Routes
router.use('/discord', discordRoute);

export default router;