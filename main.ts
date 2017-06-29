
import * as path from 'path';
import Bluebird = require('bluebird');
Bluebird.config({ warnings: false });
global.Promise = Bluebird;

let config = require('@jingli/config');
import API from '@jingli/dnode-api';
import Logger from '@jingli/logger';
Logger.init(config.logger);
let logger = new Logger('dtask');

import * as zone from '@jingli/zone-setup';

import * as forever from 'forever-monitor';

process.on('unhandledRejection', (reason: any, p: PromiseLike<any>) => {
    if (config.debug) {
        throw reason;
    }
    logger.error(reason);
});

if (process.argv[2] == '-d') {
    let child = new (forever.Monitor)(process.argv[1], { args: process.argv.slice(3), });
    child.on('start', function() {
        logger.info('Forever starting child...');
    });
    child.on('restart', function() {
        logger.error('Forever restarting child for', child['times'], 'time');
    });
    child.start();
} else {
    setInterval(() => {
        logger.log('MemoryUsage:', JSON.stringify(process.memoryUsage()));
    }, 5* 60 * 1000)

    zone.forkStackTrace()
        .run(async function(){
            await API.initSql(path.join(__dirname, 'api'), config.api);
            await API.init(path.join(__dirname, 'api'), config.api);
            await API.startServices(config.listen);
            logger.info('API initialized.');
        });
}
