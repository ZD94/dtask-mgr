
import * as net from 'net';
import { DTaskNode, INodeHandle } from './dtask-node';
import { DTaskDesc, TaskParams } from './dtask-desc';
import Logger from "@jingli/logger";
var logger = new Logger("dtask-mgr");
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
        let node_ = this.nodes.get(params.id);
        if (!node_){
            node_ = new DTaskNode(params.id, {
                ip: params.ip,
                concurrency: params.concurrency,
            });
            this.nodes.set(node_.id, node_);
        }
        const node = node_;
        node.ip = params.ip;
        node.concurrency = params.concurrency;
        node.onconnected(params.handle);
        let sock = <net.Socket>Zone.current.get('stream');
        sock.on('close', () => {
            node.ondisconnected();
        });
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
        logger.info(`Task: ${params.name}(${desc?JSON.stringify(desc.params):'null'})`);
        logger.info("Task input:", JSON.stringify(params.input));
        let ret;
        try {
            if(!desc){
                throw new Error('Task is not defined: '+params.name);
            }
            let node = await this.pickNode(desc);
            if(!node){
                throw new Error('No available node for task: '+params.name);
            }
            ret = await node.runTask(desc, params.input);
            return ret;

        } catch (e) {
            logger.error('Task exception:', e.stack ? e.stack : e);
            throw e;
        } finally {
            if (ret) {
                logger.info('Task output:', JSON.stringify(ret, null, '  '));
            }
        }
    }

    private async pickNode(desc: DTaskDesc): Promise<DTaskNode|null>{
        // console.log("总节点数:", this.nodes)
        let pickedCount = Number.MAX_SAFE_INTEGER;
        let picked = [] as DTaskNode[];
        if (this.nodes.size > 100) {
            this.cleanNodeMap();
        }
        let onlineNum:number = 0;
        for (let [_, node] of this.nodes) {
            if (!node.online) {
                continue;
            }
            onlineNum++;
            if (node.concurrency != 0 && node.current_task_count >= node.concurrency) {
                continue;
            }
            let count = desc.getCurrentCountForIp(node.ip);
            if (count < pickedCount) {
                pickedCount = count;
                picked = [node];
            } else if (count == pickedCount) {
                picked.push(node);
            }
        }

        if (pickedCount >= desc.concurrenty) {
            pickedCount = Infinity;
            picked = [];
        }
        logger.info(`Nodes: online(${onlineNum}), idle(${picked.length}@${pickedCount})`);
        if(picked.length == 0)
            return null;

        let rand = Math.floor(Math.random() * picked.length);
        return picked[rand];
    }

    private cleanNodeMap() {
        for(let [key, node] of this.nodes) {
            if (!node.online) {
                this.nodes.delete(key);
            }
        }
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
