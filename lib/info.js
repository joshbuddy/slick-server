var _ = require('lodash');
var humanize = require('humanize');
var path = require('path');

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .arguments('<target>')
    .description('Shows info about a file')
    .action(function(target, opts) {
      runner = new Info(target, opts);
    });

  program.parse(process.argv);

  if (!runner) {
    console.error("no target specified");
    process.exit(1);
  }

  runner.run();
}

var Info = function(target, opts) {
  this.target = target;
  Rest.call(this, opts);
}
_.extend(Info.prototype, Rest.prototype);

Info.prototype._run = function(cb) {
  var target = this._parsePath(this.target);
  var urlpath = path.join('/api/volumes', encodeURIComponent(target.name), 'file', encodeURI(target.path));
  var url = this.baseUrl + urlpath;
  var requestOptions = {
    path: urlpath,
    method: 'HEAD'
  };

  this._request(requestOptions, function(err, response) {
    if (err) return cb(err);
    switch(response.statusCode) {
      case 200:
        var base64Representation = response.headers['x-slick-base64']
        var size = response.headers['content-length'];
        var ctime = new Date(parseInt(response.headers['x-created-time']));
        var mtime = new Date(parseInt(response.headers['x-modified-time']));
        var type = response.headers['content-type'];
        var folder = response.headers['content-type'] === 'x-slick/folder';

        console.log(target.name + ':' + target.path);
        console.log('Size       : %s bytes (%s)', size, humanize.filesize(size));
        console.log('Created at : %s', ctime);
        console.log('Modified at: %s', mtime);
        if (folder) {
          console.log('Entries    : %s', response.headers['x-slick-folder-count']);
        } else {
          console.log('Mime-type  : %s', type);
          console.log('URL        : %s', url);
        }
        console.log('Base64     : %s', base64Representation);
        cb();
        break;
      case 404:
        cb("no entry found at"+target.path);
        break;
      default:
        cb("unexpected status code:"+response.statusCode);
    }
  });
}
