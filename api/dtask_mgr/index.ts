

import { DTaskNode, INodeHandle } from './dtask-node';
import { DTaskDesc, TaskParams } from './dtask-desc';

let config = require('@jingli/config');

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
        let node = await this.pickNode(desc);
        console.log("选中的节点:", node);
        if(!node){
            throw new Error('No available node for task: '+params.name);
        }
        return node.runTask(desc, params.input);
    }
    private pickNode(desc: DTaskDesc): DTaskNode|null{
        console.log("总节点数:", this.nodes)
        let nodes = [] as DTaskNode[];
        for(let [_, node] of this.nodes){
            console.log(node)
            if(node.current_task_count == 0) {
                return node;
            }
            if(node.concurrency == 0 || node.current_task_count < node.concurrency){
                nodes.push(node);
            }
        }
        let pickedCount = Number.MAX_SAFE_INTEGER;
        let picked: DTaskNode | null = null;
        for (let node of nodes) {
            let count = desc.countMap.get(node.ip);
            if (typeof count === 'undefined' || count == 0) {
                return node;
            }
            if (count == 0)
                return node;
            if (count < pickedCount) {
                pickedCount = count;
                picked = node;
            }
        }
        return picked;
    }
}

let mgr = new DTaskManager();
export default mgr;

for (let name in config.tasks) {
    let desc = config.tasks[name];

    mgr.registerTask({
        name,
        concurrency: desc.concurrency,
        type: desc.type,
        options: {
            prog: desc.prog,
            version: desc.version,
        }
    });
}
