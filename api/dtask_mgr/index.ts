

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

    //刷新注册的node
    refreshNode(params: {id: string, refreshAt: number}) {
        let node = this.nodes.get(params.id);
        if (!node)
            return;
        node.refreshAt = params.refreshAt;
    }

    async runTask(params: {name: string, input: any}): Promise<any>{
        let desc = this.tasks.get(params.name);
        if(!desc){
            throw new Error('Task is not defined: '+params.name);
        }
        let node = await this.pickNode(desc);
        // console.log("选中的节点:", node);
        if(!node){
            throw new Error('No available node for task: '+params.name);
        }
        return node.runTask(desc, params.input);
    }
    private pickNode(desc: DTaskDesc): DTaskNode|null{
        // console.log("总节点数:", this.nodes)
        let pickedCount = Number.MAX_SAFE_INTEGER;
        let picked = [] as DTaskNode[];
        for (let [_, node] of this.nodes) {
            if (!node.online) {
                continue;
            }
            if (node.concurrency != 0 && node.current_task_count >= node.concurrency) {
                continue;
            }
            let count = desc.countMap.get(node.ip);
            if (typeof count === 'undefined') {
                count = 0;
                desc.countMap.set(node.ip, count);
            }
            if (count < pickedCount) {
                pickedCount = count;
                picked = [node];
            } else if (count == pickedCount) {
                picked.push(node);
            }
        }
        if (pickedCount >= desc.concurrenty)
            return null;
        let rand = Math.floor(Math.random() * picked.length) + 1;
        return picked[rand];
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
