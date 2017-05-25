
import * as path from 'path';
let config = require('@jingli/config');
import API from '@jingli/dnode-api';
import Logger from '@jingli/logger';
Logger.init(config.logger);
let logger = new Logger('dtask');

import * as zone from '@jingli/zone-setup';

process.on('unhandledRejection', (reason: any, p: PromiseLike<any>) => {
    if (config.debug) {
        throw reason;
    }
    logger.error(reason);
});

zone.forkStackTrace()
    .run(async function(){
        await API.initSql(path.join(__dirname, 'api'), config.api);
        await API.init(path.join(__dirname, 'api'), config.api);
        await API.startServices(config.listen);
        logger.info('API initialized.');
    });

