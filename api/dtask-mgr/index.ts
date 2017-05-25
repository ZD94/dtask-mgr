
import uuid = require("uuid");

import {RunTaskParams, TaskParams} from "../dtask-node/index";


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

export class DTaskDesc{
    countMap = new Map<string, number>();
    constructor(public name: string, public type: string, public params: TaskParams, public concurrenty: number = 0){
    }
    async run(node: DTaskNode, obj: any): Promise<any>{
        let count = this.countMap.get(node.id);
        if(typeof count === 'undefined'){
            count = 1;
        }else{
            count++;
        }
        this.countMap.set(node.id, count);
        try{
            let ret = await new Promise<any>((resolve, reject) => {
                if(node.handle === null){
                    throw new Error('Schedule task on disconnected node.');
                }
                node.handle.runTask({
                    id: uuid(),
                    type: this.type,
                    prog: this.params.prog,
                    version: this.params.version,
                    input: obj,
                }, function(err, ret){
                    if(err)
                        reject(err);
                    else
                        resolve(ret);
                })
            });
            return ret;
        } finally {
            count--;
            this.countMap.set(node.id, count);
        }
    }
}

export interface registerNodeParam{
    id: string;
    ip: string;
    concurrency: number;
    handle: INodeHandle;
}
export interface registerTaskParam{
    name: string;
    concurrency: number;
    type: string;
    options: TaskParams;
}

export class DTaskManager {
    private nodes = new Map<string, DTaskNode>();
    private tasks = new Map<string, DTaskDesc>();

    registerNode(params: registerNodeParam){
        let node = this.nodes.get(params.id);
        if(!node){
            node = new DTaskNode(params.id, {
                ip: params.ip,
                concurrency: params.concurrency,
            });
            this.nodes.set(node.id, node);
        }
        node.onconnected(params.handle);
    }
    registerTask(params: registerTaskParam){
        if(this.tasks.has(params.name)) {
            throw new Error('Task name duplication');
        }
        let desc = new DTaskDesc(params.name, params.type, params.options, params.concurrency);
        this.tasks.set(desc.name, desc);
    }
    async runTask(params: {name: string, input: any}): Promise<any>{
        let desc = this.tasks.get(params.name);
        if(!desc){
            throw new Error('Task is not defined: '+params.name);
        }
        let node = this.pickNode(desc);
        if(!node){
            throw new Error('No available node for task: '+params.name);
        }
        return node.runTask(desc, params.input);
    }
    private pickNode(desc: DTaskDesc): DTaskNode|null{
        let nodes = [] as DTaskNode[];
        for(let [_, node] of this.nodes){
            if(node.current_task_count == 0)
                return node;
            if(node.concurrency == 0 || node.current_task_count < node.concurrency){
                nodes.push(node);
            }
        }
        return null;
    }
}

