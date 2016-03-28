var fs = require('fs-extra');
var path = require('path');
var _ = require('lodash');

var Rest = require('./rest');

module.exports = function() {
  var program = Rest.runner();
  var runner;

  program
    .arguments('<source> <destination>')
    .description('Copies files')
    .option('-f, --force', 'Force moving is something is in the way of destination')
    .action(function(source, destination, opts) {
      runner = new Copy(source, destination, opts);
    });

  program.parse(process.argv);

  if (!runner) {
    console.error("there was an error running");
    process.exit(1);
  }

  runner.run();
}

var Copy = function(source, destination, opts) {
  this.source = source;
  this.destination = destination;
  opts = _.defaults(opts, {
    force: false
  });

  this.force = opts.force;
  Rest.call(this, opts);
}
_.extend(Copy.prototype, Rest.prototype);

Copy.prototype._run = function(cb) {
  var source = this._parsePath(this.source);
  var destination = this._parsePath(this.destination);
  var force = this.force ? true : false;
  var body = {
    type: 'copy',
    force: force,
    source: source,
    destination: destination
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
