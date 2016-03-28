var _ = require('lodash');
var path = require('path');

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .arguments('<target>')
    .description('Outputs file to stdout')
    .action(function(target, opts) {
      runner = new Cat(target, opts);
    });

  program.parse(process.argv);

  if (!runner) {
    console.error("no target specified");
    process.exit(1);
  }

  runner.run();
}

var Cat = function(target, opts) {
  this.target = target;
  Rest.call(this, opts);
}
_.extend(Cat.prototype, Rest.prototype);

Cat.prototype._run = function(cb) {
  var target = this._parsePath(this.target);
  var cat = this;
  var requestOptions = {
    path: path.join('/api/volumes', encodeURIComponent(target.name), 'file', encodeURI(target.path)),
    method: 'GET'
  };
  this._request(requestOptions, function(err, response) {
    if (err) return cb(err);
    switch(response.statusCode) {
      case 400:
        cb("invalid target for output at "+target.path);
        break;
      case 404:
        cb("cannot find entry for "+target.path);
        break;
      case 200:
        response.pipe(process.stdout);
        response.once('end', function() {
          cb();
        });
        response.once('error', function(err) {
          cb("error:"+String(err));
        });
        break;
      default:
        return cb("unexpected status code:"+response.statusCode);
    }
  });
}
