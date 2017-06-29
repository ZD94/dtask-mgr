
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

export class DTaskDesc{
    countMap = new Map<string, number>();
    bannedMap = new Map<string, number>();
    constructor(
        public name: string,
        public type: string,
        public params: TaskParams,
        public concurrenty: number = 0,
        private ban_ip_time: number = 2*60,
    ) {
    }
    getCurrentCountForIp(ip: string): number{
        if (this.isBannedIP(ip))
            return Infinity;
        return this.countMap.get(ip) || 0;
    }
    async run(node: DTaskNode, obj: any): Promise<any>{
        let count = this.countMap.get(node.ip) || 0;
        count++;
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
            let count = this.countMap.get(node.ip) || 0;
            count--;
            if (count > 0)
                this.countMap.set(node.ip, count);
            else if (count == 0)
                this.countMap.delete(node.ip);
        }
    }
    banIpForNode(node: DTaskNode) {
        let banTime = Date.now() + this.ban_ip_time * 60 * 1000;
        this.bannedMap.set(node.ip, banTime);
    }
    isBannedIP(ip: string) {
        let bannedTime = this.bannedMap.get(ip);
        if (!bannedTime) {
            return false;
        }
        let now = Date.now();
        if (now > bannedTime) {
            this.bannedMap.delete(ip);
            return false;
        }
        return true;
    }
}
