
import '@jingli/fs-promisify';
import * as path from 'path';
import * as express from 'express';

import Logger from '@jingli/logger';

import * as zone from '@jingli/zone-setup';

import Bluebird = require('bluebird');
global.Promise = Bluebird;
Bluebird.config({ longStackTraces: false, warnings: false });

let http = require('http');

Logger.init({
    path: path.join(__dirname, "../log"),
    prefix: "mocha_",
    console: false
});
let logger = new Logger('test');

import * as database from '@jingli/database';
database.init('postgres://clear:ste461@localhost:5432/test');

import API from '@jingli/dnode-api';
import {RemoteHostConfig} from '@jingli/dnode-api';

global['API'] = API;

let apiconf = {
    "debug": false,
    "remotes": [] as RemoteHostConfig[],
};

process.on('unhandledRejection', (reason: any, p: Promise<any>) => {
    throw reason;
});

let apipath = path.normalize(path.join(__dirname, '../api'));

zone.forkStackTrace()
    .run(async function(){
        try{
            await API.initSql(apipath, apiconf);
            await API.init(apipath, apiconf);
            await API.loadTests();
            await API.startServices(18088);
            let app = express();
            app.use(Logger.httplog('http.access', 'short'));
            let root_path = path.normalize(path.join(__dirname, 'wwwroot'));
            app.use(express.static(root_path));
            let server = http.createServer(app);
            await new Promise(function(resolve, reject){
                server.on('listening', function(){ resolve(); });
                server.on('error', function(err: any){ reject(err); });
                server.listen(18080);
            });
            run();
        }
        catch(e){
            logger.error(e.stack?e.stack:e);
            console.error(e.stack?e.stack:e);
            process.exit();
        }
    });