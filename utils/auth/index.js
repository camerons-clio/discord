const lcl = require('cli-color');

// checks a user's auth header against the env token
export default function(header) {
    try {
        if (!header) throw new Error('No auth header provided');
        const [authType, authToken] = header.split(' ');
        if (authType?.toString().toLowerCase() !== 'basic') throw new Error('Invalid auth type');

        // check auth 
        if (authToken !== process.env.HTTP_AUTH) throw new Error('Invalid auth token');
        return true;
    } catch(err) {
        console.log(`${lcl.redBright('[Auth - Error]')} Failed to authenticate user: ${err['message']}`);
        return false;
    }
}