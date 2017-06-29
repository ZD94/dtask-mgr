
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
    refreshAt?: number;

    constructor(public id: string, options: {ip: string, concurrency?: number}){
        this.ip = options.ip;
        this.concurrency = options.concurrency || 0;
        this.handle = null;
        this.online = false;
    }

    onconnected(handle: INodeHandle) {
        logger.info(`Node[${this.id}] connected, ip:`, this.ip);
        this.handle = handle;
        this.online = true;
        this.refreshAt = Date.now();
    }

    ondisconnected(){
        logger.warn(`Node[${this.id}] disconnected, ip:`, this.ip);
        this.online = false;
        this.handle = null;
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
}
