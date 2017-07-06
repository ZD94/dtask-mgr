--schema=dtask-mgr

CREATE SCHEMA IF NOT EXISTS "dtask-mgr" ;
create table "dtask-mgr"."task_logs" (
    id Serial primary key,
    task_id varchar(50),
    task_name varchar(100),
    task_desc text,
    params text,
    result text,
    created_at timestamp,
    finish_at timestamp,
    node varchar(100),
    ip varchar(100),
    status integer default -1
);