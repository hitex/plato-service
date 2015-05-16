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

var plato = require('plato');
var express = require('express');
var app = express();
var fs = require('fs');
var JSZip = require('jszip');
var path = require('path');
var mkdirp = require('mkdirp');
var request = require('request');
var conf = require('rc')('platoservice', defaults);
var async = require('async');

app.get('/:provider/:user/:repo/:branch?', function (req, res) {
    var params = {
        provider: req.params.provider,
        user: req.params.user,
        repo: req.params.repo,
        branch: req.query.branch || 'master',
        dir: req.query.dir
    };
    run(params);
    res.send('Submitted! ' + new Date());
});

function run(params) {
    var name = params.user + '/' + params.repo + '#' + params.branch;
    console.log('Starting processing %s', name);
    var url = replace(conf.providers[params.provider].zipUrl, params);

    function handleDownloadZip(buffer) {
        extractZip(buffer, handleExtractZip);
    }

    function handleExtractZip(zipPath) {
        var source = params.dir ? path.join(zipPath, params.dir) : zipPath;
        runPlato(
            [params.user, params.repo, params.branch.replace('/', '_')].join('/'),
            source,
            handlePlato
        );
    }

    function handlePlato() {
        console.log('Done processing %s', name);
    }

    downloadZip(url, handleDownloadZip);
}

function downloadZip(url, cb) {
    console.log('Downloading %s', url);

    var data = [], dataLen = 0;

    var res = request(url);

    res.on("data", function (chunk) {
        data.push(chunk);
        dataLen += chunk.length;
    });

    res.on("end", function () {
        var buf = new Buffer(dataLen);
        for (var i=0,len=data.length,pos=0; i<len; i++) {
            data[i].copy(buf, pos);
            pos += data[i].length;
        }

        cb(buf);
    });
}

function extractZip(buffer, cb) {
    var zip = new JSZip(buffer);

    var tmp = path.join(conf.tmp, Date.now().toString());
    mkdirp(tmp, handleProjectDirCreation);

    console.log('Extracting zip to %s', tmp);

    function handleProjectDirCreation(err) {
        if (err) cb(err);

        async.each(Object.keys(zip.files), extractFile, function(err) {
            cb(tmp);
        });
    }

    function extractFile(filename, cb) {
        var entry = zip.files[filename];
        if (entry.options.dir) return cb();
        var content = entry.asNodeBuffer();
        var dest = path.join(tmp, filename.split('/').slice(1).join('/'));
        mkdirp(path.dirname(dest), function(err) {
            if (err) cb(err);
            fs.writeFile(dest, content, cb);
        });
    }
}

function runPlato(name, source, cb) {
    console.log('Running PlatoJS for %s at %s', name, source);

    var files = [
        source + '/*'
    ];

    var outputDir = './' + conf.resultDir + '/' + name;

    var options = {
        title: name,
        recurse: true
    };

    plato.inspect(files, outputDir, options, cb);
}

function replace(string, params) {
    Object.keys(params).forEach(function(param){
        string = string.replace('{' + param + '}', params[param]);
    });
    return string;
}

var server = app.listen(conf.port, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Plato Service started at http://%s:%s', host, port);
});
