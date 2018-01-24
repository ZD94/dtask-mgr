
import * as net from 'net';
import { DTaskNode, INodeHandle } from './dtask-node';
import { DTaskDesc, TaskParams } from './dtask-desc';
import Logger from "@jingli/logger";
var logger = new Logger("dtask-mgr");
var outputLogger = new Logger("output");
let config = require('@jingli/config');
// import taskRecord from './task-record';

export interface registerNodeParam {
    id: string;
    ip: string;
    concurrency: number;
    handle: INodeHandle;
}
export interface registerTaskParam {
    name: string;
    concurrency: number;
    type: string;
    options: TaskParams;
}

export class DTaskManager {
    private nodes = new Map<string, DTaskNode>();
    private tasks = new Map<string, DTaskDesc>();

    getNodes() {
        return this.nodes;
    }

    getTasks() {
        return this.tasks;
    }
    async stat(): Promise<string> {
        let ret = [] as string[];
        ret.push('DTaskMgr status:')
        ret.push('Tasks status:')
        for (let [_, desc] of this.tasks) {
            ret.push(await desc.stat());
        }
        ret.push('Nodes status:')
        for (let [_, node] of this.nodes) {
            ret.push(await node.stat());
        }
        return ret.join('\n');
    }

    async statNumber(): Promise<any> {
        let freeNodes = 0;
        for (let [_, node] of this.nodes) {
            if (node.current_task_count == 0) {
                freeNodes++
            }
        }
        return {
            nodes: this.nodes.size,
            freeNodes
        }
    }

    registerNode(params: registerNodeParam) {
        let node_ = this.nodes.get(params.id);
        if (!node_) {
            node_ = new DTaskNode(params.id, {
                ip: params.ip,
                concurrency: params.concurrency,
            });
            this.nodes.set(node_.id, node_);
        }
        let sock = <net.Socket>Zone.current.get('stream');
        const node = node_;
        node.ip = params.ip;
        node.concurrency = params.concurrency;
        node.onconnected(params.handle, sock);
        sock.on('close', () => {
            node.ondisconnected(sock);
        });
    }

    registerTask(params: registerTaskParam) {
        if (this.tasks.has(params.name)) {
            throw new Error('Task name duplication');
        }
        let desc = new DTaskDesc(params.name, params.type, params.options, params.concurrency);
        this.tasks.set(desc.name, desc);
    }

    //刷新注册的node
    refreshNode(params: { id: string, refreshAt: number }) {
        let node = this.nodes.get(params.id);
        if (!node)
            return;
        node.refreshAt = params.refreshAt;
        return 'ok';
    }

    async runTask(params: { name: string, input: any }): Promise<any> {
        let desc = this.tasks.get(params.name);
        const RETRY_COUNT = 2;
        for (let retry = 0; retry <= RETRY_COUNT; retry++) {
            let prefix = retry > 0 ? 'Retry' : 'Run';
            logger.info(`${prefix} Task: ${params.name}(${desc ? JSON.stringify(desc.params) : 'null'})`);
            logger.info("Task input:", JSON.stringify(params.input));
            let ret;
            // let logId = 0;
            try {
                if (!desc) {
                    throw new Error('Task is not defined: ' + params.name);
                }
                let node = await this.pickNode(desc);
                // try {
                //     logId = await taskRecord.beginTask({
                //         task_name: params.name,
                //         task_desc: desc,
                //         task_id: '',
                //         node: node ? node.id : '',
                //         params: params.input,
                //         ip: node ? node.ip : ''
                //     });
                // } catch (err) {
                //     logger.error(`taskrecord call beginTask error:`, err);
                // }

                if (!node) {
                    throw new Error('No available node for task: ' + params.name);
                }
                ret = await node.runTask(desc, params.input);
                // try {
                //     await taskRecord.finishTask({
                //         id: logId,
                //         status: 1,
                //         result: ret,
                //     })
                // } catch (err) {
                //     logger.error(`taskrecord call finishTask error:`, err);
                // }

                return ret;
            } catch (e) {
                // await taskRecord.finishTask({
                //     id: logId,
                //     status: -1,
                //     result: e.stack,
                // });
                logger.error('Task exception:', e.stack ? e.stack : e);
                if (e.code != 403 || retry == RETRY_COUNT)
                    throw e;
            } finally {
                if (ret) {
                    // logger.info('Task output:', JSON.stringify(ret, null, '  '));
                    outputLogger.info('Task output:', JSON.stringify(ret, null, '  '));
                }
            }
        }
    }

    private async pickNode(desc: DTaskDesc): Promise<DTaskNode | null> {
        // console.log("总节点数:", this.nodes)
        //let pickedCount = Number.MAX_SAFE_INTEGER;
        let picked = [] as DTaskNode[];

        let onlineNum: number = 0;
        for (let [_, node] of this.nodes) {
            if (!node.online) {
                continue;
            }
            onlineNum++;
            if (node.concurrency != 0 && node.current_task_count >= node.concurrency) {
                continue;
            }
            let count = desc.getCurrentCountForIp(node.ip);
            if (count >= desc.concurrency)
                continue;
            picked.push(node);
        }
        // if (pickedCount >= desc.concurrency) {
        //     pickedCount = Infinity;
        //     picked = [];
        // }
        logger.info(`Nodes: online(${onlineNum}), idle(${picked.length})`);
        if (picked.length == 0) {
            logger.info('Node task status:')
            for (let [_, _node] of this.nodes) {
                logger.info('节点：', _node.ip, _node.current_task_count);
            }
            logger.info('IP task status:');
            for (let [ip, stat] of desc.statMap) {
                logger.info('IP：', ip, stat.running, stat.lastRun, stat.banUntil);
            }
            return null;
        }

        picked.sort((a, b) => {
            let sa = desc.getIpStat(a.ip);
            let sb = desc.getIpStat(b.ip);
            let diff = sa.lastRun - sb.lastRun;
            if (diff != 0)
                return diff;
            return sa.running - sb.running;
        });
        let chooseNode = picked[0];
        let stat = desc.getIpStat(chooseNode.ip);
        logger.info(`Choose Node ${chooseNode.id}, ${chooseNode.current_task_count} ${stat.running} ${Date.now() - stat.lastRun}`)
        return chooseNode || null;

        // let rand = Math.floor(Math.random() * picked.length);
        // return picked[rand];
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

setInterval(async () => {
    try {
        logger.log('MemoryUsage:', JSON.stringify(process.memoryUsage()));
        logger.log(await mgr.stat());
    } catch (err) {
        logger.error(err.stack ? err.stack : err);
    }
}, 5 * 60 * 1000);
