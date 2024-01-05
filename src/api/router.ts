import express from 'express';
const router = express.Router();

// API Version Routers
import V1 from './v1/router';

// send to most recent API version by default
router.get('/', function (req, res) {
    return res.redirect(307, '/api/v1/');
});

// import all API versions
router.use('/v1', V1);

export default router;