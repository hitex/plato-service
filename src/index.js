"use strict";

var defaults = {
    tmp: 'tmp',
    resultDir: 'results',
	host: 'localhost',
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
var exphbs  = require('express-handlebars');
var app = express();
var conf = require('rc')('platoservice', defaults);
var childProcess = require('child_process');

var utils = require('./utils');

var DataStore = require('nedb');
var db = {
    tasks: new DataStore({ filename: 'tasks.db', autoload: true }),
    projects: new DataStore({ filename: 'projects.db', autoload: true })
};

var worker = childProcess.fork('src/worker.js');
var inProgress = false;
var queue = [];

var Projects = (function(){
    var projects = [];

    db.projects.find({}).exec(function(err, data){
        if (err || !data.length) return;
        data = data.map(function(item){
            return item._id;
        });
        projects = projects.concat(data);
        projects = projects.filter(function (item, pos) {return projects.indexOf(item) == pos});   // deduplicate
    });

    var add = function (params) {
        var project = [params.provider, params.user, params.repo].join('/');
        db.projects.insert({_id:project},function(err){
            if (!err) projects.push(project);
        });
    };

    var getProjects = function () {
        return projects;
    };

    return {
        add: add,
        getProjects: getProjects
    };
})();

var TaskCounter = (function(){
    var taskCount = 0;

    db.tasks.find({}).exec(function(err, data){
        taskCount += data.length;
    });

    return {
        inc: function(){taskCount++},
        getCount: function(){return taskCount}
    };
})();

function runPendingTask(){
    if (queue.length) {
        var task = queue.shift();
        startTask(task);
    }
}

function startTask(task){
    inProgress = true;
    db.tasks.update({ _id: task._id }, { $set: { status: 'processing' } });
    worker.send(task);
}

function startWorker () {
    console.log('Restarting child process');
    worker = childProcess.fork('src/worker.js');
    worker.send({__type:'conf', conf: conf});
    worker.on('message', function (msg) {
        console.log(msg);
        if (msg.__type === 'error') {
            db.tasks.update({ _id: msg.task._id }, { $set: { status: 'error', stack: msg.stack } });
            inProgress = false;
            console.log('Child died horribly...');
            console.log(msg.stack);
            startWorker();
            runPendingTask();

        } else if (msg.__type === 'done') {
            db.tasks.update({ _id: msg.task._id }, { $set: { status: 'done' } });
            inProgress = false;

            Projects.add(msg.task.params);
            console.log('Pending tasks in queue', queue.length);
            runPendingTask();
        }
    });
}

startWorker();

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.get('/', function (req, res) {
    res.redirect('/dashboard');
});

app.get('/dashboard', function (req, res) {
    db.tasks.find({}).sort({ time: -1 }).limit(100).exec(function (err, data) {
        var model = {
            queue: data.filter(function(entry){
                return entry.status === 'pending';
            }).length,
            projectCount: Projects.getProjects().length,
            avgMaintainability: '-',
            taskCount: TaskCounter.getCount(),
            log: data.map(function(entry){
                return {
                    project: entry.params.user + '/' + entry.params.repo,
                    projectUrl: 'https://' + entry.params.provider + '/' + entry.params.user + '/' + entry.params.repo,
                    result: '/results/' + utils.paramsToPath(entry.params),
                    task: '/task/' + utils.paramsToTask(entry.params),
                    branch: entry.params.branch,
                    dir: entry.params.dir,
                    maintainability: '-',
                    date: new Date(entry.time).toLocaleString(),
                    status: entry.status,
                    info: entry.stack,
                    isError: entry.status === 'error'
                }
            })
        };
        res.render('home', model);
    });
});

app.get('/add-project', function (req, res) {
    var model = {
        providers: Object.keys(conf.providers)
    };
    res.render('add-project', model);
});

app.get('/projects', function (req, res) {
    var model = {
        projects: Projects.getProjects()
    };
    res.render('projects', model);
});

app.use('/bower_components', express.static('bower_components'));
app.use('/dist', express.static('bower_components/startbootstrap-sb-admin-2/dist'));

app.use('/results', express.static('results'));
app.use('/web.js', express.static('src/web.js'));

app.get('/task/:provider/:user/:repo', function (req, res) {
    var task = {
        _id: Date.now() * 10000 + Math.round(Math.random()*10000),
        time: Date.now(),
        params: utils.reqToParams(req),
        status: 'new'
    };

    console.log('Request received for', task.params);

    if (!inProgress) {
        console.log('and passed to worker');
        task.status = 'processing';
        startTask(task);
    } else {
        console.log('and added to the queue');
        task.status = 'pending';
        queue.push(task);
    }

    db.tasks.insert(task);
    TaskCounter.inc();

    res.send({
        date: Date.now(),
        queue: queue.length,
        result: '/results/' + utils.paramsToPath(task.params)
    });
});

var server = app.listen(conf.port, conf.host, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Plato Service started at http://%s:%s', host, port);
});
