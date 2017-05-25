"use strict";

var stdin = [];
process.stdin.on('data', function(data){
    stdin.push(data);
});
process.stdin.on('end', function(){
    var obj = JSON.parse(stdin.join(''));
    obj.message = 'from test task';
    process.stdout.write(JSON.stringify(obj));
});
