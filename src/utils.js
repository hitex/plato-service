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
    paramsToPath: paramsToPath
};