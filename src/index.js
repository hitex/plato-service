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

var worker = childProcess.fork('src/worker.js');
worker.send({__type:'conf', conf: conf});

var pending = 0;

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
    worker.send(params);

    pending++;

    res.send({
        date: Date.now(),
        queue: pending,
        result: '/results/' + params.provider + '/' + params.user + '/' + params.repo + '/' + params.branch
    });
});

worker.on('message', function(msg){
    if (msg.__type === 'done') {
        pending--;
        console.log('Pending tasks in queue', pending);
    }
});

var server = app.listen(conf.port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Plato Service started at http://%s:%s', host, port);
});
