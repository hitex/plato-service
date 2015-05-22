"use strict";

var defaults = {
    tmp: 'tmp',
    resultDir: 'results',
    port: 3000,
    providers: {
        'github.com': {
            zipUrl: 'https://github.com/{user}/{repo}/archive/{branch}.zip'
        },
        'bitbucket.com': {
            zipUrl: 'https://bitbucket.org/{user}/{repo}/get/{branch}.zip'
        }
    }
};

var express = require('express');
var app = express();
var conf = require('rc')('platoservice', defaults);
var childProcess = require('child_process');
var low = require('lowdb');

var db = low('db.json');
var worker = childProcess.fork('src/worker.js');
var inProgress = false;
var queue = [];

function runPendingTask(){
    if (queue.length) {
        startTask(queue.shift());
    }
}

function startTask(task){
    inProgress = task;
    worker.send(task);
}

function startWorker () {
    console.log('Restarting child process');
    worker = childProcess.fork('src/worker.js');
    worker.send({__type:'conf', conf: conf});
    worker.on('message', function (msg) {
        if (msg.__type === 'error') {
            db('tasks').push({
                time: Date.now(),
                task: inProgress,
                status: 'error',
                message: msg.error,
                details: msg.stack
            });
            inProgress = false;
            console.log('Child died horribly...');
            console.log(msg.stack);
            startWorker();
            runPendingTask();

        } else if (msg.__type === 'done') {
            db('tasks').push({
                time: Date.now(),
                task: inProgress,
                status: 'success'
            });
            inProgress = false;
            console.log('Pending tasks in queue', queue.length);
            runPendingTask();
        }
    });
}

startWorker();

app.use('/', express.static('www'));

app.use('/results', express.static('results'));

app.get('/:provider/:user/:repo/:branch?', function (req, res) {
    var params = {
        provider: req.params.provider,
        user: req.params.user,
        repo: req.params.repo,
        branch: req.query.branch || 'master',
        dir: req.query.dir
    };

    console.log('Request received for', params);

    if (!inProgress) {
        console.log('and passed to worker');
        startTask(params);
    } else {
        console.log('and added to the queue');
        queue.push(params);
    }

    res.send({
        date: Date.now(),
        queue: queue.length,
        result: '/results/' + params.provider + '/' + params.user + '/' + params.repo + '/' + params.branch
    });
});

var server = app.listen(conf.port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Plato Service started at http://%s:%s', host, port);
});
