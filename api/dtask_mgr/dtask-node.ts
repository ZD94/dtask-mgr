
import moment = require('moment');
import * as net from 'net';
import { DTaskDesc, RunTaskParams } from './dtask-desc';

import Logger from "@jingli/logger";
var logger = new Logger("dtask-mgr.node");

export interface PingResponse {
    pongAt: number;
}

export interface INodeHandle{
    runTask(params: RunTaskParams, cb: (err: any, ret: Object)=>void): void;
    ping(params: any):PingResponse;
}

export class DTaskNode{
    ip: string;
    concurrency: number;
    current_task_count = 0;
    handle: INodeHandle|null;
    online: boolean;
    sock?: net.Socket;
    refreshAt?: number;

    constructor(public id: string, options: {ip: string, concurrency?: number}){
        this.ip = options.ip;
        this.concurrency = options.concurrency || 0;
        this.handle = null;
        this.online = false;
    }

    onconnected(handle: INodeHandle, sock: net.Socket) {
        logger.info(`Node[${this.id}] connected, ip:`, this.ip);
        this.sock = sock;
        this.handle = handle;
        this.online = true;
        this.refreshAt = Date.now();
    }

    ondisconnected(sock: net.Socket) {
        logger.warn(`Node[${this.id}] disconnected, ip:`, this.ip);
        if (this.sock === sock) {
            this.online = false;
            this.handle = null;
        }
    }

    async runTask(task: DTaskDesc, obj: any): Promise<any>{
        this.current_task_count++;
        try {
            let ret = await task.run(this, obj);
            return ret;

        } finally {
            this.current_task_count--;
        }
    }

    stat(): string {
        let refreshAt = moment(this.refreshAt).format('YYYY/MM/DD HH:mm:ss');
        return `Node ${this.id} ${this.online ? 'online' : 'offline'}@${refreshAt}, IP(${this.ip}: ${this.current_task_count}`;
    }
}
