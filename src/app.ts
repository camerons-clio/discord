// Configure imports
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import lcl from 'cli-color';
import express from 'express';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import favicon from 'serve-favicon';
import bodyParser from 'body-parser';
import cors from 'cors';
import { AddressInfo } from 'net';

import coreAPIRouter from './api/router';

// Express configuration
const app = express();
app.use(compression());
app.use(morgan('dev', {
    skip: (req, res) => {
        switch (req.url) {
            case '/status':
                return true;
            default:
                return false;
        }
    }
}));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

// Configure routes
app.use('/api', coreAPIRouter);
app.use('/static', express.static(path.join(__dirname, 'public')));
app.get('/status', function (req, res) {
    return res.status(200).json({
        status: true,
        message: "ok"
    });
});

// Configure error handling
app.use((req, res, next) => {
    const err = new Error('Page Not Found');
    err['status'] = 404;
    next(err);
});
app.use((err, req, res, next) => {
    return res.status(err.status || 500).json({
        status: false,
        message: err.message
    });
});

// start server
const server = app.listen(Number(process.env.PORT || 3000), () => {
    let { port } = server.address() as AddressInfo;
    console.log(lcl.green("[Express - Info]"), "Started server on port", lcl.cyan(port));
});