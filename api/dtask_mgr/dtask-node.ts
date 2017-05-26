
import { DTaskDesc, RunTaskParams } from './dtask-desc';

export interface INodeHandle{
    runTask(params: RunTaskParams, cb: (err: any, ret: Object)=>void): void;
}

export class DTaskNode{
    ip: string;
    concurrency: number;
    current_task_count = 0;
    handle: INodeHandle|null;
    online: boolean;
    constructor(public id: string, options: {ip: string, concurrency?: number}){
        this.ip = options.ip;
        this.concurrency = options.concurrency || 0;
        this.handle = null;
        this.online = false;
    }
    onconnected(handle: INodeHandle){
        this.handle = handle;
        this.online = true;
    }
    ondisconnected(){
        this.online = false;
        this.handle = null;
    }

    async runTask(task: DTaskDesc, obj: any): Promise<any>{
        this.current_task_count++;
        let ret = await task.run(this, obj);
        this.current_task_count--;
        return ret;
    }
}
