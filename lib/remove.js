var fs = require('fs-extra');
var path = require('path');
var _ = require('lodash');

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .arguments('<target>')
    .description('Removes a file or directory')
    .action(function(target, opts) {
      runner = new Remove(target, opts);
    });

  program.parse(process.argv);

  if (!runner) {
    console.error("there was an error running");
    process.exit(1);
  }

  runner.run();
}

var Remove = function(target, opts) {
  this.target = target;
  Rest.call(this, opts);
}
_.extend(Remove.prototype, Rest.prototype);

Remove.prototype._run = function(cb) {
  var target = this._parsePath(this.target);
  var requestOptions = {
    path: path.join('/api/volumes', encodeURIComponent(target.name), 'entries', encodeURI(target.path)),
    method: 'DELETE'
  };

  this._requestJSON(requestOptions, function(err) {
    if (err) return cb(err);
    cb();
  });
}
