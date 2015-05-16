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

    res.send('Submitted! ' + new Date());
});

var server = app.listen(conf.port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Plato Service started at http://%s:%s', host, port);
});
