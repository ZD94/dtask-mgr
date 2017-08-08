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
        let stat = await mgr.stat();
        res.send(`<pre>${stat}</pre>`);
    } catch (err) { 
        next(err);
    }
});
export { app };
export default app;