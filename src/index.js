"use strict";

var defaults = {
    tmp: 'tmp',
    resultDir: 'results',
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
    var url = replace(conf.providers[params.provider].zipUrl, params);

    downloadZip(url, function(buffer){
        extractZip(buffer, function(zipPath){
            var source = params.dir ? path.join(zipPath, params.dir) : zipPath;
            setTimeout(function(){
                runPlato([params.user, params.repo, params.branch].join('_').replace('/', '_'), source);
            },1000); // TODO: Hack to allow successful unzipping
        });
    });
}

function runPlato(name, source) {
    var files = [
        source + '/*'
    ];

    console.log(files);

    var outputDir = './' + conf.resultDir + '/' + name;
    // null options for this example
    var options = {
        title: 'Your title here',
        recurse: true
    };

    var callback = function (report){
        console.log('done!');
    };

    plato.inspect(files, outputDir, options, callback);
}

function extractZip(buffer, cb) {
    var zip = new JSZip(buffer);

    var tmp = path.join(conf.tmp, Date.now().toString());
    mkdirp(tmp, handleProjectDirCreation);

    function handleProjectDirCreation(err) {
        if (err) throw new Error(err);

        Object.keys(zip.files).forEach(function(filename) {
            var entry = zip.files[filename];
            if (entry.options.dir) return;
            var content = entry.asNodeBuffer();
            var dest = path.join(tmp, filename.split('/').slice(1).join('/'));
            mkdirp(path.dirname(dest), function(err) {
                if (err) throw new Error(err);
                fs.writeFileSync(dest, content);
            });
        });

        cb(tmp);
    }
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

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});

function replace(string, params) {
    Object.keys(params).forEach(function(param){
        string = string.replace('{' + param + '}', params[param]);
    });
    return string;
}
