"use strict";

var plato = require('plato');
var fs = require('fs');
var JSZip = require('jszip');
var path = require('path');
var mkdirp = require('mkdirp');
var request = require('request');
var conf;
var async = require('async');
var rimraf = require('rimraf');

var task;

process.on('message', function (msg) {
    if (msg.__type === 'conf') {
        console.log('conf passed to child');
        conf = msg.conf;
    } else {
        run(msg);
    }
});

function run(newTask) {
    task = newTask;
    var params = task.params;
    var name = params.user + '/' + params.repo + '#' + params.branch;
    console.log('Starting processing %s', name);
    var url = replace(conf.providers[params.provider].zipUrl, params);

    var tmpDir;

    function handleDownloadZip(buffer) {
        extractZip(buffer, handleExtractZip);
    }

    function handleExtractZip(zipPath) {
        tmpDir = zipPath;
        runPlato(
            [params.provider, params.user, params.repo, params.branch.replace('/', '_')].join('/'),
            zipPath,
            params.dir,
            handlePlato
        );
    }

    function handlePlato() {
        console.log('Done processing %s', name);
        process.send({
            __type: 'done',
            task: task
        });

        console.log('Cleaning up', tmpDir);
        rimraf(tmpDir, function(err){
            if (err) return console.log('Failed cleaning up', tmp);
            console.log('Done cleaning up', tmpDir);
        });
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

function runPlato(name, source, dir, cb) {
    console.log('Running PlatoJS for %s at %s', name, source);

    var cwd = process.cwd();
    process.chdir(source);

    var outputDir = path.relative(process.cwd(), cwd) + '/' + conf.resultDir + '/' + name;

    var files = [
        dir ? dir + '/*' : '/*'
    ];

    var options = {
        title: name,
        recurse: true
    };

    plato.inspect(files, outputDir, options, function(){
        process.chdir(cwd);
        cb();
    });
}

function replace(string, params) {
    Object.keys(params).forEach(function(param){
        string = string.replace('{' + param + '}', params[param]);
    });
    return string;
}

process.on('uncaughtException', function(e){
    process.send({
        __type: 'error',
        error: e.toString(),
        stack: e.stack.toString(),
        task: task
    });
    process.exit(1);
})