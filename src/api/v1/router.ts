import express from 'express';
const router = express.Router();

// Import all of our routes
import exampleRoute from './exampleRoute';

router.get('/', function (req, res) {
    return res.status(200).json({ message: 'Hello World! API V1' });
});

// Add All Routes
router.use('/example', exampleRoute);

export default router;