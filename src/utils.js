"use strict";

var DIR_SEPARATOR = '--';

function reqToParams(req) {
    return {
        provider: req.params.provider,
        user: req.params.user,
        repo: req.params.repo,
        branch: req.query.branch || 'master',
        dir: req.query.dir || '.'
    };
}

function paramsToTask(params) {
    var url = [params.provider,
        params.user,
        params.repo].join('/');
    var query = [];
    if (params.dir) query.push('dir=' + params.dir);
    if (params.branch) query.push('branch=' + params.branch);

    if (query.length) query = '?' + query.join('&');

    return url + query;
}

function paramsToPath(params) {
    return [
        params.provider,
        params.user,
        params.repo,
        params.dir === '.'
            ? '--'
            : params.dir.replace('/', DIR_SEPARATOR),
        params.branch.replace('/', DIR_SEPARATOR)
    ].join('/');
}

module.exports = {
    reqToParams: reqToParams,
    paramsToTask: paramsToTask,
    paramsToPath: paramsToPath
};