
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
