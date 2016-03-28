var _ = require('lodash');
var path = require('path');

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .arguments('<target>')
    .description('Creates a directory at target')
    .action(function(target, opts) {
      runner = new Mkdir(target, opts);
    });

  program.parse(process.argv);

  if (!runner) {
    console.error("must specify target")
    process.exit(1);
  }

  runner.run();
}

var Mkdir = function(target, opts) {
  this.target = target;
  Rest.call(this, opts);
}
_.extend(Mkdir.prototype, Rest.prototype);

Mkdir.prototype._run = function(cb) {
  var target = this._parsePath(this.target);
  var body = {
    type: 'mkdir',
    target: target
  };
  var buffer = new Buffer(JSON.stringify(body), 'utf-8');
  var requestOptions = {
    path: '/api/operations',
    method: 'POST'
  };
  this._requestJSON(requestOptions, buffer, function(err) {
    if (err) return cb(err);
    cb();
  });
}
