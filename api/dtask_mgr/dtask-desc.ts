
import uuid = require("uuid");
import { DTaskNode } from './dtask-node';

export interface TaskParams{
    prog: string;
    version?: string;
}

export interface RunTaskParams extends TaskParams{
    id: string;
    type: string;

    input: Object;
}

export interface IPStat{
    running: number;
    banUntil: number;
    lastRun: number;
}

export class DTaskDesc{
    statMap = new Map<string, IPStat>();

    constructor(
        public name: string,
        public type: string,
        public params: TaskParams,
        public concurrency: number = 0,
        private ban_ip_time: number = 2*60,
    ) {
    }
    getIpStat(ip: string): IPStat {
        let stat = this.statMap.get(ip);
        if(!stat){
            stat = {
                running: 0,
                banUntil: 0,
                lastRun: 0,
            }
            this.statMap.set(ip, stat);
        }
        return stat;
    }
    getCurrentCountForIp(ip: string): number{
        let stat = this.getIpStat(ip);
        if (this.isBannedIP(ip))
            return Infinity;
        return stat.running;
    }
    async run(node: DTaskNode, obj: any): Promise<any>{
        let stat = this.getIpStat(node.ip);
        stat.running++;
        stat.lastRun = Date.now();
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
                }, (err, ret) => {
                    if(!err)
                        return resolve(ret);
                    if (err.code == 403)
                        this.banIpForNode(node);
                    reject(err);
                })
            });
            return ret;
        } finally {
            stat.running--;
        }
    }
    banIpForNode(node: DTaskNode) {
        let stat = this.getIpStat(node.ip);
        let banTime = Date.now() + this.ban_ip_time * 60 * 1000;
        stat.banUntil = banTime;
    }
    isBannedIP(ip: string) {
        let stat = this.getIpStat(ip);
        if (Date.now() > stat.banUntil) {
            stat.banUntil = 0;
            return false;
        }
        return true;
    }
}
