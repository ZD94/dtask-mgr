import mgr from './api/dtask_mgr';

var express = require("express");
const app = express();

app.use(function (req: any, res: any, next: Function) {
    let { key } = req.query;
    if (key == 'Jingli2016') {
        return next();
    }
    res.sendStatus(403);
});

app.get('/nodes', async (req: any, res: any, next: any) => {
    try {
        let nodeMap = await mgr.getNodes();
        let result = {}
        for (let [key, value] of nodeMap) { 
            result[key] = value;
        }
        res.json(result);
    } catch (err) { 
        return next(err);
    }
});
export { app };
export default app;