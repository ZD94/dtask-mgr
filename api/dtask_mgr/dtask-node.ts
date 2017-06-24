
import { DTaskDesc, RunTaskParams } from './dtask-desc';

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
    private refreshTimer: any;

    constructor(public id: string, options: {ip: string, concurrency?: number}){
        this.ip = options.ip;
        this.concurrency = options.concurrency || 0;
        this.handle = null;
        this.online = false;
    }

    onconnected(handle: INodeHandle){
        this.handle = handle;
        this.online = true;
        this.refreshAt = Date.now();
        this.refreshTimer = setInterval( ()=> {
            if (!this.refreshAt || this.refreshAt + 60 * 1000 < Date.now()) {
                console.warn(`node-`, this.id,`可能已经掉线`);
                this.ondisconnected();
            }
        }, 30 * 1000);
    }
    
    ondisconnected(){
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
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
