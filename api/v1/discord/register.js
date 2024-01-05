const checkAuth = require('../../utils/auth/index.js');

export default async function handler(req, res) {
    try {
        if (!checkAuth(req.headers['authorization'])) {
            let error = new Error('Unauthorized');
            error['statusCode'] = 401;
            throw error;
        }

        return res.status(200).json({
            success: true,
            message: 'Successfully pinged Discord!'
        });
    } catch (err) {
        console.error(`${lcl.redBright('[Vercel - Error]')} ${lcl.yellow(err['statusCode'] || 500)} - ${err['message']}`);
        return res.status(err['statusCode'] || 500).json({
            success: false,
            message: err['message'] || 'Something went wrong... Whooops :3'
        });
    }
}