

import { DTaskNode, INodeHandle } from './dtask-node';
import { DTaskDesc, TaskParams } from './dtask-desc';

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

let mgr = new DTaskManager();
export default mgr;
