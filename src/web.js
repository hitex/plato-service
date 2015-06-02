'use strict';

function request(url, cb) {
    var oReq = new XMLHttpRequest();
    oReq.onload = function(){
        cb();
    };
    oReq.open("get", url, true);
    oReq.send();
}

function submitTask(form){
    var params = '?';
    if (form.branch.value) params += 'branch=' + form.branch.value;
    if (form.dir.value) params += 'dir=' + form.dir.value;

    request(
        '/api/task/' + form.provider.value + '/' + form.repo.value + (params.length > 1 ? params : ''),
        function(){
            window.location.href = '/';
        }
    );
}

function repeatTask(url){
    request(url);
}
