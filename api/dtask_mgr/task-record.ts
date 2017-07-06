import { DB } from "@jingli/database";

export interface RecordOptions { 
    params: string;
    task_desc: any;
    task_id: string;
    task_name: string;
    node: string;
    ip: string;
}

export class PGTaskRecord { 
    constructor(public db: any, public table?: string, public schema?: string) { 
        if (!table) { 
            this.table = 'task_logs'
        }
        if (!schema) { 
            this.schema = 'dtask-mgr';
        }
    }

    async beginTask(options: RecordOptions) :Promise<number> {
        let { task_name, task_desc, task_id, params, node, ip } = options;
        if (typeof params == 'object') {
            params = JSON.stringify(params);
        }
        if (typeof task_desc == 'object') { 
            task_desc = JSON.stringify(task_desc);
        }
        let sql = `insert into "${this.schema}"."${this.table}"(task_name, task_desc, task_id, params, status, node, ip, created_at) `
        sql += `values('${task_name}', '${task_desc}','${task_id}', '${params}', 0, '${node}', '${ip}', now()) returning id;`;
        let ret = await this.db.query(sql);
        if (ret && ret.length) { 
            return ret[0]['id'];
        }
        return 0;
    }

    async finishTask(options: { id: number, status?: number, result: Object | string }) :Promise<any>{ 
        let { id, status, result } = options;
        if (!id) { 
            return;
        }
        if (typeof result == 'object') { 
            result = JSON.stringify(result);
        }
        let sql = `update "${this.schema}"."${this.table}" set status=${status}, result='${result}', finish_at=now() where id = ${id}`;
        return this.db.query(sql);
    }
}

let taskRecord = new PGTaskRecord(DB);
export { taskRecord };
export default taskRecord;

